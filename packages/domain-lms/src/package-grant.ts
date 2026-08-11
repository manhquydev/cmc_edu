// Pure helpers for money → unit package resolution (Plan 3).

import type { UnitRange } from './unit-progression.js';

/**
 * Resolve continuous grant range for a paid package of `unitCount` units.
 * First grant starts at class current unit; renewals extend after max existing.
 */
export function resolvePackageGrantRange(opts: {
  currentOrder: number;
  existingRanges: UnitRange[];
  unitCount: number;
}): UnitRange {
  if (opts.unitCount < 1) {
    throw new Error('unitCount must be >= 1');
  }
  const maxExisting = opts.existingRanges.reduce(
    (m, r) => Math.max(m, r.toOrderGlobal),
    0,
  );
  const from =
    opts.existingRanges.length === 0
      ? opts.currentOrder
      : Math.max(opts.currentOrder, maxExisting + 1);
  return { fromOrderGlobal: from, toOrderGlobal: from + opts.unitCount - 1 };
}
