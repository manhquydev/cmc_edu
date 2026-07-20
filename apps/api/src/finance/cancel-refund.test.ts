// WF-P1-08 integration tests: receipt cancel / refund (money-critical).
// Covers I3 (cancel reverts O5 -> O4 + clears closedAt ONLY when this
// receipt is the sole approved receipt that advanced the opportunity), I5
// (refund append-only ledger, SUM(refund) <= netAmount under `FOR UPDATE`),
// the approved-only precondition on both mutations, sale FORBIDDEN on
// cancel (same money-gate permission as receiptApprove), and the
// void-vs-genuine-refund StudentLifecycle split (QĐ 0024).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
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

describe('finance.receiptCancel / finance.refundCreate (WF-P1-08)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let classBatch: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Cancel-Refund Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-cr-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-cr-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  /** Draft a receipt through the full O1..O4 -> receiptCreate flow. */
  async function draftReceipt(
    creator: Caller,
    opts: { contactPhone: string; parentPhone: string; amount?: number; classBatchId?: string; opportunityId?: string },
  ) {
    let opportunityId = opts.opportunityId;
    if (!opportunityId) {
      const opp = await creator.crm.opportunityCreate({ contactName: 'Contact ' + opts.contactPhone, phone: opts.contactPhone });
      await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
      await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O3_TEST_SCHEDULED' });
      await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });
      opportunityId = opp.id;
    }

    phonesToClean.push(opts.parentPhone);
    const result = await creator.finance.receiptCreate({
      opportunityId,
      studentName: 'Student for ' + opts.parentPhone,
      parentPhone: opts.parentPhone,
      amount: opts.amount ?? 5_000_000,
      classBatchId: opts.classBatchId ?? classBatch.id,
    });
    if (result.status === 'needs_confirmation') {
      throw new Error(`draftReceipt: phone ${opts.parentPhone} needs disambiguation — this helper caller must pass a fresh phone`);
    }
    return { opportunityId, receipt: result.receipt };
  }

  /** Draft + approve in one step. */
  async function draftAndApprove(
    opts: { contactPhone: string; parentPhone: string; amount?: number; classBatchId?: string; opportunityId?: string },
  ) {
    const { opportunityId, receipt } = await draftReceipt(sale, opts);
    const approved = await gdkd.finance.receiptApprove({ receiptId: receipt.id });
    return { opportunityId, receipt: approved.receipt };
  }

  describe('receiptCancel', () => {
    it('reverts O5 -> O4 + clears closedAt when this is the sole approved receipt — I3', async () => {
      const { opportunityId, receipt } = await draftAndApprove({
        contactPhone: '0970000001',
        parentPhone: '0980000001',
      });

      const result = await gdkd.finance.receiptCancel({ receiptId: receipt.id, reason: 'test cancel' });

      expect(result.opportunityReverted).toBe(true);
      const opportunity = await testDbBypass((tx) =>
        tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }),
      );
      expect(opportunity.stage).toBe('O4_TESTED');
      expect(opportunity.closedAt).toBeNull();

      const cancelled = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
      expect(cancelled.status).toBe('cancelled');
    });

    it('does NOT revert when a second approved receipt still exists on the same opportunity — I3', async () => {
      const { opportunityId, receipt: firstReceipt } = await draftAndApprove({
        contactPhone: '0970000002',
        parentPhone: '0980000002',
      });
      await draftAndApprove({
        contactPhone: '0970000002',
        parentPhone: '0980000012',
        classBatchId: classBatch.id,
        opportunityId,
      });

      const result = await gdkd.finance.receiptCancel({ receiptId: firstReceipt.id, reason: 'test cancel' });

      expect(result.opportunityReverted).toBe(false);
      const opportunity = await testDbBypass((tx) =>
        tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }),
      );
      expect(opportunity.stage).toBe('O5_ENROLLED');
      expect(opportunity.closedAt).not.toBeNull();
    });

    it('cancel of an auto-created walk-in O5 receipt reverts the opportunity O5 -> O4, no error (phase-05)', async () => {
      const parentPhone = '0980000050';
      phonesToClean.push(parentPhone);
      const created = await sale.finance.receiptCreate({
        studentName: 'Walkin Cancel Kid',
        parentPhone,
        amount: 5_000_000,
        classBatchId: classBatch.id,
      });
      if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
      await gdkd.finance.receiptApprove({ receiptId: created.receipt.id });

      const linked = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: created.receipt.id } }));
      expect(linked.opportunityId).not.toBeNull();

      const result = await gdkd.finance.receiptCancel({ receiptId: created.receipt.id, reason: 'walk-in cancel' });
      expect(result.opportunityReverted).toBe(true);

      const opp = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: linked.opportunityId! } }));
      expect(opp.stage).toBe('O4_TESTED'); // reverted from the auto-created O5
    });

    it('forbids sale from cancelling (same money-gate permission as receiptApprove)', async () => {
      const { receipt } = await draftAndApprove({ contactPhone: '0970000003', parentPhone: '0980000003' });

      await expect(sale.finance.receiptCancel({ receiptId: receipt.id, reason: 'nope' })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('rejects cancelling a non-approved receipt (still draft)', async () => {
      const { receipt } = await draftReceipt(sale, { contactPhone: '0970000004', parentPhone: '0980000004' });

      await expect(gdkd.finance.receiptCancel({ receiptId: receipt.id, reason: 'nope' })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });

    it('void:true archives/withdraws Student + Enrollment', async () => {
      const { receipt } = await draftAndApprove({ contactPhone: '0970000005', parentPhone: '0980000005' });
      const student = await testDbBypass((tx) =>
        tx.student.findUniqueOrThrow({ where: { createdByReceiptId: receipt.id } }),
      );

      const result = await gdkd.finance.receiptCancel({
        receiptId: receipt.id,
        reason: 'entered by mistake',
        void: true,
      });

      expect(result.studentLifecycle).toBe('withdrawn');
      const updatedStudent = await testDbBypass((tx) => tx.student.findUniqueOrThrow({ where: { id: student.id } }));
      expect(updatedStudent.lifecycle).toBe('withdrawn');
      const enrollment = await testDbBypass((tx) => tx.enrollment.findFirstOrThrow({ where: { studentId: student.id } }));
      expect(enrollment.status).toBe('withdrawn');
    });

    it('keeps a shared enrollment active when cancelling one of two approved receipts covering it — M9', async () => {
      const parentPhone = '0980000020';
      phonesToClean.push(parentPhone);

      const first = await sale.finance.receiptCreate({
        studentName: 'Shared Enrollment Student',
        parentPhone,
        amount: 5_000_000,
        classBatchId: classBatch.id,
      });
      if (first.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
      const firstApproved = await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
      const student = await testDbBypass((tx) =>
        tx.student.findUniqueOrThrow({ where: { createdByReceiptId: first.receipt.id } }),
      );

      // Second receipt: same student (renewal-style reuse) + the SAME class —
      // models a duplicate/erroneous double payment into one class, both approved.
      const second = await sale.finance.receiptCreate({
        studentId: student.id,
        studentName: 'Shared Enrollment Student',
        parentPhone,
        amount: 5_000_000,
        classBatchId: classBatch.id,
      });
      if (second.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
      const secondApproved = await gdkd.finance.receiptApprove({ receiptId: second.receipt.id });

      const enrollment = await testDbBypass((tx) =>
        tx.enrollment.findFirstOrThrow({ where: { studentId: student.id, classBatchId: classBatch.id } }),
      );
      expect(enrollment.status).toBe('active');

      // Cancel the FIRST receipt: the second is still approved and covers the
      // same student+class, so the enrollment must stay active.
      await gdkd.finance.receiptCancel({ receiptId: firstApproved.receipt.id, reason: 'duplicate payment' });
      const afterFirstCancel = await testDbBypass((tx) =>
        tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
      );
      expect(afterFirstCancel.status).toBe('active');

      // Cancel the SECOND (last remaining approved) receipt: now nothing
      // covers the enrollment, so it withdraws.
      await gdkd.finance.receiptCancel({ receiptId: secondApproved.receipt.id, reason: 'duplicate payment' });
      const afterSecondCancel = await testDbBypass((tx) =>
        tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
      );
      expect(afterSecondCancel.status).toBe('withdrawn');
    });

    it('serialises concurrent cancels of the two approved receipts on one opportunity: ends at O4 (reverted exactly once), never stuck at O5 — H6', async () => {
      const { opportunityId, receipt: receiptA } = await draftAndApprove({
        contactPhone: '0970000030',
        parentPhone: '0980000030',
        classBatchId: classBatch.id,
      });
      const { receipt: receiptB } = await draftAndApprove({
        contactPhone: '0970000030',
        parentPhone: '0980000031',
        classBatchId: classBatch.id,
        opportunityId,
      });

      const results = await Promise.allSettled([
        gdkd.finance.receiptCancel({ receiptId: receiptA.id, reason: 'concurrent cancel A' }),
        gdkd.finance.receiptCancel({ receiptId: receiptB.id, reason: 'concurrent cancel B' }),
      ]);
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);

      const fulfilled = results as PromiseFulfilledResult<{ opportunityReverted: boolean }>[];
      const reverts = fulfilled.filter((r) => r.value.opportunityReverted);
      expect(reverts).toHaveLength(1);

      const opportunity = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }));
      expect(opportunity.stage).toBe('O4_TESTED');
      expect(opportunity.closedAt).toBeNull();
    });

    it('non-void (genuine refund/cancel) keeps the Student lifecycle', async () => {
      const { receipt } = await draftAndApprove({ contactPhone: '0970000006', parentPhone: '0980000006' });
      const student = await testDbBypass((tx) =>
        tx.student.findUniqueOrThrow({ where: { createdByReceiptId: receipt.id } }),
      );
      expect(student.lifecycle).toBe('active');

      const result = await gdkd.finance.receiptCancel({ receiptId: receipt.id, reason: 'genuine refund' });

      expect(result.studentLifecycle).toBe('active');
      const updatedStudent = await testDbBypass((tx) => tx.student.findUniqueOrThrow({ where: { id: student.id } }));
      expect(updatedStudent.lifecycle).toBe('active');
      // Enrollment still ends per the explicit WF-P1-05 transition
      // ("active --> withdrawn: rút (WF-P1-08)") regardless of the void flag.
      const enrollment = await testDbBypass((tx) => tx.enrollment.findFirstOrThrow({ where: { studentId: student.id } }));
      expect(enrollment.status).toBe('withdrawn');
    });

    it('K9 REVERSED (scenario audit, PO round 3): a REGULAR cancel keeps LMS visibility — parent still sees the child via enrollment.mine', async () => {
      const parentPhone = '0980000021';
      const { receipt } = await draftAndApprove({ contactPhone: '0970000021', parentPhone });

      const parentAccount = await testDb().parentAccount.findUniqueOrThrow({
        where: { phone: normalizeLoginPhone(parentPhone) },
      });
      const student = await testDbBypass((tx) =>
        tx.student.findUniqueOrThrow({ where: { createdByReceiptId: receipt.id } }),
      );
      const parent = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));

      // Before cancel: provisioning (K1) already created a Guardian row for
      // the paying parent, so the child is visible.
      const mineBeforeCancel = await parent.enrollment.mine();
      expect(mineBeforeCancel.some((e) => e.studentId === student.id)).toBe(true);

      await gdkd.finance.receiptCancel({ receiptId: receipt.id, reason: 'refund, revoke access' });

      // Guardian row still exists (cancel does not delete it) AND
      // Student.lifecycle stays `active` (a regular, non-void cancel) — the
      // read gate (getApprovedChildren) is now keyed purely on
      // Student.lifecycle, not enrollment status, so the parent keeps seeing
      // the child (their history) even though the Enrollment itself withdrew.
      const guardianStillExists = await testDb().guardian.findUnique({
        where: { parentAccountId_studentId: { parentAccountId: parentAccount.id, studentId: student.id } },
      });
      expect(guardianStillExists).not.toBeNull();
      const studentAfterCancel = await testDbBypass((tx) => tx.student.findUniqueOrThrow({ where: { id: student.id } }));
      expect(studentAfterCancel.lifecycle).toBe('active');

      const mineAfterCancel = await parent.enrollment.mine();
      expect(mineAfterCancel.some((e) => e.studentId === student.id)).toBe(true);
    });

    it('void:true cancel DOES revoke LMS visibility — parent no longer sees the child via enrollment.mine', async () => {
      const parentPhone = '0980000022';
      const { receipt } = await draftAndApprove({ contactPhone: '0970000022', parentPhone });

      const parentAccount = await testDb().parentAccount.findUniqueOrThrow({
        where: { phone: normalizeLoginPhone(parentPhone) },
      });
      const student = await testDbBypass((tx) =>
        tx.student.findUniqueOrThrow({ where: { createdByReceiptId: receipt.id } }),
      );
      const parent = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));

      const mineBeforeCancel = await parent.enrollment.mine();
      expect(mineBeforeCancel.some((e) => e.studentId === student.id)).toBe(true);

      await gdkd.finance.receiptCancel({ receiptId: receipt.id, reason: 'entered by mistake', void: true });

      const mineAfterCancel = await parent.enrollment.mine();
      expect(mineAfterCancel.some((e) => e.studentId === student.id)).toBe(false);
    });
  });

  describe('refundCreate', () => {
    it('appends a RefundRecord within cap and returns the remaining balance — I5', async () => {
      const { receipt } = await draftAndApprove({
        contactPhone: '0970000007',
        parentPhone: '0980000007',
        amount: 10_000_000,
      });

      const result = await gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 4_000_000 });

      expect(result.refund.amount).toBe(4_000_000);
      expect(result.remainingBalance).toBe(6_000_000);
      const records = await testDbBypass((tx) => tx.refundRecord.findMany({ where: { receiptId: receipt.id } }));
      expect(records).toHaveLength(1);
    });

    it('rejects a refund that would exceed the remaining cap — I5', async () => {
      const { receipt } = await draftAndApprove({
        contactPhone: '0970000008',
        parentPhone: '0980000008',
        amount: 5_000_000,
      });
      await gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 3_000_000 });

      await expect(
        gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 3_000_000 }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      const records = await testDbBypass((tx) => tx.refundRecord.findMany({ where: { receiptId: receipt.id } }));
      expect(records).toHaveLength(1); // the rejected call never appended a row
    });

    it('requires an approved receipt (rejects refund on a draft receipt)', async () => {
      const { receipt } = await draftReceipt(sale, { contactPhone: '0970000009', parentPhone: '0980000009' });

      await expect(
        gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 1_000_000 }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('is append-only: two valid refunds create two rows, neither mutated', async () => {
      const { receipt } = await draftAndApprove({
        contactPhone: '0970000010',
        parentPhone: '0980000010',
        amount: 10_000_000,
      });

      await gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 2_000_000 });
      await gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 3_000_000 });

      const records = await testDbBypass((tx) =>
        tx.refundRecord.findMany({
          where: { receiptId: receipt.id },
          orderBy: { amount: 'asc' },
        }),
      );
      expect(records).toHaveLength(2);
      expect(records.map((r) => r.amount.toNumber())).toEqual([2_000_000, 3_000_000]);
    });

    it('is idempotent: a repeat refundCreate with the same idempotencyKey returns the same RefundRecord — M4', async () => {
      const { receipt } = await draftAndApprove({
        contactPhone: '0970000012',
        parentPhone: '0980000014',
        amount: 10_000_000,
      });

      const first = await gdkd.finance.refundCreate({
        receiptId: receipt.id,
        amount: 3_000_000,
        idempotencyKey: 'refund-key-1',
      });
      const second = await gdkd.finance.refundCreate({
        receiptId: receipt.id,
        amount: 3_000_000,
        idempotencyKey: 'refund-key-1',
      });

      expect(second.refund.id).toBe(first.refund.id);
      const records = await testDbBypass((tx) => tx.refundRecord.findMany({ where: { receiptId: receipt.id } }));
      expect(records).toHaveLength(1);
    });

    it('two concurrent refunds that together exceed netAmount: exactly one succeeds — FOR UPDATE serialisation', async () => {
      const { receipt } = await draftAndApprove({
        contactPhone: '0970000011',
        parentPhone: '0980000011',
        amount: 10_000_000,
      });

      const results = await Promise.allSettled([
        gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 6_000_000 }),
        gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 6_000_000 }),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('BAD_REQUEST');

      const records = await testDbBypass((tx) => tx.refundRecord.findMany({ where: { receiptId: receipt.id } }));
      const sum = records.reduce((total, r) => total + r.amount.toNumber(), 0);
      expect(sum).toBeLessThanOrEqual(10_000_000);
      expect(records).toHaveLength(1);
    });
  });
});
