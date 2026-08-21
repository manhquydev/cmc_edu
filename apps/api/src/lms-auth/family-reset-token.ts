// Family password-reset ticket. Separate header typ from CMC-LMS-1 so a
// session token cannot be replayed as a reset ticket (and vice versa).

import { createHmac, timingSafeEqual } from 'node:crypto';

const HEADER_B64 = Buffer.from(
  JSON.stringify({ alg: 'HS256', typ: 'CMC-FAM-RESET-1' }),
  'utf8',
).toString('base64url');

const DEFAULT_TTL_MS = 60 * 60 * 1000;

function hmacB64(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signFamilyResetToken(
  parentAccountId: string,
  tokenVersion: number,
  secret: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      parentAccountId,
      tv: tokenVersion,
      typ: 'family-reset',
      iat: now,
      exp: now + Math.floor(ttlMs / 1000),
    }),
    'utf8',
  ).toString('base64url');
  return `${HEADER_B64}.${payload}.${hmacB64(`${HEADER_B64}.${payload}`, secret)}`;
}

export function verifyFamilyResetToken(
  token: string,
  secret: string,
): { parentAccountId: string; tokenVersion: number } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];
  if (header !== HEADER_B64) return null;

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
  if (raw['typ'] !== 'family-reset') return null;
  const parentAccountId = raw['parentAccountId'];
  const tv = raw['tv'];
  if (typeof parentAccountId !== 'string' || !parentAccountId) return null;
  const tokenVersion = typeof tv === 'number' && Number.isInteger(tv) ? tv : 0;
  return { parentAccountId, tokenVersion };
}
