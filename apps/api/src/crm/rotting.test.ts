import { describe, expect, it } from 'vitest';
import { isOpportunityRotting, rottingAgeDays } from './rotting.js';

const NOW = new Date('2026-08-09T12:00:00.000Z');
const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

describe('isOpportunityRotting', () => {
  const base = {
    stage: 'O2_CONTACTED',
    closedAt: null as Date | null,
    stageChangedAt: new Date(NOW.getTime() - DAYS(8)),
    createdAt: new Date(NOW.getTime() - DAYS(30)),
  };

  it('is true when stage clock is older than the per-stage threshold (O1/O2 = 7)', () => {
    expect(isOpportunityRotting(base, NOW)).toBe(true);
    expect(rottingAgeDays(base, NOW)).toBe(8);
  });

  it('O1 is rotting at 8 days', () => {
    const o1 = { ...base, stage: 'O1_LEAD' };
    expect(isOpportunityRotting(o1, NOW)).toBe(true);
    expect(rottingAgeDays(o1, NOW)).toBe(8);
  });

  it('O3 is not rotting at 8 days (threshold 14)', () => {
    const o3 = { ...base, stage: 'O3_TEST_SCHEDULED' };
    expect(isOpportunityRotting(o3, NOW)).toBe(false);
    expect(rottingAgeDays(o3, NOW)).toBeNull();
  });

  it('O3 is rotting at 15 days', () => {
    const o3 = {
      ...base,
      stage: 'O3_TEST_SCHEDULED',
      stageChangedAt: new Date(NOW.getTime() - DAYS(15)),
    };
    expect(isOpportunityRotting(o3, NOW)).toBe(true);
    expect(rottingAgeDays(o3, NOW)).toBe(15);
  });

  it('O4 is rotting at 8 days (threshold 7)', () => {
    const o4 = { ...base, stage: 'O4_TESTED' };
    expect(isOpportunityRotting(o4, NOW)).toBe(true);
    expect(rottingAgeDays(o4, NOW)).toBe(8);
  });

  it('is false when stage clock is exactly at the boundary (not strictly older)', () => {
    const atBoundary = {
      ...base,
      stageChangedAt: new Date(NOW.getTime() - DAYS(7)),
    };
    expect(isOpportunityRotting(atBoundary, NOW)).toBe(false);
    expect(rottingAgeDays(atBoundary, NOW)).toBeNull();
  });

  it('is false when stage clock is fresher than threshold', () => {
    const fresh = {
      ...base,
      stageChangedAt: new Date(NOW.getTime() - DAYS(3)),
    };
    expect(isOpportunityRotting(fresh, NOW)).toBe(false);
  });

  it('falls back to createdAt when stageChangedAt is null', () => {
    const noClock = {
      ...base,
      stageChangedAt: null,
      createdAt: new Date(NOW.getTime() - DAYS(10)),
    };
    expect(isOpportunityRotting(noClock, NOW)).toBe(true);
    expect(rottingAgeDays(noClock, NOW)).toBe(10);
  });

  it('never flags O5_ENROLLED', () => {
    expect(
      isOpportunityRotting(
        { ...base, stage: 'O5_ENROLLED', closedAt: new Date(NOW.getTime() - DAYS(1)) },
        NOW,
      ),
    ).toBe(false);
    expect(
      rottingAgeDays(
        { ...base, stage: 'O5_ENROLLED', closedAt: new Date(NOW.getTime() - DAYS(1)) },
        NOW,
      ),
    ).toBeNull();
  });

  it('never flags lost opportunities', () => {
    expect(
      isOpportunityRotting(
        { ...base, closedAt: new Date(NOW.getTime() - DAYS(1)) },
        NOW,
      ),
    ).toBe(false);
  });

  it('excludes opps with a future nextActionAt (P4 coordination)', () => {
    expect(
      isOpportunityRotting(
        {
          ...base,
          nextActionAt: new Date(NOW.getTime() + DAYS(1)),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it('still flags when nextActionAt is in the past', () => {
    expect(
      isOpportunityRotting(
        {
          ...base,
          nextActionAt: new Date(NOW.getTime() - DAYS(1)),
        },
        NOW,
      ),
    ).toBe(true);
  });
});
