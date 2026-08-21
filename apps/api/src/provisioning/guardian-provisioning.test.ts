// K1 remediation integration tests: `provisionFromReceipt` must create a
// `Guardian` row for the paying parent (find-or-create, idempotent), so the
// parent who just paid sees their child through the SAME read gate
// (`getApprovedChildren`) that `enrollment.mine` and `lmsAuth.verifyOtp` use —
// without ever having to run a separate `guardian.requestLink`/`approveLink`
// round trip. Before this fix, `provisionFromReceipt` never touched
// `Guardian` at all and a freshly-provisioned parent saw an empty children
// list forever (deep-review K1, CRITICAL).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import { provisionFromReceipt } from './provision-from-receipt.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('provisionFromReceipt creates a Guardian link (K1)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let classBatch: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Guardian Provisioning Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-gp-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-gp-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  it('after receiptApprove provisioning, the paying parent immediately sees the child via enrollment.mine', async () => {
    const parentPhone = '0997000001';
    phonesToClean.push(parentPhone);

    const draft = await sale.finance.receiptCreate({
      studentName: 'K1 Provisioned Child',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (draft.status !== 'success') throw new Error('expected draft creation to succeed');

    const approved = await gdkd.finance.receiptApprove({ receiptId: draft.receipt.id });
    expect(approved.provisioning).toBe('ok');

    const parentAccount = await testDb().parentAccount.findUniqueOrThrow({
      where: { phone: normalizeLoginPhone(parentPhone) },
    });
    expect(parentAccount.passwordHash).toMatch(/^pbkdf2:/);
    const student = await testDbBypass((tx) =>
      tx.student.findUniqueOrThrow({ where: { createdByReceiptId: draft.receipt.id } }),
    );

    const guardian = await testDb().guardian.findUniqueOrThrow({
      where: { parentAccountId_studentId: { parentAccountId: parentAccount.id, studentId: student.id } },
    });
    expect(guardian.relation).toBe('guardian');

    const parent = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));
    const mine = await parent.enrollment.mine();
    expect(mine).toHaveLength(1);
    expect(mine[0]!.studentId).toBe(student.id);
  });

  it('is idempotent: replaying provisionFromReceipt for the same receipt creates no duplicate Guardian row', async () => {
    const parentPhone = '0997000002';
    phonesToClean.push(parentPhone);

    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-TEST-K1-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 1_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone,
          studentName: 'K1 Replay Child',
          classBatchId: classBatch.id,
          createdById: 'test-creator',
        },
      }),
    );

    const receiptForProvisioning = {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone,
      studentName: receipt.studentName,
      classBatchId: receipt.classBatchId,
    };

    const first = await provisionFromReceipt(testDb(), receiptForProvisioning);
    const second = await provisionFromReceipt(testDb(), receiptForProvisioning);

    expect(second.guardianId).toBe(first.guardianId);
    expect(
      await testDb().guardian.count({
        where: { parentAccountId: first.parentAccountId, studentId: first.studentId },
      }),
    ).toBe(1);
  });

  it('resolves a race on the same receipt (two concurrent provisions) to exactly one Guardian row', async () => {
    const parentPhone = '0997000003';
    phonesToClean.push(parentPhone);

    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-TEST-K1R-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 1_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone,
          studentName: 'K1 Concurrent Child',
          classBatchId: classBatch.id,
          createdById: 'test-creator',
        },
      }),
    );

    const receiptForProvisioning = {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone,
      studentName: receipt.studentName,
      classBatchId: receipt.classBatchId,
    };

    const [first, second] = await Promise.all([
      provisionFromReceipt(testDb(), receiptForProvisioning),
      provisionFromReceipt(testDb(), receiptForProvisioning),
    ]);

    expect(first.guardianId).toBe(second.guardianId);
    expect(
      await testDb().guardian.count({
        where: { parentAccountId: first.parentAccountId, studentId: first.studentId },
      }),
    ).toBe(1);
  });
});
