// afterSale router — P4 (WF-P4-05): after-sale support case lifecycle.
//
// Lifecycle: open -> in_progress -> resolved -> closed.
// `advance` is idempotent: open->in_progress; already in_progress is a no-op.
// `resolve` requires a non-empty `resolution` field.
// cmc_app has no DELETE grant — closed is the terminal state.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';

const createInput = z.object({
  studentId: z.string().uuid(),
  description: z.string().min(1).max(2000),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

const advanceInput = z.object({
  caseId: z.string().uuid(),
});

const resolveInput = z.object({
  caseId: z.string().uuid(),
  resolution: z.string().min(1, 'resolution is required to resolve a case'),
});

const closeInput = z.object({
  caseId: z.string().uuid(),
});

const listInput = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

const getInput = z.object({
  caseId: z.string().uuid(),
});

export const afterSaleRouter = router({
  /** Cold-start form /crm/aftersale/:caseId */
  get: requirePermission('afterSale', 'manage')
    .input(getInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const kase = await tx.afterSaleCase.findFirst({
          where: { id: input.caseId, facilityId },
        });
        if (!kase) throw notFound('After-sale case not found.');
        const student = await tx.student.findFirst({
          where: { id: kase.studentId, facilityId },
          select: { id: true, fullName: true },
        });
        return {
          ...kase,
          studentName: student?.fullName ?? null,
        };
      });
    }),

  /** Facility-scoped, paginated case list for the after-sale screen (F10). */
  list: requirePermission('afterSale', 'manage')
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const where = { facilityId, ...(input.status ? { status: input.status } : {}) };
        const [rows, total] = await Promise.all([
          tx.afterSaleCase.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.afterSaleCase.count({ where }),
        ]);
        // AfterSaleCase has no Prisma relation to Student — resolve names in a
        // second facility-scoped query and map them on.
        const studentIds = [...new Set(rows.map((r) => r.studentId))];
        const students = studentIds.length
          ? await tx.student.findMany({ where: { facilityId, id: { in: studentIds } }, select: { id: true, fullName: true } })
          : [];
        const nameById = new Map(students.map((s) => [s.id, s.fullName]));
        const items = rows.map((r) => ({ ...r, studentName: nameById.get(r.studentId) ?? null }));
        return { items, total, page: input.page, pageSize: input.pageSize };
      });
    }),

  /** Open a new after-sale case. */
  create: requirePermission('afterSale', 'manage')
    .input(createInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const student = await tx.student.findFirst({
          where: { id: input.studentId, facilityId },
        });
        if (!student) throw notFound('Student not found in this facility.');

        return tx.afterSaleCase.create({
          data: {
            facilityId,
            studentId: input.studentId,
            description: input.description,
            priority: input.priority,
            status: 'open',
            createdById: ctx.subject!.userId,
          },
        });
      });
    }),

  /**
   * Advance from open -> in_progress.
   * Idempotent: already in_progress returns the row unchanged without error.
   */
  advance: requirePermission('afterSale', 'manage')
    .input(advanceInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const kase = await tx.afterSaleCase.findFirst({
          where: { id: input.caseId, facilityId },
        });
        if (!kase) throw notFound('After-sale case not found.');
        if (kase.status === 'in_progress') return kase; // idempotent
        if (kase.status !== 'open') {
          throw badRequest(`Case is ${kase.status}; can only advance open cases.`);
        }
        return tx.afterSaleCase.update({
          where: { id: input.caseId },
          data: { status: 'in_progress' },
        });
      });
    }),

  /** Resolve an open or in-progress case. Requires a non-empty resolution. */
  resolve: requirePermission('afterSale', 'manage')
    .input(resolveInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const kase = await tx.afterSaleCase.findFirst({
          where: { id: input.caseId, facilityId },
        });
        if (!kase) throw notFound('After-sale case not found.');
        if (kase.status !== 'open' && kase.status !== 'in_progress') {
          throw badRequest(`Case is ${kase.status}; can only resolve open or in-progress cases.`);
        }
        return tx.afterSaleCase.update({
          where: { id: input.caseId },
          data: {
            status: 'resolved',
            resolution: input.resolution,
            resolvedAt: new Date(),
          },
        });
      });
    }),

  /** Close a resolved case (terminal state). */
  close: requirePermission('afterSale', 'manage')
    .input(closeInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const kase = await tx.afterSaleCase.findFirst({
          where: { id: input.caseId, facilityId },
        });
        if (!kase) throw notFound('After-sale case not found.');
        if (kase.status !== 'resolved') {
          throw badRequest(`Case is ${kase.status}; can only close resolved cases.`);
        }
        return tx.afterSaleCase.update({
          where: { id: input.caseId },
          data: { status: 'closed' },
        });
      });
    }),
});
