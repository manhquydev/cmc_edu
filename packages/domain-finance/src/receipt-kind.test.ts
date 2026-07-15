import { describe, expect, it } from 'vitest';
import { computeReceiptKind } from './receipt-kind.js';

describe('computeReceiptKind', () => {
  it('returns "new" when there is no prior approved receipt for this student', () => {
    expect(computeReceiptKind(false)).toBe('new');
  });

  it('returns "renewal" when a prior approved receipt exists for this student', () => {
    expect(computeReceiptKind(true)).toBe('renewal');
  });
});
