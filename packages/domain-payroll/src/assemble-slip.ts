// assembleSlip — pure payroll calculation (QĐ0025/0012, P3-II).
//
// Invariants (pre-resolved in plan.md, never to be changed):
//   1. penalty = lateMinutes×500 + earlyMinutes×1000 — INDEPENDENT line item.
//   2. penaltyAmount is NEVER added to variablePay, baseSalary, or kpiBonus.
//   3. totalNet = baseSalary + variablePay + kpiBonus − penaltyAmount, clamped ≥ 0.
//   4. variablePay = baseSalary × variablePayRate (fixed multiplier, no tax).
//   5. Punches without an approved shift → flaggedPunches (caller-computed),
//      NOT penalized here — caller must NOT include those minutes in lateMinutes
//      or earlyMinutes.

export interface AssembleSlipInput {
  /** Monthly base salary (VND). */
  baseSalary: number;
  /** Variable pay multiplier, 0–1. variablePay = baseSalary × variablePayRate. */
  variablePayRate: number;
  /** KPI bonus awarded this period (VND). Independent of penalty calculation. */
  kpiBonus: number;
  /** Total minutes of late clock-in across all approved shift entries this period. */
  lateMinutes: number;
  /** Total minutes of early clock-out across all approved shift entries this period. */
  earlyMinutes: number;
  /** Penalty per late minute (VND). Caller supplies from CompensationPolicy; default 500. */
  penaltyRatePerLateMinute: number;
  /** Penalty per early-departure minute (VND). Caller supplies; default 1000. */
  penaltyRatePerEarlyMinute: number;
}

export interface PayslipData {
  /** Unchanged from input — stored as its own field in Payslip. */
  baseSalary: number;
  /** baseSalary × variablePayRate — NEVER includes penalty. */
  variablePay: number;
  /** Passed through from input — stored as its own field in Payslip. */
  kpiBonus: number;
  /** lateMinutes×rate + earlyMinutes×rate — INDEPENDENT deduction line. */
  penaltyAmount: number;
  /** baseSalary + variablePay + kpiBonus − penaltyAmount, clamped ≥ 0. */
  totalNet: number;
}

function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number, got ${value}.`);
  }
}

function assertRate(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be within [0, 1], got ${value}.`);
  }
}

/**
 * Assembles a payslip from the given inputs. Pure — no DB access, no side
 * effects. Callers gather inputs from live TimePunch / ShiftRegistration data;
 * this function only encodes the arithmetic invariants.
 */
export function assembleSlip(input: AssembleSlipInput): PayslipData {
  assertNonNegative(input.baseSalary, 'baseSalary');
  assertRate(input.variablePayRate, 'variablePayRate');
  assertNonNegative(input.kpiBonus, 'kpiBonus');
  assertNonNegative(input.lateMinutes, 'lateMinutes');
  assertNonNegative(input.earlyMinutes, 'earlyMinutes');
  assertNonNegative(input.penaltyRatePerLateMinute, 'penaltyRatePerLateMinute');
  assertNonNegative(input.penaltyRatePerEarlyMinute, 'penaltyRatePerEarlyMinute');

  const variablePay = input.baseSalary * input.variablePayRate;
  // Penalty is the ONLY deduction — computed from approved-shift deviation only.
  const penaltyAmount =
    input.lateMinutes * input.penaltyRatePerLateMinute +
    input.earlyMinutes * input.penaltyRatePerEarlyMinute;
  // Floor at 0: an employee cannot owe the company money via payroll.
  const totalNet = Math.max(0, input.baseSalary + variablePay + input.kpiBonus - penaltyAmount);

  return {
    baseSalary: input.baseSalary,
    variablePay,
    kpiBonus: input.kpiBonus,
    penaltyAmount,
    totalNet,
  };
}
