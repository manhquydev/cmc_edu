// exercise.openForStudent / exercise.listForStudent — student homework surface.
//
// Single open path (B3): an exercise is open for a student only when it was
// **delivered** on a non-cancelled ClassSession (`SessionExercise`) and the
// student is on that session's dual-gate roster (active enrollment, not
// archived for the session day, **EnrollmentUnitRange covers session unit**
// via `onRoster` / `isEntitled` — this entitlement check is REQUIRED and is
// not the removed env flag `LMS_ENTITLEMENT_GATE`).
//
// B4: submissions attach to `sessionExerciseId` (delivery instance). Open list
// therefore returns `sessionExerciseId` so saveDraft/submit can target a
// specific delivery. Same catalog exercise on two sessions ⇒ two open items
// (or one if student is only on one roster).
//
// Base filters: Exercise `status = published`; `blocked_lms` sees nothing.
// File name kept as `open-tier.ts` for stable imports; procedure name remains
// `exercise.openForStudent`.

import type { PrismaClient } from '@cmc/db';
import { withFacility } from '@cmc/db';
import { ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { badRequest, forbidden, notFound } from '../errors.js';
import { onRoster } from '../lms-ops/on-roster.js';
import { lmsProcedure, requireLmsStudent, router } from '../trpc.js';
import { toExerciseDto, type ExerciseDto } from './router.js';
import { getApprovedChildren } from '../guardian/approved-children.js';

export interface LmsStudent {
  id: string;
  facilityId: string;
  lifecycle: string;
}

/** One open homework slot: catalog exercise + the delivery row to submit against. */
export interface OpenHomeworkDto extends ExerciseDto {
  sessionExerciseId: string;
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

/** Delivered + on-roster SessionExercise rows for this student (published only). */
export async function listOpenExercisesForStudent(
  db: PrismaClient,
  student: LmsStudent,
): Promise<OpenHomeworkDto[]> {
  return withFacility(db, student.facilityId, async (tx) => {
    if (student.lifecycle === 'blocked_lms') return [];

    const enrollments = await tx.enrollment.findMany({
      where: { studentId: student.id, status: 'active' },
      select: {
        classBatchId: true,
        archivedAt: true,
        status: true,
        unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } },
        student: { select: { lifecycle: true } },
      },
    });
    if (enrollments.length === 0) return [];

    const batchIds = enrollments.map((e) => e.classBatchId);
    const deliveries = await tx.sessionExercise.findMany({
      where: {
        classSession: {
          classBatchId: { in: batchIds },
          status: { not: 'cancelled' },
        },
        exercise: { status: 'published' },
      },
      select: {
        id: true,
        exercise: true,
        classSession: {
          select: {
            classBatchId: true,
            sessionDate: true,
            curriculumUnit: { select: { orderGlobal: true } },
          },
        },
      },
      orderBy: { deliveredAt: 'asc' },
    });

    const items: OpenHomeworkDto[] = [];
    for (const d of deliveries) {
      const enrollment = enrollments.find((e) => e.classBatchId === d.classSession.classBatchId);
      if (!enrollment) continue;
      const archivedDayUtc = enrollment.archivedAt
        ? ictToUtc(ictDateOnlyOf(enrollment.archivedAt), '00:00')
        : null;
      if (
        !onRoster({
          enrollmentStatus: enrollment.status,
          studentLifecycle: enrollment.student.lifecycle,
          archivedDayUtc,
          sessionDate: d.classSession.sessionDate,
          sessionOrderGlobal: d.classSession.curriculumUnit?.orderGlobal ?? null,
          ranges: enrollment.unitRanges,
        })
      ) {
        continue;
      }
      items.push({
        ...toExerciseDto(d.exercise),
        sessionExerciseId: d.id,
      });
    }
    return items;
  });
}

/**
 * Guard for submission.saveDraft / submit: fail-closed unless this delivery
 * is published, not cancelled, and the student is on the session roster
 * (unit range covers the stamped unit).
 */
export async function assertSessionExerciseOpenForStudent(
  db: PrismaClient,
  student: LmsStudent,
  sessionExerciseId: string,
): Promise<{
  sessionExerciseId: string;
  exerciseId: string;
  exercise: {
    id: string;
    status: string;
    maxScore: number;
    starReward: number;
    basePdfRef: string;
  };
}> {
  if (student.lifecycle === 'blocked_lms') {
    throw badRequest('Exercise is not available: student is blocked from LMS.');
  }

  return withFacility(db, student.facilityId, async (tx) => {
    const se = await tx.sessionExercise.findFirst({
      where: { id: sessionExerciseId, facilityId: student.facilityId },
      select: {
        id: true,
        exerciseId: true,
        exercise: {
          select: {
            id: true,
            status: true,
            maxScore: true,
            starReward: true,
            basePdfRef: true,
          },
        },
        classSession: {
          select: {
            status: true,
            sessionDate: true,
            classBatchId: true,
            curriculumUnit: { select: { orderGlobal: true } },
          },
        },
      },
    });
    if (!se) {
      throw notFound('Session exercise delivery not found.');
    }
    if (se.classSession.status === 'cancelled') {
      throw badRequest('Cannot submit: the class session for this delivery was cancelled.');
    }
    if (se.exercise.status !== 'published') {
      throw badRequest('Exercise is not published.');
    }

    const enrollment = await tx.enrollment.findFirst({
      where: {
        studentId: student.id,
        classBatchId: se.classSession.classBatchId,
        status: 'active',
      },
      select: {
        status: true,
        archivedAt: true,
        unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } },
        student: { select: { lifecycle: true } },
      },
    });
    if (!enrollment) {
      throw badRequest(
        'Exercise is not available: not delivered for this student (or student is not on the session roster).',
      );
    }
    const archivedDayUtc = enrollment.archivedAt
      ? ictToUtc(ictDateOnlyOf(enrollment.archivedAt), '00:00')
      : null;
    if (
      !onRoster({
        enrollmentStatus: enrollment.status,
        studentLifecycle: enrollment.student.lifecycle,
        archivedDayUtc,
        sessionDate: se.classSession.sessionDate,
        sessionOrderGlobal: se.classSession.curriculumUnit?.orderGlobal ?? null,
        ranges: enrollment.unitRanges,
      })
    ) {
      throw badRequest(
        'Exercise is not available: not delivered for this student (or student is not on the session roster).',
      );
    }

    return {
      sessionExerciseId: se.id,
      exerciseId: se.exerciseId,
      exercise: se.exercise,
    };
  });
}

/** @deprecated Use assertSessionExerciseOpenForStudent — kept name alias during B4. */
export const assertExerciseOpenForStudent = assertSessionExerciseOpenForStudent;

export const exerciseOpenTierRouter = router({
  openForStudent: lmsProcedure.query(async ({ ctx }): Promise<{ items: OpenHomeworkDto[] }> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);
    const items = await listOpenExercisesForStudent(ctx.db, student);
    return { items };
  }),

  listForStudent: lmsProcedure.query(async ({ ctx }): Promise<{ items: OpenHomeworkDto[] }> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);
    const items = await listOpenExercisesForStudent(ctx.db, student);
    return { items };
  }),
});
