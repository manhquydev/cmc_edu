// parentMeeting router — P4 (WF-P4-03): parent-teacher meeting lifecycle.
//
// Lifecycle: scheduled -> done | cancelled.
// `complete` requires a non-empty `result` field — an empty result string is
// rejected so the meeting record is meaningful for after-sale follow-up.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { listRecordEventPage } from '../record-event/store.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { assertStudentActive } from '../student/assert-student-active.js';
import {
  emitParentMeetingRecordEvent,
  isParentMeetingRecordEventKind,
  labelForParentMeetingRecordEventKind,
  PARENT_MEETING_RECORD_EVENT_ENTITY,
  PARENT_MEETING_RECORD_EVENT_HISTORY_SINCE,
} from './record-event.js';

const scheduleInput = z.object({
  studentId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
});

const completeInput = z.object({
  meetingId: z.string().uuid(),
  result: z.string().min(1, 'result is required to complete a meeting'),
});

const cancelInput = z.object({
  meetingId: z.string().uuid(),
});

const listInput = z.object({
  status: z.enum(['scheduled', 'done', 'cancelled']).optional(),
  /** Optional ISO datetime bounds on scheduledAt (inclusive). */
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

const getInput = z.object({
  meetingId: z.string().uuid(),
});

export const parentMeetingRouter = router({
  /** Facility-scoped, paginated meeting list for the post-sale-meeting screen
   * (F10). Deliberately does NOT return `remindedAt` — that column is dropped in
   * phase 10, so the UI must never depend on it. */
  list: requirePermission('parentMeeting', 'manage')
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const scheduledAt =
          input.from || input.to
            ? { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) }
            : undefined;
        const where = {
          facilityId,
          ...(input.status ? { status: input.status } : {}),
          ...(scheduledAt ? { scheduledAt } : {}),
        };
        const [rows, total] = await Promise.all([
          tx.parentMeeting.findMany({
            where,
            select: { id: true, studentId: true, scheduledAt: true, status: true, result: true, createdAt: true },
            orderBy: { scheduledAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.parentMeeting.count({ where }),
        ]);
        const studentIds = [...new Set(rows.map((r) => r.studentId))];
        const students = studentIds.length
          ? await tx.student.findMany({ where: { facilityId, id: { in: studentIds } }, select: { id: true, fullName: true } })
          : [];
        const nameById = new Map(students.map((s) => [s.id, s.fullName]));
        const items = rows.map((r) => ({ ...r, studentName: nameById.get(r.studentId) ?? null }));
        return { items, total, page: input.page, pageSize: input.pageSize };
      });
    }),

  get: requirePermission('parentMeeting', 'manage')
    .input(getInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const meeting = await tx.parentMeeting.findFirst({
          where: { id: input.meetingId, facilityId },
          select: {
            id: true,
            studentId: true,
            scheduledAt: true,
            status: true,
            result: true,
            createdAt: true,
          },
        });
        if (!meeting) throw notFound('Meeting not found.');
        const student = await tx.student.findFirst({
          where: { id: meeting.studentId, facilityId },
          select: { fullName: true },
        });
        return { ...meeting, studentName: student?.fullName ?? null };
      });
    }),

  timeline: requirePermission('parentMeeting', 'manage')
    .input(z.object({
      meetingId: z.string().uuid(),
      cursor: z.string().min(1).optional(),
      take: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const meeting = await tx.parentMeeting.findFirst({
          where: { id: input.meetingId, facilityId },
          select: { id: true },
        });
        if (!meeting) throw notFound('Meeting not found.');
        const eventWhere = {
          facilityId,
          entity: PARENT_MEETING_RECORD_EVENT_ENTITY,
          entityId: meeting.id,
        };
        const [{ rows, nextCursor }, createdEvent] = await Promise.all([
          listRecordEventPage(tx, eventWhere, input.cursor ?? null, input.take),
          tx.recordEvent.findFirst({ where: { ...eventWhere, kind: 'created' }, select: { id: true } }),
        ]);
        const actorUserIds = [...new Set(rows.map((row) => row.actor).filter(Boolean))];
        const actorStaffRows = actorUserIds.length
          ? await tx.appUser.findMany({
              where: { facilityId, userId: { in: actorUserIds } },
              select: { userId: true, fullName: true, employeeCode: true },
            })
          : [];
        const actorMap = new Map(actorStaffRows.map((staff) => [staff.userId, staff]));
        return {
          items: rows.map((row) => {
            const staff = actorMap.get(row.actor);
            return {
              id: row.id,
              kind: row.kind,
              actor: staff ? staff.fullName || staff.employeeCode || staff.userId : 'Hệ thống',
              payload: isParentMeetingRecordEventKind(row.kind) ? row.payload : null,
              label: labelForParentMeetingRecordEventKind(row.kind),
              createdAt: row.createdAt,
            };
          }),
          nextCursor,
          historySince: createdEvent ? null : PARENT_MEETING_RECORD_EVENT_HISTORY_SINCE,
        };
      });
    }),

  /** Schedule a new parent meeting. */
  schedule: requirePermission('parentMeeting', 'manage')
    .input(scheduleInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const student = await tx.student.findFirst({
          where: { id: input.studentId, facilityId },
        });
        if (!student) throw notFound('Student not found in this facility.');
        assertStudentActive(student);

        const scheduledAt = new Date(input.scheduledAt);

        // Low-Severity Hygiene remediation (scenario audit): a double-booked
        // slot for the same student is CHỐT as a soft warning, not a block —
        // scheduling meetings is a low-stakes action, and hard-blocking would
        // just annoy staff coordinating around a parent's availability.
        const doubleBooked = await tx.parentMeeting.findFirst({
          where: { facilityId, studentId: input.studentId, scheduledAt, status: 'scheduled' },
          select: { id: true },
        });

        const created = await tx.parentMeeting.create({
          data: {
            facilityId,
            studentId: input.studentId,
            scheduledAt,
            status: 'scheduled',
          },
        });

        await emitParentMeetingRecordEvent(tx, {
          facilityId,
          meetingId: created.id,
          actor: ctx.subject.userId,
          kind: 'created',
          studentId: created.studentId,
        });

        return {
          ...created,
          warning: doubleBooked ? 'Học sinh này đã có 1 lịch họp trùng giờ — vui lòng xác nhận.' : undefined,
        };
      });
    }),

  /** Mark a meeting as done. Requires a non-empty result. */
  complete: requirePermission('parentMeeting', 'manage')
    .input(completeInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const meeting = await tx.parentMeeting.findFirst({
          where: { id: input.meetingId, facilityId },
        });
        if (!meeting) throw notFound('Meeting not found.');
        if (meeting.status !== 'scheduled') {
          throw badRequest(`Meeting is already ${meeting.status}; can only complete scheduled meetings.`);
        }
        const updated = await tx.parentMeeting.update({
          where: { id: input.meetingId },
          data: { status: 'done', result: input.result },
        });
        await emitParentMeetingRecordEvent(tx, {
          facilityId,
          meetingId: updated.id,
          actor: ctx.subject.userId,
          kind: 'completed',
        });
        return updated;
      });
    }),

  /** Cancel a scheduled meeting. */
  cancel: requirePermission('parentMeeting', 'manage')
    .input(cancelInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const meeting = await tx.parentMeeting.findFirst({
          where: { id: input.meetingId, facilityId },
        });
        if (!meeting) throw notFound('Meeting not found.');
        if (meeting.status !== 'scheduled') {
          throw badRequest(`Meeting is already ${meeting.status}; can only cancel scheduled meetings.`);
        }
        const updated = await tx.parentMeeting.update({
          where: { id: input.meetingId },
          data: { status: 'cancelled' },
        });
        await emitParentMeetingRecordEvent(tx, {
          facilityId,
          meetingId: updated.id,
          actor: ctx.subject.userId,
          kind: 'cancelled',
        });
        return updated;
      });
    }),
});
