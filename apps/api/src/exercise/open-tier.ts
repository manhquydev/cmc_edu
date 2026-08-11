// exercise.openForStudent / exercise.listForStudent — T2-II (US-015, docs/26
// WF-P2-03, ADR 0038 verbatim, TL19 §4).
//
// ADR 0038 decision, restated:
//   - Base: Exercise `status = published` AND student is NOT `blocked_lms`.
//   - Tier A (opens for the whole batch): a `curriculumUnitId` opens when a
//     NON-makeup ClassSession teaching that unit has ENDED — the ICT wall-
//     clock `endTime` (already stored as the correct UTC instant by
//     ../class/ict-time.ts) is in the past, and the session is not
//     `cancelled`.
//   - Tier B (opens ONLY for one student): a MAKEUP ClassSession the student
//     attended `present`/`late` opens that unit for THAT student alone,
//     keyed on `Attendance.studentId` — it never opens the unit for the rest
//     of the batch (a makeup session teaches one absent student, not the
//     class).
// `Exercise`/`CurriculumUnit` are GLOBAL tables (no facilityId, no RLS — QĐ
// 0021/0022); `Enrollment`/`ClassSession`/`Attendance` are facility-scoped —
// this module resolves the student's OWN facility first, then runs the
// facility-scoped lookups through `withFacility` (never a bypass — a
// student's open-tier gate is always evaluated within their own facility).

import type { PrismaClient, Prisma } from '@cmc/db';
import { withFacility } from '@cmc/db';
import { isEntitled } from '@cmc/domain-lms';
import { badRequest, forbidden, notFound } from '../errors.js';
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
 * this student — `getApprovedChildren` is the SINGLE approved-Guardian gate
 * (./guardian/approved-children.ts). A parent who constructs a JWT with an
 * arbitrary `studentId` (not in their approved list) gets FORBIDDEN here,
 * never reaching the facility lookup or the exercise/submission surface.
 *
 * The subsequent `withFacility({ bypass })` is still needed because the
 * student's OWN facility is what this call is discovering, and `Student`
 * carries no facility-level RLS policy — the ownership check above (Guardian
 * link) is the real boundary, not the RLS GUC.
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
    (tx) => tx.student.findUnique({ where: { id: studentId }, select: { id: true, facilityId: true, lifecycle: true } }),
    { bypass: true },
  );
  if (!student) {
    throw notFound('Student not found.');
  }
  return student;
}

/**
 * Kill-switch for ADR 0038 open-tier (Plan 2 teaching spine).
 * - unset / "1" / "true" → open-tier ON (legacy default)
 * - "0" / "false" / "off" → open-tier OFF (empty open set)
 */
export function isOpenTierEnabled(): boolean {
  const v = (process.env.LMS_OPEN_TIER_ENABLED ?? '1').toLowerCase();
  return v !== '0' && v !== 'false' && v !== 'off';
}

/** When on, open units must also be covered by EnrollmentUnitRange (dual-gate homework). */
export function isEntitlementGateOnOpenTier(): boolean {
  const v = (process.env.LMS_ENTITLEMENT_GATE ?? '0').toLowerCase();
  return v === '1' || v === 'true' || v === 'on';
}

/** ADR 0038 Tier A + Tier B, resolved to the set of `curriculumUnitId`s open
 * for `studentId` right now. Empty set for a `blocked_lms` student (the base
 * condition) without running either tier's query. */
async function resolveOpenCurriculumUnitIds(
  tx: Prisma.TransactionClient,
  student: LmsStudent,
): Promise<Set<string>> {
  if (student.lifecycle === 'blocked_lms') {
    return new Set();
  }
  // When open-tier kill-switch is OFF, homework opens only via SessionExercise
  // delivery (dual-gate roster membership), not ADR 0038 Tier A/B.
  if (!isOpenTierEnabled()) {
    const { deliveredExerciseIdsForStudent } = await import('../lms-ops/exercise-delivery.js');
    const exerciseIds = await deliveredExerciseIdsForStudent(tx, student);
    if (exerciseIds.size === 0) return new Set();
    const exercises = await tx.exercise.findMany({
      where: { id: { in: [...exerciseIds] }, status: 'published' },
      select: { curriculumUnitId: true },
    });
    return new Set(exercises.map((e) => e.curriculumUnitId));
  }

  const entitlementOn = isEntitlementGateOnOpenTier();
  const activeEnrollments = await tx.enrollment.findMany({
    where: { studentId: student.id, status: 'active' },
    select: {
      classBatchId: true,
      classBatch: { select: { program: true } },
      ...(entitlementOn
        ? { unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } } }
        : {}),
    },
  });
  const classBatchIds = activeEnrollments.map((e) => e.classBatchId);

  const openUnitIds = new Set<string>();

  // Tier A: any non-makeup, non-cancelled session in one of this student's
  // active classes, teaching a unit, that has already ENDED (ICT).
  if (classBatchIds.length > 0) {
    const tierASessions = await tx.classSession.findMany({
      where: {
        classBatchId: { in: classBatchIds },
        isMakeup: false,
        status: { not: 'cancelled' },
        curriculumUnitId: { not: null },
        endTime: { lt: new Date() },
      },
      select: { curriculumUnitId: true },
    });
    for (const session of tierASessions) {
      if (session.curriculumUnitId) openUnitIds.add(session.curriculumUnitId);
    }
  }

  // Tier B: makeup sessions THIS student attended present/late — keyed on
  // Attendance.studentId, so this query is inherently per-student already
  // (no batch-wide leak possible from this branch).
  //
  // Metric & Data Integrity remediation (scenario audit): mirror Tier A's
  // `endTime < now` gate — a makeup session marked present in advance (or
  // live, mid-session) must not open the unit before the session has
  // actually ended, same reasoning as Tier A.
  const tierBAttendances = await tx.attendance.findMany({
    where: {
      studentId: student.id,
      status: { in: ['present', 'late'] },
      classSession: {
        isMakeup: true,
        status: { not: 'cancelled' },
        curriculumUnitId: { not: null },
        endTime: { lt: new Date() },
      },
    },
    select: { classSession: { select: { curriculumUnitId: true } } },
  });
  for (const attendance of tierBAttendances) {
    const unitId = attendance.classSession.curriculumUnitId;
    if (unitId) openUnitIds.add(unitId);
  }

  if (!entitlementOn || openUnitIds.size === 0) {
    return openUnitIds;
  }

  // Intersect open units with sold/granted ranges, scoped by program
  // (orderGlobal is unique per program, not globally — ADR 0046).
  const units = await tx.curriculumUnit.findMany({
    where: { id: { in: [...openUnitIds] } },
    select: { id: true, orderGlobal: true, program: true },
  });
  const rangesByProgram = new Map<string, { fromOrderGlobal: number; toOrderGlobal: number }[]>();
  for (const e of activeEnrollments) {
    const program = e.classBatch.program;
    const ranges =
      'unitRanges' in e && Array.isArray(e.unitRanges)
        ? (e.unitRanges as { fromOrderGlobal: number; toOrderGlobal: number }[])
        : [];
    const bucket = rangesByProgram.get(program) ?? [];
    bucket.push(...ranges);
    rangesByProgram.set(program, bucket);
  }
  const filtered = new Set<string>();
  for (const u of units) {
    const ranges = rangesByProgram.get(u.program) ?? [];
    if (isEntitled(ranges, u.orderGlobal)) filtered.add(u.id);
  }
  return filtered;
}

/** The set of `curriculumUnitId`s currently open for `student` (ADR 0038). */
export function getOpenCurriculumUnitIdsForStudent(
  db: PrismaClient,
  student: LmsStudent,
): Promise<Set<string>> {
  return withFacility(db, student.facilityId, (tx) => resolveOpenCurriculumUnitIds(tx, student));
}

/** Every `published` Exercise open for `student` (ADR 0038 or delivery path). */
export async function listOpenExercisesForStudent(
  db: PrismaClient,
  student: LmsStudent,
): Promise<ExerciseDto[]> {
  // Kill-switch OFF: exact delivered exercise ids (not whole unit catalog).
  if (!isOpenTierEnabled()) {
    return withFacility(db, student.facilityId, async (tx) => {
      if (student.lifecycle === 'blocked_lms') return [];
      const { deliveredExerciseIdsForStudent } = await import('../lms-ops/exercise-delivery.js');
      const exerciseIds = await deliveredExerciseIdsForStudent(tx, student);
      if (exerciseIds.size === 0) return [];
      const exercises = await tx.exercise.findMany({
        where: { id: { in: [...exerciseIds] }, status: 'published' },
        orderBy: { createdAt: 'asc' },
      });
      return exercises.map(toExerciseDto);
    });
  }

  const openUnitIds = await getOpenCurriculumUnitIdsForStudent(db, student);
  if (openUnitIds.size === 0) {
    return [];
  }
  const exercises = await db.exercise.findMany({
    where: { curriculumUnitId: { in: [...openUnitIds] }, status: 'published' },
    orderBy: { createdAt: 'asc' },
  });
  return exercises.map(toExerciseDto);
}

/** Guard used by `submission.saveDraft` (../submission/router.ts): throws
 * BAD_REQUEST unless `exercise` is published AND open for `student` right now. */
export async function assertExerciseOpenForStudent(
  db: PrismaClient,
  student: LmsStudent,
  exercise: { id?: string; curriculumUnitId: string; status: string },
): Promise<void> {
  if (exercise.status !== 'published') {
    throw badRequest('Exercise is not published.');
  }
  if (!isOpenTierEnabled()) {
    await withFacility(db, student.facilityId, async (tx) => {
      if (student.lifecycle === 'blocked_lms') {
        throw badRequest('Exercise is not open yet.');
      }
      const { deliveredExerciseIdsForStudent } = await import('../lms-ops/exercise-delivery.js');
      const exerciseIds = await deliveredExerciseIdsForStudent(tx, student);
      const id = exercise.id;
      if (!id || !exerciseIds.has(id)) {
        throw badRequest('Exercise is not open yet.');
      }
    });
    return;
  }
  const openUnitIds = await getOpenCurriculumUnitIdsForStudent(db, student);
  if (!openUnitIds.has(exercise.curriculumUnitId)) {
    throw badRequest('Exercise is not open yet.');
  }
}

export const exerciseOpenTierRouter = router({
  // ADR 0038 (US-015): the student-facing "what can I do right now" list.
  openForStudent: lmsProcedure.query(async ({ ctx }): Promise<{ items: ExerciseDto[] }> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);
    const items = await listOpenExercisesForStudent(ctx.db, student);
    return { items };
  }),

  // Alias (phase-03 spec: "= openForStudent alias if simpler").
  listForStudent: lmsProcedure.query(async ({ ctx }): Promise<{ items: ExerciseDto[] }> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);
    const items = await listOpenExercisesForStudent(ctx.db, student);
    return { items };
  }),
});
