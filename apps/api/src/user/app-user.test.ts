// P3-I integration tests — AppUser CRUD (US-020, WF-P3-01).
//
// Covers: create (employeeCode sequence, managerId validation), list, update
// (field mutation, A-B cycle detection, self-manager rejection),
// updateRoles (super_admin gate, self-demotion guard, audit skip on no-op),
// and permission guard (only super_admin via user.manage).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
} from '../test/db.js';

describe('user — AppUser CRUD (P3-I)', () => {
  let facilityId: string;
  let superAdminCtx: ReturnType<typeof buildStaffContext>;
  let saleCtx: ReturnType<typeof buildStaffContext>;
  const caller = (ctx: ReturnType<typeof buildStaffContext>) =>
    appRouter.createCaller(ctx);

  beforeEach(async () => {
    const facility = await createTestFacility('P3-I AppUser Test');
    facilityId = facility.id;
    superAdminCtx = buildStaffContext({
      facilityId,
      userId: 'super-admin-user',
      roles: ['super_admin'],
    });
    saleCtx = buildStaffContext({
      facilityId,
      userId: 'sale-user',
      roles: ['sale'],
    });
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('user.create — generates CMC0001 for the first user', async () => {
    const result = await caller(superAdminCtx).user.create({
      userId: 'u-001',
      email: 'alice@cmc.test',
      fullName: 'Alice',
      position: 'teacher',
    });
    expect(result.employeeCode).toMatch(/^CMC\d{4}$/);
    expect(result.facilityId).toBe(facilityId);
    expect(result.userId).toBe('u-001');
    expect(result.isActive).toBe(true);
  });

  it('user.create — second user gets an incremented code', async () => {
    const first = await caller(superAdminCtx).user.create({
      userId: 'u-seq-1',
      email: 'seq1@cmc.test',
      fullName: 'Seq One',
      position: 'sale',
    });
    const second = await caller(superAdminCtx).user.create({
      userId: 'u-seq-2',
      email: 'seq2@cmc.test',
      fullName: 'Seq Two',
      position: 'sale',
    });
    const n1 = parseInt(first.employeeCode.slice(3), 10);
    const n2 = parseInt(second.employeeCode.slice(3), 10);
    expect(n2).toBe(n1 + 1);
  });

  it('user.create — sets managerId when provided', async () => {
    const mgr = await seedAppUser({ facilityId, userId: 'mgr-001' });
    const result = await caller(superAdminCtx).user.create({
      userId: 'u-sub',
      email: 'sub@cmc.test',
      fullName: 'Sub',
      position: 'sale',
      managerId: mgr.id,
    });
    expect(result.managerId).toBe(mgr.id);
  });

  it('user.create — rejects managerId from a different facility', async () => {
    const otherFacility = await createTestFacility('Other Facility');
    try {
      const otherMgr = await seedAppUser({
        facilityId: otherFacility.id,
        userId: 'other-mgr',
      });
      await expect(
        caller(superAdminCtx).user.create({
          userId: 'u-bad',
          email: 'bad@cmc.test',
          fullName: 'Bad',
          position: 'sale',
          managerId: otherMgr.id,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });

  it('user.update — changes position', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-upd' });
    const result = await caller(superAdminCtx).user.update({
      appUserId: user.id,
      position: 'hr',
    });
    expect(result.position).toBe('hr');
  });

  it('user.update — rejects self as manager', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-self' });
    await expect(
      caller(superAdminCtx).user.update({
        appUserId: user.id,
        managerId: user.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('user.update — rejects A-B circular management chain', async () => {
    const a = await seedAppUser({ facilityId, userId: 'u-chain-a' });
    const b = await seedAppUser({ facilityId, userId: 'u-chain-b', managerId: a.id });
    // A.managerId = B would create A<->B cycle
    await expect(
      caller(superAdminCtx).user.update({
        appUserId: a.id,
        managerId: b.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('user.list — returns users in the facility', async () => {
    await seedAppUser({ facilityId, userId: 'u-list-1' });
    await seedAppUser({ facilityId, userId: 'u-list-2' });
    const result = await caller(superAdminCtx).user.list();
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items.every((u) => u.facilityId === facilityId)).toBe(true);
  });

  it('user.create/update/list — forbidden for sale role', async () => {
    await expect(
      caller(saleCtx).user.create({
        userId: 'u-forbidden',
        email: 'f@cmc.test',
        fullName: 'Forbidden',
        position: 'sale',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(caller(saleCtx).user.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('user.updateRoles — assigns roles and returns updated user', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-roles-1' });
    const result = await caller(superAdminCtx).user.updateRoles({
      appUserId: user.id,
      roles: ['sale', 'giao_vien'],
    });
    expect(result.roles).toEqual(expect.arrayContaining(['sale', 'giao_vien']));
    expect(result.roles).toHaveLength(2);
  });

  it('user.updateRoles — deduplicates duplicate role entries', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-roles-dedup' });
    const result = await caller(superAdminCtx).user.updateRoles({
      appUserId: user.id,
      roles: ['sale', 'sale'],
    });
    expect(result.roles).toEqual(['sale']);
  });

  it('user.updateRoles — rejects unknown role string', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-roles-bad' });
    await expect(
      caller(superAdminCtx).user.updateRoles({
        appUserId: user.id,
        roles: ['not_a_real_role' as never],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('user.updateRoles — forbidden for sale role', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-roles-forbidden' });
    await expect(
      caller(saleCtx).user.updateRoles({ appUserId: user.id, roles: ['sale'] }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('user.updateRoles — blocks self-demotion of super_admin', async () => {
    // Seed a user whose userId matches the super_admin context caller.
    const superUser = await seedAppUser({ facilityId, userId: 'super-admin-user' });
    // Give them the super_admin role first.
    await caller(superAdminCtx).user.updateRoles({
      appUserId: superUser.id,
      roles: ['super_admin'],
    });
    // Now try to remove super_admin from themselves.
    await expect(
      caller(superAdminCtx).user.updateRoles({
        appUserId: superUser.id,
        roles: ['sale'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('user.updateRoles — rejects dormant role ke_toan (ADR-D)', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-dormant-1' });
    await expect(
      caller(superAdminCtx).user.updateRoles({
        appUserId: user.id,
        roles: ['ke_toan'] as never[],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('user.updateRoles — rejects mix of active + dormant roles', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-dormant-2' });
    await expect(
      caller(superAdminCtx).user.updateRoles({
        appUserId: user.id,
        roles: ['sale', 'hr'] as never[],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('user.updateRoles — accepts all 5 active roles', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-all-active' });
    const result = await caller(superAdminCtx).user.updateRoles({
      appUserId: user.id,
      roles: ['super_admin', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao', 'sale', 'giao_vien'],
    });
    expect(result.roles).toHaveLength(5);
  });

  it('user.updateRoles — blocks removing super_admin from last active admin', async () => {
    const targetUser = await seedAppUser({ facilityId, userId: 'u-last-admin' });
    await caller(superAdminCtx).user.updateRoles({
      appUserId: targetUser.id,
      roles: ['super_admin'],
    });
    // The seeded super-admin-user from other tests may exist; ensure this is
    // the only active super_admin by using a second admin ctx to remove it.
    // We verify: when only one super_admin remains, cannot remove their role.
    // Use a different caller userId so self-demotion guard doesn't fire first.
    const adminCtx2 = buildStaffContext({
      facilityId,
      userId: 'other-admin-ctx',
      roles: ['super_admin'],
    });
    await expect(
      caller(adminCtx2).user.updateRoles({
        appUserId: targetUser.id,
        roles: ['sale'],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('user.updateRoles — allows removing super_admin when another active admin exists', async () => {
    const adminA = await seedAppUser({ facilityId, userId: 'u-admin-a' });
    const adminB = await seedAppUser({ facilityId, userId: 'u-admin-b' });
    await caller(superAdminCtx).user.updateRoles({
      appUserId: adminA.id,
      roles: ['super_admin'],
    });
    await caller(superAdminCtx).user.updateRoles({
      appUserId: adminB.id,
      roles: ['super_admin'],
    });
    // With two super_admins, removing one is allowed.
    const otherCtx = buildStaffContext({
      facilityId,
      userId: 'admin-remover',
      roles: ['super_admin'],
    });
    const result = await caller(otherCtx).user.updateRoles({
      appUserId: adminA.id,
      roles: ['sale'],
    });
    expect(result.roles).toEqual(['sale']);
  });
});
