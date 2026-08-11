// Exercise delivery: freeze class sequence + deliver one exercise per ended session.
// Spec spirit: class-unit-spec §8 (port from cmc-lms). Monorepo uses Exercise catalog.

import {
  nextDeliverablePosition,
  planSequenceUpdate,
  type SequenceItem,
} from '@cmc/domain-lms';
import type { Prisma, PrismaClient } from '@cmc/db';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { onRoster } from './on-roster.js';
import { ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

export interface DeliveredSessionExercise {
  id: string;
  classSessionId: string;
  exerciseId: string;
  position: number;
  deliveredAt: Date;
}

export async function deliveredPositionsForBatch(tx: Tx, classBatchId: string): Promise<number[]> {
  const rows = await tx.sessionExercise.findMany({
    where: { classSession: { classBatchId } },
    select: { position: true },
  });
  return rows.map((r) => r.position);
}

export async function deliveredCountForBatch(tx: Tx, classBatchId: string): Promise<number> {
  const agg = await tx.sessionExercise.aggregate({
    where: { classSession: { classBatchId } },
    _max: { position: true },
  });
  return agg._max.position ?? 0;
}

export async function sequenceForBatch(tx: Tx, classBatchId: string): Promise<SequenceItem[]> {
  const rows = await tx.classExerciseItem.findMany({
    where: { classBatchId },
    orderBy: { position: 'asc' },
    select: { position: true, exerciseId: true },
  });
  return rows;
}

/**
 * Freeze / reassign class exercise sequence. Positions already delivered
 * (MAX SessionExercise.position) are kept; only positions after that boundary
 * are replaced. Unit restamp never touches this pointer.
 */
export async function writeSequenceUpdate(
  tx: Tx,
  opts: {
    facilityId: string;
    classBatchId: string;
    exerciseIds: string[];
  },
): Promise<{ deliveredCount: number; items: SequenceItem[] }> {
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext($1::text), 91004)`,
    opts.classBatchId,
  );

  const batch = await tx.classBatch.findFirst({
    where: { id: opts.classBatchId, facilityId: opts.facilityId },
    select: { id: true },
  });
  if (!batch) throw notFound('ClassBatch not found.');

  if (opts.exerciseIds.length === 0) {
    throw badRequest('At least one exerciseId is required for the class sequence.');
  }
  if (new Set(opts.exerciseIds).size !== opts.exerciseIds.length) {
    throw badRequest('exerciseIds must be unique.');
  }

  const exercises = await tx.exercise.findMany({
    where: { id: { in: opts.exerciseIds }, status: 'published' },
    select: { id: true },
  });
  if (exercises.length !== opts.exerciseIds.length) {
    throw badRequest('Every exerciseId must exist and be published.');
  }

  const current = await sequenceForBatch(tx, opts.classBatchId);
  const deliveredCount = await deliveredCountForBatch(tx, opts.classBatchId);
  const plan = planSequenceUpdate(current, opts.exerciseIds, deliveredCount);

  await tx.classExerciseItem.deleteMany({
    where: { classBatchId: opts.classBatchId, position: { gt: deliveredCount } },
  });
  if (plan.replaced.length > 0) {
    const { randomUUID } = await import('node:crypto');
    await tx.classExerciseItem.createMany({
      data: plan.replaced.map((item) => ({
        id: randomUUID(),
        facilityId: opts.facilityId,
        classBatchId: opts.classBatchId,
        position: item.position,
        exerciseId: item.exerciseId,
      })),
    });
  }

  return {
    deliveredCount,
    items: await sequenceForBatch(tx, opts.classBatchId),
  };
}

/**
 * Deliver next sequence item (or unit-stamped homework fallback) for one session.
 * Idempotent: if SessionExercise already exists, returns it.
 * Skips cancelled sessions and sessions that have not ended.
 */
export async function deliverForSession(
  tx: Tx,
  opts: { facilityId: string; classSessionId: string; now?: Date },
): Promise<DeliveredSessionExercise | null> {
  const now = opts.now ?? new Date();
  const session = await tx.classSession.findFirst({
    where: { id: opts.classSessionId, facilityId: opts.facilityId },
    select: {
      id: true,
      facilityId: true,
      classBatchId: true,
      status: true,
      endTime: true,
      curriculumUnitId: true,
      deliveredExercise: {
        select: { id: true, classSessionId: true, exerciseId: true, position: true, deliveredAt: true },
      },
    },
  });
  if (!session) throw notFound('ClassSession not found.');
  if (session.status === 'cancelled') {
    throw badRequest('Cannot deliver exercise for a cancelled session.');
  }
  if (session.deliveredExercise) {
    return session.deliveredExercise;
  }
  if (session.endTime.getTime() > now.getTime()) {
    throw badRequest('Session has not ended yet; delivery runs after endTime.');
  }

  // Serialize deliver per batch (prevents double-assign of the same position).
  await tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext($1::text), 91005)`,
    session.classBatchId,
  );
  // Re-check after lock.
  const again = await tx.sessionExercise.findUnique({
    where: { classSessionId: session.id },
    select: { id: true, classSessionId: true, exerciseId: true, position: true, deliveredAt: true },
  });
  if (again) return again;

  const sequence = await sequenceForBatch(tx, session.classBatchId);
  let exerciseId: string | null = null;
  let position = 0;

  if (sequence.length > 0) {
    const deliveredPositions = await deliveredPositionsForBatch(tx, session.classBatchId);
    const nextPos = nextDeliverablePosition(
      deliveredPositions,
      sequence[sequence.length - 1]!.position,
    );
    if (nextPos == null) {
      return null; // sequence exhausted — not an error
    }
    const item = sequence.find((s) => s.position === nextPos);
    if (!item) return null;
    exerciseId = item.exerciseId;
    position = item.position;
  } else if (session.curriculumUnitId) {
    // Fallback: published homework for the stamped unit (no frozen sequence).
    const homework = await tx.exercise.findFirst({
      where: {
        curriculumUnitId: session.curriculumUnitId,
        type: 'homework',
        status: 'published',
      },
      select: { id: true },
    });
    if (!homework) return null;
    exerciseId = homework.id;
    // Synthetic position: count existing deliveries + 1 (gap-free for unit path).
    const count = await tx.sessionExercise.count({
      where: { classSession: { classBatchId: session.classBatchId } },
    });
    position = count + 1;
  } else {
    return null;
  }

  const { randomUUID } = await import('node:crypto');
  const created = await tx.sessionExercise.create({
    data: {
      id: randomUUID(),
      facilityId: session.facilityId,
      classSessionId: session.id,
      exerciseId,
      position,
    },
    select: {
      id: true,
      classSessionId: true,
      exerciseId: true,
      position: true,
      deliveredAt: true,
    },
  });
  return created;
}

/**
 * Worker entry: deliver for all non-cancelled sessions that have ended and
 * still lack SessionExercise. Uses bypass so multi-facility is covered.
 */
export async function deliverDueExercises(
  db: PrismaClient,
  opts?: { now?: Date; limit?: number },
): Promise<{ delivered: number; skipped: number }> {
  const now = opts?.now ?? new Date();
  const limit = opts?.limit ?? 100;
  // Match cmc-lms: only scan recent ended sessions (avoid poison backlog).
  const windowMs = 14 * 24 * 60 * 60_000;
  const notBefore = new Date(now.getTime() - windowMs);

  const due = await withFacility(
    db,
    null,
    (tx) =>
      tx.classSession.findMany({
        where: {
          status: { not: 'cancelled' },
          endTime: { lte: now, gte: notBefore },
          deliveredExercise: null,
        },
        select: { id: true, facilityId: true },
        orderBy: { endTime: 'asc' },
        take: limit,
      }),
    { bypass: true },
  );

  let delivered = 0;
  let skipped = 0;
  for (const s of due) {
    try {
      const row = await withFacility(db, s.facilityId, (tx) =>
        deliverForSession(tx, { facilityId: s.facilityId, classSessionId: s.id, now }),
      );
      if (row) delivered += 1;
      else skipped += 1;
    } catch (err) {
      skipped += 1;
      // eslint-disable-next-line no-console
      console.error('[deliverDueExercises] session', s.id, err);
    }
  }
  return { delivered, skipped };
}

/**
 * Dual-gate student ids that may receive homework for a session (roster D1).
 * Used by delivery visibility and tests.
 */
export async function rosterStudentIdsForSession(
  tx: Tx,
  opts: {
    facilityId: string;
    classBatchId: string;
    sessionDate: Date;
    sessionOrderGlobal: number | null;
  },
): Promise<string[]> {
  const enrollments = await tx.enrollment.findMany({
    where: { classBatchId: opts.classBatchId, facilityId: opts.facilityId },
    include: {
      student: { select: { id: true, lifecycle: true } },
      unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } },
    },
  });
  const out: string[] = [];
  for (const e of enrollments) {
    const archivedDayUtc = e.archivedAt
      ? ictToUtc(ictDateOnlyOf(e.archivedAt), '00:00')
      : null;
    if (
      onRoster({
        enrollmentStatus: e.status,
        studentLifecycle: e.student.lifecycle,
        archivedDayUtc,
        sessionDate: opts.sessionDate,
        sessionOrderGlobal: opts.sessionOrderGlobal,
        ranges: e.unitRanges,
      })
    ) {
      out.push(e.student.id);
    }
  }
  return out;
}

/** Open exercise ids for a student via SessionExercise delivery (kill-switch path). */
export async function deliveredExerciseIdsForStudent(
  tx: Tx,
  student: { id: string; facilityId: string },
): Promise<Set<string>> {
  const enrollments = await tx.enrollment.findMany({
    where: { studentId: student.id, status: 'active' },
    select: {
      classBatchId: true,
      archivedAt: true,
      unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } },
      student: { select: { lifecycle: true } },
      status: true,
    },
  });
  if (enrollments.length === 0) return new Set();

  const batchIds = enrollments.map((e) => e.classBatchId);
  const deliveries = await tx.sessionExercise.findMany({
    where: {
      classSession: {
        classBatchId: { in: batchIds },
        status: { not: 'cancelled' },
      },
    },
    select: {
      exerciseId: true,
      classSession: {
        select: {
          classBatchId: true,
          sessionDate: true,
          curriculumUnit: { select: { orderGlobal: true } },
        },
      },
    },
  });

  const open = new Set<string>();
  for (const d of deliveries) {
    const enrollment = enrollments.find((e) => e.classBatchId === d.classSession.classBatchId);
    if (!enrollment) continue;
    const archivedDayUtc = enrollment.archivedAt
      ? ictToUtc(ictDateOnlyOf(enrollment.archivedAt), '00:00')
      : null;
    const sessionOrderGlobal = d.classSession.curriculumUnit?.orderGlobal ?? null;
    if (
      !onRoster({
        enrollmentStatus: enrollment.status,
        studentLifecycle: enrollment.student.lifecycle,
        archivedDayUtc,
        sessionDate: d.classSession.sessionDate,
        sessionOrderGlobal,
        ranges: enrollment.unitRanges,
      })
    ) {
      continue;
    }
    open.add(d.exerciseId);
  }
  return open;
}
