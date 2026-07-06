// Core auto-generation logic for `classBatch.create` and
// `schedule.generateSessions` (docs/26 WF-P2-01). Pure function -- no Prisma
// import -- computing every (date, slot) pair to materialize as a
// `ClassSession`; both callers persist the result via
// `classSession.createMany({ skipDuplicates: true })`, which is what makes
// re-generation idempotent (the DB unique index on
// `[classBatchId, scheduleSlotId, sessionDate]` is the actual de-dupe
// mechanism -- this function does not need to know which sessions already
// exist).

import { addDaysToDateOnly, compareDateOnly, ictToUtc, weekdayOf } from '@cmc/domain-time';

export interface SlotForPlanning {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface PlannedSession {
  scheduleSlotId: string | undefined;
  sessionDate: Date;
  startTime: Date;
  endTime: Date;
}

/** Upper bound on a class batch's [startDate,endDate] span (~2 years). Guards
 * against an unbounded range materializing millions of sessions in one request
 * (G1 review M2); real programs run <=12 months (docs/19 §1). */
export const MAX_CLASS_SPAN_DAYS = 730;

/** Inclusive day count between two YYYY-MM-DD dates (>=1 for a valid range;
 * 0 or negative for an inverted range). Pure — callers throw BAD_REQUEST. */
export function spanDaysInclusive(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.floor((end - start) / 86_400_000) + 1;
}

/**
 * Computes every (date, slot) pair in `[startDate, endDate]` (inclusive)
 * whose weekday matches a slot's weekday -- one planned `ClassSession` per
 * match ("so buoi = so ngay khop weekday x so slot"). Returns an empty array
 * for an empty/inverted range -- callers are responsible for rejecting
 * `startDate > endDate` as `BAD_REQUEST` before calling this (this function
 * does not throw on that input, it simply plans zero sessions).
 */
export function planClassSessions(
  startDate: string,
  endDate: string,
  slots: readonly SlotForPlanning[],
): PlannedSession[] {
  const planned: PlannedSession[] = [];
  if (slots.length === 0 || compareDateOnly(startDate, endDate) > 0) {
    return planned;
  }

  for (let date = startDate; compareDateOnly(date, endDate) <= 0; date = addDaysToDateOnly(date, 1)) {
    const weekday = weekdayOf(date);
    for (const slot of slots) {
      if (slot.weekday !== weekday) continue;
      planned.push({
        scheduleSlotId: slot.id,
        sessionDate: ictToUtc(date, '00:00'),
        startTime: ictToUtc(date, slot.startTime),
        endTime: ictToUtc(date, slot.endTime),
      });
    }
  }
  return planned;
}
