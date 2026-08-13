// LMS foundation spike: create class with unit stamps + grant unit ranges + roster D1.
// Does not replace classBatch.create (legacy calendar path) — this is the unit-aware path.

import { z } from 'zod';
import { withFacility, type Prisma } from '@cmc/db';
import {
  previousOrderOnAxis,
  rangeEndpointsOnAxis,
  toProgramUnitAxis,
  validateNewRange,
} from '@cmc/domain-lms';
import {
  compareDateOnly,
  ictDateOnlyOf,
  ictToUtc,
  isValidDateOnly,
  isValidTimeOfDay,
} from '@cmc/domain-time';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { nextClassBatchCode } from '../class/class-code.js';
import { MAX_CLASS_SPAN_DAYS, planClassSessions, spanDaysInclusive } from '../class/generate-sessions.js';
import { insertMissingPlannedSessions } from '../class/insert-planned-sessions.js';
import { assertNoRoomConflict } from '../class/room-conflict.js';
import { onRoster } from './on-roster.js';
import { restampBatchSessions } from './stamp-sessions.js';
import { cancelSessionWithRestamp } from './cancel-session.js';
import {
  deliverForSession,
  deliveredCountForBatch,
  sequenceForBatch,
  writeSequenceUpdate,
} from './exercise-delivery.js';
import { resolveClassCurrentOrder } from './grant-units.js';

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

const createClassWithUnitsInput = z.object({
  courseId: z.string().uuid(),
  startUnitId: z.string().uuid(),
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
  roomId: z.string().uuid().optional(),
  slots: z.array(slotInputSchema).min(1).max(20),
  teacherId: z.string().uuid().optional(),
});

const addWithUnitsInput = z.object({
  enrollmentId: z.string().uuid(),
  fromOrderGlobal: z.number().int().positive(),
  toOrderGlobal: z.number().int().positive(),
});

const rosterForSessionInput = z.object({
  classSessionId: z.string().uuid(),
});

function rangesOverlap(
  a: { fromOrderGlobal: number; toOrderGlobal: number },
  b: { fromOrderGlobal: number; toOrderGlobal: number },
): boolean {
  return a.fromOrderGlobal <= b.toOrderGlobal && b.fromOrderGlobal <= a.toOrderGlobal;
}

async function loadProgramUnitOrders(
  tx: Prisma.TransactionClient,
  program: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE',
): Promise<Map<number, string>> {
  const units = await tx.curriculumUnit.findMany({
    where: { program },
    select: { id: true, orderGlobal: true },
  });
  return new Map(units.map((u) => [u.orderGlobal, u.id]));
}

/** Endpoints must be real units; integer holes between labels are allowed (Bright I.G). */
function assertRangeEndpointsOnProgram(
  range: { fromOrderGlobal: number; toOrderGlobal: number },
  unitOrders: Map<number, string>,
  program: string,
): void {
  const axis = toProgramUnitAxis(unitOrders.keys());
  if (!rangeEndpointsOnAxis(range, axis)) {
    throw badRequest(
      `orderGlobal range [${range.fromOrderGlobal}..${range.toOrderGlobal}] ` +
        `is not on program ${program} (endpoints must be real units; gaps between are allowed).`,
    );
  }
}

export const lmsOpsRouter = router({
  /**
   * Unit-aware class create: calendar materialize + same-TX unit restamp from neo.
   * Permission: class.create (GĐĐT). Side-effect: stamps feed ADR 0038 open-tier when sessions end.
   */
  createClassWithUnits: requirePermission('class', 'create')
    .input(createClassWithUnitsInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      if (compareDateOnly(input.startDate, input.endDate) > 0) {
        throw badRequest('startDate must not be after endDate.');
      }
      if (spanDaysInclusive(input.startDate, input.endDate) > MAX_CLASS_SPAN_DAYS) {
        throw badRequest(`Class span exceeds the ${MAX_CLASS_SPAN_DAYS}-day limit.`);
      }

      return withFacility(ctx.db, facilityId, async (tx) => {
        const course = await tx.course.findFirst({ where: { id: input.courseId, facilityId } });
        if (!course) throw notFound('Course not found.');

        const startUnit = await tx.curriculumUnit.findFirst({
          where: { id: input.startUnitId, program: course.program },
        });
        if (!startUnit) throw notFound('Start unit not found for course program.');

        if (input.roomId) {
          const room = await tx.room.findFirst({ where: { id: input.roomId, facilityId } });
          if (!room) throw notFound('Room not found.');
        }

        let teacherAppUserId: string | null = null;
        if (input.teacherId) {
          const teacher = await tx.appUser.findFirst({
            where: { id: input.teacherId, facilityId },
          });
          if (!teacher) throw notFound('Teacher (AppUser) not found in this facility.');
          if (!teacher.roles.includes('giao_vien')) {
            throw badRequest('That staff member is not a teacher (role giao_vien required).');
          }
          teacherAppUserId = teacher.id;
        }

        const year = Number(input.startDate.slice(0, 4));
        const counter = await tx.classBatchCodeCounter.upsert({
          where: { facilityId_program_year: { facilityId, program: course.program, year } },
          create: { facilityId, program: course.program, year, value: 1 },
          update: { value: { increment: 1 } },
        });
        const facility = await tx.facility.findUniqueOrThrow({ where: { id: facilityId } });
        const code = nextClassBatchCode(facility.code, course.program, year, counter.value - 1);
        const startDateUtc = ictToUtc(input.startDate, '00:00');

        const classBatch = await tx.classBatch.create({
          data: {
            facilityId,
            code,
            courseId: course.id,
            program: course.program,
            startDate: startDateUtc,
            endDate: ictToUtc(input.endDate, '00:00'),
            roomId: input.roomId ?? null,
            teacherId: input.teacherId ?? null,
            teacherAppUserId,
            createdById: ctx.subject.userId,
            startUnitId: startUnit.id,
            currentUnitId: startUnit.id,
            currentUnitAnchor: startDateUtc,
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
        if (input.roomId) {
          await assertNoRoomConflict(tx, facilityId, input.roomId, planned, classBatch.id);
        }

        const inserted = await insertMissingPlannedSessions(tx, {
          facilityId,
          classBatchId: classBatch.id,
          teacherId: classBatch.teacherId,
          planned,
        });

        const stamped = await restampBatchSessions(tx, {
          classBatchId: classBatch.id,
          program: course.program,
          anchorOrderGlobal: startUnit.orderGlobal,
          anchorDate: new Date(0),
        });

        return {
          classBatchId: classBatch.id,
          code: classBatch.code,
          sessionsCreated: inserted.created,
          sessionsStamped: stamped,
          startUnitOrderGlobal: startUnit.orderGlobal,
        };
      });
    }),

  /**
   * Grant continuous unit range on an **active** enrollment.
   * Permission: enrollment.grantUnits (GĐĐT) — sale forbidden.
   */
  addWithUnits: requirePermission('enrollment', 'grantUnits')
    .input(addWithUnitsInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const range = {
        fromOrderGlobal: input.fromOrderGlobal,
        toOrderGlobal: input.toOrderGlobal,
      };

      return withFacility(ctx.db, facilityId, async (tx) => {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: input.enrollmentId, facilityId },
          include: {
            classBatch: { select: { program: true, currentUnitId: true } },
            unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } },
          },
        });
        if (!enrollment) throw notFound('Enrollment not found.');
        if (enrollment.status !== 'active') {
          throw badRequest('Enrollment must be active before granting unit ranges.');
        }
        if (enrollment.archivedAt) {
          throw badRequest('Cannot grant units on an archived enrollment.');
        }

        const currentOrder = await resolveClassCurrentOrder(tx, enrollment.classBatch);

        const validated = validateNewRange(range, currentOrder);
        if (!validated.ok) {
          throw badRequest(
            validated.reason === 'inverted'
              ? 'fromOrderGlobal must be <= toOrderGlobal.'
              : 'Range cannot start before the class current unit (use grantPast for backfill).',
          );
        }

        const unitOrders = await loadProgramUnitOrders(tx, enrollment.classBatch.program);
        assertRangeEndpointsOnProgram(range, unitOrders, enrollment.classBatch.program);

        for (const existing of enrollment.unitRanges) {
          if (rangesOverlap(range, existing)) {
            throw badRequest('Range overlaps an existing unit range for this enrollment.');
          }
        }

        // Serialize grants per enrollment (phase-5 contract FOR UPDATE).
        await tx.$queryRawUnsafe(
          `SELECT id FROM "Enrollment" WHERE id = $1 AND "facilityId" = $2 FOR UPDATE`,
          enrollment.id,
          facilityId,
        );

        const freshRanges = await tx.enrollmentUnitRange.findMany({
          where: { enrollmentId: enrollment.id },
          select: { fromOrderGlobal: true, toOrderGlobal: true },
        });
        for (const existing of freshRanges) {
          if (rangesOverlap(range, existing)) {
            throw badRequest('Range overlaps an existing unit range for this enrollment.');
          }
        }

        const created = await tx.enrollmentUnitRange.create({
          data: {
            facilityId,
            enrollmentId: enrollment.id,
            fromOrderGlobal: range.fromOrderGlobal,
            toOrderGlobal: range.toOrderGlobal,
          },
        });

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'enrollment.grantUnits',
            entity: 'EnrollmentUnitRange',
            entityId: created.id,
            data: {
              enrollmentId: enrollment.id,
              fromOrderGlobal: range.fromOrderGlobal,
              toOrderGlobal: range.toOrderGlobal,
              facilityId,
            },
          },
        });

        return {
          id: created.id,
          enrollmentId: enrollment.id,
          fromOrderGlobal: created.fromOrderGlobal,
          toOrderGlobal: created.toOrderGlobal,
        };
      });
    }),

  /**
   * Teaching roster for a session (dual-gate). Permission: classRoster.read.
   */
  rosterForSession: requirePermission('classRoster', 'read')
    .input(rosterForSessionInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const session = await tx.classSession.findFirst({
          where: { id: input.classSessionId, facilityId },
          select: {
            id: true,
            classBatchId: true,
            sessionDate: true,
            curriculumUnitId: true,
            status: true,
          },
        });
        if (!session) throw notFound('ClassSession not found.');

        let sessionOrderGlobal: number | null = null;
        if (session.curriculumUnitId) {
          const u = await tx.curriculumUnit.findUnique({
            where: { id: session.curriculumUnitId },
            select: { orderGlobal: true },
          });
          sessionOrderGlobal = u?.orderGlobal ?? null;
        }

        const enrollments = await tx.enrollment.findMany({
          where: { classBatchId: session.classBatchId, facilityId },
          include: {
            student: { select: { id: true, fullName: true, lifecycle: true } },
            unitRanges: {
              select: { fromOrderGlobal: true, toOrderGlobal: true },
            },
          },
        });

        const roster = [];
        for (const e of enrollments) {
          // Domain expects UTC-midnight of the ICT calendar day (class-unit-spec).
          const archivedDayUtc = e.archivedAt
            ? ictToUtc(ictDateOnlyOf(e.archivedAt), '00:00')
            : null;
          if (
            !onRoster({
              enrollmentStatus: e.status,
              studentLifecycle: e.student.lifecycle,
              archivedDayUtc,
              sessionDate: session.sessionDate,
              sessionOrderGlobal,
              ranges: e.unitRanges,
            })
          ) {
            continue;
          }
          roster.push({
            enrollmentId: e.id,
            studentId: e.student.id,
            fullName: e.student.fullName,
          });
        }

        return {
          classSessionId: session.id,
          sessionOrderGlobal,
          sessionStatus: session.status,
          students: roster,
        };
      });
    }),

  /**
   * Cancel session then restamp (alias of unified cancelSessionWithRestamp).
   * Prefer classSession.cancel for staff UIs — both share the same helper.
   */
  cancelSessionAndRestamp: requirePermission('schedule', 'generate')
    .input(z.object({ classSessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const { session, restamped } = await cancelSessionWithRestamp(tx, {
          facilityId,
          sessionId: input.classSessionId,
          actorUserId: ctx.subject.userId,
          auditAction: 'lmsOps.cancelSessionAndRestamp',
        });
        return { classSessionId: session.id, restamped };
      });
    }),

  /**
   * grantPast: allow ranges starting before current unit (admin backfill).
   * Still blocks inverted ranges and out-of-program orders.
   */
  grantPast: requirePermission('enrollment', 'grantUnits')
    .input(addWithUnitsInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const range = {
        fromOrderGlobal: input.fromOrderGlobal,
        toOrderGlobal: input.toOrderGlobal,
      };
      if (range.fromOrderGlobal > range.toOrderGlobal) {
        throw badRequest('fromOrderGlobal must be <= toOrderGlobal.');
      }

      return withFacility(ctx.db, facilityId, async (tx) => {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: input.enrollmentId, facilityId },
          include: {
            classBatch: { select: { program: true } },
            unitRanges: true,
          },
        });
        if (!enrollment) throw notFound('Enrollment not found.');
        if (enrollment.status !== 'active') {
          throw badRequest('Enrollment must be active before granting unit ranges.');
        }
        if (enrollment.archivedAt) {
          throw badRequest('Cannot grant units on an archived enrollment.');
        }

        await tx.$queryRawUnsafe(
          `SELECT id FROM "Enrollment" WHERE id = $1 AND "facilityId" = $2 FOR UPDATE`,
          enrollment.id,
          facilityId,
        );

        const unitOrders = await loadProgramUnitOrders(tx, enrollment.classBatch.program);
        assertRangeEndpointsOnProgram(range, unitOrders, enrollment.classBatch.program);
        const freshRanges = await tx.enrollmentUnitRange.findMany({
          where: { enrollmentId: enrollment.id },
          select: { fromOrderGlobal: true, toOrderGlobal: true },
        });
        for (const existing of freshRanges) {
          if (rangesOverlap(range, existing)) {
            throw badRequest('Range overlaps an existing unit range for this enrollment.');
          }
        }

        const created = await tx.enrollmentUnitRange.create({
          data: {
            facilityId,
            enrollmentId: enrollment.id,
            fromOrderGlobal: range.fromOrderGlobal,
            toOrderGlobal: range.toOrderGlobal,
          },
        });
        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'enrollment.grantPast',
            entity: 'EnrollmentUnitRange',
            entityId: created.id,
            data: { enrollmentId: enrollment.id, ...range, facilityId },
          },
        });
        return {
          id: created.id,
          enrollmentId: enrollment.id,
          fromOrderGlobal: created.fromOrderGlobal,
          toOrderGlobal: created.toOrderGlobal,
        };
      });
    }),

  /**
   * Cut units from fromOrderGlobal onward. Past subtract is forbidden:
   * fromOrderGlobal must be >= class current unit order.
   */
  revokeFromNext: requirePermission('enrollment', 'grantUnits')
    .input(z.object({ enrollmentId: z.string().uuid(), fromOrderGlobal: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: input.enrollmentId, facilityId },
          include: {
            classBatch: { select: { currentUnitId: true, program: true } },
          },
        });
        if (!enrollment) throw notFound('Enrollment not found.');
        if (enrollment.status !== 'active') {
          throw badRequest('Enrollment must be active to revoke unit ranges.');
        }

        const currentOrder = await resolveClassCurrentOrder(tx, enrollment.classBatch);
        if (input.fromOrderGlobal < currentOrder) {
          throw badRequest(
            `Cannot revoke past units: fromOrderGlobal must be >= class current unit (${currentOrder}).`,
          );
        }

        await tx.$queryRawUnsafe(
          `SELECT id FROM "Enrollment" WHERE id = $1 AND "facilityId" = $2 FOR UPDATE`,
          enrollment.id,
          facilityId,
        );

        const unitOrders = await loadProgramUnitOrders(tx, enrollment.classBatch.program);
        const programAxis = toProgramUnitAxis(unitOrders.keys());
        // Last real unit kept after cut: strictly before fromOrderGlobal (not label-1).
        const keepTo = previousOrderOnAxis(programAxis, input.fromOrderGlobal);

        const ranges = await tx.enrollmentUnitRange.findMany({
          where: { enrollmentId: enrollment.id },
        });

        let touched = 0;
        for (const r of ranges) {
          if (r.toOrderGlobal < input.fromOrderGlobal) continue;
          if (r.fromOrderGlobal >= input.fromOrderGlobal) {
            await tx.enrollmentUnitRange.delete({ where: { id: r.id } });
            touched += 1;
            continue;
          }
          // Truncate to last real unit before the cut (gaps are not units).
          if (keepTo == null || keepTo < r.fromOrderGlobal) {
            await tx.enrollmentUnitRange.delete({ where: { id: r.id } });
            touched += 1;
            continue;
          }
          await tx.enrollmentUnitRange.update({
            where: { id: r.id },
            data: { toOrderGlobal: keepTo },
          });
          touched += 1;
        }

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'enrollment.revokeFromNext',
            entity: 'Enrollment',
            entityId: enrollment.id,
            data: {
              fromOrderGlobal: input.fromOrderGlobal,
              classCurrentOrder: currentOrder,
              rangesTouched: touched,
              facilityId,
            },
          },
        });
        return { enrollmentId: enrollment.id, rangesTouched: touched };
      });
    }),

  archiveEnrollment: requirePermission('enrollment', 'grantUnits')
    .input(z.object({ enrollmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: input.enrollmentId, facilityId },
        });
        if (!enrollment) throw notFound('Enrollment not found.');
        if (enrollment.archivedAt) {
          return { enrollmentId: enrollment.id, archivedAt: enrollment.archivedAt };
        }
        const archivedAt = new Date();
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { archivedAt },
        });
        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'enrollment.archive',
            entity: 'Enrollment',
            entityId: enrollment.id,
            data: { facilityId, archivedAt: archivedAt.toISOString() },
          },
        });
        return { enrollmentId: enrollment.id, archivedAt };
      });
    }),

  unarchiveEnrollment: requirePermission('enrollment', 'grantUnits')
    .input(z.object({ enrollmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: input.enrollmentId, facilityId },
        });
        if (!enrollment) throw notFound('Enrollment not found.');
        await tx.enrollment.update({
          where: { id: enrollment.id },
          data: { archivedAt: null },
        });
        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'enrollment.unarchive',
            entity: 'Enrollment',
            entityId: enrollment.id,
            data: { facilityId },
          },
        });
        return { enrollmentId: enrollment.id, archivedAt: null as null };
      });
    }),

  /**
   * Freeze class homework sequence (positions after delivered MAX are replaced).
   * Unit restamp never mutates this pointer.
   */
  assignExerciseSequence: requirePermission('exercise', 'manage')
    .input(
      z.object({
        classBatchId: z.string().uuid(),
        exerciseIds: z.array(z.string().uuid()).min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const result = await writeSequenceUpdate(tx, {
          facilityId,
          classBatchId: input.classBatchId,
          exerciseIds: input.exerciseIds,
        });
        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'lmsOps.assignExerciseSequence',
            entity: 'ClassBatch',
            entityId: input.classBatchId,
            data: {
              facilityId,
              deliveredCount: result.deliveredCount,
              sequenceLength: result.items.length,
            },
          },
        });
        return result;
      });
    }),

  listExerciseSequence: requirePermission('exercise', 'manage')
    .input(z.object({ classBatchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const batch = await tx.classBatch.findFirst({
          where: { id: input.classBatchId, facilityId },
          select: { id: true },
        });
        if (!batch) throw notFound('ClassBatch not found.');
        const items = await sequenceForBatch(tx, input.classBatchId);
        const deliveredCount = await deliveredCountForBatch(tx, input.classBatchId);
        return { items, deliveredCount };
      });
    }),

  /** Deliver homework for one ended session (manual / ops). Idempotent. */
  deliverSessionExercise: requirePermission('exercise', 'manage')
    .input(z.object({ classSessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const delivered = await deliverForSession(tx, {
          facilityId,
          classSessionId: input.classSessionId,
        });
        if (!delivered) {
          return { delivered: false as const, reason: 'no_sequence_or_exhausted' as const };
        }
        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'lmsOps.deliverSessionExercise',
            entity: 'SessionExercise',
            entityId: delivered.id,
            data: {
              facilityId,
              classSessionId: delivered.classSessionId,
              exerciseId: delivered.exerciseId,
              position: delivered.position,
            },
          },
        });
        return { delivered: true as const, sessionExercise: delivered };
      });
    }),
});
