import { describe, expect, it } from 'vitest';
import { resolvePackageGrantRange } from './package-grant.js';
import { contiguousProgramAxis, toProgramUnitAxis } from './unit-progression.js';

const CONTIG = contiguousProgramAxis(101, 200);

/** Bright I.G real axis: 37–59 missing 40/44/48/52/56 (CSV-faithful). */
const BRIGHT_IG_GAPS = new Set([40, 44, 48, 52, 56]);
const BRIGHT_IG = toProgramUnitAxis(
  Array.from({ length: 59 - 37 + 1 }, (_, i) => 37 + i).filter((o) => !BRIGHT_IG_GAPS.has(o)),
);

describe('resolvePackageGrantRange', () => {
  it('first grant starts at class current unit', () => {
    expect(
      resolvePackageGrantRange({
        currentOrder: 101,
        existingRanges: [],
        unitCount: 4,
        programAxis: CONTIG,
      }),
    ).toEqual({ fromOrderGlobal: 101, toOrderGlobal: 104 });
  });

  it('renewal extends after max existing', () => {
    expect(
      resolvePackageGrantRange({
        currentOrder: 103,
        existingRanges: [{ fromOrderGlobal: 101, toOrderGlobal: 104 }],
        unitCount: 2,
        programAxis: CONTIG,
      }),
    ).toEqual({ fromOrderGlobal: 105, toOrderGlobal: 106 });
  });

  it('uses current when class advanced past last grant', () => {
    expect(
      resolvePackageGrantRange({
        currentOrder: 110,
        existingRanges: [{ fromOrderGlobal: 101, toOrderGlobal: 104 }],
        unitCount: 1,
        programAxis: CONTIG,
      }),
    ).toEqual({ fromOrderGlobal: 110, toOrderGlobal: 110 });
  });

  it('Bright I.G: 12 real units from 37 end at 51 (skip 40/44/48)', () => {
    expect(
      resolvePackageGrantRange({
        currentOrder: 37,
        existingRanges: [],
        unitCount: 12,
        programAxis: BRIGHT_IG,
      }),
    ).toEqual({ fromOrderGlobal: 37, toOrderGlobal: 51 });
  });

  it('Bright I.G renewal after to=39 starts at 41 (not 40) — money joint on hole', () => {
    // S6.1: maxExisting+1 would be 40 (missing); axis next is 41.
    expect(
      resolvePackageGrantRange({
        currentOrder: 37,
        existingRanges: [{ fromOrderGlobal: 37, toOrderGlobal: 39 }],
        unitCount: 3,
        programAxis: BRIGHT_IG,
      }),
    ).toEqual({ fromOrderGlobal: 41, toOrderGlobal: 43 });
  });

  it('Bright I.G first package of 4 from 37 ends at 41 (not 40)', () => {
    // S3.1 / money: unitCount=4 must deliver 4 real units, not invent hole endpoint.
    expect(
      resolvePackageGrantRange({
        currentOrder: 37,
        existingRanges: [],
        unitCount: 4,
        programAxis: BRIGHT_IG,
      }),
    ).toEqual({ fromOrderGlobal: 37, toOrderGlobal: 41 });
  });

  it('Bright I.G renewal after every band hole (43→45, 47→49, …)', () => {
    // S6.5 table-driven: each hole boundary must skip the missing label.
    const cases: { maxTo: number; n: number; from: number; to: number }[] = [
      { maxTo: 43, n: 3, from: 45, to: 47 },
      { maxTo: 47, n: 3, from: 49, to: 51 },
      { maxTo: 51, n: 3, from: 53, to: 55 },
      { maxTo: 55, n: 3, from: 57, to: 59 },
    ];
    for (const c of cases) {
      expect(
        resolvePackageGrantRange({
          currentOrder: c.from,
          existingRanges: [{ fromOrderGlobal: 37, toOrderGlobal: c.maxTo }],
          unitCount: c.n,
          programAxis: BRIGHT_IG,
        }),
        `after to=${c.maxTo}`,
      ).toEqual({ fromOrderGlobal: c.from, toOrderGlobal: c.to });
    }
  });

  it('rejects unitCount < 1 (cannot sell zero/negative packages)', () => {
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 37,
        existingRanges: [],
        unitCount: 0,
        programAxis: BRIGHT_IG,
      }),
    ).toThrow(/unitCount must be >= 1/);
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 37,
        existingRanges: [],
        unitCount: -2,
        programAxis: BRIGHT_IG,
      }),
    ).toThrow(/unitCount must be >= 1/);
  });

  it('rejects empty program axis (no catalog to sell against)', () => {
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 1,
        existingRanges: [],
        unitCount: 1,
        programAxis: [],
      }),
    ).toThrow(/programUnitAxis is empty/);
  });

  it('rejects from order not on axis (currentOrder sits on a hole)', () => {
    // S5.2 / money: class neo or renew joint must be a real label, not 40.
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 40,
        existingRanges: [],
        unitCount: 1,
        programAxis: BRIGHT_IG,
      }),
    ).toThrow(/from order 40 is not on programUnitAxis/);
  });

  it('rejects package larger than remaining frame (oversell past last unit)', () => {
    // S5.4 / S6.4: from 55 only 55,57,58,59 remain (4); N=12 must fail closed.
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 55,
        existingRanges: [],
        unitCount: 12,
        programAxis: BRIGHT_IG,
      }),
    ).toThrow(/exceeds remaining program units/);
  });

  it('rejects renewal when max existing is last unit (axis exhausted — no invent past end)', () => {
    // After granting through 59, nextOrderOnAxis is null → program sold out.
    // Must fail here with a sold-out message, not invent 60/61 or return an
    // overlapping range that downstream reports as "Range overlaps…".
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 59,
        existingRanges: [{ fromOrderGlobal: 57, toOrderGlobal: 59 }],
        unitCount: 2,
        programAxis: BRIGHT_IG,
      }),
    ).toThrow(/no remaining program units after order 59/);
  });

  it('when axis exhausted after grant, rejects even N=1 (sold out — not overlap)', () => {
    // Former bug: fall back to currentOrder=59 produced {59,59} which overlapped
    // the existing range and failed as "Range overlaps an existing unit range".
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 59,
        existingRanges: [{ fromOrderGlobal: 57, toOrderGlobal: 59 }],
        unitCount: 1,
        programAxis: BRIGHT_IG,
      }),
    ).toThrow(/no remaining program units after order 59/);
  });

  it('Black Hole: sold through last unit 102 → clear sold-out, not overlap', () => {
    // Review scenario: axis ends at 102; student already holds 95–102; class
    // current is 99; receipt tries to grant 4 more. nextAfter is null — do not
    // return 99–102 (would overlap) and force a misleading overlap reject.
    const BLACK_HOLE = contiguousProgramAxis(61, 102);
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 99,
        existingRanges: [{ fromOrderGlobal: 95, toOrderGlobal: 102 }],
        unitCount: 4,
        programAxis: BLACK_HOLE,
      }),
    ).toThrow(/no remaining program units after order 102/);
  });

  it('single-unit program: can sell N=1, cannot sell N=2', () => {
    const one = toProgramUnitAxis([100]);
    expect(
      resolvePackageGrantRange({
        currentOrder: 100,
        existingRanges: [],
        unitCount: 1,
        programAxis: one,
      }),
    ).toEqual({ fromOrderGlobal: 100, toOrderGlobal: 100 });
    expect(() =>
      resolvePackageGrantRange({
        currentOrder: 100,
        existingRanges: [],
        unitCount: 2,
        programAxis: one,
      }),
    ).toThrow(/exceeds remaining program units/);
  });
});
