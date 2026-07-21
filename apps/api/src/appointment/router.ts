// testAppointment router — P4 (WF-P4-04), redesigned in phase-07 (F5).
//
// CONTRACT (replaces the old "entrance never mutates CRM" invariant):
//   - `entrance` tests happen PRE-payment, before any Student exists, so they
//     attach to an OPPORTUNITY and drive its stage: scheduling advances
//     O2_CONTACTED -> O3_TEST_SCHEDULED, completing advances
//     O3_TEST_SCHEDULED -> O4_TESTED. Both go through the shared one-step
//     advance helper (never bypassing the linear rule), and each such advance
//     writes a CRM stage-change audit row so funnel history stays complete.
//   - `periodic` tests are post-enrollment, so they still attach to a STUDENT
//     and never touch CRM.
// The DB CHECK requires the arm for the row's type (entrance⇒opportunityId,
// periodic⇒studentId) but is NOT exclusive — a legacy entrance row backfilled
// by the phase-07 migration also retains its old studentId. New rows written
// here set only the arm they need. Lifecycle unchanged: scheduled -> done | no_show.

import { z } from 'zod';
import { withFacility, type Prisma } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { isOpportunityLost } from '../crm/opportunity-lost.js';
import { advanceOpportunityOneStep } from '../crm/advance-opportunity.js';
import { resolveAuditActor } from '../audit/audit-helpers.js';

const scheduleInput = z
  .object({
    type: z.enum(['entrance', 'periodic']),
    scheduledAt: z.string().datetime(),
    opportunityId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
  })
  .refine((v) => (v.type === 'entrance' ? Boolean(v.opportunityId) : Boolean(v.studentId)), {
    message: 'An entrance appointment requires opportunityId; a periodic appointment requires studentId.',
  });

const completeInput = z.object({
  appointmentId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

const noShowInput = z.object({
  appointmentId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

/**
 * Records a CRM stage-change audit row for an advance triggered by the
 * appointment lifecycle. The tRPC middleware audits the `testAppointment.*`
 * call itself (a different action); this row mirrors what a direct
 * `crm.opportunityAdvance` would leave, so stage history is complete regardless
 * of which door advanced the opportunity.
 */
async function auditStageAdvance(
  tx: Prisma.TransactionClient,
  actor: string,
  opportunityId: string,
  fromStage: string,
  toStage: string,
  appointmentId: string,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actor,
      action: 'crm.opportunityAdvance',
      entity: 'Opportunity',
      entityId: opportunityId,
      data: { fromStage, toStage, viaTestAppointment: appointmentId },
    },
  });
}

const forOpportunityInput = z.object({ opportunityId: z.string().uuid() });

export const testAppointmentRouter = router({
  /** Entrance appointments attached to an opportunity (for the CRM detail UI). */
  forOpportunity: requirePermission('testAppointment', 'manage')
    .input(forOpportunityInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.testAppointment.findMany({
          where: { facilityId, opportunityId: input.opportunityId },
          orderBy: { scheduledAt: 'desc' },
        }),
      );
    }),

  /**
   * Schedule a test appointment. Entrance attaches to an Opportunity (and
   * advances O2 -> O3); periodic attaches to a Student.
   */
  schedule: requirePermission('testAppointment', 'manage')
    .input(scheduleInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const actor = resolveAuditActor(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        if (input.type === 'entrance') {
          // Lock the opportunity for the validation + stage sync so a
          // concurrent advance/markLost can't interleave.
          const oppRows = await tx.$queryRaw<{ id: string; stage: string; closedAt: Date | null }[]>`
            SELECT "id", "stage", "closedAt" FROM "Opportunity"
            WHERE "id" = ${input.opportunityId} AND "facilityId" = ${facilityId}
            FOR UPDATE
          `;
          const opp = oppRows[0];
          if (!opp) throw notFound('Opportunity not found in this facility.');
          if (isOpportunityLost(opp)) {
            throw badRequest('Cơ hội đã được đánh dấu mất — mở lại (reopen) trước khi đặt lịch test.');
          }
          if (opp.stage === 'O1_LEAD') {
            throw badRequest('Cơ hội đang ở giai đoạn tiếp cận (O1) — hãy đánh dấu "đã liên hệ" (O2) trước khi đặt lịch test.');
          }
          if (opp.stage !== 'O2_CONTACTED' && opp.stage !== 'O3_TEST_SCHEDULED') {
            throw badRequest(`Cơ hội đang ở ${opp.stage} — không thể đặt lịch test đầu vào.`);
          }

          const appt = await tx.testAppointment.create({
            data: {
              facilityId,
              opportunityId: opp.id,
              type: 'entrance',
              scheduledAt: new Date(input.scheduledAt),
              status: 'scheduled',
            },
          });

          // Sync O2 -> O3 (idempotent: only when the opp is still at O2).
          if (opp.stage === 'O2_CONTACTED') {
            await advanceOpportunityOneStep(tx, facilityId, opp.id, 'O3_TEST_SCHEDULED');
            await auditStageAdvance(tx, actor, opp.id, 'O2_CONTACTED', 'O3_TEST_SCHEDULED', appt.id);
          }
          return appt;
        }

        // periodic — attaches to a Student (post-enrollment), never touches CRM.
        const student = await tx.student.findFirst({ where: { id: input.studentId, facilityId } });
        if (!student) throw notFound('Student not found in this facility.');
        if (student.lifecycle === 'withdrawn') {
          throw badRequest('Học sinh đã rút — không thể đặt lịch test định kỳ.');
        }
        return tx.testAppointment.create({
          data: {
            facilityId,
            studentId: student.id,
            type: 'periodic',
            scheduledAt: new Date(input.scheduledAt),
            status: 'scheduled',
          },
        });
      });
    }),

  /** Mark appointment as done (attended). Entrance completion advances O3 -> O4. */
  complete: requirePermission('testAppointment', 'manage')
    .input(completeInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const actor = resolveAuditActor(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appt = await tx.testAppointment.findFirst({
          where: { id: input.appointmentId, facilityId },
        });
        if (!appt) throw notFound('Appointment not found.');
        if (appt.status !== 'scheduled') {
          throw badRequest(`Appointment is already ${appt.status}; can only complete scheduled appointments.`);
        }
        const updated = await tx.testAppointment.update({
          where: { id: input.appointmentId },
          data: {
            status: 'done',
            ...(input.notes != null ? { notes: input.notes } : {}),
          },
        });

        // Entrance completion advances O3 -> O4. Idempotent + lenient: skip if
        // the opp isn't at O3 anymore or was marked lost after scheduling —
        // completing the appointment record must never fail on the CRM sync.
        if (appt.type === 'entrance' && appt.opportunityId) {
          const oppRows = await tx.$queryRaw<{ id: string; stage: string; closedAt: Date | null }[]>`
            SELECT "id", "stage", "closedAt" FROM "Opportunity"
            WHERE "id" = ${appt.opportunityId} AND "facilityId" = ${facilityId}
            FOR UPDATE
          `;
          const opp = oppRows[0];
          if (opp && opp.stage === 'O3_TEST_SCHEDULED' && !isOpportunityLost(opp)) {
            await advanceOpportunityOneStep(tx, facilityId, opp.id, 'O4_TESTED');
            await auditStageAdvance(tx, actor, opp.id, 'O3_TEST_SCHEDULED', 'O4_TESTED', appt.id);
          }
        }
        return updated;
      });
    }),

  /** Mark appointment as no-show. Never changes any CRM stage. */
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
