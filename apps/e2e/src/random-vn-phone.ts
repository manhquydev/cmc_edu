// Generates a unique-enough raw VN mobile number (`0` + 9 digits, the input
// shape `normalizeLoginPhone` — @cmc/domain-identity — accepts) for e2e specs
// that need a fresh `ParentAccount.phone`/`Receipt.parentPhone` per run, so
// concurrent/repeat runs against the shared dev Postgres never collide on the
// global phone-unique constraint.

import { randomInt } from 'node:crypto';

export function randomVnPhone(): string {
  let digits = '9'; // plausible VN mobile prefix, not itself validated
  for (let i = 0; i < 8; i += 1) {
    digits += String(randomInt(0, 10));
  }
  return `0${digits}`;
}
