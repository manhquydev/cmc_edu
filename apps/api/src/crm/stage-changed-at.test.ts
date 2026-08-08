// P2: stageChangedAt is set on CRM stage UPDATEs (advance + reopen) and on
// create via DB DEFAULT now(). Finance paths are intentionally not covered.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('Opportunity.stageChangedAt (P2 rotting clock)', () => {
  let facility: { id: string };
  let sale: Caller;
  let phoneSeq = 0;

  beforeEach(async () => {
    facility = await createTestFacility('StageClock Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-stageclock', roles: ['sale'] }),
    );
    phoneSeq = 0;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  function nextPhone() {
    phoneSeq += 1;
    return `09440000${String(phoneSeq).padStart(2, '0')}`;
  }

  it('create stamps stageChangedAt via DB default (near now)', async () => {
    const before = Date.now();
    const opp = await sale.crm.opportunityCreate({
      contactName: 'New Clock',
      phone: nextPhone(),
    });
    const row = await testDbBypass((tx) =>
      tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }),
    );
    expect(row.stageChangedAt).not.toBeNull();
    expect(row.stageChangedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('advance resets stageChangedAt', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Advance Clock',
      phone: nextPhone(),
    });
    // Age the clock.
    await testDbBypass((tx) =>
      tx.opportunity.update({
        where: { id: opp.id },
        data: { stageChangedAt: new Date('2020-01-01T00:00:00.000Z') },
      }),
    );

    const beforeAdvance = Date.now();
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    const row = await testDbBypass((tx) =>
      tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }),
    );
    expect(row.stageChangedAt!.getTime()).toBeGreaterThanOrEqual(beforeAdvance - 1000);
  });

  it('reopen after mark-lost resets stageChangedAt', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Reopen Clock',
      phone: nextPhone(),
    });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityMarkLost({
      opportunityId: opp.id,
      lostReason: 'no_response',
    });
    await testDbBypass((tx) =>
      tx.opportunity.update({
        where: { id: opp.id },
        data: { stageChangedAt: new Date('2020-01-01T00:00:00.000Z') },
      }),
    );

    const beforeReopen = Date.now();
    await sale.crm.opportunityMarkLost({ opportunityId: opp.id, reopen: true });
    const row = await testDbBypass((tx) =>
      tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }),
    );
    expect(row.stage).toBe('O2_CONTACTED');
    expect(row.stageChangedAt!.getTime()).toBeGreaterThanOrEqual(beforeReopen - 1000);
  });

  it('list marks isRotting when stageChangedAt is older than threshold', async () => {
    const prev = process.env.ROTTING_THRESHOLD_DAYS;
    process.env.ROTTING_THRESHOLD_DAYS = '7';
    try {
      const opp = await sale.crm.opportunityCreate({
        contactName: 'Rotting Lead',
        phone: nextPhone(),
      });
      await testDbBypass((tx) =>
        tx.opportunity.update({
          where: { id: opp.id },
          data: { stageChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        }),
      );

      const list = await sale.crm.opportunityList({ pageSize: 100 });
      const item = list.items.find((i) => i.id === opp.id);
      expect(item?.isRotting).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ROTTING_THRESHOLD_DAYS;
      else process.env.ROTTING_THRESHOLD_DAYS = prev;
    }
  });

  it('list does not mark isRotting after a fresh advance', async () => {
    const prev = process.env.ROTTING_THRESHOLD_DAYS;
    process.env.ROTTING_THRESHOLD_DAYS = '7';
    try {
      const opp = await sale.crm.opportunityCreate({
        contactName: 'Fresh After Advance',
        phone: nextPhone(),
      });
      await testDbBypass((tx) =>
        tx.opportunity.update({
          where: { id: opp.id },
          data: { stageChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        }),
      );
      await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });

      const list = await sale.crm.opportunityList({ pageSize: 100 });
      const item = list.items.find((i) => i.id === opp.id);
      expect(item?.isRotting).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.ROTTING_THRESHOLD_DAYS;
      else process.env.ROTTING_THRESHOLD_DAYS = prev;
    }
  });

  it('O5 never isRotting even with an old stageChangedAt', async () => {
    const won = await testDbBypass(async (tx) => {
      const contact = await tx.contact.create({
        data: { facilityId: facility.id, name: 'Won', phone: nextPhone() },
      });
      return tx.opportunity.create({
        data: {
          facilityId: facility.id,
          contactId: contact.id,
          stage: 'O5_ENROLLED',
          closedAt: new Date(),
          stageChangedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    const list = await sale.crm.opportunityList({ lost: 'include', pageSize: 100 });
    const item = list.items.find((i) => i.id === won.id);
    expect(item?.isRotting).toBe(false);
  });
});
