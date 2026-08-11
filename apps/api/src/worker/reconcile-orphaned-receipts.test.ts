// K2 remediation integration tests: `reconcileOrphanedReceipts` recovers
// money collected on an approved Receipt whose provisioning never completed
// (deep-review K2, CRITICAL — "tiền mồ côi"). Covers both failure shapes:
//   1. the `provisioning.retry_pending` marker case (approve committed money,
//      provisioning threw before creating any Student, marker recorded);
//   2. the "crash, no marker" case (an approved Receipt with no Student and
//      no retry marker at all — simulates a process death between the money
//      commit and the catch block, per ADR 0041's own description of the gap).
// Also covers idempotency: running the drain twice never double-provisions.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import { reconcileOrphanedReceipts } from './reconcile-orphaned-receipts.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  seedCurriculumUnit,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('reconcileOrphanedReceipts (K2)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let classBatch: { id: string };
  let classBatchTwo: { id: string };
  const phonesToClean: string[] = [];
  let curriculumUnitIds: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Reconcile Facility');
    // Plan 3 grant path needs program units + class current neo.
    // Seed sequentially — concurrent create races on (program, orderGlobal).
    const units: { id: string; orderGlobal: number }[] = [];
    for (let i = 0; i < 8; i++) {
      units.push(await seedCurriculumUnit({ program: 'UCREA', title: `K2 Unit ${i + 1}` }));
    }
    curriculumUnitIds = units.map((u) => u.id);
    classBatch = await seedClassBatch({ facilityId: facility.id });
    classBatchTwo = await seedClassBatch({ facilityId: facility.id });
    await testDbBypass(async (tx) => {
      await tx.classBatch.update({
        where: { id: classBatch.id },
        data: {
          startUnitId: units[0].id,
          currentUnitId: units[0].id,
          currentUnitAnchor: new Date('2026-09-01'),
        },
      });
      await tx.classBatch.update({
        where: { id: classBatchTwo.id },
        data: {
          startUnitId: units[0].id,
          currentUnitId: units[0].id,
          currentUnitAnchor: new Date('2026-09-01'),
        },
      });
    });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-reconcile-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-reconcile-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...curriculumUnitIds);
    curriculumUnitIds = [];
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  it('marker case: recovers a receipt that failed provisioning before any Student/ParentAccount was created', async () => {
    // A malformed phone slips past `receiptCreate` (which does not validate
    // phone format) and fails inside provisioning's `normalizeLoginPhone`
    // call — BEFORE any ParentAccount/Student create is attempted. Money
    // still commits (receipt approved); provisioning records the
    // `retry_pending` marker with NO Student ever created — a realistic
    // "transient provisioning failure" repro matching the deep-review K2 test
    // requirement (receipt approved + provisioning:'pending' + NO student).
    // Contains digits so the CRM contact key is non-empty, but is too short
    // for the stricter login-identity normalizer used by provisioning.
    const malformedPhone = '123';
    const draft = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-TEST-K2M-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 5_000_000,
          status: 'draft',
          kind: 'new',
          parentPhone: malformedPhone,
          studentName: 'K2 Marker Child',
          classBatchId: classBatch.id,
          createdById: 'test-creator',
        },
      }),
    );

    const approved = await gdkd.finance.receiptApprove({ receiptId: draft.id });
    expect(approved.provisioning).toBe('pending');
    expect(approved.receipt.status).toBe('approved');

    const noStudent = await testDbBypass((tx) =>
      tx.student.findUnique({ where: { createdByReceiptId: draft.id } }),
    );
    expect(noStudent).toBeNull();

    const marker = await testDb().auditLog.findFirst({
      where: { entity: 'Receipt', entityId: draft.id, action: 'provisioning.retry_pending' },
    });
    expect(marker).not.toBeNull();

    // Fix the phone (out-of-band, as a real remediation would) then drain.
    const fixedPhone = '0996000001';
    phonesToClean.push(fixedPhone);
    await testDbBypass((tx) =>
      tx.receipt.update({ where: { id: draft.id }, data: { parentPhone: fixedPhone } }),
    );

    // The orphan scan is deliberately cross-facility (a background/system
    // job — see reconcile-orphaned-receipts.ts), so under parallel test-file
    // execution it may also pick up unrelated orphans from other concurrently
    // running tests; assert on THIS receipt's outcome specifically rather
    // than the batch size.
    const outcomes = await reconcileOrphanedReceipts(testDb());
    const mine = outcomes.find((o) => o.receiptId === draft.id);
    expect(mine).toMatchObject({ receiptId: draft.id, status: 'recovered' });

    const student = await testDbBypass((tx) =>
      tx.student.findUniqueOrThrow({ where: { createdByReceiptId: draft.id } }),
    );
    const parentAccount = await testDb().parentAccount.findUniqueOrThrow({
      where: { phone: normalizeLoginPhone(fixedPhone) },
    });
    const guardian = await testDb().guardian.findUniqueOrThrow({
      where: { parentAccountId_studentId: { parentAccountId: parentAccount.id, studentId: student.id } },
    });
    expect(guardian).not.toBeNull();
    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirstOrThrow({ where: { studentId: student.id, classBatchId: classBatch.id } }),
    );
    expect(enrollment.status).toBe('active');

    // Re-running the drain is a no-op (idempotent) — the receipt no longer
    // matches the orphan query at all.
    const secondRun = await reconcileOrphanedReceipts(testDb());
    expect(secondRun.find((o) => o.receiptId === draft.id)).toBeUndefined();
    expect(await testDbBypass((tx) => tx.student.count({ where: { createdByReceiptId: draft.id } }))).toBe(1);
  });

  it('crash-with-no-marker case: recovers an approved Receipt with no Student and no retry_pending audit row at all', async () => {
    const parentPhone = '0996000002';
    phonesToClean.push(parentPhone);

    // Simulates a hard process crash between the money commit and the
    // provisioning try/catch: an approved Receipt exists, but NEITHER a
    // Student NOR the `provisioning.retry_pending` marker were ever written.
    const orphan = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-TEST-K2C-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 3_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone,
          studentName: 'K2 Crash Child',
          classBatchId: classBatch.id,
          createdById: 'test-creator',
        },
      }),
    );

    const marker = await testDb().auditLog.findFirst({
      where: { entity: 'Receipt', entityId: orphan.id, action: 'provisioning.retry_pending' },
    });
    expect(marker).toBeNull();

    const outcomes = await reconcileOrphanedReceipts(testDb());
    const mine = outcomes.find((o) => o.receiptId === orphan.id);
    expect(mine).toMatchObject({ receiptId: orphan.id, status: 'recovered' });

    const student = await testDbBypass((tx) =>
      tx.student.findUniqueOrThrow({ where: { createdByReceiptId: orphan.id } }),
    );
    const studentAccount = await testDb().studentAccount.findUniqueOrThrow({ where: { studentId: student.id } });
    expect(studentAccount).not.toBeNull();

    // Idempotent: running twice does not duplicate anything.
    await reconcileOrphanedReceipts(testDb());
    expect(await testDbBypass((tx) => tx.student.count({ where: { createdByReceiptId: orphan.id } }))).toBe(1);
    expect(await testDb().studentAccount.count({ where: { studentId: student.id } })).toBe(1);
  });

  it('R1: mid-provision failure (Student committed, but Guardian/Enrollment/StudentAccount are not) is fully recovered, and re-running creates no duplicates', async () => {
    const parentPhone = '0996000005';
    phonesToClean.push(parentPhone);
    const classBatchId = classBatch.id;

    // Simulates a crash/error AFTER the Student commit but BEFORE
    // Guardian/Enrollment/StudentAccount (R1, deep-review adversarial
    // verification): an approved Receipt whose Student is already committed,
    // but nothing downstream is — exactly the gap the ORIGINAL reconciler
    // query (only "approved + no Student at all") could never detect, since
    // a Student row already exists here.
    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-TEST-K2P-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 4_500_000,
          status: 'approved',
          kind: 'new',
          parentPhone,
          studentName: 'K2 Partial Child',
          classBatchId,
          createdById: 'test-creator',
        },
      }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({
        data: {
          facilityId: facility.id,
          fullName: 'K2 Partial Child',
          createdByReceiptId: receipt.id,
        },
      }),
    );

    // Pre-condition: Student exists, nothing downstream does yet.
    expect(await testDb().guardian.count({ where: { studentId: student.id } })).toBe(0);
    expect(await testDbBypass((tx) => tx.enrollment.count({ where: { studentId: student.id } }))).toBe(0);
    expect(await testDb().studentAccount.count({ where: { studentId: student.id } })).toBe(0);

    const outcomes = await reconcileOrphanedReceipts(testDb());
    const mine = outcomes.find((o) => o.receiptId === receipt.id);
    expect(mine).toMatchObject({ receiptId: receipt.id, status: 'recovered' });

    const parentAccount = await testDb().parentAccount.findUniqueOrThrow({
      where: { phone: normalizeLoginPhone(parentPhone) },
    });
    const guardian = await testDb().guardian.findUniqueOrThrow({
      where: { parentAccountId_studentId: { parentAccountId: parentAccount.id, studentId: student.id } },
    });
    expect(guardian).not.toBeNull();
    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirstOrThrow({ where: { studentId: student.id, classBatchId } }),
    );
    expect(enrollment.status).toBe('active');
    const studentAccount = await testDb().studentAccount.findUniqueOrThrow({ where: { studentId: student.id } });
    expect(studentAccount).not.toBeNull();

    // `enrollment.mine` (LMS parent-facing read) now shows the recovered child.
    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));
    const mineList = await parentCaller.enrollment.mine();
    expect(mineList.some((e) => e.studentId === student.id)).toBe(true);

    // Re-running the drain is a no-op (idempotent) — no duplicates anywhere.
    const secondRun = await reconcileOrphanedReceipts(testDb());
    expect(secondRun.find((o) => o.receiptId === receipt.id)).toBeUndefined();
    expect(await testDb().guardian.count({ where: { studentId: student.id } })).toBe(1);
    expect(await testDbBypass((tx) => tx.enrollment.count({ where: { studentId: student.id } }))).toBe(1);
    expect(await testDb().studentAccount.count({ where: { studentId: student.id } })).toBe(1);
  });

  it('does not touch a fully-provisioned approved receipt', async () => {
    const parentPhone = '0996000003';
    const draft = await sale.finance.receiptCreate({
      studentName: 'K2 Healthy Child',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (draft.status !== 'success') throw new Error('expected success');
    phonesToClean.push(parentPhone);

    const approved = await gdkd.finance.receiptApprove({ receiptId: draft.receipt.id });
    expect(approved.provisioning).toBe('ok');

    const outcomes = await reconcileOrphanedReceipts(testDb());
    expect(outcomes.find((o) => o.receiptId === draft.receipt.id)).toBeUndefined();
  });

  it('does not touch a renewal receipt (studentId already set) even though it never gets its own createdByReceiptId Student', async () => {
    const parentPhone = '0996000004';
    phonesToClean.push(parentPhone);
    const first = await sale.finance.receiptCreate({
      studentName: 'K2 Renewal Child',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (first.status !== 'success') throw new Error('expected success');
    await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
    const student = await testDbBypass((tx) =>
      tx.student.findUniqueOrThrow({ where: { createdByReceiptId: first.receipt.id } }),
    );

    const renewal = await sale.finance.receiptCreate({
      studentId: student.id,
      studentName: 'K2 Renewal Child',
      parentPhone,
      amount: 4_000_000,
      classBatchId: classBatchTwo.id,
    });
    if (renewal.status !== 'success' && renewal.status !== 'warning') throw new Error('expected create to succeed');
    await gdkd.finance.receiptApprove({ receiptId: renewal.receipt.id });

    const outcomes = await reconcileOrphanedReceipts(testDb());
    expect(outcomes.find((o) => o.receiptId === renewal.receipt.id)).toBeUndefined();
  });

  it('Plan 3: full refund must not keep the receipt in the missing-range orphan set', async () => {
    const parentPhone = '0996000007';
    phonesToClean.push(parentPhone);
    const draft = await sale.finance.receiptCreate({
      studentName: 'K2 Refund Residual Child',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
      unitCount: 2,
    });
    if (draft.status !== 'success') throw new Error('expected success');

    const approved = await gdkd.finance.receiptApprove({ receiptId: draft.receipt.id });
    expect(approved.provisioning).toBe('ok');

    await gdkd.finance.refundCreate({
      receiptId: draft.receipt.id,
      amount: 5_000_000,
    });
    expect(
      await testDbBypass((tx) =>
        tx.enrollmentUnitRange.count({ where: { sourceReceiptId: draft.receipt.id } }),
      ),
    ).toBe(0);

    // Residual 0 + status still approved + active enrollment must NOT match
    // the missing-range orphan clause (would fail-loop every drain).
    const outcomes = await reconcileOrphanedReceipts(testDb());
    expect(outcomes.find((o) => o.receiptId === draft.receipt.id)).toBeUndefined();
  });

  it('Plan 3: recovers missing range only when grant never succeeded (crash-before-grant)', async () => {
    const parentPhone = '0996000006';
    phonesToClean.push(parentPhone);
    // Break-glass provision (unitCount 0) completes identity with no grant audit,
    // then flip unitCount to paid span — models crash/repair after package set.
    const draft = await sale.finance.receiptCreate({
      studentName: 'K2 Range Gap Child',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
      unitCount: 0,
    });
    if (draft.status !== 'success') throw new Error('expected success');

    const approved = await gdkd.finance.receiptApprove({ receiptId: draft.receipt.id });
    expect(approved.provisioning).toBe('ok');
    expect(
      await testDbBypass((tx) =>
        tx.enrollmentUnitRange.count({ where: { sourceReceiptId: draft.receipt.id } }),
      ),
    ).toBe(0);

    await testDbBypass((tx) =>
      tx.receipt.update({ where: { id: draft.receipt.id }, data: { unitCount: 2 } }),
    );

    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirstOrThrow({
        where: { classBatchId: classBatch.id, status: 'active' },
      }),
    );

    const outcomes = await reconcileOrphanedReceipts(testDb());
    const mine = outcomes.find((o) => o.receiptId === draft.receipt.id);
    expect(mine).toMatchObject({ receiptId: draft.receipt.id, status: 'recovered' });

    const ranges = await testDbBypass((tx) =>
      tx.enrollmentUnitRange.findMany({
        where: { enrollmentId: enrollment.id, sourceReceiptId: draft.receipt.id },
      }),
    );
    expect(ranges).toHaveLength(1);
    expect(ranges[0].toOrderGlobal - ranges[0].fromOrderGlobal + 1).toBe(2);

    const second = await reconcileOrphanedReceipts(testDb());
    expect(second.find((o) => o.receiptId === draft.receipt.id)).toBeUndefined();
  });

  it('Plan 3: does not re-grant after intentional range delete when grant audit remains', async () => {
    const parentPhone = '0996000008';
    phonesToClean.push(parentPhone);
    const draft = await sale.finance.receiptCreate({
      studentName: 'K2 Ops Cut Child',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
      unitCount: 2,
    });
    if (draft.status !== 'success') throw new Error('expected success');

    const approved = await gdkd.finance.receiptApprove({ receiptId: draft.receipt.id });
    expect(approved.provisioning).toBe('ok');

    // Ops/refund-style cut: delete range but leave enrollment.grantUnitsFromReceipt audit.
    await testDbBypass((tx) =>
      tx.enrollmentUnitRange.deleteMany({ where: { sourceReceiptId: draft.receipt.id } }),
    );
    const grantAudit = await testDb().auditLog.findFirst({
      where: {
        action: 'enrollment.grantUnitsFromReceipt',
        data: { path: ['sourceReceiptId'], equals: draft.receipt.id },
      },
    });
    expect(grantAudit).not.toBeNull();

    const outcomes = await reconcileOrphanedReceipts(testDb());
    expect(outcomes.find((o) => o.receiptId === draft.receipt.id)).toBeUndefined();
    expect(
      await testDbBypass((tx) =>
        tx.enrollmentUnitRange.count({ where: { sourceReceiptId: draft.receipt.id } }),
      ),
    ).toBe(0);
  });
});
