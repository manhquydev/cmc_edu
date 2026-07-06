// Duplicate-phone warning predicate (QD 0037, WF-P1-02). Pure function — no
// Prisma import. The router looks up whether a ParentAccount or another
// Receipt already uses the incoming parentPhone (facility-scoped for the
// Receipt check, system-wide for ParentAccount per TL10 §4 invariant #3) and
// passes the two booleans here; this function only decides the warning text.
//
// This is a soft warning, not a hard block: QD 0037 requires the sale rep to
// confirm before creating the receipt, never an outright rejection.

/**
 * Returns a warning message when `parentPhone` already matches an existing
 * ParentAccount or Receipt, or `null` when there is no conflict. Callers
 * narrow `status === 'success'` vs `'warning'` on the returned discriminated
 * union using this result (TL11 §2).
 */
export function duplicatePhoneWarning(
  hasExistingParentAccount: boolean,
  hasExistingReceiptForPhone: boolean,
): string | null {
  if (hasExistingParentAccount || hasExistingReceiptForPhone) {
    return 'SĐT phụ huynh đã tồn tại trong hệ thống — vui lòng xác nhận trước khi tạo phiếu.';
  }
  return null;
}
