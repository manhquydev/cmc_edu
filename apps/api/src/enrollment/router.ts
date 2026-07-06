// enrollment router — WF-P1-05 (`reserved` -> `active`, Receipt-driven) and
// WF-P1-07 (`enrollment.mine` — the LMS parent-facing read).
//
// `enrollment.enroll` is the only client-facing mutation here: it creates a
// seat hold (`reserved`, unpaid). There is deliberately NO mutation that sets
// `active` directly — that transition only happens inside
// `finance.receiptApprove` provisioning (see ../provisioning/provision-from-receipt.ts
// and ./activate-enrollment.ts), per ADR-A: `active` <=> an approved Receipt.

import { z } from 'zod';
import { notFound } from '../errors.js';
import { getApprovedChildren } from '../guardian/approved-children.js';
import { lmsProcedure, requirePermission, router, scoped } from '../trpc.js';

const enrollInput = z.object({
  studentId: z.string().uuid(),
  classBatchId: z.string().min(1),
  opportunityId: z.string().uuid().optional(),
});

export interface EnrollmentMineDto {
  id: string;
  studentId: string;
  studentName: string;
  classBatchId: string;
  status: string;
  createdAt: Date;
}

export const enrollmentRouter = router({
  enroll: requirePermission('enrollment', 'enroll')
    .input(enrollInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      // Out-of-facility student ids look identical to non-existent ones (RLS).
      const student = await ctx.db.student.findFirst({
        where: { id: input.studentId, facilityId },
      });
      if (!student) {
        throw notFound('Student not found.');
      }

      return ctx.db.enrollment.create({
        data: {
          facilityId,
          studentId: input.studentId,
          classBatchId: input.classBatchId,
          status: 'reserved',
        },
      });
    }),

  // WF-P1-07: the caller-parent's children's enrollments — filtered to
  // approved-guardian children only, excluding any `blocked_lms` child
  // (docs/19 §2), via the shared gate in ../guardian/approved-children.ts.
  mine: lmsProcedure.query(async ({ ctx }): Promise<EnrollmentMineDto[]> => {
    const children = await getApprovedChildren(ctx.db, ctx.lmsSubject.parentAccountId);
    if (children.length === 0) return [];

    const nameByStudentId = new Map(children.map((c) => [c.studentId, c.fullName]));
    const enrollments = await ctx.db.enrollment.findMany({
      where: { studentId: { in: children.map((c) => c.studentId) } },
      orderBy: { createdAt: 'desc' },
    });

    return enrollments.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      studentName: nameByStudentId.get(e.studentId) ?? '',
      classBatchId: e.classBatchId,
      status: e.status,
      createdAt: e.createdAt,
    }));
  }),
});
