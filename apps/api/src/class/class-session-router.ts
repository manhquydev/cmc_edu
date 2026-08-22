// classSession router — T1 session lifecycle (docs/26 phase-02, ADR 0038 Tier
// A open-tier): `cancel`/`confirm` flip `SessionStatus`; `assignUnit` stamps
// the unit a session teaches. Lifecycle mutations gate on `schedule.generate`
// (GĐĐT/super_admin) — the same permission `classBatch.create`/
// `schedule.generateSessions` already use, since session lifecycle is a
// training-ops action, not a teacher-facing one (that's `attendance.mark`,
// ./attendance/router.ts). Makeup sessions are intentionally not supported.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { assertSessionActive } from './assert-session-active.js';
import {
  compareDateOnly,
  ictToUtc,
  isValidDateOnly,
} from '@cmc/domain-time';
import { spanDaysInclusive } from './generate-sessions.js';
import { resolveTeacher } from './resolve-teacher.js';
import { emitClassRecordEvent } from './record-event.js';
import { cancelSessionWithRestamp } from '../lms-ops/cancel-session.js';
import {
  evaluateSessionDoneProgress,
  type SessionDoneProgress,
} from './session-done.js';

const dateOnlySchema = z.string().refine(isValidDateOnly, { message: 'Expected YYYY-MM-DD.' });

/** Max calendar window for listInRange (calendar lazy load; prevents unbounded scans). */
const LIST_IN_RANGE_MAX_DAYS = 120;

const sessionIdInput = z.object({ sessionId: z.string().uuid() });

const assignUnitInput = z.object({
  sessionId: z.string().uuid(),
  curriculumUnitId: z.string().uuid(),
});

const assignSessionTeacherInput = z.object({
  sessionId: z.string().uuid(),
  teacherAppUserId: z.string().uuid(),
});

export interface ClassSessionDto {
  id: string;
  classBatchId: string;
  scheduleSlotId: string | null;
  sessionDate: Date;
  startTime: Date;
  endTime: Date;
  status: string;
  curriculumUnitId: string | null;
  teacherId: string | null;
}

function toClassSessionDto(
  row: {
    id: string;
    classBatchId: string;
    scheduleSlotId: string | null;
    sessionDate: Date;
    startTime: Date;
    endTime: Date;
    status: string;
    curriculumUnitId: string | null;
    teacherId: string | null;
  },
  classTeacherId: string | null = null,
): ClassSessionDto {
  return {
    id: row.id,
    classBatchId: row.classBatchId,
    scheduleSlotId: row.scheduleSlotId,
    sessionDate: row.sessionDate,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    curriculumUnitId: row.curriculumUnitId,
    teacherId: row.teacherId ?? classTeacherId,
  };
}

const listSessionsInput = z.object({
  classBatchId: z.string().uuid(),
});

/**
 * Facility calendar range query for FullCalendar (timeGrid/dayGrid).
 * `from`/`to` are inclusive ICT calendar days (YYYY-MM-DD).
 */
const listInRangeInput = z
  .object({
    from: dateOnlySchema,
    to: dateOnlySchema,
    courseId: z.string().uuid().optional(),
    includeCancelled: z.boolean().optional().default(false),
  })
  .superRefine((input, ctx) => {
    if (compareDateOnly(input.from, input.to) > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`from` must be on or before `to`.',
        path: ['from'],
      });
      return;
    }
    const span = spanDaysInclusive(input.from, input.to);
    if (span > LIST_IN_RANGE_MAX_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Date range must span at most ${LIST_IN_RANGE_MAX_DAYS} days (got ${span}).`,
        path: ['to'],
      });
    }
  });

/** Session row for calendar with batch denorm for titles/hrefs. */
export interface ClassSessionInRangeDto {
  id: string;
  classBatchId: string;
  scheduleSlotId: string | null;
  sessionDate: Date;
  startTime: Date;
  endTime: Date;
  status: string;
  curriculumUnitId: string | null;
  batchCode: string;
  program: string;
  teacherId: string | null;
  courseId: string;
  batchStatus: string;
}

/** Single-session identity for teacher Session Detail hub. */
export interface ClassSessionGetDto extends ClassSessionDto {
  batchCode: string;
  program: string;
  teacherId: string | null;
  /** Resolved AppUser.id for the session/class teacher hop. */
  teacherAppUserId: string | null;
  teacherFullName: string | null;
  courseId: string;
  batchStatus: string;
}

export const classSessionRouter = router({
  // Read-only: list all sessions for a batch (schedule, confirm/cancel UI).
  list: requirePermission('class', 'read')
    .input(listSessionsInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const rows = await tx.classSession.findMany({
          where: { classBatchId: input.classBatchId, facilityId },
          include: { classBatch: { select: { teacherId: true } } },
          orderBy: { sessionDate: 'asc' },
        });
        return rows.map((row) => toClassSessionDto(row, row.classBatch.teacherId));
      });
    }),

  /**
   * Single session + batch denorm for Session Detail hub (cold-start by id).
   * Permission matches list/listInRange (`class.read`).
   */
  get: requirePermission('class', 'read')
    .input(sessionIdInput)
    .query(async ({ ctx, input }): Promise<ClassSessionGetDto> => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const row = await tx.classSession.findFirst({
          where: { id: input.sessionId, facilityId },
          include: {
            classBatch: {
              select: {
                code: true,
                program: true,
                teacherId: true,
                teacherAppUserId: true,
                courseId: true,
                status: true,
              },
            },
          },
        });
        if (!row) {
          throw notFound('ClassSession not found.');
        }
        const teacherAppUserId =
          row.teacherId ?? row.classBatch.teacherAppUserId ?? row.classBatch.teacherId;
        const teacher = teacherAppUserId
          ? await tx.appUser.findFirst({
              where: { id: teacherAppUserId, facilityId },
              select: { id: true, fullName: true },
            })
          : null;
        return {
          ...toClassSessionDto(row, row.classBatch.teacherId),
          batchCode: row.classBatch.code,
          program: row.classBatch.program,
          teacherAppUserId: teacher?.id ?? null,
          teacherFullName: teacher?.fullName ?? null,
          courseId: row.classBatch.courseId,
          batchStatus: row.classBatch.status,
        };
      });
    }),

  /**
   * Session-done checklist flags for hub UI (does not flip status).
   * Same three conditions as `evaluateSessionDone` / done-sweep.
   */
  doneProgress: requirePermission('class', 'read')
    .input(sessionIdInput)
    .query(async ({ ctx, input }): Promise<SessionDoneProgress & { sessionId: string; status: string }> => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await tx.classSession.findFirst({
          where: { id: input.sessionId, facilityId },
          select: { id: true, endTime: true, status: true },
        });
        if (!session) {
          throw notFound('ClassSession not found.');
        }

        const [attendances, assessments, evidence] = await Promise.all([
          tx.attendance.findMany({
            where: { classSessionId: session.id },
            select: { studentId: true, status: true, markedAt: true },
          }),
          tx.qualitativeAssessment.findMany({
            where: { classSessionId: session.id },
            select: { studentId: true, status: true, confirmedAt: true },
          }),
          tx.sessionEvidence.findUnique({
            where: { classSessionId: session.id },
            select: { status: true, publishedAt: true, photos: { select: { id: true } } },
          }),
        ]);

        const progress = evaluateSessionDoneProgress(
          {
            endTime: session.endTime,
            attendances,
            assessments,
            evidence: evidence
              ? {
                  status: evidence.status,
                  publishedAt: evidence.publishedAt,
                  photoCount: evidence.photos.length,
                }
              : null,
          },
          new Date(),
        );

        return { sessionId: session.id, status: session.status, ...progress };
      });
    }),

  /**
   * Facility-scoped sessions in an ICT date window for the teaching calendar.
   * Uses `sessionDate` (ICT midnight) + index `[facilityId, sessionDate]`.
   * Cancelled sessions excluded unless `includeCancelled`.
   */
  listInRange: requirePermission('class', 'read')
    .input(listInRangeInput)
    .query(async ({ ctx, input }): Promise<ClassSessionInRangeDto[]> => {
      const { facilityId } = scoped(ctx);
      // sessionDate is ICT midnight for the calendar day — inclusive bounds.
      const fromInstant = ictToUtc(input.from, '00:00');
      const toInstant = ictToUtc(input.to, '00:00');

      return withFacility(ctx.db, facilityId, async (tx) => {
        const rows = await tx.classSession.findMany({
          where: {
            facilityId,
            sessionDate: { gte: fromInstant, lte: toInstant },
            ...(input.includeCancelled ? {} : { status: { not: 'cancelled' as const } }),
            ...(input.courseId
              ? { classBatch: { courseId: input.courseId } }
              : {}),
          },
          include: {
            classBatch: {
              select: {
                code: true,
                program: true,
                teacherId: true,
                courseId: true,
                status: true,
              },
            },
          },
          orderBy: [{ startTime: 'asc' }],
        });

        return rows.map((row) => ({
          id: row.id,
          classBatchId: row.classBatchId,
          scheduleSlotId: row.scheduleSlotId,
          sessionDate: row.sessionDate,
          startTime: row.startTime,
          endTime: row.endTime,
          status: row.status,
          curriculumUnitId: row.curriculumUnitId,
          batchCode: row.classBatch.code,
          program: row.classBatch.program,
          teacherId: row.teacherId ?? row.classBatch.teacherId,
          courseId: row.classBatch.courseId,
          batchStatus: row.classBatch.status,
        }));
      });
    }),

  // planned/confirmed -> cancelled + unit restamp (shared with lmsOps).
  // Cancelled sessions are excluded from attendance (docs/19 §5 gate 1).
  cancel: requirePermission('schedule', 'generate')
    .input(sessionIdInput)
    .mutation(async ({ ctx, input }): Promise<ClassSessionDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const { session } = await cancelSessionWithRestamp(tx, {
          facilityId,
          sessionId: input.sessionId,
          actorUserId: ctx.subject.userId,
          auditAction: 'classSession.cancel',
        });
        await emitClassRecordEvent(tx, {
          facilityId,
          classBatchId: session.classBatchId,
          actor: ctx.subject.userId,
          kind: 'session_cancelled',
          sessionId: session.id,
        });
        const batch = await tx.classBatch.findFirst({
          where: { id: session.classBatchId, facilityId },
          select: { teacherId: true },
        });
        return toClassSessionDto(session, batch?.teacherId ?? null);
      });
    }),

  // planned -> confirmed only (cheap, no audit — a non-destructive forward
  // transition, unlike cancel which blocks future attendance).
  confirm: requirePermission('schedule', 'generate')
    .input(sessionIdInput)
    .mutation(async ({ ctx, input }): Promise<ClassSessionDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await tx.classSession.findFirst({
          where: { id: input.sessionId, facilityId },
        });
        if (!session) {
          throw notFound('ClassSession not found.');
        }
        if (session.status !== 'planned') {
          throw badRequest('Only a planned session can be confirmed.');
        }

        const updated = await tx.classSession.update({
          where: { id: session.id },
          data: { status: 'confirmed' },
        });
        await emitClassRecordEvent(tx, {
          facilityId,
          classBatchId: updated.classBatchId,
          actor: ctx.subject.userId,
          kind: 'session_confirmed',
          sessionId: updated.id,
        });
        const batch = await tx.classBatch.findFirst({
          where: { id: updated.classBatchId, facilityId },
          select: { teacherId: true },
        });
        return toClassSessionDto(updated, batch?.teacherId ?? null);
      });
    }),

  // T2-I (docs/26 WF-P2-01 remainder, phase-03 §Schema): sets the curriculum
  // unit a session teaches — the Tier A open-tier gate (ADR 0038, T2-II)
  // reads this to know which unit's exercises to open once the session ends.
  // `CurriculumUnit` is a GLOBAL table (no facilityId, no RLS — QĐ 0021), so
  // only the session lookup is facility-scoped; the unit lookup is a plain
  // `ctx.db` call, same pattern as ../exercise/router.ts.
  assignUnit: requirePermission('schedule', 'generate')
    .input(assignUnitInput)
    .mutation(async ({ ctx, input }): Promise<ClassSessionDto> => {
      const { facilityId } = scoped(ctx);

      const unit = await ctx.db.curriculumUnit.findUnique({ where: { id: input.curriculumUnitId } });
      if (!unit) {
        throw notFound('CurriculumUnit not found.');
      }

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await tx.classSession.findFirst({
          where: { id: input.sessionId, facilityId },
        });
        if (!session) {
          throw notFound('ClassSession not found.');
        }
        assertSessionActive(session, { alsoBlockDone: true });

        const updated = await tx.classSession.update({
          where: { id: session.id },
          data: { curriculumUnitId: input.curriculumUnitId },
        });
        if (session.curriculumUnitId !== input.curriculumUnitId) {
          await emitClassRecordEvent(tx, {
            facilityId,
            classBatchId: updated.classBatchId,
            actor: ctx.subject.userId,
            kind: 'session_unit_assigned',
            sessionId: updated.id,
            curriculumUnitId: input.curriculumUnitId,
          });
        }
        const batch = await tx.classBatch.findFirst({
          where: { id: updated.classBatchId, facilityId },
          select: { teacherId: true },
        });
        return toClassSessionDto(updated, batch?.teacherId ?? null);
      });
    }),

  // Display-only override of the session teacher (NULL still means inherit
  // the class teacher). Not the source for attendance, KPI, or payroll —
  // those keep reading ClassBatch.teacherAppUserId.
  // Reuses class.create (same key as classBatch.assignTeacher). Lane B owns
  // the auth registry, so A1 does not add a session-specific permission.
  // Auto AuditLog middleware covers the mutation.
  assignTeacher: requirePermission('class', 'create')
    .input(assignSessionTeacherInput)
    .mutation(async ({ ctx, input }): Promise<ClassSessionDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await tx.classSession.findFirst({
          where: { id: input.sessionId, facilityId },
        });
        if (!session) {
          throw notFound('ClassSession not found.');
        }
        assertSessionActive(session, { alsoBlockDone: true });

        const teacher = await resolveTeacher(tx, input.teacherAppUserId, facilityId);

        const updated = await tx.classSession.update({
          where: { id: session.id },
          data: { teacherId: teacher.id },
        });
        if (session.teacherId !== teacher.id) {
          await emitClassRecordEvent(tx, {
            facilityId,
            classBatchId: updated.classBatchId,
            actor: ctx.subject.userId,
            kind: 'session_teacher_changed',
            sessionId: updated.id,
            teacherAppUserId: teacher.id,
          });
        }
        const batch = await tx.classBatch.findFirst({
          where: { id: updated.classBatchId, facilityId },
          select: { teacherId: true },
        });
        return toClassSessionDto(updated, batch?.teacherId ?? null);
      });
    }),
});
