import type { Prisma } from '@cmc/db';
import type { PlannedSession } from './generate-sessions.js';

function sessionClockKey(sessionDate: Date, startTime: Date): string {
  return `${sessionDate.toISOString()}|${startTime.toISOString()}`;
}

/**
 * Persist planned sessions that do not already exist for the same
 * (class, ICT day, start instant). Callers must build `startTime`/`endTime`
 * via `ictToUtc(date, 'HH:mm')` so the unique key compares bit-identically.
 */
export async function insertMissingPlannedSessions(
  tx: Prisma.TransactionClient,
  args: {
    facilityId: string;
    classBatchId: string;
    teacherId: string | null;
    planned: readonly PlannedSession[];
  },
): Promise<{ created: number; alreadyExisting: number }> {
  if (args.planned.length === 0) {
    return { created: 0, alreadyExisting: 0 };
  }

  const existing = await tx.classSession.findMany({
    where: { classBatchId: args.classBatchId },
    select: { sessionDate: true, startTime: true },
  });
  const seen = new Set(existing.map((row) => sessionClockKey(row.sessionDate, row.startTime)));

  const toCreate = [];
  for (const planned of args.planned) {
    const key = sessionClockKey(planned.sessionDate, planned.startTime);
    if (seen.has(key)) continue;
    seen.add(key);
    toCreate.push(planned);
  }

  if (toCreate.length > 0) {
    await tx.classSession.createMany({
      data: toCreate.map((planned) => ({
        facilityId: args.facilityId,
        classBatchId: args.classBatchId,
        scheduleSlotId: planned.scheduleSlotId ?? null,
        sessionDate: planned.sessionDate,
        startTime: planned.startTime,
        endTime: planned.endTime,
        teacherId: args.teacherId,
      })),
      // Lookup is the count source. skipDuplicates is only the race net if
      // two regenerate calls both miss the same (class, day, start).
      skipDuplicates: true,
    });
  }

  return {
    created: toCreate.length,
    alreadyExisting: args.planned.length - toCreate.length,
  };
}
