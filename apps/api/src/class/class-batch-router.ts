// classBatch router -- WF-P2-01 happy path: create a class, auto-generate
// its ClassSession rows in one transaction, and read it back.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { nextClassBatchCode } from './class-code.js';
import { MAX_CLASS_SPAN_DAYS, planClassSessions, spanDaysInclusive } from './generate-sessions.js';
import { insertMissingPlannedSessions } from './insert-planned-sessions.js';
import { PROGRAM_VALUES } from './program.js';
import { resolveTeacher } from './resolve-teacher.js';
import { assertNoRoomConflict } from './room-conflict.js';
import { compareDateOnly, ictToUtc, isValidDateOnly, isValidTimeOfDay } from '@cmc/domain-time';

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
  // Low-Severity Hygiene remediation (scenario audit): resource guard — a
  // real weekly schedule never needs more than a handful of slots (mirrors
  // markAllInput's bounded-batch pattern, ../attendance/router.ts).
  slots: z.array(slotInputSchema).min(1).max(20),
  // HR remediation phase 1 (R2 #C5): teacherId is documented (schema.prisma)
  // as an AppUser.id — tightened from `.min(1)` to `.uuid()` since `create`
  // now resolves + validates it against a real AppUser row.
  teacherId: z.string().uuid().optional(),
});

const classBatchListInput = z.object({
  courseId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  /** Matches class code, status, program, or related course name — G1 FilterBar. */
  search: z.string().trim().min(1).max(100).optional(),
});

const classBatchGetInput = z.object({
  classBatchId: z.string().uuid(),
});

// HR remediation phase 1 (R2 #C5): `teacherAppUserId` has had zero writers
// since it was added (P3-I) — this mutation is the first. `class.create`
// (giam_doc_dao_tao) is reused rather than inventing a new `class.manage`
// permission key the registry does not name.
const classBatchAssignTeacherInput = z.object({
  classBatchId: z.string().uuid(),
  teacherAppUserId: z.string().uuid(),
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
  /// HR remediation phase 1: the real AppUser FK (resolved by `create`/
  /// `assignTeacher`) — `teacherId` is kept for back-compat display only.
  teacherAppUserId: string | null;
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
  teacherAppUserId: string | null;
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
    teacherAppUserId: row.teacherAppUserId,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export const classBatchRouter = router({
  // Reads and writes are separate keys. `list`/`get` originally reused
  // `class.create` because the P2-Foundation spec named only 4 permissions --
  // which silently made "pick a class" a director-only action and left sale,
  // GĐKD and teachers unable to finish their own flows. `class.read` covers the
  // reads; `classRoster.read` covers the one read that returns children's names.
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

        // HR remediation phase 1 (R2 #C5): when the caller supplies a
        // teacher, resolve + validate the AppUser row in this facility and
        // write BOTH the legacy scalar and the real FK — `teacherId` had
        // zero writers before this phase (plan finding), so there is no
        // back-compat data shape to preserve beyond keeping the column set.
        let teacherAppUserId: string | null = null;
        if (input.teacherId) {
          const teacher = await resolveTeacher(tx, input.teacherId, facilityId);
          teacherAppUserId = teacher.id;
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
            teacherAppUserId,
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

        const inserted = await insertMissingPlannedSessions(tx, {
          facilityId,
          classBatchId: classBatch.id,
          planned,
        });

        return {
          classBatch: toClassBatchDto(classBatch),
          slotsCreated: slots.length,
          sessionsCreated: inserted.created,
        };
      });
    }),

  list: requirePermission('class', 'read')
    .input(classBatchListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const term = input.search;
      const programHit =
        term && (PROGRAM_VALUES as readonly string[]).includes(term.toUpperCase())
          ? (term.toUpperCase() as (typeof PROGRAM_VALUES)[number])
          : undefined;

      const where = {
        facilityId,
        ...(input.courseId ? { courseId: input.courseId } : {}),
        ...(term
          ? {
              OR: [
                { code: { contains: term, mode: 'insensitive' as const } },
                { status: { contains: term, mode: 'insensitive' as const } },
                ...(programHit ? [{ program: programHit }] : []),
                {
                  course: {
                    name: { contains: term, mode: 'insensitive' as const },
                  },
                },
              ],
            }
          : {}),
      };

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

  // Returns children's full names -- narrower key than the rest of the reads.
  listStudents: requirePermission('classRoster', 'read')
    .input(classBatchGetInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const enrollments = await tx.enrollment.findMany({
          where: {
            classBatchId: input.classBatchId,
            facilityId,
            status: { in: ['reserved', 'active'] },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (enrollments.length === 0) return [];
        const studentIds = enrollments.map((e) => e.studentId);
        const students = await tx.student.findMany({
          where: { id: { in: studentIds }, facilityId },
          select: { id: true, fullName: true },
        });
        const studentMap = new Map(students.map((s) => [s.id, s]));
        return enrollments.map((e) => ({
          enrollmentId: e.id,
          studentId: e.studentId,
          fullName: studentMap.get(e.studentId)?.fullName ?? '—',
          status: e.status,
        }));
      });
    }),

  get: requirePermission('class', 'read')
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

  // HR remediation phase 1 (R2 #C5): the router had NO update mutation at
  // all before this phase — `assignTeacher` is the first, scoped to just the
  // teacher FK (a general classBatch.update is out of scope). UI picker
  // lands in phase 5.
  assignTeacher: requirePermission('class', 'create')
    .input(classBatchAssignTeacherInput)
    .mutation(async ({ ctx, input }): Promise<ClassBatchDto> => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const classBatch = await tx.classBatch.findFirst({
          where: { id: input.classBatchId, facilityId },
        });
        if (!classBatch) {
          throw notFound('ClassBatch not found.');
        }

        const teacher = await resolveTeacher(tx, input.teacherAppUserId, facilityId);

        const updated = await tx.classBatch.update({
          where: { id: classBatch.id },
          data: { teacherAppUserId: teacher.id, teacherId: teacher.id, updatedAt: new Date() },
        });
        return toClassBatchDto(updated);
      });
    }),
});
