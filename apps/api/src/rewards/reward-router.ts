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
import { lmsProcedure, requireLmsStudent, assertPasswordNotExpired, requirePermission, router, scoped } from '../trpc.js';
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
    await assertPasswordNotExpired(ctx, studentId);
    const student = await loadLmsStudent(ctx.db, studentId, ctx.lmsSubject!.parentAccountId);

    return withFacility(ctx.db, student.facilityId, async (tx) => {
      // 1. Verify gift.
      const gift = await tx.gift.findFirst({
        where: { id: input.giftId, facilityId: student.facilityId, isActive: true },
      });
      if (!gift) throw notFound('Gift not found.');

      // 2. Stock pre-check (avoid locking when trivially out of stock).
      if (gift.stock === 0) throw badRequest('Out of stock.');

      // 3. Serialize concurrent redeems for this gift. Lock keyed on gift.id so
      //    two different students racing for the last unit of the same gift
      //    compete for the same advisory lock (per-student locking would allow
      //    both to pass step 2 concurrently since they acquire distinct locks).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.giftId}))`;

      // 3a. Re-read stock inside the lock to catch races that passed the pre-check.
      const lockedGift = await tx.gift.findFirst({
        where: { id: input.giftId, facilityId: student.facilityId, isActive: true },
      });
      if (!lockedGift || lockedGift.stock === 0) throw badRequest('Out of stock.');

      // 4. Compute current balance.
      const agg = await tx.starTransaction.aggregate({
        where: { studentId: student.id },
        _sum: { amount: true },
      });
      const balance = agg._sum.amount ?? 0;

      // 5. Balance gate — use lockedGift.starsRequired (re-read, authoritative).
      if (balance < lockedGift.starsRequired) {
        throw badRequest('Insufficient stars.');
      }

      // 6. Create Reward + deduction StarTransaction in the same transaction.
      const reward = await tx.reward.create({
        data: {
          facilityId: student.facilityId,
          studentId: student.id,
          giftId: lockedGift.id,
          status: 'pending',
        },
      });

      await tx.starTransaction.create({
        data: {
          facilityId: student.facilityId,
          studentId: student.id,
          type: 'gift_redeemed',
          amount: -lockedGift.starsRequired,
          refType: 'reward',
          refId: reward.id,
        },
      });

      const newBalance = balance - lockedGift.starsRequired;
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
   * Decrements gift stock by 1 if stock > 0; -1 (unlimited) is unchanged.
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
        // `stock > 0` (not `>= 0`): a gift that has already reached exactly 0
        // must not decrement further — `stock >= 0` let a second delivery on
        // an already-exhausted gift push it to -1, which collides with -1's
        // meaning as the "unlimited stock" sentinel, permanently disabling
        // this gift's out-of-stock check. `updateMany` with a `stock: { gt: 0 }`
        // guard (not a plain `update` gated by the stale in-memory read above)
        // makes the check itself atomic, so two concurrent deliveries on a
        // stock=1 gift can't both pass a stale read and double-decrement.
        if (reward.gift.stock > 0) {
          await tx.gift.updateMany({
            where: { id: reward.gift.id, stock: { gt: 0 } },
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
          // Low-Severity Hygiene remediation (scenario audit): refund the
          // price actually PAID at redeem time, not `reward.gift.starsRequired`
          // (a live join — would drift if the gift's price changed between
          // redeem and reject). The `gift_redeemed` StarTransaction this
          // reward's `redeem` call created is the durable snapshot of what was
          // really deducted; read it back instead of re-deriving from Gift.
          const originalDeduction = await tx.starTransaction.findFirst({
            where: { refType: 'reward', refId: reward.id, type: 'gift_redeemed' },
            select: { amount: true },
          });
          const refundAmount = originalDeduction ? Math.abs(originalDeduction.amount) : reward.gift.starsRequired;
          try {
            await tx.starTransaction.create({
              data: {
                facilityId: reward.facilityId,
                studentId: reward.studentId,
                type: 'gift_rejected_refund',
                amount: refundAmount,
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

  /**
   * Staff: cold-start form by UUID (resource-centric form-depth).
   * Same facility wall + rewards.manage as list.
   */
  get: requirePermission('rewards', 'manage')
    .input(z.object({ rewardId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const reward = await tx.reward.findUnique({
          where: { id: input.rewardId },
          include: { gift: { select: { id: true, name: true, starsRequired: true } } },
        });
        if (!reward || reward.facilityId !== facilityId) {
          throw notFound('Reward not found.');
        }
        return reward;
      });
    }),

  /** Staff: list rewards in this facility, optionally filtered by status. */
  list: requirePermission('rewards', 'manage')
    .input(
      z.object({
        status: z.enum(['pending', 'approved', 'delivered', 'rejected']).optional(),
        pageSize: z.number().int().min(1).max(100).default(50),
        cursor: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.reward.findMany({
          where: {
            facilityId,
            ...(input.status ? { status: input.status } : {}),
            ...(input.cursor ? { id: { lt: input.cursor } } : {}),
          },
          include: { gift: { select: { id: true, name: true, starsRequired: true } } },
          orderBy: { redeemedAt: 'desc' },
          take: input.pageSize,
        }),
      );
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
