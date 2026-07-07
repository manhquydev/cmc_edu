// Password hashing for student direct login (C1/phase-01b).
//
// Uses PBKDF2-SHA256 (built-in node:crypto, no native bindings required).
// argon2 is intentionally excluded — it requires native bindings that
// complicate the build and are not yet in the project's dependency tree.
//
// Brute-force resistance: 100,000 iterations of PBKDF2-SHA256 is the current
// NIST SP 800-132 minimum recommendation for password hashing. Combined with
// a 16-byte random salt per password this defeats pre-computation (rainbow
// tables) and slows offline cracking to ~1ms/attempt on modern hardware.
//
// Rate-limiting for online attacks lives in the loginStudent procedure
// (StudentAccount.loginAttempts / loginLockedUntil), not here.
//
// Storage format: `pbkdf2:<saltHex>:<derivedKeyHex>` — the prefix makes
// future algorithm migrations detectable without a schema column change.

import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 100_000;
const KEYLEN = 32;
const DIGEST = 'sha256';
const SALT_BYTES = 16;

/**
 * Derives a storage-safe hash string from a plaintext password.
 * Every call produces a different output (new random salt).
 */
export function hashPassword(plaintext: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = pbkdf2Sync(plaintext, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `pbkdf2:${salt}:${derived}`;
}

/**
 * Constant-time verification of a plaintext password against a stored hash.
 * Returns `false` (never throws) for a malformed/unknown-algorithm stored
 * value — a corrupt row fails closed as "wrong password".
 */
export function verifyPassword(plaintext: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const [, salt, storedDerived] = parts;
  if (!salt || !storedDerived) return false;

  const candidate = pbkdf2Sync(plaintext, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(storedDerived, 'hex');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
