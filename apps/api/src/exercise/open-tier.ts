// exercise.openForStudent / exercise.listForStudent — student homework surface.
//
// Single open path (B3): an exercise is open for a student only when it was
// **delivered** on a non-cancelled ClassSession (`SessionExercise`) and the
// student is on that session's dual-gate roster (active enrollment, not
// archived for the session day, **EnrollmentUnitRange covers session unit**
// via `onRoster` / `isEntitled` — this entitlement check is REQUIRED and is
// not the removed env flag `LMS_ENTITLEMENT_GATE`).
//
// Base filters: Exercise `status = published`; `blocked_lms` sees nothing
// (empty list / gate fail — and Guardian approval still excludes blocked
// children via `getApprovedChildren`).
//
// ADR 0038 Tier A (open whole unit after any ended teaching session) and the
// env flags `LMS_OPEN_TIER_ENABLED` / `LMS_ENTITLEMENT_GATE` are removed.
// Unit entitlement for homework is the dual-gate roster on the delivery path.
//
// `Exercise` is GLOBAL (no facilityId); enrollment/session reads run under
// `withFacility` for the student's facility. File name kept as `open-tier.ts`
// so external imports (`submission`, rewards, root router merge) stay stable;
// the public procedure name remains `exercise.openForStudent`.

import type { PrismaClient } from '@cmc/db';
import { withFacility } from '@cmc/db';
import { badRequest, forbidden, notFound } from '../errors.js';
import { deliveredExerciseIdsForStudent } from '../lms-ops/exercise-delivery.js';
import { lmsProcedure, requireLmsStudent, router } from '../trpc.js';
import { toExerciseDto, type ExerciseDto } from './router.js';
import { getApprovedChildren } from '../guardian/approved-children.js';

export interface LmsStudent {
  id: string;
  facilityId: string;
  lifecycle: string;
}

/**
 * Loads the student a `studentId` (from `requireLmsStudent`) refers to.
 *
 * OWNERSHIP GATE (TL08 §7, child-data boundary): `parentAccountId` is the
 * parent whose session is making the call. Before disclosing any student data
 * we verify that an approved `Guardian` row exists linking this parent to
 * this student — `getApprovedChildren` is the SINGLE approved-Guardian gate.
 */
export async function loadLmsStudent(
  db: PrismaClient,
  studentId: string,
  parentAccountId: string,
): Promise<LmsStudent> {
  const approvedChildren = await getApprovedChildren(db, parentAccountId);
  if (!approvedChildren.some((c) => c.studentId === studentId)) {
    throw forbidden('Student does not belong to this account.');
  }

  const student = await withFacility(
    db,
    null,
    (tx) =>
      tx.student.findUnique({
        where: { id: studentId },
        select: { id: true, facilityId: true, lifecycle: true },
      }),
    { bypass: true },
  );
  if (!student) {
    throw notFound('Student not found.');
  }
  return student;
}

/** Published exercises delivered to this student (SessionExercise + roster). */
export async function listOpenExercisesForStudent(
  db: PrismaClient,
  student: LmsStudent,
): Promise<ExerciseDto[]> {
  return withFacility(db, student.facilityId, async (tx) => {
    if (student.lifecycle === 'blocked_lms') return [];
    const exerciseIds = await deliveredExerciseIdsForStudent(tx, student);
    if (exerciseIds.size === 0) return [];
    const exercises = await tx.exercise.findMany({
      where: { id: { in: [...exerciseIds] }, status: 'published' },
      orderBy: { createdAt: 'asc' },
    });
    return exercises.map(toExerciseDto);
  });
}

/**
 * Guard for submission.saveDraft / submit: fail-closed unless the exercise is
 * published and was delivered to this student (on-roster for that session).
 */
export async function assertExerciseOpenForStudent(
  db: PrismaClient,
  student: LmsStudent,
  exercise: { id?: string; curriculumUnitId: string; status: string },
): Promise<void> {
  if (exercise.status !== 'published') {
    throw badRequest('Exercise is not published.');
  }
  if (student.lifecycle === 'blocked_lms') {
    throw badRequest(
      'Exercise is not available: student is blocked from LMS.',
    );
  }
  const id = exercise.id;
  if (!id) {
    throw badRequest(
      'Exercise is not available: no delivered homework for this student.',
    );
  }

  await withFacility(db, student.facilityId, async (tx) => {
    const exerciseIds = await deliveredExerciseIdsForStudent(tx, student);
    if (!exerciseIds.has(id)) {
      throw badRequest(
        'Exercise is not available: not delivered for this student (or student is not on the session roster).',
      );
    }
  });
}

export const exerciseOpenTierRouter = router({
  // Student-facing "what homework can I do right now" (delivery path only).
  openForStudent: lmsProcedure.query(async ({ ctx }): Promise<{ items: ExerciseDto[] }> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);
    const items = await listOpenExercisesForStudent(ctx.db, student);
    return { items };
  }),

  // Alias kept for clients that call listForStudent.
  listForStudent: lmsProcedure.query(async ({ ctx }): Promise<{ items: ExerciseDto[] }> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);
    const items = await listOpenExercisesForStudent(ctx.db, student);
    return { items };
  }),
});
