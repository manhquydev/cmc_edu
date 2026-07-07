// Phase-01a: session.me — client-side mirror of staff session identity.
// Verifies it returns userId, roles, facilityId, and the approval threshold.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { APPROVAL_SECOND_EYE_THRESHOLD } from '../finance/router.js';
import { buildStaffContext, cleanupFacility, createTestFacility } from '../test/db.js';

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
  });

  it('reflects different roles for a different caller', async () => {
    const caller = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-me-1', roles: ['giam_doc_dao_tao', 'super_admin'] }),
    );
    const me = await caller.session.me();
    expect(me.roles).toContain('giam_doc_dao_tao');
    expect(me.roles).toContain('super_admin');
  });
});
