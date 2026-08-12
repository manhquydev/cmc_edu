// Pure helpers for money → unit package resolution (Plan 3).

import {
  axisIndexOf,
  nextOrderOnAxis,
  type ProgramUnitAxis,
  type UnitRange,
} from './unit-progression.js';

/**
 * Resolve grant range for a paid package of `unitCount` **real** units on the
 * program axis. First grant starts at class current unit; renewals extend after
 * the next real unit past max existing `toOrderGlobal` (not maxExisting+1).
 *
 * `toOrderGlobal` is the label of the N-th real unit starting at `from`, so
 * Bright I.G gaps are skipped rather than inventing missing orders.
 */
export function resolvePackageGrantRange(opts: {
  currentOrder: number;
  existingRanges: UnitRange[];
  unitCount: number;
  programAxis: ProgramUnitAxis;
}): UnitRange {
  if (opts.unitCount < 1) {
    throw new Error('unitCount must be >= 1');
  }
  const axis = opts.programAxis;
  if (axis.length === 0) {
    throw new Error('programUnitAxis is empty');
  }

  const maxExisting = opts.existingRanges.reduce(
    (m, r) => Math.max(m, r.toOrderGlobal),
    0,
  );

  let from: number;
  if (opts.existingRanges.length === 0) {
    from = opts.currentOrder;
  } else {
    const nextAfter = nextOrderOnAxis(axis, maxExisting);
    // Class may have advanced past the last granted label — take the later of
    // (next real after grant) and (class current). If the axis is exhausted
    // after maxExisting, fall back to currentOrder (caller validation fails
    // if that is also off-axis / cannot fit unitCount).
    from =
      nextAfter == null
        ? opts.currentOrder
        : Math.max(opts.currentOrder, nextAfter);
  }

  const fromIdx = axisIndexOf(axis, from);
  if (fromIdx < 0) {
    throw new Error(`from order ${from} is not on programUnitAxis`);
  }
  const toIdx = fromIdx + opts.unitCount - 1;
  if (toIdx >= axis.length) {
    throw new Error(
      `unitCount ${opts.unitCount} from order ${from} exceeds remaining program units`,
    );
  }
  return { fromOrderGlobal: from, toOrderGlobal: axis[toIdx]! };
}
