// HR remediation phase 7: creditFactor boundary tests (docs/26 phase-07
// §Requirements). Each cliff (24h, 48h) is tested at -1s/exact/+1s so the
// `<=` (inclusive lower bucket) semantics are pinned exactly.

import { describe, expect, it } from 'vitest';
import {
  addDaysToDateOnly,
  compareDateOnly,
  creditFactor,
  ictDateOnlyOf,
  ictMonthBounds,
  ictMonthOf,
  ictToUtc,
  isValidDateOnly,
  isValidTimeOfDay,
  resolveShiftGroup,
  weekdayOf,
} from './index.js';

// ---------------------------------------------------------------------------
// isValidDateOnly
// ---------------------------------------------------------------------------

describe('isValidDateOnly', () => {
  it('accepts valid YYYY-MM-DD format', () => {
    expect(isValidDateOnly('2026-01-15')).toBe(true);
    expect(isValidDateOnly('2026-12-31')).toBe(true);
    expect(isValidDateOnly('2000-01-01')).toBe(true);
  });

  it('rejects invalid formats (regex validation only, no semantic range check)', () => {
    expect(isValidDateOnly('2026-1-15')).toBe(false); // single-digit month
    expect(isValidDateOnly('2026-13-01')).toBe(true); // month 13 — regex allows, no range check
    expect(isValidDateOnly('not-a-date')).toBe(false);
    expect(isValidDateOnly('')).toBe(false);
    expect(isValidDateOnly('2026-01-1')).toBe(false); // single-digit day
  });
});

// ---------------------------------------------------------------------------
// isValidTimeOfDay
// ---------------------------------------------------------------------------

describe('isValidTimeOfDay', () => {
  it('accepts valid HH:mm format', () => {
    expect(isValidTimeOfDay('09:30')).toBe(true);
    expect(isValidTimeOfDay('23:59')).toBe(true);
    expect(isValidTimeOfDay('00:00')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidTimeOfDay('24:00')).toBe(false); // hour 24
    expect(isValidTimeOfDay('9:30')).toBe(false); // single-digit hour
    expect(isValidTimeOfDay('12:60')).toBe(false); // minute 60
    expect(isValidTimeOfDay('12:05:30')).toBe(false); // with seconds
    expect(isValidTimeOfDay('')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// weekdayOf
// ---------------------------------------------------------------------------

describe('weekdayOf', () => {
  it('returns correct weekday (0=Sunday..6=Saturday) for known dates', () => {
    // 2026-01-01 is a Thursday (JS getDay() = 4)
    expect(weekdayOf('2026-01-01')).toBe(4);
    // 2026-01-03 is a Saturday (JS getDay() = 6)
    expect(weekdayOf('2026-01-03')).toBe(6);
    // 2026-01-04 is a Sunday (JS getDay() = 0)
    expect(weekdayOf('2026-01-04')).toBe(0);
  });

  it('throws RangeError on malformed input', () => {
    expect(() => weekdayOf('2026-1-15')).toThrow(RangeError);
    expect(() => weekdayOf('not-a-date')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// ictToUtc
// ---------------------------------------------------------------------------

describe('ictToUtc', () => {
  it('converts ICT midnight to UTC correctly (UTC+7 offset)', () => {
    // 2026-01-01 00:00 ICT = 2025-12-31 17:00 UTC
    const result = ictToUtc('2026-01-01', '00:00');
    expect(result.getUTCFullYear()).toBe(2025);
    expect(result.getUTCMonth()).toBe(11); // December (0-indexed)
    expect(result.getUTCDate()).toBe(31);
    expect(result.getUTCHours()).toBe(17);
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('throws RangeError on malformed date or time', () => {
    expect(() => ictToUtc('2026-1-01', '00:00')).toThrow(RangeError);
    expect(() => ictToUtc('2026-01-01', '24:00')).toThrow(RangeError);
    expect(() => ictToUtc('not-a-date', '00:00')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// ictDateOnlyOf
// ---------------------------------------------------------------------------

describe('ictDateOnlyOf', () => {
  it('recovers the ICT calendar date from a UTC instant (inverse of ictToUtc midnight)', () => {
    const instant = ictToUtc('2026-01-01', '00:00');
    expect(ictDateOnlyOf(instant)).toBe('2026-01-01');
  });

  it('handles midnight boundary near day transition', () => {
    // 2026-01-01 23:59 ICT should still fall in 2026-01-01
    const late = ictToUtc('2026-01-01', '23:59');
    expect(ictDateOnlyOf(late)).toBe('2026-01-01');

    // 2026-01-02 00:00 ICT (next day)
    const nextDay = ictToUtc('2026-01-02', '00:00');
    expect(ictDateOnlyOf(nextDay)).toBe('2026-01-02');
  });
});

// ---------------------------------------------------------------------------
// ictMonthOf
// ---------------------------------------------------------------------------

describe('ictMonthOf', () => {
  it('returns correct YYYY-MM for an instant in that ICT month', () => {
    const instant = ictToUtc('2026-01-31', '23:59');
    expect(ictMonthOf(instant)).toBe('2026-01');
  });

  it('returns next month for an instant in the next ICT month', () => {
    // 2026-02-01 00:00 ICT
    const nextMonth = ictToUtc('2026-02-01', '00:00');
    expect(ictMonthOf(nextMonth)).toBe('2026-02');
  });
});

// ---------------------------------------------------------------------------
// addDaysToDateOnly
// ---------------------------------------------------------------------------

describe('addDaysToDateOnly', () => {
  it('adds positive days correctly', () => {
    expect(addDaysToDateOnly('2026-01-31', 1)).toBe('2026-02-01'); // month rollover
    expect(addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01'); // year rollover
    expect(addDaysToDateOnly('2026-01-01', 0)).toBe('2026-01-01'); // no-op
  });

  it('handles negative days (subtraction)', () => {
    expect(addDaysToDateOnly('2026-01-01', -1)).toBe('2025-12-31'); // month/year rollback
    expect(addDaysToDateOnly('2026-02-01', -1)).toBe('2026-01-31');
  });

  it('throws RangeError on malformed input', () => {
    expect(() => addDaysToDateOnly('2026-1-01', 1)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// compareDateOnly
// ---------------------------------------------------------------------------

describe('compareDateOnly', () => {
  it('returns -1 when a < b', () => {
    expect(compareDateOnly('2026-01-01', '2026-01-02')).toBe(-1);
  });

  it('returns 1 when a > b', () => {
    expect(compareDateOnly('2026-02-01', '2026-01-01')).toBe(1);
  });

  it('returns 0 when a equals b', () => {
    expect(compareDateOnly('2026-01-15', '2026-01-15')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveShiftGroup
// ---------------------------------------------------------------------------

describe('resolveShiftGroup', () => {
  it('puts anyone holding the teacher role in the teaching group', () => {
    expect(resolveShiftGroup(['giao_vien'])).toBe('GIAO_VIEN');
    // A teacher who also runs training still teaches.
    expect(resolveShiftGroup(['giam_doc_dao_tao', 'giao_vien'])).toBe('GIAO_VIEN');
  });

  it('defaults to KINH_DOANH for every other role set', () => {
    expect(resolveShiftGroup(['sale'])).toBe('KINH_DOANH');
    expect(resolveShiftGroup(['giam_doc_kinh_doanh'])).toBe('KINH_DOANH');
    expect(resolveShiftGroup([])).toBe('KINH_DOANH');
  });

  it('ignores the job title, which is free text and was never a reliable signal', () => {
    // "Giáo viên" is what the staff form's own placeholder suggests typing.
    expect(resolveShiftGroup(['sale'])).toBe('KINH_DOANH');
    expect(resolveShiftGroup(['giao_vien'])).toBe('GIAO_VIEN');
  });
});

// ---------------------------------------------------------------------------
// ictMonthBounds
// ---------------------------------------------------------------------------

describe('ictMonthBounds', () => {
  it('returns [start, end) bounds for a given YYYY-MM period', () => {
    const [start, end] = ictMonthBounds('2026-01');
    // Start = 2026-01-01 00:00 ICT
    expect(ictDateOnlyOf(start)).toBe('2026-01-01');
    // End = 2026-02-01 00:00 ICT (exclusive)
    expect(ictDateOnlyOf(end)).toBe('2026-02-01');
  });

  it('handles year rollover (December -> January)', () => {
    const [start, end] = ictMonthBounds('2026-12');
    expect(ictDateOnlyOf(start)).toBe('2026-12-01');
    expect(ictDateOnlyOf(end)).toBe('2027-01-01');
  });

  it('throws RangeError on malformed period', () => {
    expect(() => ictMonthBounds('2026-1')).toThrow(RangeError); // single-digit month
    expect(() => ictMonthBounds('not-a-period')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// creditFactor (existing tests preserved)
// ---------------------------------------------------------------------------

describe('creditFactor', () => {
  const endTime = new Date('2026-08-03T12:30:00.000Z');

  function doneAtOffset(ms: number): Date {
    return new Date(endTime.getTime() + ms);
  }

  const ONE_HOUR_MS = 60 * 60 * 1_000;

  it('returns 1.0 when doneAt equals endTime (0 lateness)', () => {
    expect(creditFactor(doneAtOffset(0), endTime)).toBe(1.0);
  });

  it('returns 1.0 at exactly 24h late (inclusive boundary)', () => {
    expect(creditFactor(doneAtOffset(24 * ONE_HOUR_MS), endTime)).toBe(1.0);
  });

  it('returns 1.0 at 24h minus 1s', () => {
    expect(creditFactor(doneAtOffset(24 * ONE_HOUR_MS - 1_000), endTime)).toBe(1.0);
  });

  it('returns 0.5 at 24h plus 1s', () => {
    expect(creditFactor(doneAtOffset(24 * ONE_HOUR_MS + 1_000), endTime)).toBe(0.5);
  });

  it('returns 0.5 at exactly 48h late (inclusive boundary)', () => {
    expect(creditFactor(doneAtOffset(48 * ONE_HOUR_MS), endTime)).toBe(0.5);
  });

  it('returns 0.5 at 48h minus 1s', () => {
    expect(creditFactor(doneAtOffset(48 * ONE_HOUR_MS - 1_000), endTime)).toBe(0.5);
  });

  it('returns 0 at 48h plus 1s', () => {
    expect(creditFactor(doneAtOffset(48 * ONE_HOUR_MS + 1_000), endTime)).toBe(0);
  });

  it('returns 0 far beyond 48h', () => {
    expect(creditFactor(doneAtOffset(30 * 24 * ONE_HOUR_MS), endTime)).toBe(0);
  });
});
