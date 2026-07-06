// LMS login phone normalization (QD 0033, docs/19 SS2). One credential per
// parent phone, in canonical `84xxxxxxxxx` form — this is deliberately a
// DIFFERENT normalizer from CRM's `normalizeContactPhone` (`+84` form, lives
// with the CRM domain when it exists): login identity and CRM matching are
// two different concerns that must not be conflated (docs/01 SS6.3).

/** Thrown when a raw phone string cannot be normalized to a VN mobile number. */
export class InvalidPhoneError extends Error {
  constructor(raw: string) {
    super(`Invalid Vietnamese phone number for login: "${raw}"`);
    this.name = 'InvalidPhoneError';
  }
}

const NON_DIGITS = /\D/g;

/**
 * Normalizes a raw phone string (`0912345678`, `+84912345678`,
 * `84912345678`, with optional spaces/dashes) to the canonical login form
 * `84xxxxxxxxx` (QD 0033). Throws `InvalidPhoneError` when the input does not
 * resolve to a 9-digit VN mobile subscriber number.
 */
export function normalizeLoginPhone(raw: string): string {
  const digits = raw.replace(NON_DIGITS, '');

  let nationalNumber: string;
  if (digits.startsWith('84')) {
    nationalNumber = digits.slice(2);
  } else if (digits.startsWith('0')) {
    nationalNumber = digits.slice(1);
  } else {
    nationalNumber = digits;
  }

  if (!/^\d{9}$/.test(nationalNumber)) {
    throw new InvalidPhoneError(raw);
  }

  return `84${nationalNumber}`;
}
