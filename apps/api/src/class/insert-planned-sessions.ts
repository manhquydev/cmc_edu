import type { Prisma } from '@cmc/db';
import type { PlannedSession } from './generate-sessions.js';

function sessionClockKey(sessionDate: Date, startTime: Date): string {
  return `${sessionDate.toISOString()}|${startTime.toISOString()}`;
}

/**
 * Persist planned sessions that do not already exist for the same
 * (class, ICT day, start instant). Callers must build `startTime`/`endTime`
 * via `ictToUtc(date, 'HH:mm')` so the unique key compares bit-identically.
 *
 * New rows leave `teacherId` NULL: that means inherit ClassBatch.teacherId.
 */
export async function insertMissingPlannedSessions(
  tx: Prisma.TransactionClient,
  args: {
    facilityId: string;
    classBatchId: string;
    planned: readonly PlannedSession[];
  },
): Promise<{ created: number; alreadyExisting: number }> {
  if (args.planned.length === 0) {
    return { created: 0, alreadyExisting: 0 };
  }

  const existing = await tx.classSession.findMany({
    where: { facilityId: args.facilityId, classBatchId: args.classBatchId },
    select: { sessionDate: true, startTime: true },
  });
  const seen = new Set(existing.map((row) => sessionClockKey(row.sessionDate, row.startTime)));

  const toCreate: PlannedSession[] = [];
  for (const planned of args.planned) {
    const key = sessionClockKey(planned.sessionDate, planned.startTime);
    if (seen.has(key)) continue;
    seen.add(key);
    toCreate.push(planned);
  }

  let created = 0;
  if (toCreate.length > 0) {
    const result = await tx.classSession.createMany({
      data: toCreate.map((planned) => ({
        facilityId: args.facilityId,
        classBatchId: args.classBatchId,
        scheduleSlotId: planned.scheduleSlotId ?? null,
        sessionDate: planned.sessionDate,
        startTime: planned.startTime,
        endTime: planned.endTime,
      })),
      // Lookup is the count source. skipDuplicates is only the race net if
      // two regenerate calls both miss the same (class, day, start).
      skipDuplicates: true,
    });
    created = result.count;
  }

  return {
    created,
    alreadyExisting: args.planned.length - created,
  };
}
