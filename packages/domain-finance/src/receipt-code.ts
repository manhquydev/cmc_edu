// Receipt code generation. Pure formatting function; the atomic increment of
// `ReceiptCodeCounter.value` (packages/db) happens in the caller's transaction
// — this function only knows how to render the *next* code from a counter
// value already read (typically under `FOR UPDATE`).

/**
 * Formats the next receipt code from the counter's current stored value
 * (i.e. the last-issued sequence number). `counterValue` must be a
 * non-negative integer; the returned code uses the next value (`counterValue + 1`).
 */
export function nextReceiptCode(counterValue: number): string {
  if (!Number.isInteger(counterValue) || counterValue < 0) {
    throw new RangeError(`counterValue must be a non-negative integer, got ${counterValue}.`);
  }

  const next = counterValue + 1;
  return `PT-${String(next).padStart(6, '0')}`;
}
