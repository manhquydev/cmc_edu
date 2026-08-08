import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROTTING_THRESHOLD_DAYS,
  getRottingThresholdDays,
  isOpportunityRotting,
} from './rotting.js';

const NOW = new Date('2026-08-09T12:00:00.000Z');
const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

describe('getRottingThresholdDays', () => {
  it('defaults to 7', () => {
    expect(getRottingThresholdDays({})).toBe(DEFAULT_ROTTING_THRESHOLD_DAYS);
  });

  it('reads ROTTING_THRESHOLD_DAYS when positive', () => {
    expect(getRottingThresholdDays({ ROTTING_THRESHOLD_DAYS: '3' })).toBe(3);
  });

  it('falls back on invalid values', () => {
    expect(getRottingThresholdDays({ ROTTING_THRESHOLD_DAYS: '0' })).toBe(7);
    expect(getRottingThresholdDays({ ROTTING_THRESHOLD_DAYS: 'nope' })).toBe(7);
  });
});

describe('isOpportunityRotting', () => {
  const base = {
    stage: 'O2_CONTACTED',
    closedAt: null as Date | null,
    stageChangedAt: new Date(NOW.getTime() - DAYS(8)),
    createdAt: new Date(NOW.getTime() - DAYS(30)),
  };

  it('is true when stage clock is older than threshold (age > days)', () => {
    expect(isOpportunityRotting(base, NOW, 7)).toBe(true);
  });

  it('is false when stage clock is exactly at the boundary (not strictly older)', () => {
    const atBoundary = {
      ...base,
      stageChangedAt: new Date(NOW.getTime() - DAYS(7)),
    };
    // anchor === now - threshold → NOT < → not rotting
    expect(isOpportunityRotting(atBoundary, NOW, 7)).toBe(false);
  });

  it('is false when stage clock is fresher than threshold', () => {
    const fresh = {
      ...base,
      stageChangedAt: new Date(NOW.getTime() - DAYS(3)),
    };
    expect(isOpportunityRotting(fresh, NOW, 7)).toBe(false);
  });

  it('falls back to createdAt when stageChangedAt is null', () => {
    const noClock = {
      ...base,
      stageChangedAt: null,
      createdAt: new Date(NOW.getTime() - DAYS(10)),
    };
    expect(isOpportunityRotting(noClock, NOW, 7)).toBe(true);
  });

  it('never flags O5_ENROLLED', () => {
    expect(
      isOpportunityRotting(
        { ...base, stage: 'O5_ENROLLED', closedAt: new Date(NOW.getTime() - DAYS(1)) },
        NOW,
        7,
      ),
    ).toBe(false);
  });

  it('never flags lost opportunities', () => {
    expect(
      isOpportunityRotting(
        { ...base, closedAt: new Date(NOW.getTime() - DAYS(1)) },
        NOW,
        7,
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
        7,
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
        7,
      ),
    ).toBe(true);
  });
});
