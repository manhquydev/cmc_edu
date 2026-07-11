// HR remediation phase 7: session-done sweep worker (docs/26 phase-07,
// plan.md "Session-done engine"). Two independent tasks, both sweep-only —
// no event hooks on attendance/assessment/evidence routers (R2 #1: hooking
// those races across separate transactions with no real-time consumer).
//
//   A. Done-sweep: every `planned|confirmed` session past its own `endTime`
//      is re-evaluated via `markSessionDoneIfEligible` (../class/session-done.js).
//   B. Cancel + tail-append: a session past `endTime + 24h` with 0 `present`
//      attendance auto-cancels, then a makeup session is generated NOSED
//      onto the tail of its own recurring slot (same `scheduleSlotId`, next
//      occurrence after the batch's current last session date) — full-auto
//      per the user's decision (R2-Q2); a room conflict skips creation and
//      reports it in the sweep result instead (person only steps in then).
//
// Both tasks process one session per `withFacility(..., { bypass: true })`
// transaction (not one big transaction for the whole batch) so one
// session's failure/race never rolls back another's already-committed work
// — same isolation shape as reconcile-orphaned-receipts.ts's per-outcome loop.

import { withFacility, type Prisma, type PrismaClient } from '@cmc/db';
import { addDaysToDateOnly, ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import type { PlannedSession } from '../class/generate-sessions.js';
import { assertNoRoomConflict } from '../class/room-conflict.js';
import { markSessionDoneIfEligible } from '../class/session-done.js';

/** R2 #4: grace window after `endTime` before a 0-present session auto-cancels
 * — gives a teacher who marks attendance late a chance to avoid the cancel. */
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
  makeupSessionId: string | null;
  /** true when a makeup was needed but a room conflict blocked auto-creation
   * — the UI ("buổi hủy chưa xếp bù — cần xử lý") is expected to surface any
   * cancelled session whose reverse `makeupSession` relation is still empty. */
  roomConflict: boolean;
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
      (tx) => cancelAndTailAppend(tx, candidate.id),
      { bypass: true },
    );
    if (outcome) outcomes.push(outcome);
  }
  return outcomes;
}

/**
 * Conditional single-statement cancel (`WHERE status IN (...) AND
 * attendances NONE present`) — a teacher marking attendance late races
 * safely against this: if a `present` row lands first, the `updateMany`
 * matches 0 rows and this session is left alone. Only a successful cancel
 * (count === 1) proceeds to consider a makeup.
 */
async function cancelAndTailAppend(
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
    select: { facilityId: true, classBatchId: true, scheduleSlotId: true },
  });

  // Ad-hoc sessions (classSession.addMakeup) have no scheduleSlotId and thus
  // no recurring pattern to extend — cancel only, nothing to tail-append.
  if (!session.scheduleSlotId) {
    return { sessionId, makeupSessionId: null, roomConflict: false };
  }

  const scheduleSlot = await tx.scheduleSlot.findUniqueOrThrow({ where: { id: session.scheduleSlotId } });
  const maxDate = await tx.classSession.aggregate({
    where: { classBatchId: session.classBatchId, scheduleSlotId: session.scheduleSlotId },
    _max: { sessionDate: true },
  });
  // Same weekday slot, 7 days after the batch's current latest session in
  // this slot (cancelled/makeup rows included — the tail always follows the
  // true chronological last occurrence so repeated 0-present cancels converge).
  const lastDateOnly = ictDateOnlyOf(maxDate._max.sessionDate ?? new Date());
  const nextDateOnly = addDaysToDateOnly(lastDateOnly, 7);

  const planned: PlannedSession = {
    scheduleSlotId: session.scheduleSlotId,
    sessionDate: ictToUtc(nextDateOnly, '00:00'),
    startTime: ictToUtc(nextDateOnly, scheduleSlot.startTime),
    endTime: ictToUtc(nextDateOnly, scheduleSlot.endTime),
  };

  const classBatch = await tx.classBatch.findUniqueOrThrow({ where: { id: session.classBatchId } });

  if (classBatch.roomId) {
    try {
      await assertNoRoomConflict(tx, session.facilityId, classBatch.roomId, [planned], classBatch.id);
    } catch {
      return { sessionId, makeupSessionId: null, roomConflict: true };
    }
  }

  try {
    const makeup = await tx.classSession.create({
      data: {
        facilityId: session.facilityId,
        classBatchId: session.classBatchId,
        scheduleSlotId: session.scheduleSlotId,
        sessionDate: planned.sessionDate,
        startTime: planned.startTime,
        endTime: planned.endTime,
        isMakeup: true,
        makeupForSessionId: sessionId,
      },
    });
    return { sessionId, makeupSessionId: makeup.id, roomConflict: false };
  } catch (err) {
    // P2002 on the `makeupForSessionId` unique column — a concurrent replica
    // already created the makeup for this exact session; idempotent no-op.
    if ((err as { code?: string }).code === 'P2002') {
      const existing = await tx.classSession.findUnique({
        where: { makeupForSessionId: sessionId },
        select: { id: true },
      });
      return { sessionId, makeupSessionId: existing?.id ?? null, roomConflict: false };
    }
    throw err;
  }
}
