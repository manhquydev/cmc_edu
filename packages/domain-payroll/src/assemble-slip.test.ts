// assembleSlip unit tests — ≥90% coverage threshold (vitest.config.ts).
//
// Tests cover every arithmetic invariant documented in assemble-slip.ts.

import { describe, expect, it } from 'vitest';
import { assembleSlip } from './assemble-slip.js';

const BASE = {
  baseSalary: 10_000_000,
  variablePayRate: 0.1,
  kpiBonus: 500_000,
  lateMinutes: 0,
  earlyMinutes: 0,
  penaltyRatePerLateMinute: 500,
  penaltyRatePerEarlyMinute: 1000,
};

describe('assembleSlip — happy path', () => {
  it('zero late/early: no penalty, totalNet = base + variable + kpi', () => {
    const result = assembleSlip(BASE);
    expect(result.baseSalary).toBe(10_000_000);
    expect(result.variablePay).toBe(1_000_000);   // 10M × 0.1
    expect(result.kpiBonus).toBe(500_000);
    expect(result.penaltyAmount).toBe(0);
    expect(result.totalNet).toBe(11_500_000);      // 10M + 1M + 0.5M
  });

  it('late only: penaltyAmount = lateMinutes × 500, NOT added to variablePay', () => {
    const result = assembleSlip({ ...BASE, lateMinutes: 60 });
    expect(result.penaltyAmount).toBe(30_000);     // 60 × 500
    // variablePay must be based on baseSalary only, never including penalty
    expect(result.variablePay).toBe(1_000_000);
    expect(result.totalNet).toBe(11_500_000 - 30_000);
  });

  it('early only: penaltyAmount = earlyMinutes × 1000', () => {
    const result = assembleSlip({ ...BASE, earlyMinutes: 30 });
    expect(result.penaltyAmount).toBe(30_000);     // 30 × 1000
    expect(result.totalNet).toBe(11_500_000 - 30_000);
  });

  it('combined late + early: penalty is sum of both', () => {
    const result = assembleSlip({ ...BASE, lateMinutes: 30, earlyMinutes: 30 });
    // 30×500 + 30×1000 = 15000 + 30000 = 45000
    expect(result.penaltyAmount).toBe(45_000);
    expect(result.totalNet).toBe(11_500_000 - 45_000);
  });

  it('penaltyAmount is independent: variablePay is always base × rate', () => {
    const r1 = assembleSlip({ ...BASE, lateMinutes: 0 });
    const r2 = assembleSlip({ ...BASE, lateMinutes: 120 });
    // variablePay must be identical regardless of penalty
    expect(r1.variablePay).toBe(r2.variablePay);
    // penaltyAmount differs
    expect(r2.penaltyAmount).toBe(60_000);
  });

  it('totalNet is floored at 0 — massive penalty cannot produce negative net', () => {
    const result = assembleSlip({
      baseSalary: 1_000_000,
      variablePayRate: 0,
      kpiBonus: 0,
      lateMinutes: 10_000,  // 10000 × 500 = 5M > 1M base
      earlyMinutes: 0,
      penaltyRatePerLateMinute: 500,
      penaltyRatePerEarlyMinute: 1000,
    });
    expect(result.penaltyAmount).toBe(5_000_000);
    expect(result.totalNet).toBe(0);
  });

  it('zero baseSalary with variablePayRate > 0: variablePay = 0', () => {
    const result = assembleSlip({ ...BASE, baseSalary: 0, kpiBonus: 0 });
    expect(result.variablePay).toBe(0);
    expect(result.totalNet).toBe(0);
  });

  it('variablePayRate = 1 doubles baseSalary contribution', () => {
    const result = assembleSlip({ ...BASE, variablePayRate: 1, kpiBonus: 0 });
    expect(result.variablePay).toBe(10_000_000);
    expect(result.totalNet).toBe(20_000_000);
  });

  it('kpiBonus = 0: totalNet = base + variable - penalty', () => {
    const result = assembleSlip({ ...BASE, kpiBonus: 0, lateMinutes: 10 });
    expect(result.kpiBonus).toBe(0);
    expect(result.totalNet).toBe(10_000_000 + 1_000_000 - 5_000);
  });

  it('custom penalty rates: caller controls per-minute cost', () => {
    const result = assembleSlip({
      ...BASE,
      lateMinutes: 1,
      earlyMinutes: 1,
      penaltyRatePerLateMinute: 1000,
      penaltyRatePerEarlyMinute: 2000,
    });
    expect(result.penaltyAmount).toBe(3000);
  });

  it('returns baseSalary unchanged in output', () => {
    const result = assembleSlip(BASE);
    expect(result.baseSalary).toBe(BASE.baseSalary);
  });
});

describe('assembleSlip — input validation', () => {
  it('throws on negative baseSalary', () => {
    expect(() => assembleSlip({ ...BASE, baseSalary: -1 })).toThrow(RangeError);
  });

  it('throws on variablePayRate > 1', () => {
    expect(() => assembleSlip({ ...BASE, variablePayRate: 1.5 })).toThrow(RangeError);
  });

  it('throws on negative variablePayRate', () => {
    expect(() => assembleSlip({ ...BASE, variablePayRate: -0.1 })).toThrow(RangeError);
  });

  it('throws on negative kpiBonus', () => {
    expect(() => assembleSlip({ ...BASE, kpiBonus: -1 })).toThrow(RangeError);
  });

  it('throws on negative lateMinutes', () => {
    expect(() => assembleSlip({ ...BASE, lateMinutes: -1 })).toThrow(RangeError);
  });

  it('throws on negative earlyMinutes', () => {
    expect(() => assembleSlip({ ...BASE, earlyMinutes: -1 })).toThrow(RangeError);
  });

  it('throws on NaN baseSalary', () => {
    expect(() => assembleSlip({ ...BASE, baseSalary: NaN })).toThrow(RangeError);
  });

  it('throws on Infinity lateMinutes', () => {
    expect(() => assembleSlip({ ...BASE, lateMinutes: Infinity })).toThrow(RangeError);
  });
});
