// SSO routes — Microsoft Entra authorization-code flow (S2, docs/18).
//
// Routes (mounted at the root by server.ts when SSO_ENABLED=true):
//   GET /auth/login    → redirect to Entra authorize URL
//   GET /auth/callback → exchange code, validate, set staff cookie, redirect to admin
//   GET /auth/logout   → clear staff cookie, redirect to login
//
// Fail-closed on EVERY validation step:
//   - email not matching STAFF_EMAIL_DOMAIN → reject
//   - no AppUser with that email           → reject
//   - AppUser.isActive = false             → reject
//   - auto-provision is NOT performed      → strict allow-list
//
// CSRF protection: login generates a random `state`, signs it with HMAC-SHA256
// (STAFF_SESSION_SECRET), stores the signature in a short-lived HttpOnly cookie
// (`oauth_state`). Callback reads both the URL `state` and the cookie,
// re-derives the expected HMAC, and uses constant-time comparison.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { ConfidentialClientApplication, LogLevel } from '@azure/msal-node';
import type { AuthorizationCodeRequest, AuthorizationUrlRequest } from '@azure/msal-node';
import { createPrismaClient, type PrismaClient } from '@cmc/db';
import type { Role as AuthRole } from '@cmc/auth';
import {
  buildStaffCookieHeader,
  clearStaffCookieHeader,
  getStaffSessionSecret,
  signStaffToken,
} from './staff-session.js';

const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

// Module-level singleton so MSAL's in-memory state/nonce cache persists across
// the login→callback round-trip. A fresh instance per request would discard the
// nonce generated during /auth/login before /auth/callback can validate it,
// silently disabling OAuth CSRF protection.
let _msalClient: ConfidentialClientApplication | undefined;
function getMsalClient(): ConfidentialClientApplication {
  _msalClient ??= new ConfidentialClientApplication({
    auth: {
      clientId: process.env['ENTRA_CLIENT_ID'] ?? '',
      clientSecret: process.env['ENTRA_CLIENT_SECRET'] ?? '',
      authority: `https://login.microsoftonline.com/${process.env['ENTRA_TENANT_ID'] ?? ''}`,
    },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        loggerCallback: () => undefined,
        piiLoggingEnabled: false,
      },
    },
  });
  return _msalClient;
}

function getRedirectUri(): string {
  return process.env['ERP_SSO_REDIRECT_URI'] ?? 'http://localhost:3000/auth/callback';
}

function getAdminOrigin(): string {
  return process.env['ADMIN_APP_ORIGIN'] ?? 'http://localhost:5173';
}

// Module-level singleton — avoids opening a new connection pool per SSO login.
let _ssoDb: PrismaClient | undefined;
function getSsoDb(): PrismaClient {
  _ssoDb ??= createPrismaClient();
  return _ssoDb;
}

function getStaffEmailDomain(): string | null {
  const d = process.env['STAFF_EMAIL_DOMAIN'];
  return d && d.length > 0 ? d.toLowerCase() : null;
}

function sendRedirect(res: ServerResponse, url: string): void {
  res.writeHead(302, { Location: url });
  res.end();
}

function sendError(res: ServerResponse, status: number, msg: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(msg);
}

// OAuth state cookie — short-lived (5 min), HttpOnly, SameSite=Lax.
const OAUTH_STATE_COOKIE = 'oauth_state';
const OAUTH_STATE_TTL_S = 300;

function signOauthState(stateRaw: string): string {
  return createHmac('sha256', getStaffSessionSecret()).update(stateRaw).digest('base64url');
}

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1) || null;
    }
  }
  return null;
}

/** GET /auth/login — initiates Entra authorization-code flow. */
export async function handleSsoLogin(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const stateRaw = randomBytes(16).toString('hex');
    const stateSig = signOauthState(stateRaw);
    const isProd = process.env['NODE_ENV'] === 'production';
    const stateCookieParts = [
      `${OAUTH_STATE_COOKIE}=${stateRaw}.${stateSig}`,
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${OAUTH_STATE_TTL_S}`,
      // Path=/ (not the callback path): the browser returns from Entra to the
      // registered redirect_uri, whose public path can differ from the internal
      // /auth/callback route (e.g. /api/auth/sso/callback fronted by an nginx
      // rewrite). A callback-scoped path would suppress the cookie there and
      // break the CSRF check. The token is short-lived (5 min), HttpOnly, and
      // carries only a random state + its HMAC — no secret.
      'Path=/',
    ];
    if (isProd) stateCookieParts.push('Secure');

    const client = getMsalClient();
    const authCodeUrlParameters: AuthorizationUrlRequest = {
      scopes: SCOPES,
      redirectUri: getRedirectUri(),
      state: stateRaw,
    };
    const url = await client.getAuthCodeUrl(authCodeUrlParameters);
    res.writeHead(302, {
      'Set-Cookie': stateCookieParts.join('; '),
      Location: url,
    });
    res.end();
  } catch {
    sendError(res, 500, 'SSO login initiation failed.');
  }
}

/** GET /auth/callback — exchanges authorization code, sets staff cookie. */
export async function handleSsoCallback(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const rawUrl = req.url ?? '';
  const params = new URL(rawUrl, 'http://localhost').searchParams;
  const code = params.get('code');
  const error = params.get('error');
  const stateParam = params.get('state');

  if (error || !code) {
    sendRedirect(res, `${getAdminOrigin()}/login?error=sso_denied`);
    return;
  }

  // CSRF validation: verify the state cookie matches the URL state param.
  const cookieHeader = req.headers['cookie'];
  const stateCookieValue = parseCookieValue(cookieHeader, OAUTH_STATE_COOKIE);
  if (!stateParam || !stateCookieValue) {
    sendRedirect(res, `${getAdminOrigin()}/login?error=state_missing`);
    return;
  }
  const dotIdx = stateCookieValue.lastIndexOf('.');
  if (dotIdx === -1) {
    sendRedirect(res, `${getAdminOrigin()}/login?error=state_invalid`);
    return;
  }
  const cookieStateRaw = stateCookieValue.slice(0, dotIdx);
  const cookieSig = stateCookieValue.slice(dotIdx + 1);
  const expectedSig = signOauthState(cookieStateRaw);
  const cookieSigBuf = Buffer.from(cookieSig, 'base64url');
  const expectedSigBuf = Buffer.from(expectedSig, 'base64url');
  const sigValid =
    cookieSigBuf.length === expectedSigBuf.length &&
    timingSafeEqual(cookieSigBuf, expectedSigBuf);
  const stateParamBuf = Buffer.from(stateParam, 'utf8');
  const cookieStateRawBuf = Buffer.from(cookieStateRaw, 'utf8');
  const stateMatch =
    stateParamBuf.length === cookieStateRawBuf.length &&
    timingSafeEqual(stateParamBuf, cookieStateRawBuf);
  if (!sigValid || !stateMatch) {
    sendRedirect(res, `${getAdminOrigin()}/login?error=state_mismatch`);
    return;
  }

  try {
    const client = getMsalClient();
    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: SCOPES,
      redirectUri: getRedirectUri(),
    };
    const tokenResponse = await client.acquireTokenByCode(tokenRequest);
    const email = (tokenResponse.account?.username ?? '').toLowerCase();

    if (!email) {
      sendRedirect(res, `${getAdminOrigin()}/login?error=no_email`);
      return;
    }

    // Domain restriction (fail-closed when STAFF_EMAIL_DOMAIN is set).
    const domain = getStaffEmailDomain();
    if (!domain) {
      // eslint-disable-next-line no-console
      console.warn('[sso] STAFF_EMAIL_DOMAIN is unset — all Entra users with an AppUser row can log in regardless of email domain');
    }
    if (domain && !email.endsWith(`@${domain}`)) {
      sendRedirect(res, `${getAdminOrigin()}/login?error=wrong_domain`);
      return;
    }

    // Look up AppUser by email (must exist and be active — no auto-provision).
    const appUser = await getSsoDb().appUser.findFirst({ where: { email } });

    if (!appUser || !appUser.isActive) {
      sendRedirect(res, `${getAdminOrigin()}/login?error=not_authorized`);
      return;
    }

    const isProd = process.env['NODE_ENV'] === 'production';
    const token = signStaffToken(
      {
        userId: appUser.userId,
        roles: appUser.roles as AuthRole[],
        facilityId: appUser.facilityId,
      },
      getStaffSessionSecret(),
    );

    res.writeHead(302, {
      'Set-Cookie': buildStaffCookieHeader(token, isProd),
      Location: getAdminOrigin(),
    });
    res.end();
  } catch {
    sendRedirect(res, `${getAdminOrigin()}/login?error=sso_error`);
  }
}

/** GET /auth/logout — clears staff cookie, redirects to login. */
export function handleSsoLogout(_req: IncomingMessage, res: ServerResponse): void {
  const isProd = process.env['NODE_ENV'] === 'production';
  res.writeHead(302, {
    'Set-Cookie': clearStaffCookieHeader(isProd),
    Location: `${getAdminOrigin()}/login`,
  });
  res.end();
}
