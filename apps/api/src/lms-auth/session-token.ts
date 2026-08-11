// LMS session token — RT-1 remediation.
//
// Replaces the unsigned base64url(JSON) placeholder in lms-auth/router.ts
// with an HMAC-SHA256 signed token. No external JWT library — uses Node.js
// built-in `crypto` so the dependency footprint stays zero.
//
// Format: base64url(header).base64url(payload).base64url(sig)
//   header  — {"alg":"HS256","typ":"CMC-LMS-1"}
//   payload — {parentAccountId, studentId?, kind, iat, exp}  (Unix seconds)
//   sig     — HMAC-SHA256(header.payload, LMS_SESSION_SECRET)
//
// Production secret: LMS_SESSION_SECRET env var (boot-check refuses start
// if missing in production — see boot-checks.ts).
// Dev fallback: a hardcoded insecure default so unit tests run without env.
// The boot-check ensures the default NEVER runs in NODE_ENV=production.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface LmsTokenClaims {
  parentAccountId: string;
  studentId?: string;
  kind: 'parent' | 'student';
  /** ParentAccount.tokenVersion at issue time; rejected if account bumps. */
  tokenVersion?: number;
}

/**
 * Insecure dev-only default. Boot-check (`boot-checks.ts`) refuses to start
 * in NODE_ENV=production when this default is in use.
 */
export const LMS_SESSION_SECRET_DEV_DEFAULT =
  'cmc-lms-dev-only-insecure-default-CHANGE-IN-PROD';

const HEADER_B64 = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'CMC-LMS-1' }),
  'utf8',
).toString('base64url');

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hmacB64(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

/**
 * Signs a new LMS session token.
 *
 * @param ttlMs  Token lifetime in milliseconds. Defaults to `LMS_TOKEN_TTL_MS`
 *               env var (for test overrides) or 7 days. Pass explicitly in
 *               tests to produce expired tokens without env manipulation.
 */
export function signLmsToken(
  claims: LmsTokenClaims,
  secret: string,
  ttlMs: number = Number(process.env['LMS_TOKEN_TTL_MS'] ?? DEFAULT_TTL_MS),
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      parentAccountId: claims.parentAccountId,
      ...(claims.studentId !== undefined && { studentId: claims.studentId }),
      kind: claims.kind,
      tv: claims.tokenVersion ?? 0,
      iat: now,
      exp: now + Math.floor(ttlMs / 1000),
    }),
    'utf8',
  ).toString('base64url');

  const sig = hmacB64(`${HEADER_B64}.${payload}`, secret);
  return `${HEADER_B64}.${payload}.${sig}`;
}

/**
 * Verifies a signed LMS token and returns its claims, or `null` on any failure
 * (bad signature, wrong secret, expired, malformed).
 *
 * Signature comparison is constant-time (timingSafeEqual) to prevent
 * timing-oracle attacks.
 */
export function verifyLmsToken(token: string, secret: string): LmsTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];

  // Constant-time signature verification
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

  // Expiry check (Unix seconds)
  const exp = raw['exp'];
  if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) return null;

  const { parentAccountId, studentId, kind, tv } = raw;
  const tokenVersion = typeof tv === 'number' && Number.isInteger(tv) ? tv : 0;
  if (typeof parentAccountId !== 'string') return null;
  if (kind !== 'parent' && kind !== 'student') return null;

  return {
    parentAccountId,
    studentId: typeof studentId === 'string' ? studentId : undefined,
    kind,
    tokenVersion,
  };
}
