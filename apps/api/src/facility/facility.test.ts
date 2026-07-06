// facility.create / facility.list integration tests (K7 remediation, deep-
// review consolidated report): before this file, the product had no writer
// for `Facility` at all — grep found zero create/list procedures. Covers:
// the super_admin-only gate (every other role, including the broadest
// business roles, is FORBIDDEN) and list pagination.

import { afterEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, createTestFacility, testDb } from '../test/db.js';

describe('facility.create / facility.list (K7)', () => {
  const facilityIdsToDelete: string[] = [];

  afterEach(async () => {
    if (facilityIdsToDelete.length > 0) {
      await testDb().facility.deleteMany({ where: { id: { in: facilityIdsToDelete } } });
      facilityIdsToDelete.length = 0;
    }
  });

  it('super_admin can create a facility, and the row is actually persisted', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap Create');
    facilityIdsToDelete.push(bootstrap.id);
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'admin-facility-1', roles: ['super_admin'] }),
    );

    const created = await admin.facility.create({ name: 'Facility Created By Test' });
    facilityIdsToDelete.push(created.id);
    expect(created.name).toBe('Facility Created By Test');

    const persisted = await testDb().facility.findUniqueOrThrow({ where: { id: created.id } });
    expect(persisted.name).toBe('Facility Created By Test');
  });

  it('a non-super_admin role (even GĐKD, the broadest business role) is FORBIDDEN', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap GDKD');
    facilityIdsToDelete.push(bootstrap.id);
    const gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'gdkd-facility-1', roles: ['giam_doc_kinh_doanh'] }),
    );

    await expect(gdkd.facility.create({ name: 'Should Not Be Created' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('R2: super_admin bootstraps the very first facility — an unknown/bootstrap facilityId does not block facility.create', async () => {
    // No `createTestFacility` call here on purpose: this reproduces the
    // chicken-and-egg bootstrap deadlock (R2, deep-review adversarial
    // verification) — a super_admin session referencing a facilityId that
    // does NOT correspond to any real Facility row (there may be none on a
    // clean DB) must still be able to call `facility.create`, since
    // `requireValidFacility` (../trpc.ts) now bypasses its existence check
    // for `super_admin` sessions.
    const bootstrapAdmin = appRouter.createCaller(
      buildStaffContext({ facilityId: 'bootstrap-no-such-facility-yet', userId: 'admin-facility-bootstrap', roles: ['super_admin'] }),
    );

    const created = await bootstrapAdmin.facility.create({ name: 'Facility Bootstrapped By Super Admin' });
    facilityIdsToDelete.push(created.id);
    expect(created.name).toBe('Facility Bootstrapped By Super Admin');

    const persisted = await testDb().facility.findUniqueOrThrow({ where: { id: created.id } });
    expect(persisted.name).toBe('Facility Bootstrapped By Super Admin');
  });

  it('R2: a non-super_admin with an unknown facilityId is still rejected (the bypass is super_admin-only)', async () => {
    const ghost = appRouter.createCaller(
      buildStaffContext({ facilityId: 'ghost-facility-does-not-exist-r2', userId: 'gdkd-facility-bootstrap', roles: ['giam_doc_kinh_doanh'] }),
    );

    await expect(ghost.facility.create({ name: 'Should Not Be Created' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('facility.list paginates and is super_admin only', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap List');
    facilityIdsToDelete.push(bootstrap.id);
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'admin-facility-2', roles: ['super_admin'] }),
    );
    const sale = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'sale-facility-1', roles: ['sale'] }),
    );

    const { items, total, page, pageSize } = await admin.facility.list({ page: 1, pageSize: 5 });
    expect(page).toBe(1);
    expect(pageSize).toBe(5);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(total).toBeGreaterThanOrEqual(1);

    await expect(sale.facility.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
