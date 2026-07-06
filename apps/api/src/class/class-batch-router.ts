// classBatch router -- WF-P2-01 happy path: create a class, auto-generate
// its ClassSession rows in one transaction, and read it back.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { nextClassBatchCode } from './class-code.js';
import { MAX_CLASS_SPAN_DAYS, planClassSessions, spanDaysInclusive } from './generate-sessions.js';
import { assertNoRoomConflict } from './room-conflict.js';
import { compareDateOnly, ictToUtc, isValidDateOnly, isValidTimeOfDay } from './ict-time.js';

const dateOnlySchema = z.string().refine(isValidDateOnly, { message: 'Expected YYYY-MM-DD.' });
const timeOfDaySchema = z.string().refine(isValidTimeOfDay, { message: 'Expected HH:mm (24h).' });

const slotInputSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .refine((slot) => slot.startTime < slot.endTime, {
    message: 'slot startTime must be before endTime.',
    path: ['endTime'],
  });

const classBatchCreateInput = z.object({
  courseId: z.string().uuid(),
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  roomId: z.string().uuid().optional(),
  slots: z.array(slotInputSchema).min(1),
  teacherId: z.string().min(1).optional(),
});

const classBatchListInput = z.object({
  courseId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

const classBatchGetInput = z.object({
  classBatchId: z.string().uuid(),
});

export interface ClassBatchDto {
  id: string;
  code: string;
  courseId: string;
  program: string;
  startDate: Date;
  endDate: Date;
  roomId: string | null;
  teacherId: string | null;
  status: string;
  createdAt: Date;
}

export interface ClassBatchCreateResult {
  classBatch: ClassBatchDto;
  slotsCreated: number;
  sessionsCreated: number;
}

function toClassBatchDto(row: {
  id: string;
  code: string;
  courseId: string;
  program: string;
  startDate: Date;
  endDate: Date;
  roomId: string | null;
  teacherId: string | null;
  status: string;
  createdAt: Date;
}): ClassBatchDto {
  return {
    id: row.id,
    code: row.code,
    courseId: row.courseId,
    program: row.program,
    startDate: row.startDate,
    endDate: row.endDate,
    roomId: row.roomId,
    teacherId: row.teacherId,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export const classBatchRouter = router({
  // Registry has only 4 P2-Foundation entries (course.manage, room.manage,
  // class.create, schedule.generate) -- list/get reuse `class.create` rather
  // than inventing a 5th read-only permission the spec does not name.
  create: requirePermission('class', 'create')
    .input(classBatchCreateInput)
    .mutation(async ({ ctx, input }): Promise<ClassBatchCreateResult> => {
      const { facilityId } = scoped(ctx);

      if (compareDateOnly(input.startDate, input.endDate) > 0) {
        throw badRequest('startDate must not be after endDate.');
      }
      if (spanDaysInclusive(input.startDate, input.endDate) > MAX_CLASS_SPAN_DAYS) {
        throw badRequest(`Class span exceeds the ${MAX_CLASS_SPAN_DAYS}-day limit.`);
      }

      return withFacility(ctx.db, facilityId, async (tx) => {
        const course = await tx.course.findFirst({ where: { id: input.courseId, facilityId } });
        if (!course) {
          throw notFound('Course not found.');
        }

        if (input.roomId) {
          const room = await tx.room.findFirst({ where: { id: input.roomId, facilityId } });
          if (!room) {
            throw notFound('Room not found.');
          }
        }

        const year = Number(input.startDate.slice(0, 4));

        // Atomic per-(facility, program, year) counter -- same upsert-increment
        // shape as finance.receiptCreate's ReceiptCodeCounter (concurrent
        // creates serialize on the row lock, no duplicate codes).
        const counter = await tx.classBatchCodeCounter.upsert({
          where: { facilityId_program_year: { facilityId, program: course.program, year } },
          create: { facilityId, program: course.program, year, value: 1 },
          update: { value: { increment: 1 } },
        });
        const facility = await tx.facility.findUniqueOrThrow({ where: { id: facilityId } });
        const code = nextClassBatchCode(facility.code, course.program, year, counter.value - 1);

        const classBatch = await tx.classBatch.create({
          data: {
            facilityId,
            code,
            courseId: course.id,
            program: course.program,
            startDate: ictToUtc(input.startDate, '00:00'),
            endDate: ictToUtc(input.endDate, '00:00'),
            roomId: input.roomId ?? null,
            teacherId: input.teacherId ?? null,
            createdById: ctx.subject.userId,
          },
        });

        const slots = [];
        for (const slotInput of input.slots) {
          slots.push(
            await tx.scheduleSlot.create({
              data: {
                facilityId,
                classBatchId: classBatch.id,
                weekday: slotInput.weekday,
                startTime: slotInput.startTime,
                endTime: slotInput.endTime,
              },
            }),
          );
        }

        const planned = planClassSessions(input.startDate, input.endDate, slots);

        // Room+time conflict (WF-P2-01: "trung phong -> CONFLICT"). Throwing
        // here rolls back the ClassBatch/ScheduleSlot rows created above too
        // (one transaction). Excludes the batch's own (as-yet-uncreated)
        // sessions; shared with schedule.generateSessions (G1 review M1).
        if (input.roomId) {
          await assertNoRoomConflict(tx, facilityId, input.roomId, planned, classBatch.id);
        }

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

        return {
          classBatch: toClassBatchDto(classBatch),
          slotsCreated: slots.length,
          sessionsCreated: planned.length,
        };
      });
    }),

  list: requirePermission('class', 'create')
    .input(classBatchListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const where = { facilityId, ...(input.courseId ? { courseId: input.courseId } : {}) };

      return withFacility(ctx.db, facilityId, async (tx) => {
        const [rows, total] = await Promise.all([
          tx.classBatch.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.classBatch.count({ where }),
        ]);
        return {
          items: rows.map(toClassBatchDto),
          total,
          page: input.page,
          pageSize: input.pageSize,
        };
      });
    }),

  get: requirePermission('class', 'create')
    .input(classBatchGetInput)
    .query(async ({ ctx, input }): Promise<ClassBatchDto> => {
      const { facilityId } = scoped(ctx);
      const row = await withFacility(ctx.db, facilityId, (tx) =>
        tx.classBatch.findFirst({ where: { id: input.classBatchId, facilityId } }),
      );
      if (!row) {
        throw notFound('ClassBatch not found.');
      }
      return toClassBatchDto(row);
    }),
});
