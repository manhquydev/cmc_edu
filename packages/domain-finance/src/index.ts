// @cmc/domain-finance — pure finance functions (no Prisma import).
// This is the unit-test home for money math (docs/18 §2); integration/RLS
// tests for the procedures that call these functions live in `apps/api`.

export { assertRefundWithinCap, RefundCapExceededError } from './refund-cap.js';
export { nextReceiptCode } from './receipt-code.js';
export { computeNetAmount } from './net-amount.js';
export { duplicatePhoneWarning } from './duplicate-phone.js';
export { computeReceiptKind, type ReceiptKind } from './receipt-kind.js';
