// Stamp ClassSession.curriculumUnitId from ClassBatch unit neo + domain-lms.

import {
  deriveSessionUnits,
  toProgramUnitAxis,
  type OrderedSession,
} from '@cmc/domain-lms';
import type { Prisma } from '@cmc/db';

function toHhmm(d: Date): string {
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Restamps non-cancelled sessions for a batch from neo (start unit order + anchor).
 * Must run in the same transaction as session create for spike create path.
 *
 * Progression math counts every non-cancelled session (including `done`).
 * Writes only freeze-open statuses: never rewrite `done` teaching history
 * (domain-lms: API decides which stamps to write).
 */
export async function restampBatchSessions(
  tx: Prisma.TransactionClient,
  opts: {
    classBatchId: string;
    program: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE';
    anchorOrderGlobal: number;
    /** Sessions at/after this date are re-derived; pass epoch to stamp all. */
    anchorDate: Date;
  },
): Promise<number> {
  const units = await tx.curriculumUnit.findMany({
    where: { program: opts.program },
    select: { id: true, orderGlobal: true },
    orderBy: { orderGlobal: 'asc' },
  });
  if (units.length === 0) return 0;
  // Full ascending spine of real order_global labels — progression walks this
  // list by index so Bright I.G gaps (40/44/…) are skipped, not invented.
  const programAxis = toProgramUnitAxis(units.map((u) => u.orderGlobal));
  const unitIdByOrder = new Map(units.map((u) => [u.orderGlobal, u.id]));

  const sessions = await tx.classSession.findMany({
    where: {
      classBatchId: opts.classBatchId,
      status: { not: 'cancelled' },
      sessionDate: { gte: opts.anchorDate },
    },
    select: { id: true, sessionDate: true, startTime: true, status: true },
  });

  const ordered: OrderedSession[] = sessions.map((s) => ({
    id: s.id,
    sessionDate: s.sessionDate,
    startTime: toHhmm(s.startTime),
  }));

  const frozenIds = new Set(sessions.filter((s) => s.status === 'done').map((s) => s.id));
  const stamps = deriveSessionUnits(opts.anchorOrderGlobal, programAxis, ordered);
  let n = 0;
  for (const stamp of stamps) {
    if (frozenIds.has(stamp.id)) continue;
    const unitId = unitIdByOrder.get(stamp.order);
    if (!unitId) continue;
    await tx.classSession.update({
      where: { id: stamp.id },
      data: { curriculumUnitId: unitId },
    });
    n += 1;
  }
  return n;
}
