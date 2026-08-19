// Test backfill (gap-closure 260710-0005 Phase 3): parentAccount.updateEmail
// — PII mutation. Registry roster (packages/auth/src/index.ts):
// 'parentAccount.updateEmail' → giam_doc_kinh_doanh, sale. Covers: correct
// roster happy-path, role FORBIDDEN, facility-scope via Guardian link
// (NOT_FOUND for a parent with no approved child in the caller facility),
// email-uniqueness CONFLICT, and the audit log write.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedGuardianLink,
  seedParentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('parentAccount.updateEmail (test backfill)', () => {
  let facility: { id: string };
  let sale: Caller;
  let teacher: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('ParentAccount UpdateEmail Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-pa-1', roles: ['sale'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-pa-1', roles: ['giao_vien'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  async function seedParentWithApprovedChild(phone: string) {
    phonesToClean.push(phone);
    const parent = await seedParentAccount(phone);
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'UpdateEmail Test Student' } }),
    );
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parent.id,
      studentId: student.id,
      status: 'approved',
    });
    return parent;
  }

  it('sets the email and writes an audit log entry', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParentWithApprovedChild(phone);
    const email = `parent-${randomUUID().slice(0, 8)}@test.com`;

    const updated = await sale.parentAccount.updateEmail({ parentAccountId: parent.id, email });
    expect(updated.email).toBe(email);

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'ParentAccount', entityId: parent.id, action: 'parentAccount.updateEmail' },
    });
    expect(audit).not.toBeNull();

    const event = await testDb().recordEvent.findFirst({
      where: { entity: 'ParentAccount', entityId: parent.id, kind: 'email_updated' },
    });
    expect(event).not.toBeNull();
    expect(event?.payload).toBeNull();
  });
  it('rejects a duplicate email already used by another ParentAccount (CONFLICT)', async () => {
    const phoneA = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const phoneB = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parentA = await seedParentWithApprovedChild(phoneA);
    const parentB = await seedParentWithApprovedChild(phoneB);
    const sharedEmail = `shared-${randomUUID().slice(0, 8)}@test.com`;
    await sale.parentAccount.updateEmail({ parentAccountId: parentA.id, email: sharedEmail });

    await expect(
      sale.parentAccount.updateEmail({ parentAccountId: parentB.id, email: sharedEmail }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('NOT_FOUND: parent has no approved Guardian link in the caller facility', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    phonesToClean.push(phone);
    const parent = await seedParentAccount(phone); // no Guardian link at all

    await expect(
      sale.parentAccount.updateEmail({ parentAccountId: parent.id, email: 'orphan@test.com' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('forbids a role without parentAccount.updateEmail permission', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParentWithApprovedChild(phone);

    await expect(
      teacher.parentAccount.updateEmail({ parentAccountId: parent.id, email: 'blocked@test.com' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
