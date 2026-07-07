import { describe, expect, it } from 'vitest';
import { assertNoPii } from './pii-guard.js';

describe('assertNoPii', () => {
  it('passes for prompts with no PII', () => {
    expect(() => assertNoPii('Học sinh đạt 8/10 bài kiểm tra.')).not.toThrow();
    expect(() => assertNoPii('')).not.toThrow();
    expect(() => assertNoPii('Score: 90, attendance: present')).not.toThrow();
  });

  it('throws for a 0[35789] Vietnamese phone number', () => {
    expect(() => assertNoPii('Liên hệ 0912345678 để biết thêm.')).toThrow(
      'PII_BOUNDARY_VIOLATION: prompt contains phone number pattern',
    );
    expect(() => assertNoPii('SĐT: 0356789012')).toThrow('PII_BOUNDARY_VIOLATION');
    expect(() => assertNoPii('tel:0789012345')).toThrow('PII_BOUNDARY_VIOLATION');
    expect(() => assertNoPii('0523456789')).toThrow('PII_BOUNDARY_VIOLATION');
  });

  it('throws for legacy 01[2689] Vietnamese phone numbers (11 digits)', () => {
    // Old Vietnamese format: 01[2689] + 8 digits = 11 digits total.
    expect(() => assertNoPii('Gọi 01234567890 ngay.')).toThrow('PII_BOUNDARY_VIOLATION');
    expect(() => assertNoPii('số: 01691234567')).toThrow('PII_BOUNDARY_VIOLATION');
    expect(() => assertNoPii('gọi 01867890123 nhé')).toThrow('PII_BOUNDARY_VIOLATION');
    expect(() => assertNoPii('01289012345')).toThrow('PII_BOUNDARY_VIOLATION');
  });

  it('does not throw for 10-digit strings that are not Vietnamese phone patterns', () => {
    // Starts with 01 but not followed by 2, 6, 8, or 9
    expect(() => assertNoPii('0110000000')).not.toThrow();
    // Starts with 04 — not a VN mobile prefix
    expect(() => assertNoPii('0412345678')).not.toThrow();
    // Starts with 02 — landline area code, not matched by mobile patterns
    expect(() => assertNoPii('0212345678')).not.toThrow();
    // 9-digit number — too short to match
    expect(() => assertNoPii('091234567')).not.toThrow();
    // 11-digit number — word boundary prevents match
    expect(() => assertNoPii('09123456789')).not.toThrow();
  });
});
