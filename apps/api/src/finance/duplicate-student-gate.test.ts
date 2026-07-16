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

  describe('H3 TOCTOU (post-implementation hardening): the gate only sees PROVISIONED students', () => {
    it('two receipts for the same brand-new phone, both created before either is approved, converge to ONE Student on approval (no confirmNewStudent)', async () => {
      const phone = '0994000006';
      phonesToClean.push(phone);

      // Both receipts see existingStudents=[] at create time (correct per PO
      // gate design — neither Student exists yet, since Student is only ever
      // created at approve/provisioning time) — so both legitimately pass as
      // 'new', exactly the TOCTOU window H3 describes.
      const first = await sale.finance.receiptCreate({
        studentName: 'Bé TOCTOU Một',
        parentPhone: phone,
        amount: 4_000_000,
        classBatchId: classBatch.id,
      });
      expect(first.status).toBe('success');
      if (first.status !== 'success') throw new Error('expected success');

      // Soft dup-phone warning (existing draft receipt for this phone) still
      // fires here — it does NOT block, unlike the provisioned-student gate.
      const second = await sale.finance.receiptCreate({
        studentName: 'Bé TOCTOU Một', // same sale, forgot to disambiguate — realistic
        parentPhone: phone,
        amount: 4_000_000,
        classBatchId: classBatch.id,
      });
      if (second.status !== 'success' && second.status !== 'warning') {
        throw new Error(`expected success or warning, got ${second.status}`);
      }

      await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
      await gdkd.finance.receiptApprove({ receiptId: second.receipt.id });

      const studentCount = await testDbBypass((tx) =>
        tx.student.count({ where: { facilityId: facility.id, fullName: 'Bé TOCTOU Một' } }),
      );
      expect(studentCount).toBe(1); // provisioning-time dedup reused the same Student

      const firstStudent = await testDbBypass((tx) =>
        tx.student.findUniqueOrThrow({ where: { createdByReceiptId: first.receipt.id } }),
      );
      const guardianCount = await testDbBypass((tx) =>
        tx.guardian.count({ where: { studentId: firstStudent.id } }),
      );
      expect(guardianCount).toBe(1); // second approval reused the Guardian too (idempotent find-or-create)
    });

    it('confirmNewStudent:true on the SECOND receipt still creates a genuinely different sibling, even under the TOCTOU window', async () => {
      const phone = '0994000007';
      phonesToClean.push(phone);

      const first = await sale.finance.receiptCreate({
        studentName: 'Bé TOCTOU Anh',
        parentPhone: phone,
        amount: 4_000_000,
        classBatchId: classBatch.id,
      });
      expect(first.status).toBe('success');
      if (first.status !== 'success') throw new Error('expected success');

      const second = await sale.finance.receiptCreate({
        studentName: 'Bé TOCTOU Em',
        parentPhone: phone,
        amount: 4_000_000,
        classBatchId: classBatch.id,
        confirmNewStudent: true,
      });
      if (second.status !== 'success' && second.status !== 'warning') {
        throw new Error(`expected success or warning, got ${second.status}`);
      }

      await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
      await gdkd.finance.receiptApprove({ receiptId: second.receipt.id });

      const studentCount = await testDbBypass((tx) => tx.student.count({ where: { facilityId: facility.id } }));
      expect(studentCount).toBe(2); // confirmNewStudent must never be silently overridden by the reuse fix
    });
  });
});
