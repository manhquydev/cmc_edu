// assembleSlip unit tests — salary-tier model (validate session 3/4, R3-2/R3-13).
//
// Tests cover every arithmetic invariant documented in assemble-slip.ts.

import { describe, expect, it } from 'vitest';
import { assembleSlip, roundVnd } from './assemble-slip.js';

const BASE = {
  baseSalary: 10_000_000,
  kpiPartAmount: 500_000,
  lateMinutes: 0,
  earlyMinutes: 0,
  penaltyRatePerLateMinute: 500,
  penaltyRatePerEarlyMinute: 1000,
};

describe('assembleSlip — happy path', () => {
  it('zero late/early: no penalty, totalNet = base + kpiPartAmount', () => {
    const result = assembleSlip(BASE);
    expect(result.baseSalary).toBe(10_000_000);
    expect(result.kpiBonus).toBe(500_000);
    expect(result.penaltyAmount).toBe(0);
    expect(result.totalNet).toBe(10_500_000);
  });

  it('variablePay is ALWAYS 0 — deprecated column (R3-2)', () => {
    const result = assembleSlip(BASE);
    expect(result.variablePay).toBe(0);
    const r2 = assembleSlip({ ...BASE, baseSalary: 50_000_000, kpiPartAmount: 9_000_000 });
    expect(r2.variablePay).toBe(0);
  });

  it('kpiBonus in the output IS kpiPartAmount (repurposed column, R3-2)', () => {
    const result = assembleSlip({ ...BASE, kpiPartAmount: 1_234_567 });
    expect(result.kpiBonus).toBe(1_234_567);
  });

  it('late only: penaltyAmount = lateMinutes × 500', () => {
    const result = assembleSlip({ ...BASE, lateMinutes: 60 });
    expect(result.penaltyAmount).toBe(30_000); // 60 × 500
    expect(result.totalNet).toBe(10_500_000 - 30_000);
  });

  it('early only: penaltyAmount = earlyMinutes × 1000', () => {
    const result = assembleSlip({ ...BASE, earlyMinutes: 30 });
    expect(result.penaltyAmount).toBe(30_000); // 30 × 1000
    expect(result.totalNet).toBe(10_500_000 - 30_000);
  });

  it('combined late + early: penalty is the sum of both', () => {
    const result = assembleSlip({ ...BASE, lateMinutes: 30, earlyMinutes: 30 });
    // 30×500 + 30×1000 = 15000 + 30000 = 45000
    expect(result.penaltyAmount).toBe(45_000);
    expect(result.totalNet).toBe(10_500_000 - 45_000);
  });

  it('penaltyAmount is independent: kpiBonus is always kpiPartAmount, unaffected by penalty', () => {
    const r1 = assembleSlip({ ...BASE, lateMinutes: 0 });
    const r2 = assembleSlip({ ...BASE, lateMinutes: 120 });
    expect(r1.kpiBonus).toBe(r2.kpiBonus);
    expect(r2.penaltyAmount).toBe(60_000);
  });

  it('totalNet is floored at 0 — massive penalty cannot produce negative net', () => {
    const result = assembleSlip({
      baseSalary: 1_000_000,
      kpiPartAmount: 0,
      lateMinutes: 10_000, // 10000 × 500 = 5M > 1M base
      earlyMinutes: 0,
      penaltyRatePerLateMinute: 500,
      penaltyRatePerEarlyMinute: 1000,
    });
    expect(result.penaltyAmount).toBe(5_000_000);
    expect(result.totalNet).toBe(0);
  });

  it('zero baseSalary + zero kpiPartAmount: totalNet = 0', () => {
    const result = assembleSlip({ ...BASE, baseSalary: 0, kpiPartAmount: 0 });
    expect(result.totalNet).toBe(0);
  });

  it('kpiPartAmount = 0: totalNet = base − penalty', () => {
    const result = assembleSlip({ ...BASE, kpiPartAmount: 0, lateMinutes: 10 });
    expect(result.kpiBonus).toBe(0);
    expect(result.totalNet).toBe(10_000_000 - 5_000);
  });

  it('no tier/KPI applied yet (both 0): totalNet = 0 when baseSalary is 0', () => {
    const result = assembleSlip({ ...BASE, baseSalary: 0, kpiPartAmount: 0, lateMinutes: 0, earlyMinutes: 0 });
    expect(result.totalNet).toBe(0);
    expect(result.penaltyAmount).toBe(0);
  });

  it('custom penalty rates: caller (CompensationPolicy) controls per-minute cost', () => {
    const result = assembleSlip({
      ...BASE,
      lateMinutes: 1,
      earlyMinutes: 1,
      penaltyRatePerLateMinute: 700,
      penaltyRatePerEarlyMinute: 1200,
    });
    expect(result.penaltyAmount).toBe(1900);
  });

  it('returns baseSalary unchanged in output', () => {
    const result = assembleSlip(BASE);
    expect(result.baseSalary).toBe(BASE.baseSalary);
  });

  it('exact-value integration: base + kpi − penalty computed correctly together', () => {
    const result = assembleSlip({
      baseSalary: 8_000_000,
      kpiPartAmount: 2_345_000,
      lateMinutes: 15,
      earlyMinutes: 20,
      penaltyRatePerLateMinute: 500,
      penaltyRatePerEarlyMinute: 1000,
    });
    // penalty = 15×500 + 20×1000 = 7500 + 20000 = 27500
    expect(result.penaltyAmount).toBe(27_500);
    expect(result.totalNet).toBe(8_000_000 + 2_345_000 - 27_500);
  });
});

describe('assembleSlip — precision contract (R3-13, round half-up 0 lẻ VND)', () => {
  it('roundVnd rounds .5 up for positive values', () => {
    expect(roundVnd(1000.5)).toBe(1001);
    expect(roundVnd(1000.4)).toBe(1000);
    expect(roundVnd(1000.49)).toBe(1000);
  });

  it('fractional penalty rate produces a whole-VND penaltyAmount', () => {
    // 1 late minute × 500.5 VND/phút = 500.5 → rounds up to 501
    const result = assembleSlip({ ...BASE, lateMinutes: 1, penaltyRatePerLateMinute: 500.5 });
    expect(result.penaltyAmount).toBe(501);
    expect(Number.isInteger(result.penaltyAmount)).toBe(true);
    expect(Number.isInteger(result.totalNet)).toBe(true);
  });
});

describe('assembleSlip — input validation', () => {
  it('throws on negative baseSalary', () => {
    expect(() => assembleSlip({ ...BASE, baseSalary: -1 })).toThrow(RangeError);
  });

  it('throws on negative kpiPartAmount', () => {
    expect(() => assembleSlip({ ...BASE, kpiPartAmount: -1 })).toThrow(RangeError);
  });

  it('throws on negative lateMinutes', () => {
    expect(() => assembleSlip({ ...BASE, lateMinutes: -1 })).toThrow(RangeError);
  });

  it('throws on negative earlyMinutes', () => {
    expect(() => assembleSlip({ ...BASE, earlyMinutes: -1 })).toThrow(RangeError);
  });

  it('throws on negative penalty rates', () => {
    expect(() => assembleSlip({ ...BASE, penaltyRatePerLateMinute: -1 })).toThrow(RangeError);
    expect(() => assembleSlip({ ...BASE, penaltyRatePerEarlyMinute: -1 })).toThrow(RangeError);
  });

  it('throws on NaN baseSalary', () => {
    expect(() => assembleSlip({ ...BASE, baseSalary: NaN })).toThrow(RangeError);
  });

  it('throws on Infinity lateMinutes', () => {
    expect(() => assembleSlip({ ...BASE, lateMinutes: Infinity })).toThrow(RangeError);
  });
});
