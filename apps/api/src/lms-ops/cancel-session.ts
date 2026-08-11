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

  // Race-safe: only planned/confirmed can flip to cancelled (same pattern as
  // session-done sweep). Prevents overwriting a concurrent done transition.
  const flipped = await tx.classSession.updateMany({
    where: {
      id: session.id,
      facilityId: opts.facilityId,
      status: { in: ['planned', 'confirmed'] },
    },
    data: { status: 'cancelled' },
  });
  if (flipped.count === 0) {
    const again = await tx.classSession.findFirst({
      where: { id: session.id, facilityId: opts.facilityId },
      select: { status: true },
    });
    if (!again) throw notFound('ClassSession not found.');
    if (again.status === 'cancelled') throw badRequest('Session is already cancelled.');
    if (again.status === 'done') throw badRequest('A done session cannot be cancelled.');
    throw badRequest('Session cannot be cancelled in its current status.');
  }

  const updated = await tx.classSession.findFirstOrThrow({
    where: { id: session.id, facilityId: opts.facilityId },
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

  // Class-unit-spec §8.3: cancelled session must not burn sequence position.
  // Revoke SessionExercise when no student has submitted that exercise yet.
  const delivery = await tx.sessionExercise.findUnique({
    where: { classSessionId: session.id },
    select: { id: true, exerciseId: true },
  });
  if (delivery) {
    const submissionCount = await tx.submission.count({
      where: {
        exerciseId: delivery.exerciseId,
        facilityId: opts.facilityId,
        status: { not: 'draft' },
      },
    });
    if (submissionCount === 0) {
      await tx.sessionExercise.delete({ where: { id: delivery.id } });
    }
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
