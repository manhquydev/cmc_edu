// parentMeeting router — P4 (WF-P4-03): parent-teacher meeting lifecycle.
//
// Lifecycle: scheduled -> done | cancelled.
// `complete` requires a non-empty `result` field — an empty result string is
// rejected so the meeting record is meaningful for after-sale follow-up.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { assertStudentActive } from '../student/assert-student-active.js';

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

export const parentMeetingRouter = router({
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
        return tx.parentMeeting.update({
          where: { id: input.meetingId },
          data: { status: 'done', result: input.result },
        });
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
        return tx.parentMeeting.update({
          where: { id: input.meetingId },
          data: { status: 'cancelled' },
        });
      });
    }),
});
