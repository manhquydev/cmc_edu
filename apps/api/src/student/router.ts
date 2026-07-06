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
import { requirePermission, router, scoped } from '../trpc.js';

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
});
