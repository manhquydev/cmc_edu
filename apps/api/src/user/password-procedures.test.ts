// Integration tests for staff password management procedures:
// user.resetPassword (admin provisions a temp password, forces rotation) and
// user.changeOwnPassword (staff rotates their own, clears the force flag).

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { hashPassword, verifyPassword } from '../lms-auth/password-hash.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

const OLD_PASSWORD = 'old-password-value-1';
const NEW_PASSWORD = 'new-password-value-2';
const TEMP_PASSWORD = 'temp-password-value-3';

function uniqueUser(): { userId: string; email: string } {
  const suffix = randomUUID().slice(0, 8);
  return { userId: `pwproc-${suffix}`, email: `pwproc-${suffix}@test.cmc` };
}

describe('user password procedures (integration)', () => {
  let facilityId: string;

  beforeEach(async () => {
    const facility = await createTestFacility('PW Procedures Test');
    facilityId = facility.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  const superAdminCaller = () =>
    appRouter.createCaller(
      buildStaffContext({ facilityId, userId: 'pwproc-admin', roles: ['super_admin'] }),
    );

  it('resetPassword — sets temp hash, forces rotation, clears lockout', async () => {
    const target = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId: target.userId,
      email: target.email,
      loginAttempts: 4,
      loginLockedUntil: new Date(Date.now() + 60_000),
    });

    const result = await superAdminCaller().user.resetPassword({
      appUserId: seeded.id,
      tempPassword: TEMP_PASSWORD,
    });
    expect(result).toEqual({ ok: true });

    const row = await testDbBypass((tx) =>
      tx.appUser.findUniqueOrThrow({ where: { id: seeded.id } }),
    );
    expect(row.passwordHash).not.toBeNull();
    expect(verifyPassword(TEMP_PASSWORD, row.passwordHash!)).toBe(true);
    expect(row.mustChangePassword).toBe(true);
    expect(row.loginAttempts).toBe(0);
    expect(row.loginLockedUntil).toBeNull();
  });

  it('resetPassword — audit row exists and never contains the temp password', async () => {
    const target = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId: target.userId,
      email: target.email,
    });

    await superAdminCaller().user.resetPassword({
      appUserId: seeded.id,
      tempPassword: TEMP_PASSWORD,
    });

    const audit = await testDbBypass((tx) =>
      tx.auditLog.findFirst({
        where: { action: 'user.resetPassword', entityId: seeded.id },
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(TEMP_PASSWORD);
  });

  it('resetPassword — rejected for a role without user.manage', async () => {
    const target = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId: target.userId,
      email: target.email,
    });
    const saleCaller = appRouter.createCaller(
      buildStaffContext({ facilityId, userId: 'pwproc-sale', roles: ['sale'] }),
    );

    await expect(
      saleCaller.user.resetPassword({ appUserId: seeded.id, tempPassword: TEMP_PASSWORD }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('resetPassword — refuses an account with no login email', async () => {
    const target = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId: target.userId,
      email: '',
    });

    await expect(
      superAdminCaller().user.resetPassword({ appUserId: seeded.id, tempPassword: TEMP_PASSWORD }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('resetPassword — cannot reach a target in another facility', async () => {
    const other = await createTestFacility('PW Other Facility');
    try {
      const target = uniqueUser();
      const seeded = await seedAppUser({
        facilityId: other.id,
        userId: target.userId,
        email: target.email,
      });

      await expect(
        superAdminCaller().user.resetPassword({
          appUserId: seeded.id,
          tempPassword: TEMP_PASSWORD,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      await cleanupFacility(other.id);
    }
  });

  it('changeOwnPassword — verifies current, sets new, clears the force flag', async () => {
    const me = uniqueUser();
    const seeded = await seedAppUser({
      facilityId,
      userId: me.userId,
      email: me.email,
      roles: ['sale'],
      passwordHash: hashPassword(OLD_PASSWORD),
      mustChangePassword: true,
    });
    const caller = appRouter.createCaller(
      buildStaffContext({ facilityId, userId: me.userId, roles: ['sale'] }),
    );

    const result = await caller.user.changeOwnPassword({
      currentPassword: OLD_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(result).toEqual({ ok: true });

    const row = await testDbBypass((tx) =>
      tx.appUser.findUniqueOrThrow({ where: { id: seeded.id } }),
    );
    expect(verifyPassword(NEW_PASSWORD, row.passwordHash!)).toBe(true);
    expect(verifyPassword(OLD_PASSWORD, row.passwordHash!)).toBe(false);
    expect(row.mustChangePassword).toBe(false);
  });

  it('changeOwnPassword — rejects a wrong current password', async () => {
    const me = uniqueUser();
    await seedAppUser({
      facilityId,
      userId: me.userId,
      email: me.email,
      roles: ['sale'],
      passwordHash: hashPassword(OLD_PASSWORD),
    });
    const caller = appRouter.createCaller(
      buildStaffContext({ facilityId, userId: me.userId, roles: ['sale'] }),
    );

    await expect(
      caller.user.changeOwnPassword({
        currentPassword: 'not-the-password-9',
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('changeOwnPassword — rejects an account without password login', async () => {
    const me = uniqueUser();
    await seedAppUser({ facilityId, userId: me.userId, email: me.email, roles: ['sale'] });
    const caller = appRouter.createCaller(
      buildStaffContext({ facilityId, userId: me.userId, roles: ['sale'] }),
    );

    await expect(
      caller.user.changeOwnPassword({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
