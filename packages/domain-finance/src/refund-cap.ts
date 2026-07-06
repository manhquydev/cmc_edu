// Refund cap invariant (docs/10 §4): SUM(RefundRecord.amount) <= Receipt.netAmount.
// Pure function — no Prisma import. Callers hold a `FOR UPDATE` lock on the
// receipt row and pass in the already-summed existing refunds; this function
// only encodes the arithmetic invariant so it can be unit tested in isolation.

export class RefundCapExceededError extends Error {
  constructor(existingSum: number, amount: number, netAmount: number) {
    super(
      `Refund of ${amount} would bring total refunds to ${existingSum + amount}, ` +
        `exceeding the receipt's net amount cap of ${netAmount}.`,
    );
    this.name = 'RefundCapExceededError';
  }
}

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number, got ${value}.`);
  }
}

/**
 * Throws `RefundCapExceededError` when `existingSum + amount` would exceed
 * `netAmount`. A refund that brings the total to exactly `netAmount` is
 * allowed (boundary case: equal-to-cap is valid).
 */
export function assertRefundWithinCap(existingSum: number, amount: number, netAmount: number): void {
  assertNonNegative(existingSum, 'existingSum');
  assertNonNegative(amount, 'amount');
  assertNonNegative(netAmount, 'netAmount');

  if (existingSum + amount > netAmount) {
    throw new RefundCapExceededError(existingSum, amount, netAmount);
  }
}
