// testAppointment router — P4 (WF-P4-04): entrance / periodic test scheduling.
//
// CRITICAL INVARIANT: entrance-type appointments NEVER mutate CRM stages or
// any Opportunity table. They only record the fact of the appointment.
// Lifecycle: scheduled -> done | no_show.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';

const scheduleInput = z.object({
  studentId: z.string().uuid(),
  type: z.enum(['entrance', 'periodic']),
  scheduledAt: z.string().datetime(),
});

const completeInput = z.object({
  appointmentId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

const noShowInput = z.object({
  appointmentId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

export const testAppointmentRouter = router({
  /**
   * Schedule a test appointment (entrance or periodic).
   * Entrance type: records only — does NOT advance any CRM opportunity stage.
   */
  schedule: requirePermission('testAppointment', 'manage')
    .input(scheduleInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const student = await tx.student.findFirst({
          where: { id: input.studentId, facilityId },
        });
        if (!student) throw notFound('Student not found in this facility.');

        return tx.testAppointment.create({
          data: {
            facilityId,
            studentId: input.studentId,
            type: input.type,
            scheduledAt: new Date(input.scheduledAt),
            status: 'scheduled',
          },
        });
      });
    }),

  /** Mark appointment as done (attended). */
  complete: requirePermission('testAppointment', 'manage')
    .input(completeInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appt = await tx.testAppointment.findFirst({
          where: { id: input.appointmentId, facilityId },
        });
        if (!appt) throw notFound('Appointment not found.');
        if (appt.status !== 'scheduled') {
          throw badRequest(`Appointment is already ${appt.status}; can only complete scheduled appointments.`);
        }
        return tx.testAppointment.update({
          where: { id: input.appointmentId },
          data: {
            status: 'done',
            ...(input.notes != null ? { notes: input.notes } : {}),
          },
        });
      });
    }),

  /** Mark appointment as no-show. */
  noShow: requirePermission('testAppointment', 'manage')
    .input(noShowInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appt = await tx.testAppointment.findFirst({
          where: { id: input.appointmentId, facilityId },
        });
        if (!appt) throw notFound('Appointment not found.');
        if (appt.status !== 'scheduled') {
          throw badRequest(`Appointment is already ${appt.status}; can only mark no-show on scheduled appointments.`);
        }
        return tx.testAppointment.update({
          where: { id: input.appointmentId },
          data: {
            status: 'no_show',
            ...(input.notes != null ? { notes: input.notes } : {}),
          },
        });
      });
    }),
});
