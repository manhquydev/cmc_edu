// assembleSlip — pure payroll calculation, salary-tier model (QĐ0025,
// validate session 3/4 — HR remediation phase 2).
//
// Invariants:
//   1. totalNet = max(0, baseSalary + kpiPartAmount − penaltyAmount).
//   2. `kpiPartAmount` is the tier-based "PHẦN NHÂN" the caller already
//      computed (`KpiScore.value` for a `confirmed`/`approved` slip this
//      period) — this function does NOT recompute
//      %côngca × %chỉ-số × unitRate; that lives in phase 3's KPI refresh.
//   3. `variablePay` is ALWAYS 0 — the column is deprecated (R3-2) but
//      `Payslip.variablePay` is still NOT NULL, so callers must persist a
//      value; this pure function's output supplies that value.
//   4. `kpiBonus` in the output is the REPURPOSED column: it carries
//      `kpiPartAmount` (UI/docs label "Phần KPI", R3-2), not a
//      separately-capped bonus.
//   5. `penaltyAmount` = lateMinutes×rate + earlyMinutes×rate — an
//      INDEPENDENT deduction line, never merged into baseSalary or
//      kpiPartAmount before the final subtraction.
//   6. Both `penaltyAmount` and `totalNet` are rounded half-up to whole VND
//      before being returned (R3-13 precision contract — no fractional đồng
//      persisted).

export interface AssembleSlipInput {
  /** Monthly base salary from the employee's assigned SalaryTier (VND). */
  baseSalary: number;
  /** "PHẦN NHÂN" — KpiScore.value for a confirmed/approved slip this period (VND). 0 if none. */
  kpiPartAmount: number;
  /** Total minutes of late clock-in across all counted (present) shifts this period. */
  lateMinutes: number;
  /** Total minutes of early clock-out across all counted (present) shifts this period. */
  earlyMinutes: number;
  /** Penalty per late minute (VND). Caller supplies from CompensationPolicy; default 500. */
  penaltyRatePerLateMinute: number;
  /** Penalty per early-departure minute (VND). Caller supplies; default 1000. */
  penaltyRatePerEarlyMinute: number;
}

export interface PayslipData {
  /** Unchanged from input — stored as its own field in Payslip. */
  baseSalary: number;
  /** Deprecated column — ALWAYS 0 (R3-2). Payslip.variablePay is NOT NULL. */
  variablePay: number;
  /** Repurposed column: holds kpiPartAmount ("Phần KPI" in UI/docs, R3-2). */
  kpiBonus: number;
  /** lateMinutes×rate + earlyMinutes×rate, rounded half-up to whole VND. */
  penaltyAmount: number;
  /** max(0, baseSalary + kpiBonus − penaltyAmount), whole VND. */
  totalNet: number;
}

function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number, got ${value}.`);
  }
}

/** Half-up rounding to the nearest whole VND (R3-13 precision contract). */
export function roundVnd(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : -Math.floor(-value + 0.5);
}

/**
 * Assembles a payslip from the given inputs. Pure — no DB access, no side
 * effects. Callers gather inputs from live TimePunch / ShiftRegistration /
 * KpiScore / SalaryTier data; this function only encodes the arithmetic
 * invariants.
 */
export function assembleSlip(input: AssembleSlipInput): PayslipData {
  assertNonNegative(input.baseSalary, 'baseSalary');
  assertNonNegative(input.kpiPartAmount, 'kpiPartAmount');
  assertNonNegative(input.lateMinutes, 'lateMinutes');
  assertNonNegative(input.earlyMinutes, 'earlyMinutes');
  assertNonNegative(input.penaltyRatePerLateMinute, 'penaltyRatePerLateMinute');
  assertNonNegative(input.penaltyRatePerEarlyMinute, 'penaltyRatePerEarlyMinute');

  const penaltyRaw = roundVnd(
    input.lateMinutes * input.penaltyRatePerLateMinute +
      input.earlyMinutes * input.penaltyRatePerEarlyMinute,
  );
  // ADR 0043 E1: cap the deduction at (baseSalary + kpiPartAmount) so
  // `penaltyAmount` and `totalNet` reconcile — an employee cannot owe the
  // company money via payroll, and the displayed penalty never implies a
  // larger deduction than what was actually withheld. Reconciliation holds
  // to whole-VND rounding tolerance (roundVnd(x−n) = roundVnd(x)−n for
  // integer n), not sub-đồng exactness — immaterial since VND has no
  // sub-unit currency.
  const earningsCeiling = roundVnd(input.baseSalary + input.kpiPartAmount);
  const penaltyAmount = Math.min(penaltyRaw, earningsCeiling);
  const totalNet = Math.max(0, roundVnd(input.baseSalary + input.kpiPartAmount - penaltyAmount));

  return {
    baseSalary: input.baseSalary,
    variablePay: 0,
    kpiBonus: input.kpiPartAmount,
    penaltyAmount,
    totalNet,
  };
}
