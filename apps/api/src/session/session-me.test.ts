// Phase-01a: session.me — client-side mirror of staff session identity.
// Verifies it returns userId, roles, facilityId, and the approval threshold.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { APPROVAL_SECOND_EYE_THRESHOLD } from '../finance/router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, seedAppUser, testDb } from '../test/db.js';
import type { Context } from '../trpc.js';

describe('session.me (phase-01a M5)', () => {
  let facility: { id: string };

  beforeEach(async () => {
    facility = await createTestFacility('Session Me Facility');
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('returns userId, roles, facilityId, and approvalSecondEyeThreshold', async () => {
    const caller = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-me-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    const me = await caller.session.me();
    expect(me.userId).toBe('gdkd-me-1');
    expect(me.roles).toContain('giam_doc_kinh_doanh');
    expect(me.facilityId).toBe(facility.id);
    expect(me.config.approvalSecondEyeThreshold).toBe(APPROVAL_SECOND_EYE_THRESHOLD);
    expect(me.mustChangePassword).toBe(false);
  });

  it('reflects different roles for a different caller', async () => {
    const caller = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-me-1', roles: ['giam_doc_dao_tao', 'super_admin'] }),
    );
    const me = await caller.session.me();
    expect(me.roles).toContain('giam_doc_dao_tao');
    expect(me.roles).toContain('super_admin');
  });

  it('rejects an unauthenticated caller (no staff subject)', async () => {
    const anonymousContext: Context = {
      subject: null,
      facilityId: null,
      lmsSubject: null,
      db: testDb(),
      ip: null,
    };
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.session.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a staff caller with no resolved facility context', async () => {
    const noFacilityContext: Context = {
      subject: { userId: 'no-facility-me-1', roles: ['sale'] },
      facilityId: null,
      lmsSubject: null,
      db: testDb(),
      ip: null,
    };
    const caller = appRouter.createCaller(noFacilityContext);
    await expect(caller.session.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns mustChangePassword from the AppUser row', async () => {
    await seedAppUser({
      facilityId: facility.id,
      userId: 'mcp-true-1',
      roles: ['sale'],
      mustChangePassword: true,
    });
    const forced = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'mcp-true-1', roles: ['sale'] }),
    );
    expect((await forced.session.me()).mustChangePassword).toBe(true);

    await seedAppUser({
      facilityId: facility.id,
      userId: 'mcp-false-1',
      roles: ['sale'],
      mustChangePassword: false,
    });
    const current = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'mcp-false-1', roles: ['sale'] }),
    );
    expect((await current.session.me()).mustChangePassword).toBe(false);
  });
});
