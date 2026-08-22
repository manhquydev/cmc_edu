// schedule router -- WF-P2-01 re-generate: idempotent (looks up existing
// sessions by class+day+start before insert) and optionally extends the
// class's `endDate` first (docs/26: "nut 'sinh lai' mo rong/doi lich").
// Slot mutations archive instead of DELETE.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { MAX_CLASS_SPAN_DAYS, planClassSessions, spanDaysInclusive } from './generate-sessions.js';
import { insertMissingPlannedSessions } from './insert-planned-sessions.js';
import { emitClassRecordEvent } from './record-event.js';
import { assertNoRoomConflict } from './room-conflict.js';
import { badRequest } from '../errors.js';
import {
  compareDateOnly,
  ictDateOnlyOf,
  ictToUtc,
  isValidDateOnly,
  isValidTimeOfDay,
} from '@cmc/domain-time';

const generateSessionsInput = z.object({
  classBatchId: z.string().uuid(),
  /** Extends the batch's schedule to a later endDate before regenerating.
   * Ignored (no-op) if not later than the batch's current endDate. */
  endDate: z
    .string()
    .refine(isValidDateOnly, { message: 'Expected YYYY-MM-DD.' })
    .optional(),
});

const timeOfDaySchema = z.string().refine(isValidTimeOfDay, { message: 'Expected HH:mm (24h).' });

const scheduleSlotIdInput = z.object({
  scheduleSlotId: z.string().uuid(),
});

const slotPatternInput = {
  weekday: z.number().int().min(0).max(6),
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema,
};

const updateSlotInput = z
  .object({
    scheduleSlotId: z.string().uuid(),
    ...slotPatternInput,
  })
  .refine((slot) => slot.startTime < slot.endTime, {
    message: 'slot startTime must be before endTime.',
    path: ['endTime'],
  });

const addSlotInput = z
  .object({
    classBatchId: z.string().uuid(),
    ...slotPatternInput,
  })
  .refine((slot) => slot.startTime < slot.endTime, {
    message: 'slot startTime must be before endTime.',
    path: ['endTime'],
  });

export interface GenerateSessionsResult {
  classBatchId: string;
  sessionsCreated: number;
  sessionsAlreadyExisting: number;
}

export interface ScheduleSlotDto {
  id: string;
  classBatchId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  archivedAt: Date | null;
}

function toScheduleSlotDto(row: {
  id: string;
  classBatchId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  archivedAt: Date | null;
}): ScheduleSlotDto {
  return {
    id: row.id,
    classBatchId: row.classBatchId,
    weekday: row.weekday,
    startTime: row.startTime,
    endTime: row.endTime,
    archivedAt: row.archivedAt,
  };
}

export const scheduleRouter = router({
  generateSessions: requirePermission('schedule', 'generate')
    .input(generateSessionsInput)
    .mutation(async ({ ctx, input }): Promise<GenerateSessionsResult> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const classBatch = await tx.classBatch.findFirst({
          where: { id: input.classBatchId, facilityId },
          include: { scheduleSlots: { where: { archivedAt: null } } },
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

        if (spanDaysInclusive(startDateOnly, endDateOnly) > MAX_CLASS_SPAN_DAYS) {
          throw badRequest(`Class span exceeds the ${MAX_CLASS_SPAN_DAYS}-day limit.`);
        }

        // Regenerate only from today (ICT) forward. classBatch.create still
        // plans from startDate — a new class has no history to protect.
        const todayIct = ictDateOnlyOf(new Date());
        const planFrom =
          compareDateOnly(startDateOnly, todayIct) > 0 ? startDateOnly : todayIct;
        const planned = planClassSessions(planFrom, endDateOnly, classBatch.scheduleSlots);

        // Same room-conflict invariant as create (G1 review M1), excluding this
        // batch's own sessions so a regenerate never conflicts with itself.
        if (classBatch.roomId) {
          await assertNoRoomConflict(tx, facilityId, classBatch.roomId, planned, classBatch.id);
        }

        const inserted = await insertMissingPlannedSessions(tx, {
          facilityId,
          classBatchId: classBatch.id,
          planned,
        });

        if (inserted.created > 0) {
          await emitClassRecordEvent(tx, {
            facilityId,
            classBatchId: classBatch.id,
            actor: ctx.subject.userId,
            kind: 'sessions_generated',
            created: inserted.created,
          });
        }

        return {
          classBatchId: classBatch.id,
          sessionsCreated: inserted.created,
          sessionsAlreadyExisting: inserted.alreadyExisting,
        };
      });
    }),

  // Reuses schedule.generate — Lane B owns the auth registry, so A1 does not
  // add a new permission key. Auto AuditLog middleware covers the mutation.
  updateSlot: requirePermission('schedule', 'generate')
    .input(updateSlotInput)
    .mutation(async ({ ctx, input }): Promise<ScheduleSlotDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const slot = await tx.scheduleSlot.findFirst({
          where: { id: input.scheduleSlotId, facilityId },
        });
        if (!slot) {
          throw notFound('ScheduleSlot not found.');
        }
        if (slot.archivedAt) {
          throw badRequest('An archived schedule slot cannot be updated.');
        }

        const updated = await tx.scheduleSlot.update({
          where: { id: slot.id },
          data: {
            weekday: input.weekday,
            startTime: input.startTime,
            endTime: input.endTime,
          },
        });
        if (
          slot.weekday !== input.weekday ||
          slot.startTime !== input.startTime ||
          slot.endTime !== input.endTime
        ) {
          await emitClassRecordEvent(tx, {
            facilityId,
            classBatchId: slot.classBatchId,
            actor: ctx.subject.userId,
            kind: 'slot_updated',
            weekday: input.weekday,
            startTime: input.startTime,
            endTime: input.endTime,
          });
        }
        return toScheduleSlotDto(updated);
      });
    }),

  archiveSlot: requirePermission('schedule', 'generate')
    .input(scheduleSlotIdInput)
    .mutation(async ({ ctx, input }): Promise<ScheduleSlotDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const slot = await tx.scheduleSlot.findFirst({
          where: { id: input.scheduleSlotId, facilityId },
        });
        if (!slot) {
          throw notFound('ScheduleSlot not found.');
        }
        if (slot.archivedAt) {
          return toScheduleSlotDto(slot);
        }

        const archived = await tx.scheduleSlot.update({
          where: { id: slot.id },
          data: { archivedAt: new Date() },
        });
        await emitClassRecordEvent(tx, {
          facilityId,
          classBatchId: slot.classBatchId,
          actor: ctx.subject.userId,
          kind: 'slot_archived',
        });
        return toScheduleSlotDto(archived);
      });
    }),

  addSlot: requirePermission('schedule', 'generate')
    .input(addSlotInput)
    .mutation(async ({ ctx, input }): Promise<ScheduleSlotDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const classBatch = await tx.classBatch.findFirst({
          where: { id: input.classBatchId, facilityId },
        });
        if (!classBatch) {
          throw notFound('ClassBatch not found.');
        }

        const created = await tx.scheduleSlot.create({
          data: {
            facilityId,
            classBatchId: classBatch.id,
            weekday: input.weekday,
            startTime: input.startTime,
            endTime: input.endTime,
          },
        });
        await emitClassRecordEvent(tx, {
          facilityId,
          classBatchId: classBatch.id,
          actor: ctx.subject.userId,
          kind: 'slot_added',
          weekday: input.weekday,
          startTime: input.startTime,
          endTime: input.endTime,
        });
        return toScheduleSlotDto(created);
      });
    }),
});
