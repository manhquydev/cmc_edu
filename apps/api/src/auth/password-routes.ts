// Staff email/password login — fallback auth while the Entra tenant is
// unavailable (M365 access lost). Mounted UNCONDITIONALLY by server.ts:
//
//   POST /auth/staff-login  {email, password} → set staff cookie
//
// Coexists with sso-routes.ts (mounted only when SSO_ENABLED=true). Both
// paths issue the exact same `cmc_staff_session` cookie via staff-session.ts,
// so everything downstream (context.ts, nginx, admin SPA) stays
// auth-method-agnostic and Entra can be re-enabled with env config alone.
//
// Security invariants (mirrors lms-auth's loginStudent — no-leak):
//   - ONE generic failure message for: unknown email, wrong password, no
//     passwordHash, inactive account, active lockout. No enumeration.
//   - dummy PBKDF2 verify on every path that skips the real verify, so CPU
//     time matches the wrong-password path (timing-based enumeration).
//   - per-account lockout: MAX_STAFF_LOGIN_ATTEMPTS failures → lock.
//   - AppUser is RLS'd by facility and the facility is unknown until the row
//     is found, so the lookup runs under the audited `bypass_rls` escape
//     hatch (ADR 0042) — access is gated by the credential check itself.
//     (nginx additionally rate-limits /auth/ in production.)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createPrismaClient, withFacility, type PrismaClient } from '@cmc/db';
import type { Role as AuthRole } from '@cmc/auth';
import { hashPassword, verifyPassword } from '../lms-auth/password-hash.js';
import {
  buildStaffCookieHeader,
  getStaffSessionSecret,
  signStaffToken,
} from './staff-session.js';

/** Failed attempts allowed before an account locks (same posture as LMS). */
export const MAX_STAFF_LOGIN_ATTEMPTS = 5;

/** Lockout duration after too many failed attempts. */
export const STAFF_LOCKOUT_MINUTES = 15;

/** Generic error for ALL staff login failures (no-leak). */
export const GENERIC_STAFF_LOGIN_FAILURE = 'Invalid credentials.';

/** Login bodies are tiny; anything bigger is not a login request. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Module-level dummy hash to equalise timing when no matching AppUser exists
 * (same pattern as lms-auth's DUMMY_PASSWORD_HASH).
 */
const DUMMY_PASSWORD_HASH = hashPassword('___DUMMY_SENTINEL_DO_NOT_USE___');

// Module-level singleton — avoids opening a new connection pool per login
// (same pattern as sso-routes' getSsoDb).
let _authDb: PrismaClient | undefined;
function getAuthDb(): PrismaClient {
  _authDb ??= createPrismaClient();
  return _authDb;
}

export type StaffPasswordLoginResult =
  | { ok: false }
  | {
      ok: true;
      token: string;
      mustChangePassword: boolean;
    };

/**
 * Core credential check, separated from HTTP plumbing for integration tests.
 * Every failure collapses into `{ok:false}` — the caller must answer with
 * GENERIC_STAFF_LOGIN_FAILURE and nothing else.
 */
export async function attemptStaffPasswordLogin(
  db: PrismaClient,
  emailRaw: string,
  password: string,
): Promise<StaffPasswordLoginResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !password) {
    verifyPassword(password, DUMMY_PASSWORD_HASH);
    return { ok: false };
  }

  return withFacility(
    db,
    null,
    async (tx) => {
      // Case-insensitive match pairs with the partial unique index on
      // lower(email) — at most one row can match. A non-empty input can
      // never match the `email = ''` placeholder rows.
      const user = await tx.appUser.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      const now = new Date();

      if (!user || !user.isActive || !user.passwordHash) {
        verifyPassword(password, DUMMY_PASSWORD_HASH);
        return { ok: false as const };
      }
      if (user.loginLockedUntil && user.loginLockedUntil > now) {
        // Do not reveal lockout state — same generic failure, same CPU cost.
        verifyPassword(password, DUMMY_PASSWORD_HASH);
        return { ok: false as const };
      }

      if (!verifyPassword(password, user.passwordHash)) {
        const attempts = user.loginAttempts + 1;
        const shouldLock = attempts >= MAX_STAFF_LOGIN_ATTEMPTS;
        await tx.appUser.update({
          where: { id: user.id },
          data: {
            loginAttempts: attempts,
            loginLockedUntil: shouldLock
              ? new Date(now.getTime() + STAFF_LOCKOUT_MINUTES * 60_000)
              : null,
          },
        });
        return { ok: false as const };
      }

      await tx.appUser.update({
        where: { id: user.id },
        data: { loginAttempts: 0, loginLockedUntil: null },
      });
      await tx.auditLog.create({
        data: {
          actor: user.userId,
          action: 'auth.staffPasswordLogin',
          entity: 'AppUser',
          entityId: user.id,
        },
      });

      const token = signStaffToken(
        {
          userId: user.userId,
          roles: user.roles as AuthRole[],
          facilityId: user.facilityId,
        },
        getStaffSessionSecret(),
      );
      return { ok: true as const, token, mustChangePassword: user.mustChangePassword };
    },
    { bypass: true },
  );
}

/** Reads and parses a small JSON request body. Throws on oversize/malformed. */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buf.length;
    if (size > MAX_BODY_BYTES) {
      req.destroy();
      throw new Error('Body too large.');
    }
    chunks.push(buf);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Body must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, body: unknown, cookie?: string): void {
  const headers: Record<string, string> = {
    'content-type': 'application/json; charset=utf-8',
  };
  if (cookie) headers['Set-Cookie'] = cookie;
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

/** POST /auth/staff-login — verifies credentials, sets the staff cookie. */
export async function handleStaffPasswordLogin(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: GENERIC_STAFF_LOGIN_FAILURE });
    return;
  }

  const email = typeof body['email'] === 'string' ? body['email'] : '';
  const password = typeof body['password'] === 'string' ? body['password'] : '';

  const result = await attemptStaffPasswordLogin(getAuthDb(), email, password);
  if (!result.ok) {
    sendJson(res, 401, { error: GENERIC_STAFF_LOGIN_FAILURE });
    return;
  }

  const isProd = process.env['NODE_ENV'] === 'production';
  sendJson(
    res,
    200,
    { ok: true, mustChangePassword: result.mustChangePassword },
    buildStaffCookieHeader(result.token, isProd),
  );
}
