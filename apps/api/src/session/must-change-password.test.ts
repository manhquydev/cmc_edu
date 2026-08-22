// Staff mustChangePassword is a server gate on protectedProcedure.
// session.me and user.changeOwnPassword stay reachable so the user can rotate.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { hashPassword } from '../lms-auth/password-hash.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
} from '../test/db.js';

const OLD_PASSWORD = 'old-password-value-1';
const NEW_PASSWORD = 'new-password-value-2';

describe('staff mustChangePassword gate', () => {
  let facilityId: string;

  beforeEach(async () => {
    facilityId = (await createTestFacility('Staff MCP Gate')).id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('forbids product APIs until changeOwnPassword clears the flag', async () => {
    const suffix = randomUUID().slice(0, 8);
    const userId = `mcp-gate-${suffix}`;
    await seedAppUser({
      facilityId,
      userId,
      email: `${userId}@test.cmc`,
      roles: ['super_admin'],
      passwordHash: hashPassword(OLD_PASSWORD),
      mustChangePassword: true,
    });
    const caller = appRouter.createCaller(
      buildStaffContext({ facilityId, userId, roles: ['super_admin'] }),
    );

    await expect(caller.facility.list({ page: 1, pageSize: 20 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Password change required before proceeding.',
    });

    const me = await caller.session.me();
    expect(me.mustChangePassword).toBe(true);

    await expect(
      caller.user.changeOwnPassword({
        currentPassword: OLD_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).resolves.toEqual({ ok: true });

    expect((await caller.session.me()).mustChangePassword).toBe(false);
    await expect(caller.facility.list({ page: 1, pageSize: 20 })).resolves.toMatchObject({
      page: 1,
      pageSize: 20,
    });
  });
});
