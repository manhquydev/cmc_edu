// Assessment router — T3 (US-018, docs/26 WF-P2-07, TL13, TL19 §6b).
//
// Two surfaces:
//   Staff surface: draftComment (AI nháp) · confirm · discard
//   LMS surface:  listForChild · reportCard.getForChild
//
// Key invariants (test-verified):
//   1. Draft assessments NEVER appear in LMS responses (status filter).
//   2. PII (student fullName, phone) must NOT appear in LLM prompt — only
//      studentId is passed; TL13 §5 "token hoá tên trẻ, context tối thiểu".
//   3. Parent without an approved Guardian link → FORBIDDEN on all LMS reads.
//
// All DB calls are facility-scoped via `withFacility` (ADR 0042). The LMS
// `getApprovedChildren` gate from ../guardian/approved-children.ts is the
// ONLY approved child-data boundary — never re-implemented here.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { createLLMClient } from '@cmc/llm';
import { ictMonthBounds } from '@cmc/domain-time';
import { badRequest, forbidden, notFound } from '../errors.js';
import { lmsProcedure, requirePermission, router, scoped } from '../trpc.js';
import {
  auditChildDataAccess,
  getApprovedChildren,
} from '../guardian/approved-children.js';
import { assertTeacherOwnsSessionClass } from '../attendance/assert-teacher-owns-class.js';

// Singleton LLM client — created once at module load time. The stub is used
// when LLM_API_KEY is not set (deterministic, offline, no network calls).
const llmClient = createLLMClient();

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export interface AssessmentDto {
  id: string;
  facilityId: string;
  studentId: string;
  classSessionId: string | null;
  period: string | null;
  content: string;
  status: string;
  draftedBy: string;
  confidence: number | null;
  confirmedById: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// LMS-visible confirmed assessment (subset of AssessmentDto — no facilityId
// leakage; content is always a confirmed human-reviewed string).
export interface ConfirmedAssessmentDto {
  id: string;
  studentId: string;
  classSessionId: string | null;
  period: string | null;
  content: string;
  confirmedAt: Date | null;
}

export interface FinalGradeDto {
  id: string;
  studentId: string;
  classBatchId: string;
  period: string;
  score: number;
}

export interface ReportCardDto {
  period: string;
  finalGrade: FinalGradeDto | null;
  attendanceRate: number;
  assessments: ConfirmedAssessmentDto[];
}

function toAssessmentDto(row: {
  id: string;
  facilityId: string;
  studentId: string;
  classSessionId: string | null;
  period: string | null;
  content: string;
  status: string;
  draftedBy: string;
  confidence: number | null;
  confirmedById: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): AssessmentDto {
  return {
    id: row.id,
    facilityId: row.facilityId,
    studentId: row.studentId,
    classSessionId: row.classSessionId,
    period: row.period,
    content: row.content,
    status: row.status,
    draftedBy: row.draftedBy,
    confidence: row.confidence,
    confirmedById: row.confirmedById,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toConfirmedDto(row: {
  id: string;
  studentId: string;
  classSessionId: string | null;
  period: string | null;
  content: string;
  confirmedAt: Date | null;
}): ConfirmedAssessmentDto {
  return {
    id: row.id,
    studentId: row.studentId,
    classSessionId: row.classSessionId,
    period: row.period,
    content: row.content,
    confirmedAt: row.confirmedAt,
  };
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const draftCommentInput = z
  .object({
    studentId: z.string().uuid(),
    classSessionId: z.string().uuid().optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  })
  .refine((v) => v.classSessionId !== undefined || v.period !== undefined, {
    message: 'One of classSessionId or period is required.',
  });

const confirmInput = z.object({
  assessmentId: z.string().uuid(),
  content: z.string().min(1).max(10_000),
});

const discardInput = z.object({
  assessmentId: z.string().uuid(),
});

const listForChildInput = z.object({
  studentId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

// HR remediation phase 5 (R2 #C4 — màn nhận xét per-buổi): the staff-facing
// UI needs to know which present students already have a draft/confirmed
// assessment for a session before it can render per-student state. No such
// read existed pre-phase-5 (only draftComment/confirm/discard mutations) —
// added here as a minimal, same-permission (`assessment.draft`, teacher-
// facing) companion read. Returns every non-discarded assessment for the
// session (draft + confirmed) — the UI branches per student on `status`.
const listBySessionInput = z.object({
  classSessionId: z.string().uuid(),
});

const reportCardInput = z.object({
  studentId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const assessmentRouter = router({
  // -------------------------------------------------------------------------
  // assessment.draftComment — giao_vien / GĐĐT
  // -------------------------------------------------------------------------
  draftComment: requirePermission('assessment', 'draft')
    .input(draftCommentInput)
    .mutation(async ({ ctx, input }): Promise<AssessmentDto> => {
      const { facilityId } = scoped(ctx);

      // Verify the student exists in this facility (RLS will enforce scope).
      const student = await withFacility(ctx.db, facilityId, (tx) =>
        tx.student.findFirst({
          where: { id: input.studentId, facilityId },
          select: { id: true },
        }),
      );
      if (!student) {
        throw notFound('Student not found in this facility.');
      }

      // Build a PII-free prompt: use studentId only, not fullName/phone.
      // TL13 §5: "token hoá tên trẻ, context tối thiểu, audit những gì gửi".
      const contextParts: string[] = [`studentId: ${input.studentId}`];
      if (input.classSessionId) contextParts.push(`classSessionId: ${input.classSessionId}`);
      if (input.period) contextParts.push(`period: ${input.period}`);
      const prompt = `Nhận xét học sinh — ${contextParts.join(', ')}`;

      // The stub logs the prompt; tests assert fullName does NOT appear in it.
      const draftContent = await llmClient.draftAssessment(prompt);

      return withFacility(ctx.db, facilityId, async (tx) => {
        await assertTeacherOwnsSessionClass(tx, facilityId, ctx.subject, input.classSessionId ?? null);

        const assessment = await tx.qualitativeAssessment.create({
          data: {
            facilityId,
            studentId: input.studentId,
            classSessionId: input.classSessionId ?? null,
            period: input.period ?? null,
            content: draftContent,
            status: 'draft',
            draftedBy: 'ai',
          },
        });
        return toAssessmentDto(assessment);
      });
    }),

  // -------------------------------------------------------------------------
  // assessment.confirm — giao_vien only
  // -------------------------------------------------------------------------
  confirm: requirePermission('assessment', 'confirm')
    .input(confirmInput)
    .mutation(async ({ ctx, input }): Promise<AssessmentDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const existing = await tx.qualitativeAssessment.findFirst({
          where: { id: input.assessmentId, facilityId },
          select: { id: true, status: true, classSessionId: true },
        });
        if (!existing) {
          throw notFound('Assessment not found.');
        }
        if (existing.status !== 'draft') {
          throw badRequest(`Assessment is already ${existing.status}; only drafts can be confirmed.`);
        }
        await assertTeacherOwnsSessionClass(tx, facilityId, ctx.subject, existing.classSessionId);

        // Atomic write — the WHERE status:'draft' means a concurrent confirm/discard
        // that already committed will produce count=0 here.
        const result = await tx.qualitativeAssessment.updateMany({
          where: { id: input.assessmentId, facilityId, status: 'draft' },
          data: {
            status: 'confirmed',
            content: input.content,
            confirmedById: ctx.subject!.userId,
            confirmedAt: new Date(),
          },
        });
        if (result.count === 0) {
          throw badRequest('Assessment was modified concurrently; please retry.');
        }

        const updated = await tx.qualitativeAssessment.findFirst({
          where: { id: input.assessmentId, facilityId },
        });
        return toAssessmentDto(updated!);
      });
    }),

  // -------------------------------------------------------------------------
  // assessment.discard — giao_vien only (same perm as confirm)
  // -------------------------------------------------------------------------
  discard: requirePermission('assessment', 'confirm')
    .input(discardInput)
    .mutation(async ({ ctx, input }): Promise<AssessmentDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const existing = await tx.qualitativeAssessment.findFirst({
          where: { id: input.assessmentId, facilityId },
          select: { id: true, status: true, classSessionId: true },
        });
        if (!existing) {
          throw notFound('Assessment not found.');
        }
        if (existing.status !== 'draft') {
          throw badRequest(`Assessment is already ${existing.status}; only drafts can be discarded.`);
        }
        await assertTeacherOwnsSessionClass(tx, facilityId, ctx.subject, existing.classSessionId);

        const result = await tx.qualitativeAssessment.updateMany({
          where: { id: input.assessmentId, facilityId, status: 'draft' },
          data: { status: 'discarded' },
        });
        if (result.count === 0) {
          throw badRequest('Assessment was modified concurrently; please retry.');
        }

        const updated = await tx.qualitativeAssessment.findFirst({
          where: { id: input.assessmentId, facilityId },
        });
        return toAssessmentDto(updated!);
      });
    }),

  // -------------------------------------------------------------------------
  // assessment.listBySession — staff read (HR remediation phase 5, R2 #C4):
  // draft/confirmed assessments for one session, so the per-session
  // nhận-xét screen can render each present student's current state.
  // -------------------------------------------------------------------------
  listBySession: requirePermission('assessment', 'draft')
    .input(listBySessionInput)
    .query(async ({ ctx, input }): Promise<{ items: AssessmentDto[] }> => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const rows = await tx.qualitativeAssessment.findMany({
          where: { facilityId, classSessionId: input.classSessionId, status: { in: ['draft', 'confirmed'] } },
          orderBy: { createdAt: 'asc' },
        });
        return { items: rows.map(toAssessmentDto) };
      });
    }),

  // -------------------------------------------------------------------------
  // assessment.listForChild — LMS (parent session)
  // Returns ONLY confirmed assessments. Draft/discarded NEVER returned.
  // studentId comes from INPUT — parent may browse any of their children
  // without having a profile selected in the LMS session context.
  // -------------------------------------------------------------------------
  listForChild: lmsProcedure
    .input(listForChildInput)
    .query(async ({ ctx, input }): Promise<{ items: ConfirmedAssessmentDto[] }> => {
      // lmsProcedure guarantees ctx.lmsSubject is non-null.
      const parentAccountId = ctx.lmsSubject!.parentAccountId;

      // Sibling scope gate: student sessions may only access their own records.
      if (ctx.lmsSubject!.kind === 'student') {
        if (input.studentId !== ctx.lmsSubject!.studentId) {
          throw forbidden('Students may only access their own records.');
        }
      }

      // Guardian gate — single approved-children source of truth.
      const approvedChildren = await getApprovedChildren(ctx.db, parentAccountId);
      if (!approvedChildren.some((c) => c.studentId === input.studentId)) {
        throw forbidden('Student does not belong to this account.');
      }

      await auditChildDataAccess(ctx.db, {
        parentAccountId,
        studentIds: [input.studentId],
        via: 'assessment.listForChild',
        actorKind: ctx.lmsSubject!.kind,
      });

      // Resolve the student's facility for RLS scoping.
      const student = await withFacility(ctx.db, null, (tx) =>
        tx.student.findUnique({
          where: { id: input.studentId },
          select: { facilityId: true },
        }),
        { bypass: true },
      );
      if (!student) throw notFound('Student not found.');

      return withFacility(ctx.db, student.facilityId, async (tx) => {
        const items = await tx.qualitativeAssessment.findMany({
          where: {
            studentId: input.studentId,
            status: 'confirmed',
            ...(input.period ? { period: input.period } : {}),
          },
          orderBy: { confirmedAt: 'desc' },
          select: {
            id: true,
            studentId: true,
            classSessionId: true,
            period: true,
            content: true,
            confirmedAt: true,
          },
        });
        return { items: items.map(toConfirmedDto) };
      });
    }),
});

// ---------------------------------------------------------------------------
// reportCard router (separate key in root router — `reportCard.getForChild`)
// ---------------------------------------------------------------------------

export const reportCardRouter = router({
  getForChild: lmsProcedure
    .input(reportCardInput)
    .query(async ({ ctx, input }): Promise<ReportCardDto> => {
      const parentAccountId = ctx.lmsSubject!.parentAccountId;

      // Sibling scope gate: student sessions may only access their own report card.
      if (ctx.lmsSubject!.kind === 'student') {
        if (input.studentId !== ctx.lmsSubject!.studentId) {
          throw forbidden('Students may only access their own records.');
        }
      }

      // Guardian gate.
      const approvedChildren = await getApprovedChildren(ctx.db, parentAccountId);
      if (!approvedChildren.some((c) => c.studentId === input.studentId)) {
        throw forbidden('Student does not belong to this account.');
      }

      await auditChildDataAccess(ctx.db, {
        parentAccountId,
        studentIds: [input.studentId],
        via: 'reportCard.getForChild',
        actorKind: ctx.lmsSubject!.kind,
      });

      const student = await withFacility(ctx.db, null, (tx) =>
        tx.student.findUnique({
          where: { id: input.studentId },
          select: { facilityId: true },
        }),
        { bypass: true },
      );
      if (!student) throw notFound('Student not found.');

      const [periodStart, periodEnd] = ictMonthBounds(input.period);

      return withFacility(ctx.db, student.facilityId, async (tx) => {
        // FinalGrade: all classBatches for this student in this period.
        // Documented assumption: a student typically has one active batch per
        // period; return the first found. If multiple exist (e.g. re-enrollment
        // mid-month), return the one with the highest score as the "best"
        // indicator — no spec pin on aggregation for multi-batch case.
        const finalGradeRows = await tx.finalGrade.findMany({
          where: { studentId: input.studentId, period: input.period },
          orderBy: { score: 'desc' },
        });
        const finalGrade: FinalGradeDto | null =
          finalGradeRows[0]
            ? {
                id: finalGradeRows[0].id,
                studentId: finalGradeRows[0].studentId,
                classBatchId: finalGradeRows[0].classBatchId,
                period: finalGradeRows[0].period,
                score: finalGradeRows[0].score,
              }
            : null;

        // Attendance rate: present+late / non-cancelled sessions in period.
        const enrollments = await tx.enrollment.findMany({
          where: { studentId: input.studentId, facilityId: student.facilityId },
          select: { id: true },
        });
        const enrollmentIds = enrollments.map((e) => e.id);

        const attendances =
          enrollmentIds.length > 0
            ? await tx.attendance.findMany({
                where: {
                  enrollmentId: { in: enrollmentIds },
                  classSession: {
                    endTime: { gte: periodStart, lt: periodEnd },
                    status: { not: 'cancelled' },
                  },
                },
                select: { status: true },
              })
            : [];

        const attendedCount = attendances.filter(
          (a) => a.status === 'present' || a.status === 'late',
        ).length;
        const attendanceRate =
          attendances.length > 0 ? attendedCount / attendances.length : 0;

        // Confirmed assessments for this student in this period.
        const assessmentRows = await tx.qualitativeAssessment.findMany({
          where: {
            studentId: input.studentId,
            status: 'confirmed',
            period: input.period,
          },
          orderBy: { confirmedAt: 'desc' },
          select: {
            id: true,
            studentId: true,
            classSessionId: true,
            period: true,
            content: true,
            confirmedAt: true,
          },
        });

        return {
          period: input.period,
          finalGrade,
          attendanceRate,
          assessments: assessmentRows.map(toConfirmedDto),
        };
      });
    }),
});
