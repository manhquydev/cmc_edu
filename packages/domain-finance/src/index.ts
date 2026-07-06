// @cmc/domain-finance — pure finance functions (no Prisma import).
// This is the unit-test home for money math (docs/18 §2); integration/RLS
// tests for the procedures that call these functions live in `apps/api`.

// F9 remediation: `computeNetAmount` (gross-minus-discount) was dead code —
// no caller ever wired a discount into `finance.receiptCreate`, and no P1
// decision doc defines a discount rulebook. Deleted rather than wired in:
// inventing discount semantics (negative amounts, caps, promo codes) without
// a product decision would be speculative scope, not a bug fix. Revisit when
// the v2 discount rulebook lands (see the deleted file's original comment).

export { assertRefundWithinCap, RefundCapExceededError } from './refund-cap.js';
export { nextReceiptCode } from './receipt-code.js';
export { duplicatePhoneWarning } from './duplicate-phone.js';
export { computeReceiptKind, type ReceiptKind } from './receipt-kind.js';
