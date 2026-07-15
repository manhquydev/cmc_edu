// Receipt kind classification (WF-P1-03, docs/24). MUST be computed BEFORE
// the receipt's status/opportunity stage is mutated during approval — this
// function only decides `new` vs `renewal` from a boolean the caller already
// resolved; it does not query the database itself.
//
// Metric & Data Integrity remediation (scenario audit, 2026-07-15):
// STUDENT-scoped, not phone-scoped — 2 siblings paid under the same parent
// phone must each be classified independently (each one's own first receipt
// is 'new'), not the second sibling wrongly labelled 'renewal' just because
// the phone repeats.

export type ReceiptKind = 'new' | 'renewal';

/**
 * Returns `'renewal'` when this SAME student already has at least one other
 * approved receipt in the facility, `'new'` otherwise.
 */
export function computeReceiptKind(hasPriorApprovedReceiptForStudent: boolean): ReceiptKind {
  return hasPriorApprovedReceiptForStudent ? 'renewal' : 'new';
}
