// Metric & Data Integrity remediation (scenario audit, PO round 3 — kích
// hoạt MỌI lúc trùng SĐT, không chỉ khác tên): `finance.receiptCreate` now
// BLOCKS (not just soft-warns) when the parent phone already has ≥1 real
// (provisioned) Student in this facility AND the caller did not disambiguate
// via `studentId` (existing child) or `confirmNewStudent: true` (genuinely a
// new child). A phone with zero provisioned students (brand-new family, or a
// bare ParentAccount row with no Guardian/Student — see
// create-from-opp.test.ts's dup-phone-warning case) is never blocked.

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

describe('finance.receiptCreate — duplicate-student confirmation gate (scenario audit, PO round 3)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let classBatch: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Duplicate Student Gate Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-dup-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-dup-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  /** Provisions a real Student for `phone` by drafting + approving a first receipt. */
  async function seedExistingStudentForPhone(phone: string, studentName: string) {
    const first = await sale.finance.receiptCreate({
      studentName,
      parentPhone: phone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (first.status !== 'success') throw new Error('expected the first receipt to succeed (brand-new phone)');
    await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
    return testDbBypass((tx) =>
      tx.student.findUniqueOrThrow({ where: { createdByReceiptId: first.receipt.id } }),
    );
  }

  it('BLOCKS a second receipt for the same phone with a DIFFERENT student name, no studentId, no confirmNewStudent', async () => {
    const phone = '0994000001';
    phonesToClean.push(phone);
    await seedExistingStudentForPhone(phone, 'Bé Một');

    const result = await sale.finance.receiptCreate({
      studentName: 'Bé Hai (con khác)',
      parentPhone: phone,
      amount: 4_000_000,
      classBatchId: classBatch.id,
    });

    expect(result.status).toBe('needs_confirmation');
    if (result.status !== 'needs_confirmation') throw new Error('expected needs_confirmation');
    expect(result.existingStudents.some((s) => s.fullName === 'Bé Một')).toBe(true);
    const studentCount = await testDbBypass((tx) => tx.student.count({ where: { facilityId: facility.id } }));
    expect(studentCount).toBe(1); // no new Student created by the blocked attempt
  });

  it('BLOCKS a second receipt for the same phone even with the SAME student name (PO round-3 expansion — could be 2 real kids sharing a common name, or sale forgot to pick)', async () => {
    const phone = '0994000002';
    phonesToClean.push(phone);
    await seedExistingStudentForPhone(phone, 'Nguyễn Văn A');

    const result = await sale.finance.receiptCreate({
      studentName: 'Nguyễn Văn A', // same name on purpose
      parentPhone: phone,
      amount: 4_000_000,
      classBatchId: classBatch.id,
    });

    expect(result.status).toBe('needs_confirmation');
  });

  it('confirmNewStudent:true creates a genuinely NEW student (kind=new) even though the phone repeats', async () => {
    const phone = '0994000003';
    phonesToClean.push(phone);
    await seedExistingStudentForPhone(phone, 'Bé Anh Cả');

    const result = await sale.finance.receiptCreate({
      studentName: 'Bé Em Út',
      parentPhone: phone,
      amount: 4_000_000,
      classBatchId: classBatch.id,
      confirmNewStudent: true,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('expected success');
    const approved = await gdkd.finance.receiptApprove({ receiptId: result.receipt.id });
    expect(approved.receipt.kind).toBe('new');

    const studentCount = await testDbBypass((tx) => tx.student.count({ where: { facilityId: facility.id } }));
    expect(studentCount).toBe(2); // both siblings now exist as distinct Student rows
  });

  it('studentId of the existing child reuses that student (kind=renewal), bypassing the gate', async () => {
    const phone = '0994000004';
    phonesToClean.push(phone);
    const existing = await seedExistingStudentForPhone(phone, 'Bé Tái Tục');

    const result = await sale.finance.receiptCreate({
      studentId: existing.id,
      studentName: 'Bé Tái Tục',
      parentPhone: phone,
      amount: 4_000_000,
      classBatchId: classBatch.id,
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('expected success');
    const approved = await gdkd.finance.receiptApprove({ receiptId: result.receipt.id });
    expect(approved.receipt.kind).toBe('renewal');

    const studentCount = await testDbBypass((tx) =>
      tx.student.count({ where: { facilityId: facility.id, fullName: 'Bé Tái Tục' } }),
    );
    expect(studentCount).toBe(1); // no duplicate Student
  });

  it('a phone with ZERO existing students (brand-new family) is never blocked', async () => {
    const phone = '0994000005';
    phonesToClean.push(phone);

    const result = await sale.finance.receiptCreate({
      studentName: 'Bé Hoàn Toàn Mới',
      parentPhone: phone,
      amount: 4_000_000,
      classBatchId: classBatch.id,
    });

    expect(result.status).toBe('success');
  });
});
