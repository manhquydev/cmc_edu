// classSession router — T1 session lifecycle (docs/26 phase-02, ADR 0038 Tier
// reachability C1 fix): `cancel`/`confirm` flip `SessionStatus`; `addMakeup`
// creates an ad-hoc `isMakeup=true` session for a batch, the data foundation
// exercise-open Tier B (docs/19 §4) will read from in a later phase. All
// three gate on `schedule.generate` (GĐĐT/super_admin) — the same permission
// `classBatch.create`/`schedule.generateSessions` already use, since session
// lifecycle is a training-ops action, not a teacher-facing one (that's
// `attendance.mark`, ./attendance/router.ts).

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';
import { assertSessionActive } from './assert-session-active.js';
import type { PlannedSession } from './generate-sessions.js';
import { assertNoRoomConflict } from './room-conflict.js';
import { ictDateOnlyOf, ictToUtc, isValidDateOnly, isValidTimeOfDay } from '@cmc/domain-time';
import { recomputeFinalGrade } from '../submission/router.js';

const dateOnlySchema = z.string().refine(isValidDateOnly, { message: 'Expected YYYY-MM-DD.' });
const timeOfDaySchema = z.string().refine(isValidTimeOfDay, { message: 'Expected HH:mm (24h).' });

const sessionIdInput = z.object({ sessionId: z.string().uuid() });

const assignUnitInput = z.object({
  sessionId: z.string().uuid(),
  curriculumUnitId: z.string().uuid(),
});

const addMakeupInput = z
  .object({
    classBatchId: z.string().uuid(),
    sessionDate: dateOnlySchema,
    startTime: timeOfDaySchema,
    endTime: timeOfDaySchema,
  })
  .refine((input) => input.startTime < input.endTime, {
    message: 'startTime must be before endTime.',
    path: ['endTime'],
  });

export interface ClassSessionDto {
  id: string;
  classBatchId: string;
  scheduleSlotId: string | null;
  sessionDate: Date;
  startTime: Date;
  endTime: Date;
  status: string;
  isMakeup: boolean;
  curriculumUnitId: string | null;
}

function toClassSessionDto(row: {
  id: string;
  classBatchId: string;
  scheduleSlotId: string | null;
  sessionDate: Date;
  startTime: Date;
  endTime: Date;
  status: string;
  isMakeup: boolean;
  curriculumUnitId: string | null;
}): ClassSessionDto {
  return {
    id: row.id,
    classBatchId: row.classBatchId,
    scheduleSlotId: row.scheduleSlotId,
    sessionDate: row.sessionDate,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    isMakeup: row.isMakeup,
    curriculumUnitId: row.curriculumUnitId,
  };
}

const listSessionsInput = z.object({
  classBatchId: z.string().uuid(),
});

export const classSessionRouter = router({
  // Read-only: list all sessions for a batch (schedule, confirm/cancel UI).
  list: requirePermission('class', 'read')
    .input(listSessionsInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const rows = await tx.classSession.findMany({
          where: { classBatchId: input.classBatchId, facilityId },
          orderBy: { sessionDate: 'asc' },
        });
        return rows.map(toClassSessionDto);
      });
    }),
  // planned/confirmed -> cancelled. Cancelled sessions are excluded from
  // attendance (docs/19 §5 gate 1) — enforced in ../attendance/router.ts.
  cancel: requirePermission('schedule', 'generate')
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
        if (session.status === 'cancelled') {
          throw badRequest('Session is already cancelled.');
        }
        // HR remediation phase 7: `done` is one-way — the hours it represents
        // have already been credited (payroll/KPI), so it can never be
        // cancelled back out.
        if (session.status === 'done') {
          throw badRequest('A done session cannot be cancelled.');
        }

        const updated = await tx.classSession.update({
          where: { id: session.id },
          data: { status: 'cancelled' },
        });

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'classSession.cancel',
            entity: 'ClassSession',
            entityId: updated.id,
            data: { facilityId, previousStatus: session.status },
          },
        });

        // Post-implementation hardening (M2): cancelling a session
        // retroactively invalidates its Attendance rows from the FinalGrade
        // attendance-rate denominator (../submission/router.ts's
        // recomputeFinalGrade excludes `status: 'cancelled'` sessions) — the
        // same principle attendance.mark/markAll's own recompute already
        // enforces for status corrections. Without this, a parent's report
        // card would show a stale score until some unrelated future
        // attendance/grade event happened to trigger a refresh.
        const affected = await tx.attendance.findMany({
          where: { classSessionId: session.id, facilityId },
          select: { studentId: true },
        });
        const studentIdsToRecompute = new Set(affected.map((a) => a.studentId));
        for (const studentId of studentIdsToRecompute) {
          await recomputeFinalGrade(tx, { facilityId, studentId, periodAnchor: session.endTime });
        }

        return toClassSessionDto(updated);
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

        return toClassSessionDto(updated);
      });
    }),

  // Ad-hoc `isMakeup=true` session for a batch — room/time comes from the
  // batch's own room (same double-booking guard as `classBatch.create`/
  // `schedule.generateSessions`, G1 review M1), not a client-supplied room.
  addMakeup: requirePermission('schedule', 'generate')
    .input(addMakeupInput)
    .mutation(async ({ ctx, input }): Promise<ClassSessionDto> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const classBatch = await tx.classBatch.findFirst({
          where: { id: input.classBatchId, facilityId },
        });
        if (!classBatch) {
          throw notFound('ClassBatch not found.');
        }

        // Low-Severity Hygiene remediation (scenario audit): a makeup date
        // outside the batch's own [startDate, endDate] is almost certainly a
        // typo (or the wrong batch) — reject it instead of silently creating
        // an ad-hoc session that will never show up in the batch's own
        // schedule range.
        const batchStart = ictDateOnlyOf(classBatch.startDate);
        const batchEnd = ictDateOnlyOf(classBatch.endDate);
        if (input.sessionDate < batchStart || input.sessionDate > batchEnd) {
          throw badRequest(
            `sessionDate (${input.sessionDate}) is outside the class batch's date range (${batchStart}..${batchEnd}).`,
          );
        }

        const planned: PlannedSession = {
          scheduleSlotId: undefined,
          sessionDate: ictToUtc(input.sessionDate, '00:00'),
          startTime: ictToUtc(input.sessionDate, input.startTime),
          endTime: ictToUtc(input.sessionDate, input.endTime),
        };

        if (classBatch.roomId) {
          await assertNoRoomConflict(tx, facilityId, classBatch.roomId, [planned], classBatch.id);
        }

        const session = await tx.classSession.create({
          data: {
            facilityId,
            classBatchId: classBatch.id,
            scheduleSlotId: null,
            sessionDate: planned.sessionDate,
            startTime: planned.startTime,
            endTime: planned.endTime,
            isMakeup: true,
          },
        });

        return toClassSessionDto(session);
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

        return toClassSessionDto(updated);
      });
    }),
});
