// Shared cancel + unit restamp + FinalGrade refresh (teaching spine cancel-unify).
// Used by classSession.cancel and lmsOps.cancelSessionAndRestamp so every cancel
// path restamps non-cancelled sessions from neo (no makeup).

import type { Prisma } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { recomputeFinalGrade } from '../submission/router.js';
import { restampBatchSessions } from './stamp-sessions.js';

export interface CancelSessionResult {
  session: {
    id: string;
    facilityId: string;
    classBatchId: string;
    scheduleSlotId: string | null;
    sessionDate: Date;
    startTime: Date;
    endTime: Date;
    status: string;
    isMakeup: boolean;
    curriculumUnitId: string | null;
  };
  restamped: number;
}

/**
 * Cancel a non-done session, restamp remaining non-cancelled (non-done frozen)
 * sessions from class neo, and recompute FinalGrade for any attendance rows
 * on the cancelled session.
 */
export async function cancelSessionWithRestamp(
  tx: Prisma.TransactionClient,
  opts: {
    facilityId: string;
    sessionId: string;
    actorUserId: string;
    /** Audit action string for AuditLog.action */
    auditAction: string;
  },
): Promise<CancelSessionResult> {
  const session = await tx.classSession.findFirst({
    where: { id: opts.sessionId, facilityId: opts.facilityId },
    include: {
      classBatch: {
        select: {
          id: true,
          program: true,
          currentUnitId: true,
          currentUnitAnchor: true,
          startUnitId: true,
        },
      },
    },
  });
  if (!session) throw notFound('ClassSession not found.');
  if (session.status === 'cancelled') throw badRequest('Session is already cancelled.');
  if (session.status === 'done') throw badRequest('A done session cannot be cancelled.');

  const updated = await tx.classSession.update({
    where: { id: session.id },
    data: { status: 'cancelled' },
  });

  let restamped = 0;
  const batch = session.classBatch;
  const unitId = batch.currentUnitId ?? batch.startUnitId;
  if (unitId) {
    const unit = await tx.curriculumUnit.findUnique({
      where: { id: unitId },
      select: { orderGlobal: true },
    });
    if (unit) {
      const anchor = batch.currentUnitAnchor ?? new Date(0);
      restamped = await restampBatchSessions(tx, {
        classBatchId: batch.id,
        program: batch.program,
        anchorOrderGlobal: unit.orderGlobal,
        anchorDate: anchor,
      });
    }
  }

  await tx.auditLog.create({
    data: {
      actor: opts.actorUserId,
      action: opts.auditAction,
      entity: 'ClassSession',
      entityId: updated.id,
      data: {
        facilityId: opts.facilityId,
        previousStatus: session.status,
        restamped,
      },
    },
  });

  // FinalGrade attendance-rate denominator excludes cancelled sessions.
  const affected = await tx.attendance.findMany({
    where: { classSessionId: session.id, facilityId: opts.facilityId },
    select: { studentId: true },
  });
  const studentIds = new Set(affected.map((a) => a.studentId));
  for (const studentId of studentIds) {
    await recomputeFinalGrade(tx, {
      facilityId: opts.facilityId,
      studentId,
      periodAnchor: session.endTime,
    });
  }

  return {
    session: {
      id: updated.id,
      facilityId: updated.facilityId,
      classBatchId: updated.classBatchId,
      scheduleSlotId: updated.scheduleSlotId,
      sessionDate: updated.sessionDate,
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status,
      isMakeup: updated.isMakeup,
      curriculumUnitId: updated.curriculumUnitId,
    },
    restamped,
  };
}
