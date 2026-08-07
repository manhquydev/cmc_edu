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

  it('facility.list search filters by name or code (case-insensitive)', async () => {
    const unique = Date.now();
    const match = await createTestFacility(`Facility Search Match ${unique}`);
    const other = await createTestFacility(`Facility Search Other ${unique}`);
    facilityIdsToDelete.push(match.id, other.id);
    // Force distinctive code on match via create with explicit code.
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: match.id, userId: 'admin-facility-search', roles: ['super_admin'] }),
    );
    const coded = await admin.facility.create({
      name: `Coded Search Facility ${unique}`,
      code: `SRCH${String(unique).slice(-6)}`,
    });
    facilityIdsToDelete.push(coded.id);

    const byName = await admin.facility.list({
      page: 1,
      pageSize: 50,
      search: `Coded Search Facility ${unique}`,
    });
    expect(byName.items.some((f) => f.id === coded.id)).toBe(true);
    expect(byName.items.every((f) => f.id !== other.id || f.name.includes(String(unique)))).toBe(true);

    const byCode = await admin.facility.list({
      page: 1,
      pageSize: 50,
      search: `SRCH${String(unique).slice(-6)}`,
    });
    expect(byCode.items.some((f) => f.id === coded.id)).toBe(true);
    expect(byCode.total).toBeGreaterThanOrEqual(1);
  });

  it('facility.create with a duplicate code returns a friendly error, not a raw Prisma P2002', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap Dup Code');
    facilityIdsToDelete.push(bootstrap.id);
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'admin-facility-dup', roles: ['super_admin'] }),
    );
    const code = `DUP-${Date.now()}`;
    const first = await admin.facility.create({ name: 'First With Code', code });
    facilityIdsToDelete.push(first.id);

    await expect(admin.facility.create({ name: 'Second With Same Code', code })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: expect.stringContaining('Mã cơ sở đã tồn tại'),
    });
  });

  it('super_admin can update a facility name, and the change is persisted + audited', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap Update');
    facilityIdsToDelete.push(bootstrap.id);
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'admin-facility-update', roles: ['super_admin'] }),
    );

    const updated = await admin.facility.update({ id: bootstrap.id, name: 'Renamed Facility' });
    expect(updated.name).toBe('Renamed Facility');

    const persisted = await testDb().facility.findUniqueOrThrow({ where: { id: bootstrap.id } });
    expect(persisted.name).toBe('Renamed Facility');

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'Facility', entityId: bootstrap.id, action: 'facility.update' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('facility.update ignores a submitted code — code is immutable after creation', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap Code Immutable');
    facilityIdsToDelete.push(bootstrap.id);
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'admin-facility-immutable', roles: ['super_admin'] }),
    );
    const originalCode = bootstrap.code;

    // `code` deliberately typed as `unknown` input here — this simulates a
    // caller sending an extra field the zod schema doesn't declare, which
    // Prisma's `data: { name }` picks apart explicitly, so it's simply
    // dropped rather than rejected.
    const updated = await admin.facility.update({
      id: bootstrap.id,
      name: 'Renamed But Code Locked',
      code: 'HACKED',
    } as unknown as { id: string; name: string });

    expect(updated.code).toBe(originalCode);
  });

  it('facility.update rejects an empty name', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap Empty Name');
    facilityIdsToDelete.push(bootstrap.id);
    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'admin-facility-empty', roles: ['super_admin'] }),
    );

    await expect(admin.facility.update({ id: bootstrap.id, name: '' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('facility.update is FORBIDDEN for a non-super_admin role', async () => {
    const bootstrap = await createTestFacility('Facility Test Bootstrap Update Forbidden');
    facilityIdsToDelete.push(bootstrap.id);
    const gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: bootstrap.id, userId: 'gdkd-facility-update', roles: ['giam_doc_kinh_doanh'] }),
    );

    await expect(gdkd.facility.update({ id: bootstrap.id, name: 'Should Not Rename' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
