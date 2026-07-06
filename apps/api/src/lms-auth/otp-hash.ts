// OTP hashing (H5/M11 remediation, docs/19 §2). `LoginOtp.codeHash` stores
// `${saltHex}:${sha256HexDigest}` so the plaintext 6-digit code is never
// persisted. sha256 (not a slow KDF like scrypt) is sufficient here: the
// 6-digit code space is small enough that brute-force resistance has to come
// from the rate-limit/lockout in ./router.ts, not from the hash function's
// cost — a slow KDF would only add latency to every legitimate verify without
// meaningfully raising the attacker's cost within the lockout window.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;

/** Hashes a plaintext OTP code into the `${salt}:${digest}` storage format. */
export function hashOtpCode(code: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const digest = createHash('sha256').update(salt + code).digest('hex');
  return `${salt}:${digest}`;
}

/**
 * Constant-time comparison of a candidate plaintext code against a stored
 * `${salt}:${digest}` hash. Returns `false` (never throws) for a malformed
 * stored value, so a corrupt/legacy row fails closed as "wrong code" rather
 * than crashing the verify call.
 */
export function verifyOtpCode(code: string, stored: string): boolean {
  const separatorIndex = stored.indexOf(':');
  if (separatorIndex < 0) return false;
  const salt = stored.slice(0, separatorIndex);
  const digest = stored.slice(separatorIndex + 1);
  if (!salt || !digest) return false;

  const candidateDigest = createHash('sha256').update(salt + code).digest('hex');
  const candidateBuf = Buffer.from(candidateDigest, 'hex');
  const storedBuf = Buffer.from(digest, 'hex');
  if (candidateBuf.length !== storedBuf.length) return false;

  return timingSafeEqual(candidateBuf, storedBuf);
}
