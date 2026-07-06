// reward router — P4 (WF-P4-02): gift redemption lifecycle.
//
// Key invariants enforced here:
//   1. Star balance never goes negative: SELECT FOR UPDATE on StudentAccount
//      serializes concurrent redeems so the balance check and the deduction
//      happen atomically within one Postgres transaction.
//   2. Refund exactly once: `rejectionRefundedAt` is checked before creating
//      the refund StarTransaction — a second `reject` call is a no-op if the
//      field is already set.
//   3. Stock decrement only on `deliver`, never on `redeem` (reserve model:
//      redeem deducts stars immediately; physical stock decrements when the
//      gift is actually handed over).
//   4. `gift_redeemed` / `gift_rejected_refund` are the exact StarTxnType
//      enum values used — do not change without a schema migration.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, notFound } from '../errors.js';
import { lmsProcedure, requireLmsStudent, requirePermission, router, scoped } from '../trpc.js';
import { loadLmsStudent } from '../exercise/open-tier.js';

const redeemInput = z.object({
  giftId: z.string().uuid(),
});

const approveInput = z.object({
  rewardId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

const deliverInput = z.object({
  rewardId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

const rejectInput = z.object({
  rewardId: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export const rewardRouter = router({
  /**
   * LMS: student redeems a gift.
   *
   * Execution sequence (atomic):
   *   1. Verify gift exists + active in student's facility.
   *   2. Check stock > 0 (or -1 = unlimited).
   *   3. SELECT FOR UPDATE on StudentAccount to serialize concurrent calls.
   *   4. Compute balance = SUM(StarTransaction.amount) for this student.
   *   5. Assert balance >= gift.starsRequired.
   *   6. Create Reward (pending) + StarTransaction (gift_redeemed, negative).
   */
  redeem: lmsProcedure.input(redeemInput).mutation(async ({ ctx, input }) => {
    const { studentId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, ctx.lmsSubject!.parentAccountId);

    return withFacility(ctx.db, student.facilityId, async (tx) => {
      // 1. Verify gift.
      const gift = await tx.gift.findFirst({
        where: { id: input.giftId, facilityId: student.facilityId, isActive: true },
      });
      if (!gift) throw notFound('Gift not found.');

      // 2. Stock pre-check (avoid locking when trivially out of stock).
      if (gift.stock === 0) throw badRequest('Out of stock.');

      // 3. Serialize concurrent redeems via advisory lock keyed on student
      //    identity. Unlike a row-level FOR UPDATE, this works even when no
      //    StudentAccount row exists yet (edge case: student created outside
      //    the provisioning path), closing the TOCTOU gap.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${student.id}))`;

      // 4. Compute current balance.
      const agg = await tx.starTransaction.aggregate({
        where: { studentId: student.id },
        _sum: { amount: true },
      });
      const balance = agg._sum.amount ?? 0;

      // 5. Balance gate.
      if (balance < gift.starsRequired) {
        throw badRequest('Insufficient stars.');
      }

      // 6. Create Reward + deduction StarTransaction in the same transaction.
      const reward = await tx.reward.create({
        data: {
          facilityId: student.facilityId,
          studentId: student.id,
          giftId: gift.id,
          status: 'pending',
        },
      });

      await tx.starTransaction.create({
        data: {
          facilityId: student.facilityId,
          studentId: student.id,
          type: 'gift_redeemed',
          amount: -gift.starsRequired,
          refType: 'reward',
          refId: reward.id,
        },
      });

      const newBalance = balance - gift.starsRequired;
      return { reward, newBalance };
    });
  }),

  /** Staff: move reward from pending → approved. */
  approve: requirePermission('rewards', 'manage')
    .input(approveInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const reward = await tx.reward.findFirst({
          where: { id: input.rewardId, facilityId },
        });
        if (!reward) throw notFound('Reward not found.');
        if (reward.status !== 'pending') {
          throw badRequest(`Reward is already ${reward.status}; can only approve pending rewards.`);
        }
        return tx.reward.update({
          where: { id: input.rewardId },
          data: {
            status: 'approved',
            approvedAt: new Date(),
            ...(input.note != null ? { note: input.note } : {}),
          },
        });
      });
    }),

  /**
   * Staff: move reward from approved → delivered.
   * Decrements gift stock by 1 if stock >= 0; -1 (unlimited) is unchanged.
   */
  deliver: requirePermission('rewards', 'manage')
    .input(deliverInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const reward = await tx.reward.findFirst({
          where: { id: input.rewardId, facilityId },
          include: { gift: true },
        });
        if (!reward) throw notFound('Reward not found.');
        if (reward.status !== 'approved') {
          throw badRequest(`Reward is ${reward.status}; can only deliver approved rewards.`);
        }

        const updated = await tx.reward.update({
          where: { id: input.rewardId },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
            ...(input.note != null ? { note: input.note } : {}),
          },
        });

        // Atomically decrement stock for finite-stock gifts; -1 (unlimited) unchanged.
        // Using Prisma's { decrement } so concurrent deliver calls cannot race
        // on a stale JS-computed value.
        if (reward.gift.stock >= 0) {
          await tx.gift.update({
            where: { id: reward.gift.id },
            data: { stock: { decrement: 1 } },
          });
        }

        return updated;
      });
    }),

  /**
   * Staff: reject a pending or approved reward.
   * Exactly-once star refund: if `rejectionRefundedAt` is already set the
   * refund StarTransaction is skipped (idempotent second call).
   */
  reject: requirePermission('rewards', 'manage')
    .input(rejectInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const reward = await tx.reward.findFirst({
          where: { id: input.rewardId, facilityId },
          include: { gift: true },
        });
        if (!reward) throw notFound('Reward not found.');
        if (reward.status !== 'pending' && reward.status !== 'approved') {
          throw badRequest(`Reward is ${reward.status}; can only reject pending or approved rewards.`);
        }

        const now = new Date();

        // Exactly-once refund: only create the StarTransaction if not already done.
        // The partial unique index on (refId) WHERE type='gift_rejected_refund' is a
        // DB-level backstop against concurrent reject calls that both read
        // rejectionRefundedAt=null. If the second insert races and hits the unique
        // constraint (P2002), we treat it as a no-op — the refund already exists.
        if (!reward.rejectionRefundedAt) {
          try {
            await tx.starTransaction.create({
              data: {
                facilityId: reward.facilityId,
                studentId: reward.studentId,
                type: 'gift_rejected_refund',
                amount: reward.gift.starsRequired,
                refType: 'reward',
                refId: reward.id,
              },
            });
          } catch (err) {
            // Duck-type P2002 (unique constraint violation) without importing Prisma
            // as a runtime value — mirrors the pattern in provisioning/provision-from-receipt.ts.
            if ((err as { code?: unknown }).code === 'P2002') {
              // Concurrent reject already created the refund — idempotent, skip silently.
            } else {
              throw err;
            }
          }
        }

        return tx.reward.update({
          where: { id: input.rewardId },
          data: {
            status: 'rejected',
            rejectedAt: now,
            rejectionRefundedAt: reward.rejectionRefundedAt ?? now,
            ...(input.note != null ? { note: input.note } : {}),
          },
        });
      });
    }),

  /** LMS: student reads their own reward history. */
  listForStudent: lmsProcedure.query(async ({ ctx }) => {
    const { studentId } = requireLmsStudent(ctx);
    const student = await loadLmsStudent(ctx.db, studentId, ctx.lmsSubject!.parentAccountId);

    return withFacility(ctx.db, student.facilityId, (tx) =>
      tx.reward.findMany({
        where: { facilityId: student.facilityId, studentId: student.id },
        include: { gift: true },
        orderBy: { redeemedAt: 'desc' },
      }),
    );
  }),
});
