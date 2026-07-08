import { describe, expect, it } from 'vitest';
import { countPendingApproval } from './cockpit.js';

describe('countPendingApproval', () => {
  it('counts only draft receipts', () => {
    const receipts = [
      { status: 'draft' },
      { status: 'draft' },
      { status: 'draft' },
      { status: 'approved' },
      { status: 'cancelled' },
    ];
    expect(countPendingApproval(receipts)).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(countPendingApproval([])).toBe(0);
  });

  it('returns 0 when no drafts exist', () => {
    const receipts = [
      { status: 'approved' },
      { status: 'sent' },
      { status: 'cancelled' },
    ];
    expect(countPendingApproval(receipts)).toBe(0);
  });

  it('never counts a nonexistent "pending" status', () => {
    const receipts = [{ status: 'pending' as string }];
    expect(countPendingApproval(receipts)).toBe(0);
  });
});
