import { describe, expect, it } from 'vitest';
import { onRoster } from './on-roster.js';

const day = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);

describe('onRoster dual-gate', () => {
  const base = {
    enrollmentStatus: 'active',
    studentLifecycle: 'active',
    archivedDayUtc: null as Date | null,
    sessionDate: day('2026-09-01'),
    sessionOrderGlobal: 3 as number | null,
    ranges: [{ fromOrderGlobal: 1, toOrderGlobal: 4 }],
  };

  it('allows active + entitled + unblocked', () => {
    expect(onRoster(base)).toBe(true);
  });

  it('rejects reserved seat even with ranges', () => {
    expect(onRoster({ ...base, enrollmentStatus: 'reserved' })).toBe(false);
  });

  it('rejects range miss', () => {
    expect(onRoster({ ...base, sessionOrderGlobal: 5 })).toBe(false);
  });

  it('fail-closed on null session stamp', () => {
    expect(onRoster({ ...base, sessionOrderGlobal: null })).toBe(false);
  });

  it('rejects blocked_lms lifecycle', () => {
    expect(onRoster({ ...base, studentLifecycle: 'blocked_lms' })).toBe(false);
  });

  it('rejects after archive day', () => {
    expect(
      onRoster({
        ...base,
        archivedDayUtc: day('2026-08-31'),
        sessionDate: day('2026-09-01'),
      }),
    ).toBe(false);
  });

  it('keeps same-day archive on roster', () => {
    expect(
      onRoster({
        ...base,
        archivedDayUtc: day('2026-09-01'),
        sessionDate: day('2026-09-01'),
      }),
    ).toBe(true);
  });
});
