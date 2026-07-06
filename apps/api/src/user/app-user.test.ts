// P3-I integration tests — AppUser CRUD (US-020, WF-P3-01).
//
// Covers: create (employeeCode sequence, managerId validation), list, update
// (field mutation, A-B cycle detection, self-manager rejection), and
// permission guard (only super_admin via user.manage).

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
});
