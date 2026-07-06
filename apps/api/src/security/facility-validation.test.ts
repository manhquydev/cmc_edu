// requireValidFacility boundary test (K7 remediation, deep-review
// consolidated report): a staff session whose facilityId does not correspond
// to a real `Facility` row must be rejected before any facility-scoped query
// runs — otherwise a forged/typo'd `x-dev-user.facilityId` header (or, later,
// a bad SSO claim) silently "mints" an invisible tenant that RLS happily
// partitions by forever, with no admin surface able to see or reconcile it.

import { describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('requireValidFacility (K7)', () => {
  it('rejects a request whose facilityId does not correspond to any Facility row', async () => {
    const ghost: Caller = appRouter.createCaller(
      buildStaffContext({
        facilityId: 'ghost-facility-does-not-exist',
        userId: 'ghost-user',
        roles: ['sale'],
      }),
    );

    await expect(ghost.crm.opportunityList({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('accepts a request whose facilityId is a real, persisted Facility', async () => {
    const facility = await createTestFacility('Facility Validation Real Facility');
    const caller: Caller = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'real-user', roles: ['sale'] }),
    );

    await expect(caller.crm.opportunityList({})).resolves.toMatchObject({ page: 1, pageSize: 20 });

    await cleanupFacility(facility.id);
  });
});
