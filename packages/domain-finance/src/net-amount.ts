// Net amount computation stub (docs/11 §5 `finance.receiptCreate`).
// v2 will layer discount rules / promo codes on top of this; for P1 substrate
// it is intentionally a plain gross-minus-discount computation with input
// validation, not a placeholder — extend here when the discount rulebook lands.

/**
 * Computes the receipt's net amount from a gross amount and an optional flat
 * discount. Both inputs must be non-negative; the result must not be negative
 * (a discount larger than the gross amount is a caller error, not silently clamped).
 */
export function computeNetAmount(grossAmount: number, discount = 0): number {
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    throw new RangeError(`grossAmount must be a non-negative finite number, got ${grossAmount}.`);
  }
  if (!Number.isFinite(discount) || discount < 0) {
    throw new RangeError(`discount must be a non-negative finite number, got ${discount}.`);
  }

  const net = grossAmount - discount;
  if (net < 0) {
    throw new RangeError(`discount (${discount}) cannot exceed grossAmount (${grossAmount}).`);
  }

  return net;
}
