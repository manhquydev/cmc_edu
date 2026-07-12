// HR remediation phase 7: creditFactor boundary tests (docs/26 phase-07
// §Requirements). Each cliff (24h, 48h) is tested at -1s/exact/+1s so the
// `<=` (inclusive lower bucket) semantics are pinned exactly.

import { describe, expect, it } from 'vitest';
import { creditFactor } from './index.js';

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
