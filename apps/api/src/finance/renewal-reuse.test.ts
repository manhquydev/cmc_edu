// H3 remediation integration test: a renewal receipt carrying an explicit
// `studentId` reuses the existing Student instead of provisioning a new one
// (no fragmented child history / no headcount inflation), while a fresh
// active Enrollment is still activated for the new class.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance.receiptCreate renewal reuse (H3)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let classBatchOne: { id: string };
  let classBatchTwo: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Renewal Reuse Facility');
    classBatchOne = await seedClassBatch({ facilityId: facility.id });
    classBatchTwo = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-renew-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-renew-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  it('reuses the existing Student for a renewal receipt (no duplicate child), and activates a new active Enrollment for the new class', async () => {
    const parentPhone = '0993000001';
    phonesToClean.push(parentPhone);

    // First receipt: creates the Student (new, no studentId supplied).
    const firstReceipt = await sale.finance.receiptCreate({
      studentName: 'Renewal Student',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatchOne.id,
    });
    const firstApproved = await gdkd.finance.receiptApprove({ receiptId: firstReceipt.receipt.id });
    expect(firstApproved.provisioning).toBe('ok');

    const student = await testDbBypass((tx) =>
      tx.student.findUniqueOrThrow({ where: { createdByReceiptId: firstReceipt.receipt.id } }),
    );

    // Renewal receipt: same student (explicit studentId), a DIFFERENT class.
    const renewalReceipt = await sale.finance.receiptCreate({
      studentId: student.id,
      studentName: 'Renewal Student',
      parentPhone,
      amount: 6_000_000,
      classBatchId: classBatchTwo.id,
    });
    const renewalApproved = await gdkd.finance.receiptApprove({ receiptId: renewalReceipt.receipt.id });
    expect(renewalApproved.provisioning).toBe('ok');

    // No duplicate Student was created for this child.
    const studentCount = await testDbBypass((tx) =>
      tx.student.count({ where: { facilityId: facility.id, fullName: 'Renewal Student' } }),
    );
    expect(studentCount).toBe(1);

    // A new active Enrollment exists for the new class, for the SAME student.
    const newEnrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirstOrThrow({ where: { studentId: student.id, classBatchId: classBatchTwo.id } }),
    );
    expect(newEnrollment.status).toBe('active');

    // The original enrollment (first class) is untouched.
    const originalEnrollment = await testDbBypass((tx) =>
      tx.enrollment.findFirstOrThrow({ where: { studentId: student.id, classBatchId: classBatchOne.id } }),
    );
    expect(originalEnrollment.status).toBe('active');
  });

  it('rejects a renewal receipt naming a studentId that does not exist in this facility', async () => {
    await expect(
      sale.finance.receiptCreate({
        studentId: '00000000-0000-0000-0000-000000000000',
        studentName: 'Ghost Student',
        parentPhone: '0993000002',
        amount: 5_000_000,
        classBatchId: classBatchOne.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
