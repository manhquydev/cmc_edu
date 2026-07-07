// Staff session cookie — S2: Entra SSO.
//
// HttpOnly signed cookie for staff ERP sessions. Mirrors the HMAC-SHA256
// signing pattern of lms-auth/session-token.ts but uses a SEPARATE secret
// (STAFF_SESSION_SECRET) so LMS and staff tokens cannot cross-verify.
//
// Format: base64url(header).base64url(payload).base64url(sig)
//   header  — {"alg":"HS256","typ":"CMC-STAFF-1"}
//   payload — {userId, roles, facilityId, iat, exp}  (Unix seconds)
//   sig     — HMAC-SHA256(header.payload, STAFF_SESSION_SECRET)
//
// Cookie name: cmc_staff_session
// Cookie flags: HttpOnly; Secure (prod); SameSite=Lax; Max-Age=~8h

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Role as AuthRole } from '@cmc/auth';

export interface StaffSessionClaims {
  userId: string;
  roles: AuthRole[];
  facilityId: string;
}

/** Cookie name used by both server (set-cookie) and client (credentials: 'include'). */
export const STAFF_COOKIE_NAME = 'cmc_staff_session';

/** 8 hours in seconds — staff session lifetime per login. */
export const STAFF_SESSION_TTL_S = 8 * 60 * 60;

/**
 * Insecure dev-only default. Boot-check refuses to start in NODE_ENV=production
 * when this value is detected (mirrors LMS_SESSION_SECRET_DEV_DEFAULT guard).
 */
export const STAFF_SESSION_SECRET_DEV_DEFAULT =
  'cmc-staff-dev-only-insecure-default-CHANGE-IN-PROD';

const HEADER_B64 = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'CMC-STAFF-1' }),
  'utf8',
).toString('base64url');

function hmacB64(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function getStaffSessionSecret(): string {
  return process.env['STAFF_SESSION_SECRET'] ?? STAFF_SESSION_SECRET_DEV_DEFAULT;
}

/** Signs a staff session cookie value. Returns the raw token string. */
export function signStaffToken(claims: StaffSessionClaims, secret: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      userId: claims.userId,
      roles: claims.roles,
      facilityId: claims.facilityId,
      iat: now,
      exp: now + STAFF_SESSION_TTL_S,
    }),
    'utf8',
  ).toString('base64url');
  const sig = hmacB64(`${HEADER_B64}.${payload}`, secret);
  return `${HEADER_B64}.${payload}.${sig}`;
}

/**
 * Verifies a staff session cookie value. Returns claims or null on any failure
 * (bad signature, expired, malformed). Constant-time signature comparison.
 */
export function verifyStaffToken(token: string, secret: string): StaffSessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];

  const expected = hmacB64(`${header}.${payload}`, secret);
  const sigBuf = Buffer.from(sig, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }

  const exp = raw['exp'];
  if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) return null;

  const { userId, roles, facilityId } = raw;
  if (typeof userId !== 'string' || !Array.isArray(roles) || typeof facilityId !== 'string') {
    return null;
  }

  return {
    userId,
    roles: roles as AuthRole[],
    facilityId,
  };
}

/** Builds a Set-Cookie header value for the staff session. */
export function buildStaffCookieHeader(token: string, isProd: boolean): string {
  const parts = [
    `${STAFF_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${STAFF_SESSION_TTL_S}`,
    'Path=/',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

/** Builds a Set-Cookie header value that clears the staff session. */
export function clearStaffCookieHeader(isProd: boolean): string {
  const parts = [
    `${STAFF_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Path=/',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

/** Parses the staff session cookie from a raw Cookie header string. */
export function parseStaffCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${STAFF_COOKIE_NAME}=`)) {
      return trimmed.slice(STAFF_COOKIE_NAME.length + 1) || null;
    }
  }
  return null;
}
