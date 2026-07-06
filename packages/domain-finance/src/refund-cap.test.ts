import { describe, expect, it } from 'vitest';
import { assertRefundWithinCap, RefundCapExceededError } from './refund-cap.js';

describe('assertRefundWithinCap', () => {
  it('allows a refund that lands exactly at the cap (boundary case)', () => {
    expect(() => assertRefundWithinCap(400, 600, 1000)).not.toThrow();
  });

  it('allows a refund well under the cap', () => {
    expect(() => assertRefundWithinCap(0, 500, 1000)).not.toThrow();
  });

  it('rejects a refund that would exceed the cap by one unit', () => {
    expect(() => assertRefundWithinCap(400, 601, 1000)).toThrow(RefundCapExceededError);
  });

  it('rejects when prior refunds already exceed the cap', () => {
    expect(() => assertRefundWithinCap(1000, 1, 1000)).toThrow(RefundCapExceededError);
  });

  it('rejects negative inputs', () => {
    expect(() => assertRefundWithinCap(-1, 100, 1000)).toThrow(RangeError);
    expect(() => assertRefundWithinCap(0, -100, 1000)).toThrow(RangeError);
    expect(() => assertRefundWithinCap(0, 100, -1)).toThrow(RangeError);
  });
});
