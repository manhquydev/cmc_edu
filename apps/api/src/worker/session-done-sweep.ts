// Session-done sweep worker (docs/26 phase-07).
//
//   A. Done-sweep: every `planned|confirmed` session past its own `endTime`
//      is re-evaluated via `markSessionDoneIfEligible`.
//   B. Cancel (no makeup): a session past `endTime + 24h` with 0 `present`
//      attendance auto-cancels, then restamps remaining sessions from class
//      neo (Plan 2 owner rule: cancel restamps units; no makeup).
//
// Both tasks process one session per `withFacility(..., { bypass: true })`
// transaction so one session's failure never rolls back another's work.

import { withFacility, type Prisma, type PrismaClient } from '@cmc/db';
import { markSessionDoneIfEligible } from '../class/session-done.js';
import { recomputeFinalGrade } from '../submission/router.js';
import { restampBatchSessions } from '../lms-ops/stamp-sessions.js';

/** Grace after `endTime` before a 0-present session auto-cancels. */
const CANCEL_GRACE_MS = 24 * 60 * 60 * 1_000;

export interface RunDoneSweepResult {
  markedDone: number;
}

/** Task A. Exported for the worker loop; also callable directly in tests. */
export async function runDoneSweep(db: PrismaClient, now: Date = new Date()): Promise<RunDoneSweepResult> {
  const candidates = await withFacility(
    db,
    null,
    (tx) =>
      tx.classSession.findMany({
        where: { status: { in: ['planned', 'confirmed'] }, endTime: { lte: now } },
        select: { id: true },
      }),
    { bypass: true },
  );

  let markedDone = 0;
  for (const candidate of candidates) {
    const result = await withFacility(
      db,
      null,
      (tx) => markSessionDoneIfEligible(tx, candidate.id, now),
      { bypass: true },
    );
    if (result) markedDone++;
  }
  return { markedDone };
}

export interface CancelSweepOutcome {
  sessionId: string;
  /** Always false — room conflict only applied to the removed makeup path. */
  roomConflict: boolean;
  restamped: number;
}

/** Task B. Exported for the worker loop; also callable directly in tests. */
export async function runCancelSweep(db: PrismaClient, now: Date = new Date()): Promise<CancelSweepOutcome[]> {
  const cutoff = new Date(now.getTime() - CANCEL_GRACE_MS);
  const candidates = await withFacility(
    db,
    null,
    (tx) =>
      tx.classSession.findMany({
        where: { status: { in: ['planned', 'confirmed'] }, endTime: { lte: cutoff } },
        select: { id: true },
      }),
    { bypass: true },
  );

  const outcomes: CancelSweepOutcome[] = [];
  for (const candidate of candidates) {
    const outcome = await withFacility(
      db,
      null,
      (tx) => cancelZeroPresentWithRestamp(tx, candidate.id),
      { bypass: true },
    );
    if (outcome) outcomes.push(outcome);
  }
  return outcomes;
}

/**
 * Race-safe cancel when no present attendance, then restamp + delivery revoke.
 * Does NOT create makeup sessions (Plan 2 owner: no makeup).
 */
async function cancelZeroPresentWithRestamp(
  tx: Prisma.TransactionClient,
  sessionId: string,
): Promise<CancelSweepOutcome | null> {
  const cancelled = await tx.classSession.updateMany({
    where: {
      id: sessionId,
      status: { in: ['planned', 'confirmed'] },
      attendances: { none: { status: 'present' } },
    },
    data: { status: 'cancelled' },
  });
  if (cancelled.count === 0) return null;

  const session = await tx.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: {
      id: true,
      facilityId: true,
      classBatchId: true,
      endTime: true,
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
      actor: 'system',
      action: 'worker.cancelSweep.restamp',
      entity: 'ClassSession',
      entityId: session.id,
      data: {
        facilityId: session.facilityId,
        classBatchId: session.classBatchId,
        restamped,
      },
    },
  });

  const affected = await tx.attendance.findMany({
    where: { classSessionId: session.id, facilityId: session.facilityId },
    select: { studentId: true },
  });
  const studentIds = new Set(affected.map((a) => a.studentId));
  for (const studentId of studentIds) {
    await recomputeFinalGrade(tx, {
      facilityId: session.facilityId,
      studentId,
      periodAnchor: session.endTime,
    });
  }

  const delivery = await tx.sessionExercise.findUnique({
    where: { classSessionId: session.id },
    select: { id: true, exerciseId: true },
  });
  if (delivery) {
    const submissionCount = await tx.submission.count({
      where: {
        exerciseId: delivery.exerciseId,
        facilityId: session.facilityId,
        status: { not: 'draft' },
      },
    });
    if (submissionCount === 0) {
      await tx.sessionExercise.delete({ where: { id: delivery.id } });
    }
  }

  return {
    sessionId,
    roomConflict: false,
    restamped,
  };
}
