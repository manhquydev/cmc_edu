// TDD: parentAccount.get — cold-start /admin/parents/:id
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

describe('parentAccount.get', () => {
  let facility: { id: string };
  let otherFacility: { id: string };
  let sale: ReturnType<(typeof appRouter)['createCaller']>;
  let teacher: ReturnType<(typeof appRouter)['createCaller']>;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('ParentAccount Get Facility');
    otherFacility = await createTestFacility('ParentAccount Get Other');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-pa-get-1', roles: ['sale'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'teacher-pa-get-1',
        roles: ['giao_vien'],
      }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupFacility(otherFacility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  async function seedParent(targetFacilityId: string, phone: string, email?: string) {
    phonesToClean.push(phone);
    const parent = await testDbBypass((tx) =>
      tx.parentAccount.create({ data: { phone, ...(email ? { email } : {}) } }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({
        data: { facilityId: targetFacilityId, fullName: 'Get Test Student' },
      }),
    );
    await seedGuardianLink({
      facilityId: targetFacilityId,
      parentAccountId: parent.id,
      studentId: student.id,
      status: 'approved',
    });
    return parent;
  }

  it('returns parent with children in facility', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParent(facility.id, phone, 'get@example.com');

    const row = await sale.parentAccount.get({ parentAccountId: parent.id });
    expect(row.id).toBe(parent.id);
    expect(row.email).toBe('get@example.com');
    expect(row.linkedChildrenCount).toBe(1);
    expect(row.children).toHaveLength(1);
    expect(row.children[0]!.studentName).toBe('Get Test Student');
  });

  it('unknown / other-facility parent → NOT_FOUND', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParent(otherFacility.id, phone);

    await expect(
      sale.parentAccount.get({ parentAccountId: parent.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      sale.parentAccount.get({
        parentAccountId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('forbids role without parentAccount.updateEmail', async () => {
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParent(facility.id, phone);
    await expect(
      teacher.parentAccount.get({ parentAccountId: parent.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
