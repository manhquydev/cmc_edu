// Class-code generation (QD 0036): `{facility.code}-{program}-{year}-{seq}`,
// e.g. `HN-UCREA-2026-001`. Pure formatting function; the atomic increment of
// `ClassBatchCodeCounter.value` (packages/db) happens in the caller's
// transaction -- this only renders the *next* code from a counter value
// already read (mirrors packages/domain-finance/src/receipt-code.ts).

export function nextClassBatchCode(
  facilityCode: string,
  program: string,
  year: number,
  counterValue: number,
): string {
  if (!Number.isInteger(counterValue) || counterValue < 0) {
    throw new RangeError(`counterValue must be a non-negative integer, got ${counterValue}.`);
  }
  const seq = counterValue + 1;
  return `${facilityCode}-${program}-${year}-${String(seq).padStart(3, '0')}`;
}
