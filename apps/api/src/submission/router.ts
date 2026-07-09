// submission router — T2-II (US-016/017, docs/26 WF-P2-05/06, TL19 §3/§6).
//
// `saveDraft`/`submit` are the student-facing (lmsProcedure) writers;
// `grade`/`listForGrading` are the teacher-facing (`submission.grade` perm)
// counterparts. `Submission`/`FinalGrade`/`StarTransaction` are
// facility-scoped + RLS (docs/decisions/0042, child data + soft money) —
// every DB call here runs through `withFacility`, scoped by the STUDENT's
// own facility (never a client-supplied one, resolved via
// ../exercise/open-tier.ts `loadLmsStudent`).

import { z } from 'zod';
import { computeFinalGrade } from '@cmc/domain-grading';
import { withFacility, type Prisma } from '@cmc/db';
import { ictMonthOf, ictMonthBounds } from '@cmc/domain-time';
import { badRequest, forbidden, notFound } from '../errors.js';
import {
  lmsProcedure,
  requirePermission,
  requireLmsParent,
  requireLmsStudent,
  assertPasswordNotExpired,
  router,
  scoped,
} from '../trpc.js';
import { assertExerciseOpenForStudent, loadLmsStudent } from '../exercise/open-tier.js';
import { auditChildDataAccess, getApprovedChildren } from '../guardian/approved-children.js';

/** TL19 §3: the annotation layer is capped at 1MB — enforced here (app
 * layer), not at the DB (JSONB column has no such constraint). */
const MAX_ANNOTATION_LAYER_BYTES = 1_000_000;

const annotationLayerSchema = z.record(z.string(), z.unknown());

const saveDraftInput = z.object({
  exerciseId: z.string().uuid(),
  annotationLayer: annotationLayerSchema,
  answerText: z.string().max(20_000).optional(),
});

const submitInput = z.object({ exerciseId: z.string().uuid() });

const gradeInput = z.object({
  submissionId: z.string().uuid(),
  score: z.number().nonnegative(),
});

const listForChildInput = z.object({ studentId: z.string().uuid() });

const listForGradingInput = z.object({
  exerciseId: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'graded']).optional().default('submitted'),
});

const saveTeacherAnnotationInput = z.object({
  submissionId: z.string().uuid(),
  teacherAnnotationLayer: annotationLayerSchema,
});

export interface SubmissionDto {
  id: string;
  exerciseId: string;
  studentId: string;
  annotationLayer: unknown;
  /** Teacher's separate annotation overlay; null until first teacher annotation. */
  teacherAnnotationLayer: unknown;
  answerText: string | null;
  version: number;
  status: string;
  submittedAt: Date | null;
  gradedAt: Date | null;
  score: number | null;
  gradedById: string | null;
  /** BlobStorage key for the base PDF; used by grading UI to fetch the PDF file. */
  basePdfRef: string | null;
}

function toSubmissionDto(row: {
  id: string;
  exerciseId: string;
  studentId: string;
  annotationLayer: unknown;
  teacherAnnotationLayer?: unknown;
  answerText: string | null;
  version: number;
  status: string;
  submittedAt: Date | null;
  gradedAt: Date | null;
  score: number | null;
  gradedById: string | null;
  exercise?: { basePdfRef: string } | null;
}): SubmissionDto {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    studentId: row.studentId,
    annotationLayer: row.annotationLayer,
    teacherAnnotationLayer: row.teacherAnnotationLayer ?? null,
    answerText: row.answerText,
    version: row.version,
    status: row.status,
    submittedAt: row.submittedAt,
    gradedAt: row.gradedAt,
    score: row.score,
    gradedById: row.gradedById,
    basePdfRef: row.exercise?.basePdfRef ?? null,
  };
}

/**
 * Gap-closure 260710-0005 Phase 2: parent-facing DTO for
 * `submission.listForChild`. Deliberately a NARROW, explicit field list —
 * red-team M2/F5 flagged that a wide select on this parent-readable
 * procedure could leak `gradedById` (staff AppUser id),
 * `teacherAnnotationLayer`, `annotationLayer`, or `answerText`. None of
 * those fields exist on this type; a test asserts the raw query response
 * shape never carries them either.
 */
export interface ChildSubmissionDto {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  status: string;
  submittedAt: Date | null;
  score: number | null;
  gradedAt: Date | null;
  starReward: number;
}

function assertAnnotationLayerSize(annotationLayer: unknown): void {
  const bytes = Buffer.byteLength(JSON.stringify(annotationLayer), 'utf8');
  if (bytes > MAX_ANNOTATION_LAYER_BYTES) {
    throw badRequest(`annotationLayer exceeds the 1MB limit (${bytes} bytes).`);
  }
}

/**
 * Recomputes `FinalGrade` for `(studentId, classBatchId, period)` after a
 * grade — best-effort: if the student has no `active` Enrollment in this
 * facility right now, there is no classBatch to attribute the grade to, so
 * this silently no-ops rather than failing the whole `submission.grade` call
 * (grading a submission must succeed even for a student whose enrollment
 * later lapsed — the star award and the Submission's own `score` are the
 * durable record either way).
 *
 * ASSUMPTION (TL19 §6 does not pin an exact period grain): `period` = the ICT
 * calendar month of the grading instant (`gradedAt`) — the SAME monthly
 * bucket `Attendance` uses, so one `computeFinalGrade` call combines this
 * student's exercise scores and attendance rate for that one month.
 */
async function recomputeFinalGrade(
  tx: Prisma.TransactionClient,
  opts: { facilityId: string; studentId: string; gradedAt: Date },
): Promise<void> {
  const enrollment = await tx.enrollment.findFirst({
    where: { facilityId: opts.facilityId, studentId: opts.studentId, status: 'active' },
  });
  if (!enrollment) return;

  const period = ictMonthOf(opts.gradedAt);
  const [periodStart, periodEnd] = ictMonthBounds(period);

  const gradedSubmissions = await tx.submission.findMany({
    where: {
      facilityId: opts.facilityId,
      studentId: opts.studentId,
      status: 'graded',
      gradedAt: { gte: periodStart, lt: periodEnd },
    },
    select: { score: true, exerciseId: true },
  });

  const exerciseIds = [...new Set(gradedSubmissions.map((s) => s.exerciseId))];
  const exercises =
    exerciseIds.length > 0
      ? await tx.exercise.findMany({ where: { id: { in: exerciseIds } }, select: { id: true, maxScore: true } })
      : [];
  const maxScoreByExerciseId = new Map(exercises.map((e) => [e.id, e.maxScore]));

  const exerciseScores = gradedSubmissions
    .filter((s): s is typeof s & { score: number } => s.score !== null)
    .map((s) => ({ score: s.score, maxScore: maxScoreByExerciseId.get(s.exerciseId) ?? 10 }));

  const attendances = await tx.attendance.findMany({
    where: {
      facilityId: opts.facilityId,
      enrollmentId: enrollment.id,
      // Exclude cancelled sessions from the denominator — a cancelled session
      // never ran, so counting it would deflate the student's attendance rate.
      classSession: { endTime: { gte: periodStart, lt: periodEnd }, status: { not: 'cancelled' } },
    },
    select: { status: true },
  });
  const attendedCount = attendances.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = attendances.length > 0 ? attendedCount / attendances.length : 0;

  const score = computeFinalGrade(exerciseScores, attendanceRate);

  await tx.finalGrade.upsert({
    where: { studentId_classBatchId_period: { studentId: opts.studentId, classBatchId: enrollment.classBatchId, period } },
    create: { facilityId: opts.facilityId, studentId: opts.studentId, classBatchId: enrollment.classBatchId, period, score },
    update: { score },
  });
}

export const submissionRouter = router({
  // draft (create or re-save, version++) for an OPEN exercise (ADR 0038) —
  // blocked once the submission has moved past `draft`.
  saveDraft: lmsProcedure.input(saveDraftInput).mutation(async ({ ctx, input }): Promise<SubmissionDto> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    await assertPasswordNotExpired(ctx, studentId);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);

    const exercise = await ctx.db.exercise.findUnique({ where: { id: input.exerciseId } });
    if (!exercise) {
      throw notFound('Exercise not found.');
    }
    await assertExerciseOpenForStudent(ctx.db, student, exercise);
    assertAnnotationLayerSize(input.annotationLayer);

    return withFacility(ctx.db, student.facilityId, async (tx) => {
      const existing = await tx.submission.findUnique({
        where: { exerciseId_studentId: { exerciseId: exercise.id, studentId } },
      });
      if (existing && existing.status !== 'draft') {
        throw badRequest('Submission has already been submitted; it can no longer be edited.');
      }

      const submission = existing
        ? await tx.submission.update({
            where: { id: existing.id },
            data: {
              annotationLayer: input.annotationLayer as Prisma.InputJsonValue,
              answerText: input.answerText ?? null,
              version: { increment: 1 },
            },
          })
        : await tx.submission.create({
            data: {
              facilityId: student.facilityId,
              exerciseId: exercise.id,
              studentId,
              annotationLayer: input.annotationLayer as Prisma.InputJsonValue,
              answerText: input.answerText ?? null,
              version: 1,
              status: 'draft',
            },
          });

      return toSubmissionDto(submission);
    });
  }),

  // draft -> submitted (immutable afterward).
  submit: lmsProcedure.input(submitInput).mutation(async ({ ctx, input }): Promise<SubmissionDto> => {
    const { studentId, parentAccountId } = requireLmsStudent(ctx);
    await assertPasswordNotExpired(ctx, studentId);
    const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);

    return withFacility(ctx.db, student.facilityId, async (tx) => {
      const submission = await tx.submission.findUnique({
        where: { exerciseId_studentId: { exerciseId: input.exerciseId, studentId } },
      });
      if (!submission) {
        throw notFound('Submission not found.');
      }
      if (submission.status !== 'draft') {
        throw badRequest('Only a draft submission can be submitted.');
      }

      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: { status: 'submitted', submittedAt: new Date() },
      });
      return toSubmissionDto(updated);
    });
  }),

  // submitted|graded (regrade) -> graded. Awards `Exercise.starReward` via a
  // StarTransaction EXACTLY ONCE per Submission, even across regrades
  // (idempotent — checked inside this same transaction, backstopped by a
  // partial unique DB index, see the T2-II migration). Recomputes FinalGrade
  // best-effort.
  grade: requirePermission('submission', 'grade')
    .input(gradeInput)
    .mutation(async ({ ctx, input }): Promise<SubmissionDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const submission = await tx.submission.findFirst({ where: { id: input.submissionId, facilityId } });
        if (!submission) {
          throw notFound('Submission not found.');
        }
        if (submission.status === 'draft') {
          throw badRequest('Submission has not been submitted yet.');
        }

        const exercise = await tx.exercise.findUnique({ where: { id: submission.exerciseId } });
        if (!exercise) {
          throw notFound('Exercise not found.');
        }
        if (input.score > exercise.maxScore) {
          throw badRequest(`score (${input.score}) exceeds exercise.maxScore (${exercise.maxScore}).`);
        }

        const gradedAt = new Date();
        const updated = await tx.submission.update({
          where: { id: submission.id },
          data: { status: 'graded', score: input.score, gradedById: ctx.subject.userId, gradedAt },
        });

        const existingStarTxn = await tx.starTransaction.findFirst({
          where: { facilityId, type: 'homework_completed', refType: 'submission', refId: submission.id },
        });
        if (!existingStarTxn) {
          await tx.starTransaction.create({
            data: {
              facilityId,
              studentId: submission.studentId,
              type: 'homework_completed',
              amount: exercise.starReward,
              refType: 'submission',
              refId: submission.id,
            },
          });
        }

        await recomputeFinalGrade(tx, { facilityId, studentId: submission.studentId, gradedAt });

        return toSubmissionDto(updated);
      });
    }),

  // Phase-01a (C3): teacher annotation writer — separate from saveDraft
  // (student-only lmsProcedure). Writes the teacher's PDF annotation overlay
  // to its own column (`teacherAnnotationLayer`) — never overwrites the
  // student's `annotationLayer`. Gate: `submission.grade` (same as `grade`).
  // Cap: 1MB via `assertAnnotationLayerSize` (same helper as student layer).
  saveTeacherAnnotation: requirePermission('submission', 'grade')
    .input(saveTeacherAnnotationInput)
    .mutation(async ({ ctx, input }): Promise<SubmissionDto> => {
      const { facilityId } = scoped(ctx);
      assertAnnotationLayerSize(input.teacherAnnotationLayer);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const submission = await tx.submission.findFirst({
          where: { id: input.submissionId, facilityId },
        });
        if (!submission) {
          throw notFound('Submission not found.');
        }
        if (submission.status === 'draft') {
          throw badRequest('Cannot annotate a submission that has not been submitted yet.');
        }

        const updated = await tx.submission.update({
          where: { id: submission.id },
          data: { teacherAnnotationLayer: input.teacherAnnotationLayer as Prisma.InputJsonValue },
        });

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'submission.saveTeacherAnnotation',
            entity: 'Submission',
            entityId: submission.id,
            data: { teacherId: ctx.subject.userId },
          },
        });

        return toSubmissionDto(updated);
      });
    }),

  // Teacher grading queue — defaults to `submitted` (the actionable set).
  listForGrading: requirePermission('submission', 'grade')
    .input(listForGradingInput)
    .query(async ({ ctx, input }): Promise<{ items: SubmissionDto[] }> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const items = await tx.submission.findMany({
          where: { facilityId, exerciseId: input.exerciseId, status: input.status },
          orderBy: { submittedAt: 'asc' },
          take: 100,
          include: { exercise: { select: { basePdfRef: true } } },
        });
        return { items: items.map(toSubmissionDto) };
      });
    }),

  // -------------------------------------------------------------------------
  // submission.listForChild — LMS (parent session ONLY, gap-closure 260710-0005
  // Phase 2). Gate pattern copied from assessment.listForChild
  // (../assessment/router.ts) — getApprovedChildren + auditChildDataAccess is
  // the sole child-data boundary (never re-implemented). Unlike
  // assessment.listForChild this is `requireLmsParent`-gated (parent-only,
  // red-team H2): a student session already has its own submission view via
  // exercise.openForStudent/student home, so `student`-kind is FORBIDDEN here.
  // -------------------------------------------------------------------------
  listForChild: lmsProcedure
    .input(listForChildInput)
    .query(async ({ ctx, input }): Promise<{ items: ChildSubmissionDto[] }> => {
      const { parentAccountId } = requireLmsParent(ctx);

      const approvedChildren = await getApprovedChildren(ctx.db, parentAccountId);
      if (!approvedChildren.some((c) => c.studentId === input.studentId)) {
        throw forbidden('Student does not belong to this account.');
      }

      await auditChildDataAccess(ctx.db, {
        parentAccountId,
        studentIds: [input.studentId],
        via: 'submission.listForChild',
        actorKind: 'parent',
      });

      // Resolve the student's facility for RLS scoping — getApprovedChildren
      // runs RLS-bypass cross-facility (approved-children.ts), so the actual
      // data read below MUST re-establish the facility GUC (red-team H1
      // defense-in-depth) rather than relying on the studentId filter alone.
      const student = await withFacility(
        ctx.db,
        null,
        (tx) => tx.student.findUnique({ where: { id: input.studentId }, select: { facilityId: true } }),
        { bypass: true },
      );
      if (!student) throw notFound('Student not found.');

      return withFacility(ctx.db, student.facilityId, async (tx) => {
        const items = await tx.submission.findMany({
          where: { studentId: input.studentId, status: { not: 'draft' } },
          orderBy: { submittedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            exerciseId: true,
            status: true,
            submittedAt: true,
            score: true,
            gradedAt: true,
            exercise: { select: { starReward: true, curriculumUnit: { select: { title: true } } } },
          },
        });
        return {
          items: items.map((row) => ({
            id: row.id,
            exerciseId: row.exerciseId,
            exerciseTitle: row.exercise.curriculumUnit.title,
            status: row.status,
            submittedAt: row.submittedAt,
            score: row.score,
            gradedAt: row.gradedAt,
            starReward: row.exercise.starReward,
          })),
        };
      });
    }),
});
