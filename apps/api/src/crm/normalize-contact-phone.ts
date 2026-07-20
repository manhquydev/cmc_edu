// CRM contact-phone normalization (F8 / phase-08). Deliberately SEPARATE from
// `@cmc/domain-identity`'s `normalizeLoginPhone` (login identity vs. CRM
// matching are different concerns — docs/01 SS6.3), but they share the same
// digit-cleaning rules and, by design here, the same canonical OUTPUT form
// `84xxxxxxxxx`.
//
// Output-form note: the original forward-reference comment in
// `normalize-login-phone.ts` sketched a `+84` display form for CRM. This
// implementation uses the bare `84xxxxxxxxx` form instead, on purpose:
//  - it matches how `ParentAccount.phone` is already stored (the "phone
//    identifies the household" rule this dedup relies on),
//  - it lets phase-05 walk-in link a Contact to a receipt's login-normalized
//    parentPhone by plain equality, and
//  - it keeps the digit-substring search (phase-03) working without stripping a
//    leading '+'.
// The '+84' is a pure display concern and can be formatted at render time.
//
// Unlike the login normalizer this is LENIENT — it never throws. CRM must not
// reject a lead over phone formatting; a number that isn't a well-formed VN
// mobile still normalizes deterministically (to its cleaned digits) so the
// unique index still dedups identical inputs.

const NON_DIGITS = /\D/g;

/**
 * Normalizes a raw phone (`0912345678`, `+84 912-345-678`, `84912345678`) to
 * the canonical CRM form `84xxxxxxxxx`. A string that does not resolve to a
 * 9-digit VN national number is returned as its cleaned digits (best-effort,
 * no throw).
 */
export function normalizeContactPhone(raw: string): string {
  const digits = raw.replace(NON_DIGITS, '');

  let national: string;
  if (digits.startsWith('84')) national = digits.slice(2);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;

  if (/^\d{9}$/.test(national)) return `84${national}`;
  return digits;
}

/**
 * Maps a (possibly partial) search term to the digit form used for a `contains`
 * match against a stored, normalized `84xxxxxxxxx` phone. A leading `0` becomes
 * `84` so "0912" matches "84912345678"; already-84-prefixed or bare partials
 * pass through. Non-digits are stripped.
 */
export function toContactPhoneSearchDigits(term: string): string {
  const digits = term.replace(NON_DIGITS, '');
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}
