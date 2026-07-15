// C1 remediation (scenario audit, 2026-07-15): closes a race window where
// `finance.receiptCancel` can flip a Receipt to `cancelled` after the money
// transaction commits but before provisioning's enrollment step runs — the
// old code let provisioning finish on a stale `approved` snapshot, granting
// an active Enrollment (and therefore LMS login) for a receipt that had
// already been cancelled/refunded. Guard: `activateEnrollmentForReceipt`
// re-reads `Receipt.status` under `SELECT ... FOR UPDATE`, in the SAME
// transaction as the enrollment write — `receiptCancel`'s own atomic claim
// (`updateMany WHERE status='approved'`) holds the same row lock, so the two
// serialize instead of racing.
//
// A true concurrent race is hard to construct deterministically in vitest
// (both sides would need a controllable pause mid-transaction) — this test
// covers the guard directly: a receipt already `cancelled` by the time the
// enrollment step runs must abort, never create the Enrollment.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  activateEnrollmentForReceipt,
  ReceiptNoLongerApprovedError,
} from '../enrollment/activate-enrollment.js';
import { reconcileCancelledButProvisioned } from '../worker/reconcile-orphaned-receipts.js';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedClassBatch,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('C1: receiptCancel race vs provisioning enrollment step', () => {
  let facility: { id: string };
  let classBatch: { id: string };
  let gdkd: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('C1 Race Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-c1-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  /** A receipt row in `cancelled` status — simulates `receiptCancel` having
   * already won the race by the time provisioning's enrollment step runs. */
  async function seedCancelledReceipt() {
    return testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `C1-RACE-${randomUUID().slice(0, 8).toUpperCase()}`,
          parentPhone: '0990000001',
          studentName: 'Race Student',
          classBatchId: classBatch.id,
          netAmount: 5_000_000,
          status: 'cancelled',
          createdById: 'test-seed',
        },
      }),
    );
  }

  it('aborts and does NOT create an Enrollment when the receipt is no longer approved', async () => {
    const receipt = await seedCancelledReceipt();
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Race Student' } }),
    );

    await expect(
      activateEnrollmentForReceipt(testDb(), {
        facilityId: facility.id,
        studentId: student.id,
        classBatchId: classBatch.id,
        receiptId: receipt.id,
      }),
    ).rejects.toThrow(ReceiptNoLongerApprovedError);

    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirst({ where: { studentId: student.id, classBatchId: classBatch.id } }),
    );
    expect(enrollment).toBeNull();
  });

  it('still activates the enrollment normally when the receipt IS approved (no false positives)', async () => {
    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `C1-OK-${randomUUID().slice(0, 8).toUpperCase()}`,
          parentPhone: '0990000002',
          studentName: 'Happy Path Student',
          classBatchId: classBatch.id,
          netAmount: 5_000_000,
          status: 'approved',
          createdById: 'test-seed',
        },
      }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Happy Path Student' } }),
    );

    const enrollment = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facility.id,
      studentId: student.id,
      classBatchId: classBatch.id,
      receiptId: receipt.id,
    });

    expect(enrollment.status).toBe('active');
  });

  it('under real concurrency, a cancel racing provisioning never leaves a cancelled receipt with an active Enrollment', async () => {
    // Pre-approve via direct DB write — the exact handoff state
    // `finance.receiptApprove` gives provisioning after its money
    // transaction commits. `student.createdByReceiptId` is set so
    // `receiptCancel`'s own withdraw logic can find the student, same as the
    // real flow.
    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `C1-CONC-${randomUUID().slice(0, 8).toUpperCase()}`,
          parentPhone: '0990000004',
          studentName: 'Concurrent Race Student',
          classBatchId: classBatch.id,
          netAmount: 5_000_000,
          status: 'approved',
          createdById: 'test-seed',
        },
      }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({
        data: { facilityId: facility.id, fullName: 'Concurrent Race Student', createdByReceiptId: receipt.id },
      }),
    );

    // Fire both sides concurrently: whichever transaction wins the row lock
    // on the Receipt first, the other must observe the outcome consistently
    // — this is the invariant the FOR UPDATE pairing protects, not "which
    // call succeeds" (same aggregate-invariant style as the H6 concurrent
    // cancel test in cancel-refund.test.ts).
    await Promise.allSettled([
      activateEnrollmentForReceipt(testDb(), {
        facilityId: facility.id,
        studentId: student.id,
        classBatchId: classBatch.id,
        receiptId: receipt.id,
      }),
      gdkd.finance.receiptCancel({ receiptId: receipt.id, reason: 'concurrent race' }),
    ]);

    const finalReceipt = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirst({ where: { studentId: student.id, classBatchId: classBatch.id } }),
    );

    expect(finalReceipt.status).toBe('cancelled');
    // Invariant: a cancelled receipt must never leave an ACTIVE enrollment
    // behind, regardless of which side of the race committed first.
    if (enrollment) {
      expect(enrollment.status).not.toBe('active');
    }
  });

  describe('reconcileCancelledButProvisioned (layer 2 backstop)', () => {
    it('withdraws a stray active Enrollment left on a cancelled receipt and raises a ReconciliationFlag', async () => {
      // Construct the exact bad state layer 1 prevents going forward — a
      // cancelled receipt whose resolved student still has an ACTIVE
      // enrollment for that receipt's classBatchId (as if it slipped through
      // before the guard existed).
      const receipt = await testDbBypass((tx) =>
        tx.receipt.create({
          data: {
            facilityId: facility.id,
            code: `C1-RECON-${randomUUID().slice(0, 8).toUpperCase()}`,
            parentPhone: '0990000005',
            studentName: 'Slipped Through Student',
            classBatchId: classBatch.id,
            netAmount: 5_000_000,
            status: 'cancelled',
            createdById: 'test-seed',
          },
        }),
      );
      const student = await testDbBypass((tx) =>
        tx.student.create({
          data: { facilityId: facility.id, fullName: 'Slipped Through Student', createdByReceiptId: receipt.id },
        }),
      );
      const enrollment = await testDbBypass((tx) =>
        tx.enrollment.create({
          data: { facilityId: facility.id, studentId: student.id, classBatchId: classBatch.id, status: 'active' },
        }),
      );

      const outcomes = await reconcileCancelledButProvisioned(testDb());

      const outcome = outcomes.find((o) => o.receiptId === receipt.id);
      expect(outcome).toBeDefined();
      expect(outcome?.enrollmentId).toBe(enrollment.id);
      expect(outcome?.flagCreated).toBe(true);

      const updatedEnrollment = await testDbBypass((tx) =>
        tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
      );
      expect(updatedEnrollment.status).toBe('withdrawn');

      const flag = await testDbBypass((tx) =>
        tx.reconciliationFlag.findFirst({
          where: { facilityId: facility.id, receiptId: receipt.id, kind: 'cancelled_receipt_active_enrollment' },
        }),
      );
      expect(flag).not.toBeNull();
      expect(flag?.status).toBe('open');
    });

    it('is a no-op for a cancelled receipt with no lingering active Enrollment (already withdrawn normally)', async () => {
      const receipt = await testDbBypass((tx) =>
        tx.receipt.create({
          data: {
            facilityId: facility.id,
            code: `C1-RECON-CLEAN-${randomUUID().slice(0, 8).toUpperCase()}`,
            parentPhone: '0990000006',
            studentName: 'Clean Cancel Student',
            classBatchId: classBatch.id,
            netAmount: 5_000_000,
            status: 'cancelled',
            createdById: 'test-seed',
          },
        }),
      );
      const student = await testDbBypass((tx) =>
        tx.student.create({
          data: { facilityId: facility.id, fullName: 'Clean Cancel Student', createdByReceiptId: receipt.id },
        }),
      );
      await testDbBypass((tx) =>
        tx.enrollment.create({
          data: { facilityId: facility.id, studentId: student.id, classBatchId: classBatch.id, status: 'withdrawn' },
        }),
      );

      const outcomes = await reconcileCancelledButProvisioned(testDb());

      expect(outcomes.find((o) => o.receiptId === receipt.id)).toBeUndefined();
    });
  });
});
