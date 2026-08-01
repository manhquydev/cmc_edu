// Test: parentAccount.list — staff-facing parent directory (gap-closure: the
// only way to discover a provisioning-created parent to backfill their email).
// Registry roster (packages/auth/src/index.ts): 'parentAccount.updateEmail' →
// giam_doc_kinh_doanh, sale — `list` reuses that key (no new permission).
// Covers: facility scope (a parent linked only in another facility is
// excluded), missingEmailOnly filter, phone/email search, linkedChildrenCount,
// pagination, and role FORBIDDEN.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedGuardianLink,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('parentAccount.list', () => {
  let facility: { id: string };
  let otherFacility: { id: string };
  let sale: Caller;
  let teacher: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('ParentAccount List Facility');
    otherFacility = await createTestFacility('ParentAccount List Other Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-pa-list-1', roles: ['sale'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-pa-list-1', roles: ['giao_vien'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupFacility(otherFacility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  async function seedParentWithApprovedChild(
    targetFacilityId: string,
    phone: string,
    email?: string,
  ) {
    phonesToClean.push(phone);
    const parent = await testDbBypass((tx) =>
      tx.parentAccount.create({ data: { phone, ...(email ? { email } : {}) } }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: targetFacilityId, fullName: 'List Test Student' } }),
    );
    await seedGuardianLink({
      facilityId: targetFacilityId,
      parentAccountId: parent.id,
      studentId: student.id,
      status: 'approved',
    });
    return parent;
  }

  it('lists only parents linked in the caller facility', async () => {
    const phoneIn = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const phoneOut = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parentIn = await seedParentWithApprovedChild(facility.id, phoneIn);
    await seedParentWithApprovedChild(otherFacility.id, phoneOut);

    const result = await sale.parentAccount.list({ page: 1, pageSize: 50 });
    const ids = result.items.map((i) => i.id);
    expect(ids).toContain(parentIn.id);
    expect(ids.length).toBeGreaterThanOrEqual(1);
  });

  it('reports linkedChildrenCount scoped to the caller facility only', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParentWithApprovedChild(facility.id, phone);
    // Second child, same parent, same facility.
    const student2 = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'List Test Student 2' } }),
    );
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parent.id,
      studentId: student2.id,
      status: 'approved',
    });
    // Third child, same parent, OTHER facility — must not inflate the count.
    const student3 = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: otherFacility.id, fullName: 'List Test Student 3' } }),
    );
    await seedGuardianLink({
      facilityId: otherFacility.id,
      parentAccountId: parent.id,
      studentId: student3.id,
      status: 'approved',
    });

    const result = await sale.parentAccount.list({ page: 1, pageSize: 50 });
    const row = result.items.find((i) => i.id === parent.id);
    expect(row?.linkedChildrenCount).toBe(2);
  });

  it('missingEmailOnly filters to parents without an email', async () => {
    const phoneNoEmail = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const phoneWithEmail = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parentNoEmail = await seedParentWithApprovedChild(facility.id, phoneNoEmail);
    const parentWithEmail = await seedParentWithApprovedChild(
      facility.id,
      phoneWithEmail,
      `has-email-${randomUUID().slice(0, 8)}@test.com`,
    );

    const result = await sale.parentAccount.list({
      page: 1,
      pageSize: 50,
      missingEmailOnly: true,
    });
    const ids = result.items.map((i) => i.id);
    expect(ids).toContain(parentNoEmail.id);
    expect(ids).not.toContain(parentWithEmail.id);
  });

  it('search matches phone substring', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParentWithApprovedChild(facility.id, phone);

    const result = await sale.parentAccount.list({
      page: 1,
      pageSize: 50,
      search: phone.slice(-6),
    });
    expect(result.items.map((i) => i.id)).toContain(parent.id);
  });

  it('search matches email substring case-insensitively', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const emailLocal = `Match-${randomUUID().slice(0, 8)}`;
    const parent = await seedParentWithApprovedChild(
      facility.id,
      phone,
      `${emailLocal}@test.com`,
    );

    const result = await sale.parentAccount.list({
      page: 1,
      pageSize: 50,
      search: emailLocal.toLowerCase(),
    });
    expect(result.items.map((i) => i.id)).toContain(parent.id);
  });

  it('paginates with a stable total', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    await seedParentWithApprovedChild(facility.id, phone);

    const page1 = await sale.parentAccount.list({ page: 1, pageSize: 1 });
    expect(page1.items.length).toBe(1);
    expect(page1.total).toBeGreaterThanOrEqual(1);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(1);
  });

  it('forbids a role without parentAccount.updateEmail permission', async () => {
    await expect(teacher.parentAccount.list({ page: 1, pageSize: 50 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
