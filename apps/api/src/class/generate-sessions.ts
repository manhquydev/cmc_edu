// Core auto-generation logic for `classBatch.create` and
// `schedule.generateSessions` (docs/26 WF-P2-01). Pure function -- no Prisma
// import -- computing every (date, slot) pair to materialize as a
// `ClassSession`; both callers persist the result via
// `classSession.createMany({ skipDuplicates: true })`, which is what makes
// re-generation idempotent (the DB unique index on
// `[classBatchId, scheduleSlotId, sessionDate]` is the actual de-dupe
// mechanism -- this function does not need to know which sessions already
// exist).

import { addDaysToDateOnly, compareDateOnly, ictToUtc, weekdayOf } from './ict-time.js';

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
