// Receipt kind classification (WF-P1-03, docs/24). MUST be computed BEFORE
// the receipt's status/opportunity stage is mutated during approval — this
// function only decides `new` vs `renewal` from a boolean the caller already
// resolved (whether this parentPhone already has a prior *approved* receipt
// in the same facility); it does not query the database itself.

export type ReceiptKind = 'new' | 'renewal';

/**
 * Returns `'renewal'` when the parent phone already has at least one other
 * approved receipt in the facility, `'new'` otherwise.
 */
export function computeReceiptKind(hasPriorApprovedReceiptForPhone: boolean): ReceiptKind {
  return hasPriorApprovedReceiptForPhone ? 'renewal' : 'new';
}
