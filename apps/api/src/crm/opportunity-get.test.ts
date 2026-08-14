import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('crm.opportunityGet', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let sale: Caller;
  let teacher: Caller;
  let saleB: Caller;

  beforeEach(async () => {
    facilityA = await createTestFacility('OppGet Facility A');
    facilityB = await createTestFacility('OppGet Facility B');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'sale-og-1', roles: ['sale'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'teacher-og-1', roles: ['giao_vien'] }),
    );
    saleB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'sale-og-2', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('returns contact name/phone/email for an opportunity in the caller facility', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Nguyen Van A',
      phone: '0900111222',
      email: 'a@example.com',
    });

    const result = await sale.crm.opportunityGet({ opportunityId: opp.id });

    expect(result.id).toBe(opp.id);
    expect(result.stage).toBe('O1_LEAD');
    expect(result.contact).toEqual(
      expect.objectContaining({
        name: 'Nguyen Van A',
        phone: '84900111222', // normalized on write (phase-08)
        email: 'a@example.com',
      }),
    );
  });

  it('returns rottingDays from the per-stage clock', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Nguyen Rotting',
      phone: '0900111555',
    });
    await testDbBypass((tx) =>
      tx.opportunity.update({
        where: { id: opp.id },
        data: { stageChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      }),
    );
    const got = await sale.crm.opportunityGet({ opportunityId: opp.id });
    expect(got.isRotting).toBe(true);
    expect(got.rottingDays).toBe(10);
  });

  it('throws NOT_FOUND for an opportunity in another facility (RLS)', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Nguyen Van B',
      phone: '0900111333',
    });

    await expect(
      saleB.crm.opportunityGet({ opportunityId: opp.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws FORBIDDEN for a role without crm.opportunityList permission', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Nguyen Van C',
      phone: '0900111444',
    });

    await expect(
      teacher.crm.opportunityGet({ opportunityId: opp.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
