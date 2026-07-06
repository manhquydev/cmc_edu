// WF-P1-04 integration tests (ADR 0041): provisioning creates
// Student/ParentAccount/StudentAccount/Enrollment from an approved receipt;
// a provisioning failure does NOT roll back the money transaction
// (netAmount/approved stay intact); replaying provisionFromReceipt is
// idempotent (no duplicate rows); and a race on a brand-new phone (two
// children provisioned concurrently) resolves to exactly one ParentAccount.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import { provisionFromReceipt } from './provision-from-receipt.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('provisionFromReceipt (WF-P1-04, ADR 0041)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let classBatch: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Provisioning Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-prov-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-prov-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  async function draftAndCreateReceipt(opts: {
    contactPhone: string;
    parentPhone: string;
    studentName: string;
    classBatchId?: string;
  }) {
    const opp = await sale.crm.opportunityCreate({ contactName: 'C ' + opts.contactPhone, phone: opts.contactPhone });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O3_TEST_SCHEDULED' });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });

    phonesToClean.push(opts.parentPhone);
    const result = await sale.finance.receiptCreate({
      opportunityId: opp.id,
      studentName: opts.studentName,
      parentPhone: opts.parentPhone,
      amount: 5_000_000,
      classBatchId: opts.classBatchId ?? classBatch.id,
    });
    if (result.status !== 'success') throw new Error('expected draft creation to succeed: ' + result.message);
    return result.receipt;
  }

  /** Directly inserts an already-`approved` Receipt row, bypassing the money
   * gate flow — used only to exercise `provisionFromReceipt` in isolation
   * (e.g. the concurrency test, which needs two independent receipts). */
  async function createRawApprovedReceipt(opts: {
    parentPhone: string;
    studentName: string;
    classBatchId: string | null;
  }) {
    return testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-TEST-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 1_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone: opts.parentPhone,
          studentName: opts.studentName,
          classBatchId: opts.classBatchId,
          createdById: 'test-creator',
        },
      }),
    );
  }

  it('provisions ParentAccount + Student(createdByReceiptId) + StudentAccount + active Enrollment on approve', async () => {
    const receipt = await draftAndCreateReceipt({
      contactPhone: '0950000001',
      parentPhone: '0960000001',
      studentName: 'Provisioned Student 1',
    });

    const approveResult = await gdkd.finance.receiptApprove({ receiptId: receipt.id });
    expect(approveResult.provisioning).toBe('ok');

    const student = await testDbBypass((tx) =>
      tx.student.findUnique({ where: { createdByReceiptId: receipt.id } }),
    );
    expect(student).not.toBeNull();
    expect(student!.facilityId).toBe(facility.id);

    const parentAccount = await testDb().parentAccount.findUnique({
      where: { phone: normalizeLoginPhone('0960000001') },
    });
    expect(parentAccount).not.toBeNull();

    const studentAccount = await testDb().studentAccount.findUnique({ where: { studentId: student!.id } });
    expect(studentAccount).not.toBeNull();
    expect(studentAccount!.parentAccountId).toBe(parentAccount!.id);

    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirst({ where: { studentId: student!.id, classBatchId: classBatch.id } }),
    );
    expect(enrollment).not.toBeNull();
    expect(enrollment!.status).toBe('active');
  });

  it('does not roll back the money transaction when provisioning fails, and recovers idempotently on retry', async () => {
    const receipt = await draftAndCreateReceipt({
      contactPhone: '0950000002',
      parentPhone: '0960000002',
      studentName: 'Provisioned Student 2',
    });

    // Force a provisioning failure by stripping classBatchId directly
    // (bypassing the receiptCreate business rule) — provisioning cannot
    // activate an enrollment without knowing the class.
    await testDbBypass((tx) => tx.receipt.update({ where: { id: receipt.id }, data: { classBatchId: null } }));

    const approveResult = await gdkd.finance.receiptApprove({ receiptId: receipt.id });
    expect(approveResult.provisioning).toBe('pending');
    expect(approveResult.receipt.status).toBe('approved');
    expect(approveResult.receipt.netAmount).toBe(5_000_000);

    const persisted = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(persisted.status).toBe('approved');
    expect(persisted.netAmount.toNumber()).toBe(5_000_000);

    const retryMarker = await testDb().auditLog.findFirst({
      where: { entity: 'Receipt', entityId: receipt.id, action: 'provisioning.retry_pending' },
    });
    expect(retryMarker).not.toBeNull();

    // ParentAccount/Student were already created before the failing step;
    // retrying with a fixed classBatchId must not duplicate them.
    const parentAccountBeforeRetry = await testDb().parentAccount.findUnique({
      where: { phone: normalizeLoginPhone('0960000002') },
    });
    expect(parentAccountBeforeRetry).not.toBeNull();

    await testDbBypass((tx) =>
      tx.receipt.update({ where: { id: receipt.id }, data: { classBatchId: classBatch.id } }),
    );
    const retried = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone: receipt.parentPhone,
      studentName: receipt.studentName,
      classBatchId: classBatch.id,
    });
    expect(retried.parentAccountId).toBe(parentAccountBeforeRetry!.id);

    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findUniqueOrThrow({ where: { id: retried.enrollmentId } }),
    );
    expect(enrollment.status).toBe('active');

    const studentCount = await testDbBypass((tx) =>
      tx.student.count({ where: { createdByReceiptId: receipt.id } }),
    );
    expect(studentCount).toBe(1);
  });

  it('is idempotent: calling provisionFromReceipt twice for the same receipt creates no duplicates', async () => {
    const parentPhone = '0960000003';
    phonesToClean.push(parentPhone);
    const receipt = await createRawApprovedReceipt({
      parentPhone,
      studentName: 'Replay Student',
      classBatchId: classBatch.id,
    });

    const receiptForProvisioning = {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone,
      studentName: receipt.studentName,
      classBatchId: receipt.classBatchId,
    };

    const first = await provisionFromReceipt(testDb(), receiptForProvisioning);
    const second = await provisionFromReceipt(testDb(), receiptForProvisioning);

    expect(second.parentAccountId).toBe(first.parentAccountId);
    expect(second.studentId).toBe(first.studentId);
    expect(second.studentAccountId).toBe(first.studentAccountId);
    expect(second.enrollmentId).toBe(first.enrollmentId);

    expect(await testDb().parentAccount.count({ where: { phone: normalizeLoginPhone(parentPhone) } })).toBe(1);
    expect(await testDbBypass((tx) => tx.student.count({ where: { createdByReceiptId: receipt.id } }))).toBe(1);
    expect(await testDb().studentAccount.count({ where: { studentId: first.studentId } })).toBe(1);
    expect(
      await testDbBypass((tx) =>
        tx.enrollment.count({ where: { studentId: first.studentId, classBatchId: classBatch.id } }),
      ),
    ).toBe(1);
  });

  it('resolves a race on a brand-new phone (two children provisioned concurrently) to exactly one ParentAccount', async () => {
    const parentPhone = '0960000004';
    phonesToClean.push(parentPhone);

    const [receiptA, receiptB] = await Promise.all([
      createRawApprovedReceipt({ parentPhone, studentName: 'Sibling A', classBatchId: classBatch.id }),
      createRawApprovedReceipt({ parentPhone, studentName: 'Sibling B', classBatchId: classBatch.id }),
    ]);

    const [resultA, resultB] = await Promise.all([
      provisionFromReceipt(testDb(), {
        id: receiptA.id,
        facilityId: facility.id,
        parentPhone,
        studentName: receiptA.studentName,
        classBatchId: receiptA.classBatchId,
      }),
      provisionFromReceipt(testDb(), {
        id: receiptB.id,
        facilityId: facility.id,
        parentPhone,
        studentName: receiptB.studentName,
        classBatchId: receiptB.classBatchId,
      }),
    ]);

    expect(resultA.parentAccountId).toBe(resultB.parentAccountId);
    expect(resultA.studentId).not.toBe(resultB.studentId);

    const parentAccountCount = await testDb().parentAccount.count({
      where: { phone: normalizeLoginPhone(parentPhone) },
    });
    expect(parentAccountCount).toBe(1);
  });

  it('resolves a race when the SAME receipt is provisioned concurrently (Student + StudentAccount P2002 recovery)', async () => {
    const parentPhone = '0960000005';
    phonesToClean.push(parentPhone);
    const receipt = await createRawApprovedReceipt({
      parentPhone,
      studentName: 'Concurrent Same-Receipt Student',
      classBatchId: classBatch.id,
    });

    const receiptForProvisioning = {
      id: receipt.id,
      facilityId: facility.id,
      parentPhone,
      studentName: receipt.studentName,
      classBatchId: receipt.classBatchId,
    };

    // Both calls target the same receipt -> same `createdByReceiptId` (Student)
    // and same `studentId` (StudentAccount): exercises the P2002-and-refetch
    // recovery paths on both, not just the ParentAccount race above.
    const [first, second] = await Promise.all([
      provisionFromReceipt(testDb(), receiptForProvisioning),
      provisionFromReceipt(testDb(), receiptForProvisioning),
    ]);

    expect(first.studentId).toBe(second.studentId);
    expect(first.studentAccountId).toBe(second.studentAccountId);
    expect(
      await testDbBypass((tx) => tx.student.count({ where: { createdByReceiptId: receipt.id } })),
    ).toBe(1);
    expect(await testDb().studentAccount.count({ where: { studentId: first.studentId } })).toBe(1);
  });
});
