// gift router — P4 (WF-P4-01): staff-managed gift catalog.
//
// `gift.upsert` creates or updates a gift; archiving is done by setting
// isActive=false (no DELETE path — cmc_app has no DELETE grant on Gift).
// `gift.list` is the staff-facing surface; `gift.listForStudent` is the LMS
// surface that combines the catalog with the student's current star balance.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { notFound } from '../errors.js';
import { lmsProcedure, requireLmsStudent, requirePermission, router, scoped } from '../trpc.js';
import { loadLmsStudent } from '../exercise/open-tier.js';

const upsertGiftInput = z.object({
  /** Omit to create; provide to update. */
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  imageUrl: z.string().url().max(500).optional().nullable(),
  starsRequired: z.number().int().positive(),
  /** -1 = unlimited. 0 or more = finite stock. */
  stock: z.number().int().min(-1).default(-1),
  isActive: z.boolean().default(true),
});

const listGiftInput = z.object({
  includeInactive: z.boolean().default(false),
});

export const giftRouter = router({
  /** Create or update a gift. Archive by setting isActive=false. */
  upsert: requirePermission('gift', 'upsert')
    .input(upsertGiftInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        if (input.id) {
          const existing = await tx.gift.findFirst({ where: { id: input.id, facilityId } });
          if (!existing) throw notFound('Gift not found.');
          return tx.gift.update({
            where: { id: input.id },
            data: {
              name: input.name,
              imageUrl: input.imageUrl ?? null,
              starsRequired: input.starsRequired,
              stock: input.stock,
              isActive: input.isActive,
            },
          });
        }
        return tx.gift.create({
          data: {
            facilityId,
            name: input.name,
            imageUrl: input.imageUrl ?? null,
            starsRequired: input.starsRequired,
            stock: input.stock,
            isActive: input.isActive,
          },
        });
      });
    }),

  /** Staff view: list gifts in the facility (active by default). */
  list: requirePermission('gift', 'list')
    .input(listGiftInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.gift.findMany({
          where: {
            facilityId,
            ...(input.includeInactive ? {} : { isActive: true }),
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
    }),

  /**
   * LMS surface: list active gifts + the student's current star balance.
   * Combines into one response so the client can render affordability hints
   * without a second round-trip.
   */
  listForStudent: lmsProcedure.query(async ({ ctx }) => {
    const { studentId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, ctx.lmsSubject!.parentAccountId);

    return withFacility(ctx.db, student.facilityId, async (tx) => {
      const gifts = await tx.gift.findMany({
        where: { facilityId: student.facilityId, isActive: true },
        orderBy: { starsRequired: 'asc' },
      });
      const agg = await tx.starTransaction.aggregate({
        where: { studentId: student.id },
        _sum: { amount: true },
      });
      const starBalance = agg._sum.amount ?? 0;
      return { gifts, starBalance };
    });
  }),
});
