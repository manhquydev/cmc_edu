// session-injection.ts — Mode B (V3) UAT helper.
//
// Mints signed LMS bearer tokens AND staff session cookies for automated e2e
// flows, replacing the old `x-dev-lms-user`/`x-dev-user` dev-headers.
// Uses the same HMAC-SHA256 signing logic as the production API.
//
// LMS tokens:   apps/api/src/lms-auth/session-token.ts
// Staff cookie: apps/api/src/auth/staff-session.ts
//
// Why: dev-headers only work when NODE_ENV !== 'production' (DEV_AUTH_ENABLED).
// After V2 (ALLOW_DEV_AUTH removed), the only reliable way to authenticate any
// flow in production-mode e2e is a properly-signed token/cookie.
//
// Usage in e2e tests:
//   const token = mintParentToken('pa-123', E2E_LMS_SECRET);
//   const client = createSignedLmsClient(baseUrl, token);
//
//   const cookie = mintStaffCookie({ userId, roles, facilityId }, E2E_STAFF_SECRET);
//   // Pass as Cookie header: `cmc_staff_session=${cookie}`

import { createHmac } from 'node:crypto';

// Dev default must match the API's LMS_SESSION_SECRET_DEV_DEFAULT.
// In CI this is intentional: both sides use the same insecure dev default
// so tokens round-trip. Production deploys override via LMS_SESSION_SECRET.
const DEV_SECRET = 'cmc-lms-dev-only-insecure-default-CHANGE-IN-PROD';

const HEADER_B64 = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'CMC-LMS-1' }),
  'utf8',
).toString('base64url');

function hmacB64(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export interface MintOptions {
  ttlMs?: number;
}

export function mintParentToken(
  parentAccountId: string,
  secret: string = process.env['LMS_SESSION_SECRET'] ?? DEV_SECRET,
  opts: MintOptions = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const ttlMs = opts.ttlMs ?? 60 * 60 * 1000; // 1 hour default for tests
  const payload = Buffer.from(
    JSON.stringify({
      parentAccountId,
      kind: 'parent',
      iat: now,
      exp: now + Math.floor(ttlMs / 1000),
    }),
    'utf8',
  ).toString('base64url');
  const sig = hmacB64(`${HEADER_B64}.${payload}`, secret);
  return `${HEADER_B64}.${payload}.${sig}`;
}

export function mintStudentToken(
  parentAccountId: string,
  studentId: string,
  secret: string = process.env['LMS_SESSION_SECRET'] ?? DEV_SECRET,
  opts: MintOptions = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const ttlMs = opts.ttlMs ?? 60 * 60 * 1000;
  const payload = Buffer.from(
    JSON.stringify({
      parentAccountId,
      studentId,
      kind: 'student',
      iat: now,
      exp: now + Math.floor(ttlMs / 1000),
    }),
    'utf8',
  ).toString('base64url');
  const sig = hmacB64(`${HEADER_B64}.${payload}`, secret);
  return `${HEADER_B64}.${payload}.${sig}`;
}

/**
 * Decodes the claims payload of a signed LMS session token
 * (`header.payload.sig` — same shape signLmsToken produces). Signature is NOT
 * verified — specs only need to read ids the API already vouched for.
 */
export function decodeLmsClaims<T = { parentAccountId: string; kind: string }>(
  sessionToken: string,
): T {
  const payload = sessionToken.split('.')[1];
  if (!payload) {
    throw new Error('Malformed LMS session token: expected header.payload.sig.');
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T;
}

/**
 * Verifies that x-dev-lms-user is IGNORED by the server in production mode.
 * Used by the cutover probe (RT-2) to assert the dev-header backdoor is gone.
 *
 * Returns true if the response status is 401/403 (forged header was ignored),
 * false if the server returned 200 (the header was honoured — security failure).
 */
export async function cutoverProbe(
  baseUrl: string,
  forgedDevLmsUser: Record<string, unknown>,
): Promise<{ passed: boolean; status: number }> {
  // Uses lmsAuth.me — requires a valid LMS session; should return 401 when
  // the forged x-dev-lms-user is stripped.
  const res = await fetch(`${baseUrl}/trpc/lmsAuth.me`, {
    method: 'GET',
    headers: { 'x-dev-lms-user': JSON.stringify(forgedDevLmsUser) },
  });
  return { passed: res.status === 401 || res.status === 403, status: res.status };
}

// ─── Staff Mode-B cookie injection ────────────────────────────────────────────

// Dev default must match the API's STAFF_SESSION_SECRET_DEV_DEFAULT.
const STAFF_DEV_SECRET = 'cmc-staff-dev-only-insecure-default-CHANGE-IN-PROD';

const STAFF_HEADER_B64 = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'CMC-STAFF-1' }),
  'utf8',
).toString('base64url');

export interface StaffClaims {
  userId: string;
  roles: string[];
  facilityId: string;
}

/**
 * Mints a signed staff session cookie value for e2e test injection.
 * This is the Mode-B helper: works in any NODE_ENV, bypasses SSO.
 *
 * Use as the `cmc_staff_session` cookie value in requests:
 *   Cookie: cmc_staff_session=<token>
 */
export function mintStaffCookie(
  claims: StaffClaims,
  secret: string = process.env['STAFF_SESSION_SECRET'] ?? STAFF_DEV_SECRET,
  ttlMs = 60 * 60 * 1000, // 1 hour for tests
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      userId: claims.userId,
      roles: claims.roles,
      facilityId: claims.facilityId,
      iat: now,
      exp: now + Math.floor(ttlMs / 1000),
    }),
    'utf8',
  ).toString('base64url');
  const sig = hmacB64(`${STAFF_HEADER_B64}.${payload}`, secret);
  return `${STAFF_HEADER_B64}.${payload}.${sig}`;
}

