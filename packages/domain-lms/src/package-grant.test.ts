import { describe, expect, it } from 'vitest';
import { resolvePackageGrantRange } from './package-grant.js';

describe('resolvePackageGrantRange', () => {
  it('first grant starts at class current unit', () => {
    expect(
      resolvePackageGrantRange({ currentOrder: 101, existingRanges: [], unitCount: 4 }),
    ).toEqual({ fromOrderGlobal: 101, toOrderGlobal: 104 });
  });

  it('renewal extends after max existing', () => {
    expect(
      resolvePackageGrantRange({
        currentOrder: 103,
        existingRanges: [{ fromOrderGlobal: 101, toOrderGlobal: 104 }],
        unitCount: 2,
      }),
    ).toEqual({ fromOrderGlobal: 105, toOrderGlobal: 106 });
  });

  it('uses current when class advanced past last grant', () => {
    expect(
      resolvePackageGrantRange({
        currentOrder: 110,
        existingRanges: [{ fromOrderGlobal: 101, toOrderGlobal: 104 }],
        unitCount: 1,
      }),
    ).toEqual({ fromOrderGlobal: 110, toOrderGlobal: 110 });
  });
});
