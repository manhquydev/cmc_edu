// WF-P1-01 integration tests: O1..O4 advance, manual-O5 hard block, lost
// reason requirement + reopen, phone dedup lookup, and RLS across facilities.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, testDbBypass } from '../test/db.js';

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

  it('rejects marking an ENROLLED (O5) opportunity lost — undoing an enrollment must go through receiptCancel (phase-02)', async () => {
    // Seed a won opportunity directly: O5 with a closedAt, as finance.receiptApprove
    // leaves it. markLost on it must hard-reject and point at receiptCancel,
    // never stamp a lostReason onto a won row.
    const opp = await testDbBypass(async (tx) => {
      const contact = await tx.contact.create({
        data: { facilityId: facilityA.id, name: 'Enrolled Contact', phone: '0900000010' },
      });
      return tx.opportunity.create({
        data: { facilityId: facilityA.id, contactId: contact.id, stage: 'O5_ENROLLED', closedAt: new Date() },
      });
    });

    await expect(
      saleA.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'other' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    // The row is untouched — still O5, no lostReason.
    const after = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }));
    expect(after.stage).toBe('O5_ENROLLED');
    expect(after.lostReason).toBeNull();
  });

  it('rejects REOPENING an ENROLLED (O5) opportunity — a won opp carries closedAt but is not lost (phase-02)', async () => {
    const opp = await testDbBypass(async (tx) => {
      const contact = await tx.contact.create({
        data: { facilityId: facilityA.id, name: 'Won Contact', phone: '0900000011' },
      });
      return tx.opportunity.create({
        data: { facilityId: facilityA.id, contactId: contact.id, stage: 'O5_ENROLLED', closedAt: new Date() },
      });
    });

    await expect(
      saleA.crm.opportunityMarkLost({ opportunityId: opp.id, reopen: true }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const after = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }));
    expect(after.stage).toBe('O5_ENROLLED'); // not reverted to O2
    expect(after.closedAt).not.toBeNull();
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
