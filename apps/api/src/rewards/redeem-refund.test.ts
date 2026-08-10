// P4 adversarial integration tests — gift.upsert + rewards lifecycle.
//
// Key invariants under test:
//   1. Star balance never goes negative (FOR UPDATE serialization).
//   2. Refund is exactly-once (rejectionRefundedAt idempotency gate).
//   3. Stock decrement happens on deliver, not on redeem; -1 stays -1.
//   4. gift_redeemed / gift_rejected_refund are the exact StarTxnType values.
//   5. A parent cannot redeem on behalf of a student they do not own.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedActiveEnrollment,
  seedClassBatch,
  seedGuardianLink,
  seedParentAccount,
  seedStudentAccount,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('gift catalog + rewards lifecycle (P4)', () => {
  let facility: { id: string };
  let gdkd: Caller;
  let parentAccount: { id: string; phone: string };
  let student: { id: string };
  let studentCaller: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Rewards Facility');
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-rewards-1', roles: ['giam_doc_kinh_doanh'] }),
    );

    // Parent + student with Guardian link + StudentAccount (for FOR UPDATE lock).
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    phonesToClean.push(phone);
    parentAccount = await seedParentAccount(phone);

    const classBatch = await seedClassBatch({ facilityId: facility.id });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    student = { id: enrollment.studentId };

    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });
    await seedStudentAccount(student.id, parentAccount.id);

    studentCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parentAccount.id, studentId: student.id, kind: 'student' }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  // ---- Helper: seed stars directly ----
  async function giveStars(studentId: string, amount: number): Promise<void> {
    await testDbBypass((tx) =>
      tx.starTransaction.create({
        data: {
          facilityId: facility.id,
          studentId,
          type: 'manual',
          amount,
        },
      }),
    );
  }

  // ---- gift.upsert ----

  it('gift.upsert: director creates a gift', async () => {
    const gift = await gdkd.gift.upsert({ name: 'Sticker Pack', starsRequired: 10 });
    expect(gift.name).toBe('Sticker Pack');
    expect(gift.starsRequired).toBe(10);
    expect(gift.stock).toBe(-1);
    expect(gift.isActive).toBe(true);
  });

  it('gift.upsert: archive sets isActive=false', async () => {
    const gift = await gdkd.gift.upsert({ name: 'Old Gift', starsRequired: 5 });
    const archived = await gdkd.gift.upsert({ id: gift.id, name: gift.name, starsRequired: gift.starsRequired, isActive: false });
    expect(archived.isActive).toBe(false);
  });

  it('gift.upsert: non-director (sale) gets FORBIDDEN', async () => {
    const sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-gifts-1', roles: ['sale'] }),
    );
    await expect(sale.gift.upsert({ name: 'Sneaky Gift', starsRequired: 5 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  // ---- rewards.redeem ----

  it('rewards.redeem: student redeems gift → StarTransaction created + Reward pending', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Pen', starsRequired: 10 });

    const { reward, newBalance } = await studentCaller.rewards.redeem({ giftId: gift.id });

    expect(reward.status).toBe('pending');
    expect(reward.studentId).toBe(student.id);
    expect(newBalance).toBe(10);

    const txns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({ where: { studentId: student.id, type: 'gift_redeemed' } }),
    );
    expect(txns).toHaveLength(1);
    expect(txns[0]?.amount).toBe(-10);
    expect(txns[0]?.refId).toBe(reward.id);
  });

  it('rewards.redeem: insufficient stars → BAD_REQUEST', async () => {
    await giveStars(student.id, 5);
    const gift = await gdkd.gift.upsert({ name: 'Trophy', starsRequired: 50 });

    await expect(studentCaller.rewards.redeem({ giftId: gift.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rewards.redeem: stock=0 → BAD_REQUEST "Out of stock"', async () => {
    await giveStars(student.id, 100);
    const gift = await gdkd.gift.upsert({ name: 'Limited Item', starsRequired: 10, stock: 0 });

    await expect(studentCaller.rewards.redeem({ giftId: gift.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('stock'),
    });
  });

  it('rewards.redeem: stock=-1 (unlimited) allows redeem', async () => {
    await giveStars(student.id, 100);
    const gift = await gdkd.gift.upsert({ name: 'Unlimited Sticker', starsRequired: 10, stock: -1 });

    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });
    expect(reward.status).toBe('pending');
  });

  it('rewards.redeem: concurrent race — only one succeeds when exactly 1 unit of stars available', async () => {
    // Student has exactly 10 stars; gift costs 10; two concurrent redeems.
    await giveStars(student.id, 10);
    const gift = await gdkd.gift.upsert({ name: 'Race Gift', starsRequired: 10 });

    const results = await Promise.allSettled([
      studentCaller.rewards.redeem({ giftId: gift.id }),
      studentCaller.rewards.redeem({ giftId: gift.id }),
    ]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'BAD_REQUEST' });

    // Final balance must be 0, not -10.
    const agg = await testDbBypass((tx) =>
      tx.starTransaction.aggregate({ where: { studentId: student.id }, _sum: { amount: true } }),
    );
    expect(agg._sum.amount).toBe(0);
  });

  it('LMS: student cannot redeem for another student (FORBIDDEN)', async () => {
    // Create a second student not linked to this parent.
    const classBatch2 = await seedClassBatch({ facilityId: facility.id });
    const other = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch2.id });

    // Caller whose lmsSubject.studentId points at the unlinked student.
    const spoofedCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parentAccount.id, studentId: other.studentId }),
    );
    await giveStars(other.studentId, 100);
    const gift = await gdkd.gift.upsert({ name: 'Spoofed Gift', starsRequired: 10 });

    await expect(spoofedCaller.rewards.redeem({ giftId: gift.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  // ---- rewards.approve / deliver / reject ----

  it('rewards.reject: refund exactly once → StarTransaction created + rejectionRefundedAt set', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Reject Gift', starsRequired: 10 });
    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });

    const rejected = await gdkd.rewards.reject({ rewardId: reward.id });
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionRefundedAt).not.toBeNull();

    const refundTxns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({ where: { studentId: student.id, type: 'gift_rejected_refund' } }),
    );
    expect(refundTxns).toHaveLength(1);
    expect(refundTxns[0]?.amount).toBe(10);
  });

  it('Low-Severity Hygiene remediation (scenario audit): refund uses the price PAID at redeem time, not the CURRENT gift price', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Price Drift Gift', starsRequired: 10 });
    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });

    // Price changes AFTER redemption, before reject — the refund must still
    // match the 10 stars actually deducted, not the new price.
    await gdkd.gift.upsert({ id: gift.id, name: gift.name, starsRequired: 25 });

    const rejected = await gdkd.rewards.reject({ rewardId: reward.id });
    expect(rejected.status).toBe('rejected');

    const refundTxns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({ where: { studentId: student.id, type: 'gift_rejected_refund' } }),
    );
    expect(refundTxns).toHaveLength(1);
    expect(refundTxns[0]?.amount).toBe(10); // the ORIGINAL price, not the new 25
  });

  it('Low-Severity Hygiene remediation: rejecting an already-DELIVERED reward is rejected — BAD_REQUEST (regression, guard already correct)', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Deliver Then Reject Gift', starsRequired: 10 });
    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });
    await gdkd.rewards.approve({ rewardId: reward.id });
    await gdkd.rewards.deliver({ rewardId: reward.id });

    await expect(gdkd.rewards.reject({ rewardId: reward.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    // No refund was created for a delivered gift.
    const refundTxns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({ where: { studentId: student.id, type: 'gift_rejected_refund' } }),
    );
    expect(refundTxns).toHaveLength(0);
  });

  it('reject: concurrent reject calls produce exactly one refund (race-safe)', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Race Reject Gift', starsRequired: 10 });
    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });

    const [r1, r2] = await Promise.allSettled([
      gdkd.rewards.reject({ rewardId: reward.id, note: 'concurrent1' }),
      gdkd.rewards.reject({ rewardId: reward.id, note: 'concurrent2' }),
    ]);

    // At least one call must succeed.
    const succeeded = [r1, r2].filter((r) => r.status === 'fulfilled');
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // Exactly one refund transaction must exist regardless of concurrency.
    const refundTxns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({
        where: { refId: reward.id, type: 'gift_rejected_refund' },
      }),
    );
    expect(refundTxns).toHaveLength(1);
  });

  it('rewards.reject: second reject call → no duplicate refund (idempotent)', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Idempotent Gift', starsRequired: 10 });
    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });

    await gdkd.rewards.reject({ rewardId: reward.id });

    // Second reject on an already-rejected reward should fail at status check.
    await expect(gdkd.rewards.reject({ rewardId: reward.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    // Still only one refund transaction.
    const refundTxns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({ where: { studentId: student.id, type: 'gift_rejected_refund' } }),
    );
    expect(refundTxns).toHaveLength(1);
  });

  it('rewards.deliver: decrements stock by 1', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Finite Gift', starsRequired: 5, stock: 3 });
    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });

    await gdkd.rewards.approve({ rewardId: reward.id });
    await gdkd.rewards.deliver({ rewardId: reward.id });

    const updatedGift = await testDbBypass((tx) => tx.gift.findUniqueOrThrow({ where: { id: gift.id } }));
    expect(updatedGift.stock).toBe(2);
  });

  it('rewards.deliver: stock -1 (unlimited) stays -1 after deliver', async () => {
    await giveStars(student.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Unlimited Gift', starsRequired: 5, stock: -1 });
    const { reward } = await studentCaller.rewards.redeem({ giftId: gift.id });

    await gdkd.rewards.approve({ rewardId: reward.id });
    await gdkd.rewards.deliver({ rewardId: reward.id });

    const updatedGift = await testDbBypass((tx) => tx.gift.findUniqueOrThrow({ where: { id: gift.id } }));
    expect(updatedGift.stock).toBe(-1);
  });

  it('rewards.deliver: a stock=1 gift redeemed twice does not go negative on the second delivery', async () => {
    // redeem() only rejects stock === 0 — it does NOT decrement at redeem
    // time (comment above, invariant #3) — so two different students can
    // both redeem the same stock=1 gift before either is delivered. Once the
    // first delivery takes stock 1 -> 0, the second delivery must not push it
    // to -1 (the schema's "unlimited" sentinel) — regression for the
    // `stock >= 0` -> `stock > 0` fix.
    const phone2 = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    phonesToClean.push(phone2);
    const parentAccount2 = await seedParentAccount(phone2);
    const classBatch = await seedClassBatch({ facilityId: facility.id });
    const enrollment2 = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    const student2 = { id: enrollment2.studentId };
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount2.id,
      studentId: student2.id,
      status: 'approved',
    });
    await seedStudentAccount(student2.id, parentAccount2.id);
    const studentCaller2 = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parentAccount2.id, studentId: student2.id, kind: 'student' }),
    );

    await giveStars(student.id, 20);
    await giveStars(student2.id, 20);
    const gift = await gdkd.gift.upsert({ name: 'Down To The Wire', starsRequired: 5, stock: 1 });

    const { reward: rewardA } = await studentCaller.rewards.redeem({ giftId: gift.id });
    const { reward: rewardB } = await studentCaller2.rewards.redeem({ giftId: gift.id });
    await gdkd.rewards.approve({ rewardId: rewardA.id });
    await gdkd.rewards.approve({ rewardId: rewardB.id });

    await gdkd.rewards.deliver({ rewardId: rewardA.id });
    const afterFirst = await testDbBypass((tx) => tx.gift.findUniqueOrThrow({ where: { id: gift.id } }));
    expect(afterFirst.stock).toBe(0);

    await gdkd.rewards.deliver({ rewardId: rewardB.id });
    const afterSecond = await testDbBypass((tx) => tx.gift.findUniqueOrThrow({ where: { id: gift.id } }));
    expect(afterSecond.stock).toBe(0);
  });
});
