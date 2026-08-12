// submission router — T2-II (US-016/017, docs/26 WF-P2-05/06, TL19 §3/§6).
//
// B4: Submission attaches to SessionExercise (delivery instance), not Exercise.
// `saveDraft`/`submit` take `sessionExerciseId`. Content/maxScore still come
// from `sessionExercise.exercise`. Unique (sessionExerciseId, studentId).
//
// Facility-scoped + RLS — every DB call through `withFacility` on the
// student's facility (via loadLmsStudent).

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { computeFinalGrade } from '@cmc/domain-grading';
import { withFacility, type Prisma } from '@cmc/db';
import { ictMonthOf, ictMonthBounds } from '@cmc/domain-time';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import {
  lmsProcedure,
  requirePermission,
  requireLmsParent,
  requireLmsStudent,
  assertPasswordNotExpired,
  router,
  scoped,
} from '../trpc.js';
import {
  assertSessionExerciseOpenForStudent,
  loadLmsStudent,
} from '../exercise/open-tier.js';
import { assertTeacherOwnsStudentClass } from '../attendance/assert-teacher-owns-class.js';
import { auditChildDataAccess, getApprovedChildren } from '../guardian/approved-children.js';

const MAX_ANNOTATION_LAYER_BYTES = 1_000_000;

const annotationLayerSchema = z.record(z.string(), z.unknown());

const saveDraftInput = z.object({
  sessionExerciseId: z.string().uuid(),
  annotationLayer: annotationLayerSchema,
  answerText: z.string().max(20_000).optional(),
});

const submitInput = z.object({ sessionExerciseId: z.string().uuid() });

const gradeInput = z.object({
  submissionId: z.string().uuid(),
  score: z.number().int('Điểm phải là số nguyên.').nonnegative(),
});

const listForChildInput = z.object({ studentId: z.string().uuid() });

const listForGradingInput = z.object({
  /** Filter by catalog exercise (via SessionExercise.exerciseId). */
  exerciseId: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'graded']).optional().default('submitted'),
  search: z.string().trim().min(1).max(100).optional(),
});

const saveTeacherAnnotationInput = z.object({
  submissionId: z.string().uuid(),
  teacherAnnotationLayer: annotationLayerSchema,
});

export interface SubmissionDto {
  id: string;
  sessionExerciseId: string;
  /** Catalog exercise id (via delivery) — grading UI / FinalGrade maxScore. */
  exerciseId: string;
  studentId: string;
  studentFullName?: string;
  annotationLayer: unknown;
  teacherAnnotationLayer: unknown;
  answerText: string | null;
  version: number;
  status: string;
  submittedAt: Date | null;
  gradedAt: Date | null;
  score: number | null;
  gradedById: string | null;
  basePdfRef: string | null;
}

function toSubmissionDto(row: {
  id: string;
  sessionExerciseId: string;
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
  sessionExercise?: {
    exerciseId: string;
    exercise?: { basePdfRef: string } | null;
  } | null;
  student?: { fullName: string } | null;
}): SubmissionDto {
  return {
    id: row.id,
    sessionExerciseId: row.sessionExerciseId,
    exerciseId: row.sessionExercise?.exerciseId ?? '',
    studentId: row.studentId,
    studentFullName: row.student?.fullName,
    annotationLayer: row.annotationLayer,
    teacherAnnotationLayer: row.teacherAnnotationLayer ?? null,
    answerText: row.answerText,
    version: row.version,
    status: row.status,
    submittedAt: row.submittedAt,
    gradedAt: row.gradedAt,
    score: row.score,
    gradedById: row.gradedById,
    basePdfRef: row.sessionExercise?.exercise?.basePdfRef ?? null,
  };
}

export interface ChildSubmissionDto {
  id: string;
  sessionExerciseId: string;
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
 * Recomputes FinalGrade for (student, class, ICT month of periodAnchor).
 * Exercise scores come from graded submissions → sessionExercise.exercise.
 */
export async function recomputeFinalGrade(
  tx: Prisma.TransactionClient,
  opts: { facilityId: string; studentId: string; periodAnchor: Date },
): Promise<void> {
  const enrollment = await tx.enrollment.findFirst({
    where: { facilityId: opts.facilityId, studentId: opts.studentId, status: 'active' },
  });
  if (!enrollment) return;

  const period = ictMonthOf(opts.periodAnchor);
  const [periodStart, periodEnd] = ictMonthBounds(period);

  const gradedSubmissions = await tx.submission.findMany({
    where: {
      facilityId: opts.facilityId,
      studentId: opts.studentId,
      status: 'graded',
      gradedAt: { gte: periodStart, lt: periodEnd },
    },
    select: {
      score: true,
      sessionExercise: { select: { exerciseId: true } },
    },
  });

  const exerciseIds = [
    ...new Set(gradedSubmissions.map((s) => s.sessionExercise.exerciseId)),
  ];
  const exercises =
    exerciseIds.length > 0
      ? await tx.exercise.findMany({
          where: { id: { in: exerciseIds } },
          select: { id: true, maxScore: true },
        })
      : [];
  const maxScoreByExerciseId = new Map(exercises.map((e) => [e.id, e.maxScore]));

  const exerciseScores = gradedSubmissions
    .filter((s): s is typeof s & { score: number } => s.score !== null)
    .map((s) => ({
      score: s.score,
      maxScore: maxScoreByExerciseId.get(s.sessionExercise.exerciseId) ?? 10,
    }));

  const attendances = await tx.attendance.findMany({
    where: {
      facilityId: opts.facilityId,
      enrollmentId: enrollment.id,
      classSession: {
        endTime: { gte: periodStart, lt: periodEnd },
        status: { not: 'cancelled' },
      },
    },
    select: { status: true },
  });
  const attendedCount = attendances.filter(
    (a) => a.status === 'present' || a.status === 'late',
  ).length;
  const attendanceRate = attendances.length > 0 ? attendedCount / attendances.length : 0;

  const score = computeFinalGrade(exerciseScores, attendanceRate);

  await tx.finalGrade.upsert({
    where: {
      studentId_classBatchId_period: {
        studentId: opts.studentId,
        classBatchId: enrollment.classBatchId,
        period,
      },
    },
    create: {
      facilityId: opts.facilityId,
      studentId: opts.studentId,
      classBatchId: enrollment.classBatchId,
      period,
      score,
    },
    update: { score },
  });
}

export const submissionRouter = router({
  saveDraft: lmsProcedure
    .input(saveDraftInput)
    .mutation(async ({ ctx, input }): Promise<SubmissionDto> => {
      const { studentId, parentAccountId } = requireLmsStudent(ctx);
      await assertPasswordNotExpired(ctx, studentId);
      const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);

      const open = await assertSessionExerciseOpenForStudent(
        ctx.db,
        student,
        input.sessionExerciseId,
      );
      assertAnnotationLayerSize(input.annotationLayer);

      return withFacility(ctx.db, student.facilityId, async (tx) => {
        const existing = await tx.submission.findUnique({
          where: {
            sessionExerciseId_studentId: {
              sessionExerciseId: open.sessionExerciseId,
              studentId,
            },
          },
        });
        if (existing && existing.status !== 'draft') {
          throw badRequest(
            'Submission has already been submitted; it can no longer be edited.',
          );
        }

        const submission = existing
          ? await tx.submission.update({
              where: { id: existing.id },
              data: {
                annotationLayer: input.annotationLayer as Prisma.InputJsonValue,
                answerText: input.answerText ?? null,
                version: { increment: 1 },
              },
              include: {
                sessionExercise: {
                  select: {
                    exerciseId: true,
                    exercise: { select: { basePdfRef: true } },
                  },
                },
              },
            })
          : await tx.submission.create({
              data: {
                facilityId: student.facilityId,
                sessionExerciseId: open.sessionExerciseId,
                studentId,
                annotationLayer: input.annotationLayer as Prisma.InputJsonValue,
                answerText: input.answerText ?? null,
                version: 1,
                status: 'draft',
              },
              include: {
                sessionExercise: {
                  select: {
                    exerciseId: true,
                    exercise: { select: { basePdfRef: true } },
                  },
                },
              },
            });

        return toSubmissionDto(submission);
      });
    }),

  submit: lmsProcedure
    .input(submitInput)
    .mutation(async ({ ctx, input }): Promise<SubmissionDto> => {
      const { studentId, parentAccountId } = requireLmsStudent(ctx);
      await assertPasswordNotExpired(ctx, studentId);
      const student = await loadLmsStudent(ctx.db, studentId, parentAccountId);

      await assertSessionExerciseOpenForStudent(ctx.db, student, input.sessionExerciseId);

      return withFacility(ctx.db, student.facilityId, async (tx) => {
        const submission = await tx.submission.findUnique({
          where: {
            sessionExerciseId_studentId: {
              sessionExerciseId: input.sessionExerciseId,
              studentId,
            },
          },
          include: {
            sessionExercise: {
              select: {
                exerciseId: true,
                exercise: { select: { basePdfRef: true } },
              },
            },
          },
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
          include: {
            sessionExercise: {
              select: {
                exerciseId: true,
                exercise: { select: { basePdfRef: true } },
              },
            },
          },
        });
        return toSubmissionDto(updated);
      });
    }),

  grade: requirePermission('submission', 'grade')
    .input(gradeInput)
    .mutation(async ({ ctx, input }): Promise<SubmissionDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const submission = await tx.submission.findFirst({
          where: { id: input.submissionId, facilityId },
          include: {
            sessionExercise: {
              select: {
                exerciseId: true,
                exercise: {
                  select: {
                    id: true,
                    maxScore: true,
                    starReward: true,
                    basePdfRef: true,
                  },
                },
              },
            },
          },
        });
        if (!submission) {
          throw notFound('Submission not found.');
        }
        if (submission.status === 'draft') {
          throw badRequest('Submission has not been submitted yet.');
        }

        const exercise = submission.sessionExercise.exercise;
        if (input.score > exercise.maxScore) {
          throw badRequest(
            `score (${input.score}) exceeds exercise.maxScore (${exercise.maxScore}).`,
          );
        }

        await assertTeacherOwnsStudentClass(
          tx,
          facilityId,
          ctx.subject,
          submission.studentId,
        );

        const gradedAt = new Date();
        const claim = await tx.submission.updateMany({
          where: { id: submission.id, facilityId, status: submission.status },
          data: {
            status: 'graded',
            score: input.score,
            gradedById: ctx.subject.userId,
            gradedAt,
          },
        });
        if (claim.count === 0) {
          throw conflict('Submission was modified concurrently; please retry.');
        }
        const updated = await tx.submission.findUniqueOrThrow({
          where: { id: submission.id },
          include: {
            sessionExercise: {
              select: {
                exerciseId: true,
                exercise: { select: { basePdfRef: true } },
              },
            },
          },
        });

        const existingStarTxn = await tx.starTransaction.findFirst({
          where: {
            facilityId,
            type: 'homework_completed',
            refType: 'submission',
            refId: submission.id,
          },
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

        await recomputeFinalGrade(tx, {
          facilityId,
          studentId: submission.studentId,
          periodAnchor: gradedAt,
        });

        return toSubmissionDto(updated);
      });
    }),

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

        await assertTeacherOwnsStudentClass(
          tx,
          facilityId,
          ctx.subject,
          submission.studentId,
        );

        const updated = await tx.submission.update({
          where: { id: submission.id },
          data: {
            teacherAnnotationLayer: input.teacherAnnotationLayer as Prisma.InputJsonValue,
          },
          include: {
            sessionExercise: {
              select: {
                exerciseId: true,
                exercise: { select: { basePdfRef: true } },
              },
            },
          },
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

  listForGrading: requirePermission('submission', 'grade')
    .input(listForGradingInput)
    .query(async ({ ctx, input }): Promise<{ items: SubmissionDto[] }> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const roles = ctx.subject?.roles ?? [];
        const isDirector = roles.some((r) =>
          ['super_admin', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'].includes(r),
        );
        const isTeacherOnly = roles.includes('giao_vien') && !isDirector;

        let teacherStudentIds: string[] | undefined;
        if (isTeacherOnly) {
          const appUser = await tx.appUser.findFirst({
            where: { userId: ctx.subject!.userId, facilityId },
            select: { id: true },
          });
          if (!appUser) {
            return { items: [] };
          }
          const ownedBatches = await tx.classBatch.findMany({
            where: { facilityId, teacherAppUserId: appUser.id },
            select: { id: true },
          });
          if (ownedBatches.length === 0) {
            return { items: [] };
          }
          const enrollments = await tx.enrollment.findMany({
            where: {
              facilityId,
              classBatchId: { in: ownedBatches.map((b) => b.id) },
              status: { in: ['reserved', 'active'] },
            },
            select: { studentId: true },
          });
          teacherStudentIds = [...new Set(enrollments.map((e) => e.studentId))];
          if (teacherStudentIds.length === 0) {
            return { items: [] };
          }
        }

        const items = await tx.submission.findMany({
          where: {
            facilityId,
            status: input.status,
            ...(input.exerciseId
              ? { sessionExercise: { exerciseId: input.exerciseId } }
              : {}),
            ...(teacherStudentIds ? { studentId: { in: teacherStudentIds } } : {}),
            ...(input.search
              ? {
                  student: {
                    fullName: { contains: input.search, mode: 'insensitive' },
                  },
                }
              : {}),
          },
          orderBy: { submittedAt: 'asc' },
          take: 100,
          include: {
            sessionExercise: {
              select: {
                exerciseId: true,
                exercise: { select: { basePdfRef: true } },
              },
            },
            student: { select: { fullName: true } },
          },
        });

        const scopedRows = await Promise.all(
          items.map(async (item) => {
            try {
              await assertTeacherOwnsStudentClass(
                tx,
                facilityId,
                ctx.subject,
                item.studentId,
              );
              return item;
            } catch (error) {
              if (error instanceof TRPCError && error.code === 'FORBIDDEN') return null;
              throw error;
            }
          }),
        );

        return {
          items: scopedRows.filter((item) => item !== null).map(toSubmissionDto),
        };
      });
    }),

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

      const student = await withFacility(
        ctx.db,
        null,
        (tx) =>
          tx.student.findUnique({
            where: { id: input.studentId },
            select: { facilityId: true },
          }),
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
            sessionExerciseId: true,
            status: true,
            submittedAt: true,
            score: true,
            gradedAt: true,
            sessionExercise: {
              select: {
                exerciseId: true,
                exercise: {
                  select: {
                    starReward: true,
                    curriculumUnit: { select: { title: true } },
                  },
                },
              },
            },
          },
        });
        return {
          items: items.map((row) => ({
            id: row.id,
            sessionExerciseId: row.sessionExerciseId,
            exerciseId: row.sessionExercise.exerciseId,
            exerciseTitle: row.sessionExercise.exercise.curriculumUnit.title,
            status: row.status,
            submittedAt: row.submittedAt,
            score: row.score,
            gradedAt: row.gradedAt,
            starReward: row.sessionExercise.exercise.starReward,
          })),
        };
      });
    }),
});
