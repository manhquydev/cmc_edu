// guardian router — WF-P1-06 (parent requests a link, staff approves/rejects).
//
// ASSUMPTION (documented per phase brief — "use the student id or a lookup
// key that a parent could plausibly have"): `requestLink.studentRef` is the
// target `Student.id` (UUID). The server resolves it to a real `Student` row
// ONLY to read `facilityId` (server-derived, never trusted from the client —
// docs/11 §1 / TL19 §5 "facilityId suy server-side") and to confirm it names
// a real student; no child data (name, schedule, grades, ...) is ever
// returned to the parent at this step — satisfying the docs/08 §7 boundary.
// Staff still perform the real identity cross-check ("đối chiếu", WF-P1-06
// happy path) out of band before approving; `studentRef` narrows the request
// to one child, it is not proof of relation.
//
// `Guardian` rows are created ONLY on approval (see `approveLink` below), so
// "does an approved Guardian row exist for (parentAccountId, studentId)" IS
// the child-data read gate used everywhere else (`enrollment.mine`,
// `lmsAuth.verifyOtp` — see ./approved-children.ts). Pending/rejected
// requests never create a Guardian row, so a parent cannot read child data
// through any other path until approved.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, conflict, notFound } from '../errors.js';
import { lmsProcedure, requirePermission, router, scoped } from '../trpc.js';

const requestLinkInput = z.object({
  studentRef: z.string().uuid(),
});

export type RequestLinkResult =
  | { status: 'created'; requestId: string }
  | { status: 'already_linked' }
  | { status: 'already_pending'; requestId: string };

const relationSchema = z.enum(['father', 'mother', 'guardian']);

const approveLinkInput = z.object({
  requestId: z.string().uuid(),
  relation: relationSchema,
});

const rejectLinkInput = z.object({
  requestId: z.string().uuid(),
});

/**
 * K3 remediation (deep-review consolidated report): the pending-review queue
 * for guardian link requests. Before this, `approveLink`/`rejectLink` existed
 * but nothing let staff discover WHICH requests were waiting — `requestId`
 * was only ever handed back to the parent that created it (grep: zero list
 * procedures existed).
 */
const listPendingLinksInput = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional().default('pending'),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export interface GuardianLinkRequestDto {
  id: string;
  studentId: string;
  studentName: string;
  parentAccountId: string;
  parentPhone: string;
  status: string;
  createdAt: Date;
}

export const guardianRouter = router({
  requestLink: lmsProcedure
    .input(requestLinkInput)
    .mutation(async ({ ctx, input }): Promise<RequestLinkResult> => {
      const { parentAccountId } = ctx.lmsSubject;

      // A parent session has no single facilityId (a parent's children may
      // be at different facilities) and the target student's facility is not
      // known until it is looked up — so this Student read runs under the
      // RLS bypass GUC, same as `getApprovedChildren` (ADR 0042).
      // Server-derived facilityId (never trust a client-supplied one). This
      // lookup only ever reads `facilityId` internally — nothing about the
      // student is returned to the caller in any branch below.
      const student = await withFacility(
        ctx.db,
        null,
        (tx) =>
          tx.student.findUnique({
            where: { id: input.studentRef },
            select: { id: true, facilityId: true },
          }),
        { bypass: true },
      );
      if (!student) {
        throw notFound('Student reference not found.');
      }

      const existingGuardian = await ctx.db.guardian.findUnique({
        where: { parentAccountId_studentId: { parentAccountId, studentId: student.id } },
      });
      if (existingGuardian) {
        return { status: 'already_linked' };
      }

      const existingPending = await ctx.db.guardianLinkRequest.findFirst({
        where: { parentAccountId, studentRef: student.id, status: 'pending' },
      });
      if (existingPending) {
        return { status: 'already_pending', requestId: existingPending.id };
      }

      const request = await ctx.db.guardianLinkRequest.create({
        data: {
          facilityId: student.facilityId,
          parentAccountId,
          studentRef: student.id,
          status: 'pending',
        },
      });
      return { status: 'created', requestId: request.id };
    }),

  // Staff review (docs/24 WF-P1-06 "nhân viên duyệt"). Facility-scoped: a
  // request outside the caller's facility looks identical to a non-existent
  // one (RLS, same pattern as enrollment.enroll / finance.*).
  approveLink: requirePermission('guardian', 'approveLink')
    .input(approveLinkInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const request = await tx.guardianLinkRequest.findFirst({
          where: { id: input.requestId, facilityId },
        });
        if (!request) {
          throw notFound('Guardian link request not found.');
        }
        if (request.status !== 'pending') {
          throw badRequest(
            `Request is "${request.status}", not "pending"; it cannot be approved again.`,
          );
        }

        // Atomic claim: only one concurrent approve/reject on the same
        // request can flip it out of `pending` (same shape as
        // finance.receiptApprove's claim — see finance/router.ts).
        const claim = await tx.guardianLinkRequest.updateMany({
          where: { id: request.id, facilityId, status: 'pending' },
          data: { status: 'approved' },
        });
        if (claim.count !== 1) {
          throw conflict('Request was already reviewed by a concurrent call.');
        }

        const guardian = await tx.guardian.upsert({
          where: {
            parentAccountId_studentId: {
              parentAccountId: request.parentAccountId,
              studentId: request.studentRef,
            },
          },
          create: {
            facilityId,
            parentAccountId: request.parentAccountId,
            studentId: request.studentRef,
            relation: input.relation,
          },
          update: {},
        });

        return { requestId: request.id, status: 'approved' as const, guardianId: guardian.id };
      });
    }),

  // K3 remediation: staff's HITL work queue — defaults to `pending` (the
  // actionable set for approveLink/rejectLink), joins in the child's name and
  // the requesting parent's phone so staff have enough to actually
  // "đối chiếu" (cross-check identity) per WF-P1-06, without granting any
  // broader child-data read than this queue already implies.
  listPendingLinks: requirePermission('guardian', 'listPendingLinks')
    .input(listPendingLinksInput)
    .query(async ({ ctx, input }): Promise<{
      items: GuardianLinkRequestDto[];
      total: number;
      page: number;
      pageSize: number;
    }> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const where = { facilityId, status: input.status };
        const [requests, total] = await Promise.all([
          tx.guardianLinkRequest.findMany({
            where,
            include: { parentAccount: { select: { phone: true } } },
            orderBy: { createdAt: 'asc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.guardianLinkRequest.count({ where }),
        ]);

        const studentIds = [...new Set(requests.map((r) => r.studentRef))];
        const students =
          studentIds.length > 0
            ? await tx.student.findMany({
                where: { id: { in: studentIds }, facilityId },
                select: { id: true, fullName: true },
              })
            : [];
        const nameByStudentId = new Map(students.map((s) => [s.id, s.fullName]));

        const items: GuardianLinkRequestDto[] = requests.map((r) => ({
          id: r.id,
          studentId: r.studentRef,
          studentName: nameByStudentId.get(r.studentRef) ?? '',
          parentAccountId: r.parentAccountId,
          parentPhone: r.parentAccount.phone,
          status: r.status,
          createdAt: r.createdAt,
        }));

        return { items, total, page: input.page, pageSize: input.pageSize };
      });
    }),

  rejectLink: requirePermission('guardian', 'approveLink')
    .input(rejectLinkInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, async (tx) => {
        const request = await tx.guardianLinkRequest.findFirst({
          where: { id: input.requestId, facilityId },
        });
        if (!request) {
          throw notFound('Guardian link request not found.');
        }
        if (request.status !== 'pending') {
          throw badRequest(`Request is "${request.status}", not "pending"; it cannot be rejected.`);
        }

        const claim = await tx.guardianLinkRequest.updateMany({
          where: { id: request.id, facilityId, status: 'pending' },
          data: { status: 'rejected' },
        });
        if (claim.count !== 1) {
          throw conflict('Request was already reviewed by a concurrent call.');
        }

        return { requestId: request.id, status: 'rejected' as const };
      });
    }),
});
