// Barrel re-export smoke test — confirms the public entrypoint wires each
// function through, independent of the per-function unit tests.

import { describe, expect, it } from 'vitest';
import {
  assertRefundWithinCap,
  computeReceiptKind,
  nextReceiptCode,
  RefundCapExceededError,
} from './index.js';

describe('@cmc/domain-finance barrel', () => {
  it('re-exports the pure functions and error class', () => {
    expect(typeof assertRefundWithinCap).toBe('function');
    expect(typeof nextReceiptCode).toBe('function');
    expect(typeof computeReceiptKind).toBe('function');
    expect(RefundCapExceededError.prototype).toBeInstanceOf(Error);
  });
});
