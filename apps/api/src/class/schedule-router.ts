// schedule router -- WF-P2-01 re-generate: idempotent (does not duplicate
// existing sessions, via the DB unique index + `skipDuplicates`) and
// optionally extends the class's `endDate` first (docs/26: "nut 'sinh lai'
// mo rong/doi lich").

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { planClassSessions } from './generate-sessions.js';
import { compareDateOnly, ictDateOnlyOf, ictToUtc, isValidDateOnly } from './ict-time.js';

const generateSessionsInput = z.object({
  classBatchId: z.string().uuid(),
  /** Extends the batch's schedule to a later endDate before regenerating.
   * Ignored (no-op) if not later than the batch's current endDate. */
  endDate: z
    .string()
    .refine(isValidDateOnly, { message: 'Expected YYYY-MM-DD.' })
    .optional(),
});

export interface GenerateSessionsResult {
  classBatchId: string;
  sessionsCreated: number;
  sessionsAlreadyExisting: number;
}

export const scheduleRouter = router({
  generateSessions: requirePermission('schedule', 'generate')
    .input(generateSessionsInput)
    .mutation(async ({ ctx, input }): Promise<GenerateSessionsResult> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const classBatch = await tx.classBatch.findFirst({
          where: { id: input.classBatchId, facilityId },
          include: { scheduleSlots: true },
        });
        if (!classBatch) {
          throw notFound('ClassBatch not found.');
        }

        const startDateOnly = ictDateOnlyOf(classBatch.startDate);
        let endDateOnly = ictDateOnlyOf(classBatch.endDate);

        if (input.endDate && compareDateOnly(input.endDate, endDateOnly) > 0) {
          endDateOnly = input.endDate;
          await tx.classBatch.update({
            where: { id: classBatch.id },
            data: { endDate: ictToUtc(input.endDate, '00:00') },
          });
        }

        const planned = planClassSessions(startDateOnly, endDateOnly, classBatch.scheduleSlots);

        const before = await tx.classSession.count({ where: { classBatchId: classBatch.id } });
        if (planned.length > 0) {
          await tx.classSession.createMany({
            data: planned.map((p) => ({
              facilityId,
              classBatchId: classBatch.id,
              scheduleSlotId: p.scheduleSlotId ?? null,
              sessionDate: p.sessionDate,
              startTime: p.startTime,
              endTime: p.endTime,
            })),
            skipDuplicates: true,
          });
        }
        const after = await tx.classSession.count({ where: { classBatchId: classBatch.id } });
        const sessionsCreated = after - before;

        return {
          classBatchId: classBatch.id,
          sessionsCreated,
          sessionsAlreadyExisting: planned.length - sessionsCreated,
        };
      });
    }),
});
