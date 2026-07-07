import { describe, expect, it } from 'vitest';
import { nextReceiptCode } from './receipt-code.js';

describe('nextReceiptCode', () => {
  it('formats the first code from a zero counter', () => {
    expect(nextReceiptCode(0)).toBe('SO00001');
  });

  it('formats a mid-range counter with zero-padding', () => {
    expect(nextReceiptCode(41)).toBe('SO00042');
  });

  it('formats a counter beyond the padding width without truncation', () => {
    expect(nextReceiptCode(99999)).toBe('SO100000');
  });

  it('rejects non-integer counters', () => {
    expect(() => nextReceiptCode(1.5)).toThrow(RangeError);
  });

  it('rejects negative counters', () => {
    expect(() => nextReceiptCode(-1)).toThrow(RangeError);
  });
});
