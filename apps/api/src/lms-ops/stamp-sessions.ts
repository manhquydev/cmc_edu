// Stamp ClassSession.curriculumUnitId from ClassBatch unit neo + domain-lms.

import { deriveSessionUnits, type OrderedSession } from '@cmc/domain-lms';
import type { Prisma } from '@cmc/db';

function toHhmm(d: Date): string {
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Restamps non-cancelled sessions for a batch from neo (start unit order + anchor).
 * Must run in the same transaction as session create for spike create path.
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
  const maxOrder = units[units.length - 1]!.orderGlobal;
  const unitIdByOrder = new Map(units.map((u) => [u.orderGlobal, u.id]));

  const sessions = await tx.classSession.findMany({
    where: {
      classBatchId: opts.classBatchId,
      status: { not: 'cancelled' },
      sessionDate: { gte: opts.anchorDate },
    },
    select: { id: true, sessionDate: true, startTime: true },
  });

  const ordered: OrderedSession[] = sessions.map((s) => ({
    id: s.id,
    sessionDate: s.sessionDate,
    startTime: toHhmm(s.startTime),
  }));

  const stamps = deriveSessionUnits(opts.anchorOrderGlobal, maxOrder, ordered);
  let n = 0;
  for (const stamp of stamps) {
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
