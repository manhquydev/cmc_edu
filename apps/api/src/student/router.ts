// student router — K4 remediation (deep-review consolidated report): before
// this file, there was no procedure that let staff resolve a `Student.id`
// from anything a human actually has — a parent's phone number, or a name.
// `finance.receiptCreate`'s renewal `studentId` and `enrollment.enroll`'s
// `studentId` both required an id no legitimate staff caller could ever
// produce (grep: zero lookup procedures existed).
//
// Staff-only, facility-scoped (docs/08 §7 child-data minimization): looking
// up a student discloses the child's name, so this procedure is gated the
// same as any other child-data read and every non-empty result is audited
// (same pattern as `guardian/approved-children.ts` `auditChildDataAccess`,
// attributed to the staff actor instead of a parent).
//
// Phone lookup deliberately joins through the approved `Guardian` link (not a
// raw `Receipt.parentPhone` scan): a student is only reachable this way once
// they have gone through provisioning at least once (K1, `provisionFromReceipt`
// creates the Guardian row) — which is exactly the "existing child" case
// renewal/re-enrollment need. `Guardian` carries no RLS policy, so the
// `facilityId` predicate below is an explicit app-level filter (same pattern
// `guardian.approveLink` uses), not a bypass.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { InvalidPhoneError, normalizeLoginPhone } from '@cmc/domain-identity';
import { badRequest, notFound } from '../errors.js';
import { hashPassword } from '../lms-auth/password-hash.js';
import { listRecordEventPage } from '../record-event/store.js';
import { requirePermission, router, scoped } from '../trpc.js';
import {
  emitStudentRecordEvent,
  isStudentRecordEventKind,
  labelForStudentRecordEventKind,
  STUDENT_RECORD_EVENT_ENTITY,
  STUDENT_RECORD_EVENT_HISTORY_SINCE,
} from './record-event.js';

const studentLookupInput = z
  .object({
    phone: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .refine((v) => Boolean(v.phone) || Boolean(v.name), {
    message: 'phone or name is required.',
  });

export interface StudentLookupResultDto {
  id: string;
  fullName: string;
  lifecycle: string;
}

/** Caps result size — this is a narrow operator lookup, not a browse/list surface. */
const LOOKUP_LIMIT = 20;
const studentTimelineInput = z.object({
  studentId: z.string().uuid(),
  cursor: z.string().min(1).optional(),
  take: z.number().int().min(1).max(50).default(20),
});

/** Same BAD_REQUEST-not-500 handling as lms-auth/router.ts's `normalizeOrReject`. */
function normalizeOrReject(rawPhone: string): string {
  try {
    return normalizeLoginPhone(rawPhone);
  } catch (error) {
    if (error instanceof InvalidPhoneError) {
      throw badRequest('Invalid phone number format.');
    }
    throw error;
  }
}

export const studentRouter = router({
  /**
   * C1/phase-01b: staff resets a student's password to the system default
   * (`Cmc2026@`), forcing a password change on next login. Director-only —
   * same separation-of-duties roster as `finance.receiptApprove` (a sensitive
   * account-mutation that staff must be accountable for).
   *
   * Facility-scoped: the student must belong to the caller's facility. This
   * prevents a staff member at one facility from resetting a student's password
   * at a different facility.
   */
  resetPassword: requirePermission('studentAccount', 'resetPassword')
    .input(z.object({ studentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ ok: true }> => {
      const { facilityId } = scoped(ctx);

      // Verify the student exists in this facility.
      const student = await withFacility(ctx.db, facilityId, (tx) =>
        tx.student.findFirst({
          where: { id: input.studentId, facilityId },
          select: { id: true },
        }),
      );
      if (!student) throw notFound('Student not found.');

      // StudentAccount carries no RLS — plain lookup by studentId.
      const studentAccount = await ctx.db.studentAccount.findUnique({
        where: { studentId: input.studentId },
        select: { id: true },
      });
      if (!studentAccount) throw notFound('No student account found for this student.');

      // The write and its timeline event commit together (module-2 freeze:
      // password_reset is emitted at the producer's transaction boundary).
      // withFacility (not a bare $transaction): RecordEvent is RLS-scoped, so
      // the event write needs the facility GUC.
      await withFacility(ctx.db, facilityId, async (tx) => {
        await tx.studentAccount.update({
          where: { id: studentAccount.id },
          data: {
            passwordHash: hashPassword('Cmc2026@'),
            mustChangePassword: true,
            loginAttempts: 0,
            loginLockedUntil: null,
          },
        });
        await emitStudentRecordEvent(tx, {
          facilityId,
          studentId: input.studentId,
          actor: ctx.subject!.userId,
          kind: 'password_reset',
        });
      });

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject!.userId,
          action: 'student.resetPassword',
          entity: 'StudentAccount',
          entityId: studentAccount.id,
          data: { studentId: input.studentId, facilityId },
        },
      });

      return { ok: true };
    }),

  /**
   * P4: General student lifecycle mutation (active | blocked_lms | withdrawn).
   * Director-only — same separation-of-duties rationale as finance.receiptApprove.
   * Does NOT replace enrollment.blockLms, which remains the narrow K8 gate
   * for blocking LMS access. setLifecycle is the broader lifecycle writer
   * (e.g. marking a student as withdrawn after all refund/transfer steps complete).
   */
  setLifecycle: requirePermission('student', 'setLifecycle')
    .input(
      z.object({
        studentId: z.string().uuid(),
        lifecycle: z.enum(['active', 'blocked_lms', 'withdrawn']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Serialize lifecycle transitions so concurrent identical calls see
        // the committed state before deciding whether the write is a no-op.
        await tx.$queryRaw`
          SELECT "id" FROM "Student"
          WHERE "id" = ${input.studentId} AND "facilityId" = ${facilityId}
          FOR UPDATE
        `;
        const student = await tx.student.findFirst({
          where: { id: input.studentId, facilityId },
          select: { id: true, lifecycle: true },
        });
        if (!student) throw notFound('Student not found.');

        const updated = await tx.student.update({
          where: { id: input.studentId },
          data: { lifecycle: input.lifecycle },
          select: { id: true, lifecycle: true },
        });

        // Operational history: record the transition on the student timeline,
        // skipping no-op writes (same rule as classBatch.assignTeacher).
        if (student.lifecycle !== input.lifecycle) {
          await emitStudentRecordEvent(tx, {
            facilityId,
            studentId: student.id,
            actor: ctx.subject.userId,
            kind: 'lifecycle_changed',
            from: student.lifecycle,
            to: input.lifecycle,
          });
        }

        // Audit the security-relevant `blocked_lms` transition; mirrors the
        // pattern in enrollment.blockLms (enrollment/router.ts).
        if (input.lifecycle === 'blocked_lms') {
          await tx.auditLog.create({
            data: {
              actor: ctx.subject!.userId,
              action: 'student.setLifecycle.blocked_lms',
              entity: 'StudentAccount',
              entityId: input.studentId,
              data: { facilityId },
            },
          });
        }

        return updated;
      });
    }),

  /**
   * Single student by ID — used by the student detail page (docs/08 §7:
   * same child-data disclosure rules as `lookup`; facility-scoped).
   */
  get: requirePermission('student', 'lookup')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }): Promise<{ id: string; fullName: string; lifecycle: string; parentPhone: string | null } | null> => {
      const { facilityId } = scoped(ctx);
      const student = await withFacility(ctx.db, facilityId, (tx) =>
        tx.student.findFirst({
          where: { id: input.id, facilityId },
          select: { id: true, fullName: true, lifecycle: true },
        }),
      );
      if (!student) return null;

      const guardian = await ctx.db.guardian.findFirst({
        where: { studentId: student.id, facilityId },
        select: { parentAccountId: true },
      });
      let parentPhone: string | null = null;
      if (guardian) {
        const parent = await ctx.db.parentAccount.findUnique({
          where: { id: guardian.parentAccountId },
          select: { phone: true },
        });
        parentPhone = parent?.phone ?? null;
      }

      await ctx.db.auditLog.create({
        data: {
          actor: ctx.subject.userId,
          action: 'student.get',
          entity: 'Student',
          entityId: student.id,
          data: { facilityId },
        },
      });

      return { id: student.id, fullName: student.fullName, lifecycle: student.lifecycle, parentPhone };
    }),

  /**
   * Batch student lookup by IDs — used by the attendance page to resolve
   * session roster UUIDs to display names and parent phones.
   * Same child-data disclosure rules as `lookup` (docs/08 §7).
   */
  getManyByIds: requirePermission('student', 'lookup')
    .input(z.object({ ids: z.array(z.string().uuid()).max(100) }))
    .query(async ({ ctx, input }): Promise<Array<{ id: string; fullName: string; parentPhone: string | null }>> => {
      const { facilityId } = scoped(ctx);
      if (input.ids.length === 0) return [];

      const students = await withFacility(ctx.db, facilityId, (tx) =>
        tx.student.findMany({
          where: { id: { in: input.ids }, facilityId },
          select: { id: true, fullName: true },
        }),
      );
      if (students.length === 0) return [];

      const guardians = await ctx.db.guardian.findMany({
        where: { studentId: { in: students.map((s) => s.id) }, facilityId },
        select: { studentId: true, parentAccountId: true },
      });
      const parentIds = [...new Set(guardians.map((g) => g.parentAccountId))];
      const parents = await ctx.db.parentAccount.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, phone: true },
      });
      const parentById = new Map(parents.map((p) => [p.id, p]));
      const phoneByStudentId = new Map(
        guardians.map((g) => [g.studentId, parentById.get(g.parentAccountId)?.phone ?? null]),
      );

      const result = students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        parentPhone: phoneByStudentId.get(s.id) ?? null,
      }));

      // docs/08 §7: child-data disclosure to staff — audit every returned row,
      // same pattern as student.lookup (lines ~281-290).
      await ctx.db.auditLog.createMany({
        data: result.map((s) => ({
          actor: ctx.subject.userId,
          action: 'student.getManyByIds',
          entity: 'Student',
          entityId: s.id,
          data: { facilityId },
        })),
      });

      return result;
    }),

  lookup: requirePermission('student', 'lookup')
    .input(studentLookupInput)
    .query(async ({ ctx, input }): Promise<StudentLookupResultDto[]> => {
      const { facilityId } = scoped(ctx);

      const results = await withFacility(ctx.db, facilityId, async (tx) => {
        if (input.phone) {
          const phone = normalizeOrReject(input.phone);
          const parentAccount = await tx.parentAccount.findUnique({
            where: { phone },
            select: { id: true },
          });
          if (!parentAccount) return [];

          const guardians = await tx.guardian.findMany({
            where: { facilityId, parentAccountId: parentAccount.id },
            select: { studentId: true },
          });
          if (guardians.length === 0) return [];

          return tx.student.findMany({
            where: { id: { in: guardians.map((g) => g.studentId) }, facilityId },
            select: { id: true, fullName: true, lifecycle: true },
            take: LOOKUP_LIMIT,
          });
        }

        // `input.name` is guaranteed set here by the schema's refine() above.
        return tx.student.findMany({
          where: { facilityId, fullName: { contains: input.name, mode: 'insensitive' } },
          select: { id: true, fullName: true, lifecycle: true },
          take: LOOKUP_LIMIT,
        });
      });

      // docs/08 §7: a real child-identity disclosure to staff — audit every
      // non-empty result, one row per student, same shape as the
      // parent-facing audit in guardian/approved-children.ts.
      if (results.length > 0) {
        await ctx.db.auditLog.createMany({
          data: results.map((student) => ({
            actor: ctx.subject.userId,
            action: 'student.lookup',
            entity: 'Student',
            entityId: student.id,
            data: { via: input.phone ? 'phone' : 'name' },
          })),
        });
      }

      return results.map((s) => ({ id: s.id, fullName: s.fullName, lifecycle: s.lifecycle }));
    }),

  /** Operational history timeline for a student record (Phase 6 module 2).
   * Same read roster as student.get — timeline visibility follows authorized
   * record visibility; parent record authorized before reading events; entity
   * fixed server-side; actor identity projected to a display label at read
   * time. Payloads carry no child PII, so no extra docs/08 §7 audit row:
   * the identity disclosure (and its audit) already happens in student.get. */
  timeline: requirePermission('student', 'lookup')
    .input(studentTimelineInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const student = await tx.student.findFirst({
          where: { id: input.studentId, facilityId },
          select: { id: true },
        });
        if (!student) throw notFound('Student not found.');

        const eventWhere = {
          facilityId,
          entity: STUDENT_RECORD_EVENT_ENTITY,
          entityId: student.id,
        };

        const [{ rows, nextCursor }, createdEvent] = await Promise.all([
          listRecordEventPage(tx, eventWhere, input.cursor ?? null, input.take),
          tx.recordEvent.findFirst({
            where: { ...eventWhere, kind: 'created' },
            select: { id: true },
          }),
        ]);

        const actorUserIds = [...new Set(rows.map((r) => r.actor).filter(Boolean))];
        const actorStaffRows = actorUserIds.length > 0
          ? await tx.appUser.findMany({
              where: { facilityId, userId: { in: actorUserIds } },
              select: { userId: true, fullName: true, employeeCode: true },
            })
          : [];
        const actorMap = new Map(actorStaffRows.map((s) => [s.userId, s]));

        return {
          items: rows.map((row) => {
            const known = isStudentRecordEventKind(row.kind);
            const staff = actorMap.get(row.actor);
            const actorLabel = staff
              ? staff.fullName || staff.employeeCode || staff.userId
              : 'Hệ thống';
            return {
              id: row.id,
              kind: row.kind,
              actor: actorLabel,
              payload: known ? row.payload : null,
              label: labelForStudentRecordEventKind(row.kind),
              createdAt: row.createdAt,
            };
          }),
          nextCursor,
          historySince: createdEvent ? null : STUDENT_RECORD_EVENT_HISTORY_SINCE,
        };
      });
    }),
 });
