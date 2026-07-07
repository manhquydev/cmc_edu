// PII boundary guard for LLM prompts.
//
// Enforces TL13 §5: no Vietnamese phone numbers may reach the vendor API.
// Patterns cover the current VNPT/Viettel/Vietnamobile numbering plan.

const PHONE_PATTERNS: RegExp[] = [
  /\b(0[35789]\d{8})\b/,
  /\b(01[2689]\d{8})\b/,
];

/**
 * Throws `Error('PII_BOUNDARY_VIOLATION: ...')` if `prompt` contains a
 * Vietnamese phone number. Call this before any provider invocation.
 */
export function assertNoPii(prompt: string): void {
  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(prompt)) {
      throw new Error(
        'PII_BOUNDARY_VIOLATION: prompt contains phone number pattern',
      );
    }
  }
}
