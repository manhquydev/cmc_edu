// enrollment router — WF-P1-05 (`reserved` -> `active`, Receipt-driven) and
// WF-P1-07 (`enrollment.mine` — the LMS parent-facing read).
//
// `enrollment.enroll` is the only client-facing mutation here: it creates a
// seat hold (`reserved`, unpaid). There is deliberately NO mutation that sets
// `active` directly — that transition only happens inside
// `finance.receiptApprove` provisioning (see ../provisioning/provision-from-receipt.ts
// and ./activate-enrollment.ts), per ADR-A: `active` <=> an approved Receipt.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { notFound } from '../errors.js';
import { auditChildDataAccess, getApprovedChildren } from '../guardian/approved-children.js';
import { emitClassRecordEvent } from '../class/record-event.js';
import { emitStudentRecordEvent } from '../student/record-event.js';
import { lmsProcedure, requireLmsParent, requirePermission, router, scoped } from '../trpc.js';

const enrollInput = z.object({
  studentId: z.string().uuid(),
  classBatchId: z.string().min(1),
  opportunityId: z.string().uuid().optional(),
});

const blockLmsInput = z.object({
  studentId: z.string().uuid(),
});

export interface BlockLmsResult {
  studentId: string;
  lifecycle: string;
}

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

      return withFacility(ctx.db, facilityId, async (tx) => {
        // Out-of-facility student ids look identical to non-existent ones (RLS).
        const student = await tx.student.findFirst({
          where: { id: input.studentId, facilityId },
        });
        if (!student) {
          throw notFound('Student not found.');
        }

        // P2-Foundation seam: classBatchId must point at a real ClassBatch in
        // the caller's facility — the reserved-hold this creates must
        // reference an operable class, not an opaque free-text id (P1).
        const classBatch = await tx.classBatch.findFirst({
          where: { id: input.classBatchId, facilityId },
        });
        if (!classBatch) {
          throw notFound('ClassBatch not found.');
        }

        const enrollment = await tx.enrollment.create({
          data: {
            facilityId,
            studentId: input.studentId,
            classBatchId: input.classBatchId,
            status: 'reserved',
          },
        });
        await emitClassRecordEvent(tx, {
          facilityId,
          classBatchId: input.classBatchId,
          actor: ctx.subject.userId,
          kind: 'student_enrolled',
          studentId: input.studentId,
          enrollmentId: enrollment.id,
        });
        // Dual view (module-2 freeze): the same reserved seat is also the
        // student's own operational history, on the Student timeline.
        await emitStudentRecordEvent(tx, {
          facilityId,
          studentId: input.studentId,
          actor: ctx.subject.userId,
          kind: 'enrolled',
          enrollmentId: enrollment.id,
          classBatchId: input.classBatchId,
        });
        return enrollment;
      });
    }),

  // K8 remediation: writer for `StudentLifecycle.blocked_lms` (docs/19 §2).
  // The read-side gate (`getApprovedChildren` excluding `blocked_lms`) already
  // existed; this is the missing mutation that actually reaches it. A
  // separate guarded procedure rather than reusing `finance.receiptCancel`'s
  // `void: true` path — that path is documented (QĐ 0024) to map "void nhầm"
  // onto `withdrawn`, a distinct outcome from "block this student's LMS
  // access" (e.g. a discipline/compliance hold unrelated to any receipt).
  blockLms: requirePermission('enrollment', 'blockLms')
    .input(blockLmsInput)
    .mutation(async ({ ctx, input }): Promise<BlockLmsResult> => {
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
        });
        if (!student) {
          throw notFound('Student not found.');
        }

        const updated = await tx.student.update({
          where: { id: student.id },
          data: { lifecycle: 'blocked_lms' },
        });

        // Operational history on the student timeline; a no-op re-block (already
        // blocked_lms) records nothing (module-2 freeze).
        if (student.lifecycle !== 'blocked_lms') {
          await emitStudentRecordEvent(tx, {
            facilityId,
            studentId: student.id,
            actor: ctx.subject.userId,
            kind: 'lifecycle_changed',
            from: student.lifecycle,
            to: 'blocked_lms',
          });
        }

        await tx.auditLog.create({
          data: {
            actor: ctx.subject.userId,
            action: 'enrollment.blockLms',
            entity: 'Student',
            entityId: updated.id,
            data: { facilityId },
          },
        });

        return { studentId: updated.id, lifecycle: updated.lifecycle };
      });
    }),

  // WF-P1-07: the caller-parent's children's enrollments — filtered to
  // approved-guardian children only, excluding any `blocked_lms` child
  // (docs/19 §2), via the shared gate in ../guardian/approved-children.ts.
  //
  // Parent-only: students see their own enrollment via submission context,
  // not the parent-facing multi-child list. A student trying to call this
  // endpoint gets FORBIDDEN to prevent sibling enumeration.
  //
  // Runs with the RLS bypass GUC (not a facility scope): a parent session has
  // no single facilityId, and a parent's children may legitimately be
  // enrolled across different facilities (franchise branches) — the real
  // access boundary here is `getApprovedChildren`'s approved-Guardian gate,
  // not facility membership (same rationale as the Guardian/GuardianLinkRequest
  // RLS exemption, schema.prisma).
  mine: lmsProcedure.query(async ({ ctx }): Promise<EnrollmentMineDto[]> => {
    const { parentAccountId } = requireLmsParent(ctx);

    const children = await getApprovedChildren(ctx.db, parentAccountId);
    if (children.length === 0) return [];

    const nameByStudentId = new Map(children.map((c) => [c.studentId, c.fullName]));
    const enrollments = await withFacility(
      ctx.db,
      null,
      (tx) =>
        tx.enrollment.findMany({
          where: { studentId: { in: children.map((c) => c.studentId) } },
          orderBy: { createdAt: 'desc' },
        }),
      { bypass: true },
    );

    // M3 remediation (docs/08 §7): this is a real child-data disclosure to
    // the parent — audit it (one row per student actually returned).
    await auditChildDataAccess(ctx.db, {
      parentAccountId,
      studentIds: children.map((c) => c.studentId),
      via: 'enrollment.mine',
      actorKind: 'parent',
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
