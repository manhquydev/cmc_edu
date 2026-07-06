// WF-P1-01 integration tests: O1..O4 advance, manual-O5 hard block, lost
// reason requirement + reopen, phone dedup lookup, and RLS across facilities.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('crm opportunity stage machine (WF-P1-01)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let saleA: Caller;
  let saleB: Caller;

  beforeEach(async () => {
    facilityA = await createTestFacility('CRM Facility A');
    facilityB = await createTestFacility('CRM Facility B');
    saleA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'sale-a', roles: ['sale'] }),
    );
    saleB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'sale-b', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('creates an opportunity at O1_LEAD and advances one stage at a time through O4', async () => {
    const created = await saleA.crm.opportunityCreate({ contactName: 'Nguyen Van A', phone: '0900000001' });
    expect(created.stage).toBe('O1_LEAD');

    const toO2 = await saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O2_CONTACTED' });
    expect(toO2.stage).toBe('O2_CONTACTED');

    const toO3 = await saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O3_TEST_SCHEDULED' });
    expect(toO3.stage).toBe('O3_TEST_SCHEDULED');

    const toO4 = await saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O4_TESTED' });
    expect(toO4.stage).toBe('O4_TESTED');
  });

  it('rejects a manual advance to O5_ENROLLED (O5 only comes from finance.receiptApprove)', async () => {
    const created = await saleA.crm.opportunityCreate({ contactName: 'Nguyen Van B', phone: '0900000002' });
    await saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O2_CONTACTED' });
    await saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O3_TEST_SCHEDULED' });
    await saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O4_TESTED' });

    await expect(
      saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O5_ENROLLED' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects skipping stages', async () => {
    const created = await saleA.crm.opportunityCreate({ contactName: 'Nguyen Van Skip', phone: '0900000006' });

    await expect(
      saleA.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O3_TEST_SCHEDULED' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('requires a lostReason to mark an opportunity lost, and supports reopen to O2_CONTACTED', async () => {
    const created = await saleA.crm.opportunityCreate({ contactName: 'Nguyen Van C', phone: '0900000003' });

    await expect(saleA.crm.opportunityMarkLost({ opportunityId: created.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    const lost = await saleA.crm.opportunityMarkLost({
      opportunityId: created.id,
      lostReason: 'no_response',
    });
    expect(lost.closedAt).not.toBeNull();
    expect(lost.lostReason).toBe('no_response');

    const reopened = await saleA.crm.opportunityMarkLost({ opportunityId: created.id, reopen: true });
    expect(reopened.stage).toBe('O2_CONTACTED');
    expect(reopened.closedAt).toBeNull();
    expect(reopened.lostReason).toBeNull();
  });

  it('lookup finds an existing contact by phone for dedup, and reports false for an unknown phone', async () => {
    await saleA.crm.opportunityCreate({ contactName: 'Nguyen Van D', phone: '0900000004' });

    const found = await saleA.crm.opportunityLookup({ phone: '0900000004' });
    expect(found).toEqual({ exists: true });

    const notFound = await saleA.crm.opportunityLookup({ phone: '0900000099' });
    expect(notFound).toEqual({ exists: false });
  });

  it('enforces RLS: a sale in facility B cannot see or advance facility A opportunity', async () => {
    const created = await saleA.crm.opportunityCreate({ contactName: 'Nguyen Van E', phone: '0900000005' });

    await expect(
      saleB.crm.opportunityAdvance({ opportunityId: created.id, toStage: 'O2_CONTACTED' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
