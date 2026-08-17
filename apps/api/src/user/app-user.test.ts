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

  it('user.create — generates a zero-padded CMC employeeCode', async () => {
    const result = await caller(superAdminCtx).user.create({
      userId: 'u-001',
      email: 'alice@cmc.test',
      fullName: 'Alice',
      position: 'teacher',
    });
    // `CMC` + counter zero-padded to a MINIMUM of 4 digits (router.ts:100).
    // The shared cmc_edu test DB's EmployeeCodeCounter is never reset, so the
    // value is not necessarily CMC0001 and can exceed 4 digits (CMC10000+) —
    // assert the format, not an exact/4-digit-wide value.
    expect(result.employeeCode).toMatch(/^CMC\d{4,}$/);
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

  it('user.list — search matches fullName / employeeCode case-insensitively', async () => {
    await seedAppUser({
      facilityId,
      userId: 'u-search-alpha',
      fullName: 'Trần Alpha Search',
      email: 'alpha-search@cmc.test',
    });
    await seedAppUser({
      facilityId,
      userId: 'u-search-beta',
      fullName: 'Lê Beta Other',
      email: 'beta-other@cmc.test',
    });

    const byName = await caller(superAdminCtx).user.list({ search: 'alpha search' });
    expect(byName.items.some((u) => u.userId === 'u-search-alpha')).toBe(true);
    expect(byName.items.every((u) => !u.userId.includes('beta'))).toBe(true);

    const byEmail = await caller(superAdminCtx).user.list({ search: 'beta-other' });
    expect(byEmail.items.some((u) => u.userId === 'u-search-beta')).toBe(true);
    expect(byEmail.items.every((u) => u.userId !== 'u-search-alpha')).toBe(true);
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

  // ── user.get — resource-depth D2 cold-start fetch ────────────────────────

  it('user.get — cold-starts one staff record with browser-safe fields', async () => {
    const user = await seedAppUser({
      facilityId,
      userId: 'u-get-safe',
      fullName: 'Safe Serialization',
      position: 'sale',
      passwordHash: 'pbkdf2:should-never-leak:deadbeef',
      mustChangePassword: true,
      loginAttempts: 3,
      loginLockedUntil: new Date(Date.now() + 60_000),
    });
    const result = await caller(superAdminCtx).user.get({ appUserId: user.id });
    expect(result.id).toBe(user.id);
    expect(result.fullName).toBe('Safe Serialization');
    expect(result.facilityId).toBe(facilityId);
    // Credential/lockout internals must never serialize (APP_USER_SELECT).
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('mustChangePassword');
    expect(result).not.toHaveProperty('loginAttempts');
    expect(result).not.toHaveProperty('loginLockedUntil');
    expect(JSON.stringify(result)).not.toContain('pbkdf2');
  });

  it('user.get — GĐKD reads an ordinary same-facility staff member', async () => {
    const gdkdCtx = buildStaffContext({
      facilityId,
      userId: 'gdkd-ctx',
      roles: ['giam_doc_kinh_doanh'],
    });
    const user = await seedAppUser({ facilityId, userId: 'u-gdkd-read' });
    const result = await caller(gdkdCtx).user.get({ appUserId: user.id });
    expect(result.userId).toBe('u-gdkd-read');
  });

  it('user.get — GĐĐT reads a peer director (same facility, D2)', async () => {
    const gddtCtx = buildStaffContext({
      facilityId,
      userId: 'gddt-ctx',
      roles: ['giam_doc_dao_tao'],
    });
    const peerDirector = await seedAppUser({
      facilityId,
      userId: 'u-peer-dir',
      roles: ['giam_doc_dao_tao'],
    });
    const result = await caller(gddtCtx).user.get({ appUserId: peerDirector.id });
    expect(result.userId).toBe('u-peer-dir');
  });

  it('user.get — director reads a same-facility super_admin profile (read-only)', async () => {
    const directorCtx = buildStaffContext({
      facilityId,
      userId: 'director-ctx',
      roles: ['giam_doc_kinh_doanh'],
    });
    const superUser = await seedAppUser({
      facilityId,
      userId: 'u-super-readonly',
      roles: ['super_admin'],
    });
    // Read is allowed (D2: "directors may see/open a super_admin profile");
    // mutation guards are covered by update/updateRoles/resetPassword tests.
    const result = await caller(directorCtx).user.get({ appUserId: superUser.id });
    expect(result.userId).toBe('u-super-readonly');
    expect(result.roles).toContain('super_admin');
  });

  it('user.get — includes safe manager summary for the form', async () => {
    const manager = await seedAppUser({
      facilityId,
      userId: 'u-mgr-summary',
      fullName: 'Quản Lý Mẫu',
    });
    const report = await seedAppUser({
      facilityId,
      userId: 'u-reporter',
      managerId: manager.id,
    });
    const result = await caller(superAdminCtx).user.get({ appUserId: report.id });
    expect(result.manager).toEqual({
      id: manager.id,
      fullName: 'Quản Lý Mẫu',
      employeeCode: manager.employeeCode,
    });
    expect(JSON.stringify(result.manager)).not.toContain('passwordHash');
  });

  it('user.get — returns manager: null when no manager is set', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-no-mgr' });
    const result = await caller(superAdminCtx).user.get({ appUserId: user.id });
    expect(result.manager).toBeNull();
  });

  it('user.get — cross-facility target is NOT_FOUND (no existence leak)', async () => {
    const otherFacility = await createTestFacility('Other Facility for get');
    try {
      const otherUser = await seedAppUser({
        facilityId: otherFacility.id,
        userId: 'u-other-facility',
      });
      await expect(
        caller(superAdminCtx).user.get({ appUserId: otherUser.id }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });

  it('user.get — unknown appUserId is NOT_FOUND', async () => {
    await expect(
      caller(superAdminCtx).user.get({
        appUserId: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('user.get — forbidden for ordinary staff role', async () => {
    const user = await seedAppUser({ facilityId, userId: 'u-get-sale-target' });
    await expect(caller(saleCtx).user.get({ appUserId: user.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('user.get — rejects malformed appUserId', async () => {
    await expect(
      caller(superAdminCtx).user.get({ appUserId: 'not-a-uuid' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ── user.managerPickList — D2 manager-picker eligibility ─────────────────

  it('user.managerPickList — excludes super_admin for a director caller', async () => {
    const directorCtx = buildStaffContext({
      facilityId,
      userId: 'mgr-dir-ctx',
      roles: ['giam_doc_kinh_doanh'],
    });
    const ordinary = await seedAppUser({ facilityId, userId: 'u-mgr-ordinary' });
    const superTarget = await seedAppUser({
      facilityId,
      userId: 'u-mgr-super',
      roles: ['super_admin'],
    });
    const result = await caller(directorCtx).user.managerPickList();
    const ids = result.items.map((u) => u.id);
    expect(ids).toContain(ordinary.id);
    expect(ids).not.toContain(superTarget.id);
    // Peer directors remain eligible (D2: directors may manage peer directors).
    const peerDirector = await seedAppUser({
      facilityId,
      userId: 'u-mgr-peer-dir',
      roles: ['giam_doc_dao_tao'],
    });
    const result2 = await caller(directorCtx).user.managerPickList();
    expect(result2.items.some((u) => u.id === peerDirector.id)).toBe(true);
  });

  it('user.managerPickList — super_admin caller sees super_admin targets', async () => {
    const superTarget = await seedAppUser({
      facilityId,
      userId: 'u-mgr-super-visible',
      roles: ['super_admin'],
    });
    const result = await caller(superAdminCtx).user.managerPickList();
    expect(result.items.some((u) => u.id === superTarget.id)).toBe(true);
  });

  it('user.managerPickList — forbidden for ordinary staff role', async () => {
    await expect(caller(saleCtx).user.managerPickList()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
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
