import { describe, expect, it } from 'vitest';
import { nextReceiptCode } from './receipt-code.js';

describe('nextReceiptCode', () => {
  it('formats the first code from a zero counter', () => {
    expect(nextReceiptCode(0)).toBe('PT-000001');
  });

  it('formats a mid-range counter with zero-padding', () => {
    expect(nextReceiptCode(41)).toBe('PT-000042');
  });

  it('formats a counter beyond the padding width without truncation', () => {
    expect(nextReceiptCode(999999)).toBe('PT-1000000');
  });

  it('rejects non-integer counters', () => {
    expect(() => nextReceiptCode(1.5)).toThrow(RangeError);
  });

  it('rejects negative counters', () => {
    expect(() => nextReceiptCode(-1)).toThrow(RangeError);
  });
});
