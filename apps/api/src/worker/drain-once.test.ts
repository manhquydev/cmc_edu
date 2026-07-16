// Post-implementation hardening (H2): `reconcileCancelledButProvisioned`
// (the C1 "layer 2 backstop", `reconcile-orphaned-receipts.ts`) was built and
// unit-tested by calling it directly, but `drainOnce` — the function the real
// worker process actually runs on a timer — never called it. The backstop was
// therefore dead code in production. This test proves the wiring by driving
// the SAME bad state the backstop's own direct-call test uses, but through
// `drainOnce` itself (the real production entrypoint), never calling
// `reconcileCancelledButProvisioned` directly.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drainOnce } from './index.js';
import { cleanupFacility, createTestFacility, seedClassBatch, testDb, testDbBypass } from '../test/db.js';

describe('drainOnce wiring (post-implementation hardening H2)', () => {
  let facility: { id: string };
  let classBatch: { id: string };

  beforeEach(async () => {
    facility = await createTestFacility('DrainOnce Wiring Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('withdraws a stray active Enrollment left on a cancelled receipt — proves reconcileCancelledButProvisioned runs inside drainOnce, not just when called directly', async () => {
    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `H2-DRAIN-${randomUUID().slice(0, 8).toUpperCase()}`,
          parentPhone: '0990000099',
          studentName: 'Drain Wiring Student',
          classBatchId: classBatch.id,
          netAmount: 5_000_000,
          status: 'cancelled',
          createdById: 'test-seed',
        },
      }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({
        data: { facilityId: facility.id, fullName: 'Drain Wiring Student', createdByReceiptId: receipt.id },
      }),
    );
    const enrollment = await testDbBypass((tx) =>
      tx.enrollment.create({
        data: { facilityId: facility.id, studentId: student.id, classBatchId: classBatch.id, status: 'active' },
      }),
    );

    await drainOnce(testDb());

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
  });
});
