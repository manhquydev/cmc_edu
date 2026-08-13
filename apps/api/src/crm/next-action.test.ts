// P4 next-action + due follow-ups + coordination with rotting (P2).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDaysToDateOnly, ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('crm next-action (P4)', () => {
  let facility: { id: string };
  let sale: Caller;
  let saleOther: Caller;
  let saleAppUserId: string;
  let phoneSeq = 0;

  beforeEach(async () => {
    facility = await createTestFacility('NextAction Facility');
    const a = await seedAppUser({
      facilityId: facility.id,
      userId: 'sale-next-a',
      roles: ['sale'],
    });
    await seedAppUser({
      facilityId: facility.id,
      userId: 'sale-next-b',
      roles: ['sale'],
    });
    saleAppUserId = a.id;
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-next-a', roles: ['sale'] }),
    );
    saleOther = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-next-b', roles: ['sale'] }),
    );
    phoneSeq = 0;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  function nextPhone() {
    phoneSeq += 1;
    return `09330000${String(phoneSeq).padStart(2, '0')}`;
  }

  it('sets and clears next action; get returns fields', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Follow Me',
      phone: nextPhone(),
    });
    const due = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const set = await sale.crm.opportunitySetNextAction({
      opportunityId: opp.id,
      nextActionAt: due,
      nextActionNote: 'Gọi lại PH',
    });
    expect(set.nextActionNote).toBe('Gọi lại PH');

    const got = await sale.crm.opportunityGet({ opportunityId: opp.id });
    expect(got.nextActionNote).toBe('Gọi lại PH');
    expect(got.nextActionAt).not.toBeNull();

    await sale.crm.opportunityClearNextAction({ opportunityId: opp.id });
    const cleared = await sale.crm.opportunityGet({ opportunityId: opp.id });
    expect(cleared.nextActionAt).toBeNull();
    expect(cleared.nextActionNote).toBeNull();
  });

  it('due follow-ups only for owner + active + due', async () => {
    const mineDue = await sale.crm.opportunityCreate({
      contactName: 'Mine Due',
      phone: nextPhone(),
    });
    const mineFuture = await sale.crm.opportunityCreate({
      contactName: 'Mine Future',
      phone: nextPhone(),
    });
    const otherDue = await saleOther.crm.opportunityCreate({
      contactName: 'Other Due',
      phone: nextPhone(),
    });
    const lostDue = await sale.crm.opportunityCreate({
      contactName: 'Lost Due',
      phone: nextPhone(),
    });

    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    await sale.crm.opportunitySetNextAction({
      opportunityId: mineDue.id,
      nextActionAt: past,
      nextActionNote: 'Due mine',
    });
    await sale.crm.opportunitySetNextAction({
      opportunityId: mineFuture.id,
      nextActionAt: future,
      nextActionNote: 'Future mine',
    });
    await saleOther.crm.opportunitySetNextAction({
      opportunityId: otherDue.id,
      nextActionAt: past,
      nextActionNote: 'Other',
    });
    await sale.crm.opportunitySetNextAction({
      opportunityId: lostDue.id,
      nextActionAt: past,
      nextActionNote: 'Will lose',
    });
    await sale.crm.opportunityAdvance({ opportunityId: lostDue.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityMarkLost({
      opportunityId: lostDue.id,
      lostReason: 'no_response',
    });

    // O5 with next action must not appear
    const won = await testDbBypass(async (tx) => {
      const c = await tx.contact.create({
        data: { facilityId: facility.id, name: 'Won', phone: nextPhone() },
      });
      return tx.opportunity.create({
        data: {
          facilityId: facility.id,
          contactId: c.id,
          stage: 'O5_ENROLLED',
          closedAt: new Date(),
          assignedToId: saleAppUserId,
          nextActionAt: new Date(Date.now() - 60_000),
          nextActionNote: 'Should hide',
        },
      });
    });

    const due = await sale.crm.opportunityDueFollowUps();
    const ids = new Set(due.items.map((i) => i.id));
    expect(ids.has(mineDue.id)).toBe(true);
    expect(ids.has(mineFuture.id)).toBe(false);
    expect(ids.has(otherDue.id)).toBe(false);
    expect(ids.has(lostDue.id)).toBe(false);
    expect(ids.has(won.id)).toBe(false);
  });

  it('counts late/today/future via separate queries (future is counted even though items exclude it)', async () => {
    const now = new Date();
    const today = ictDateOnlyOf(now);
    const lateAt = ictToUtc(addDaysToDateOnly(today, -1), '12:00');
    const todayAt = new Date(Math.min(now.getTime(), ictToUtc(today, '12:00').getTime()));
    const futureAt = ictToUtc(addDaysToDateOnly(today, 2), '12:00');

    const lateOpp = await sale.crm.opportunityCreate({
      contactName: 'Count Late',
      phone: nextPhone(),
    });
    const todayOpp = await sale.crm.opportunityCreate({
      contactName: 'Count Today',
      phone: nextPhone(),
    });
    const futureOpp = await sale.crm.opportunityCreate({
      contactName: 'Count Future',
      phone: nextPhone(),
    });

    await sale.crm.opportunitySetNextAction({
      opportunityId: lateOpp.id,
      nextActionAt: lateAt.toISOString(),
      nextActionNote: 'Late',
    });
    await sale.crm.opportunitySetNextAction({
      opportunityId: todayOpp.id,
      nextActionAt: todayAt.toISOString(),
      nextActionNote: 'Today',
    });
    await sale.crm.opportunitySetNextAction({
      opportunityId: futureOpp.id,
      nextActionAt: futureAt.toISOString(),
      nextActionNote: 'Future',
    });

    const due = await sale.crm.opportunityDueFollowUps();
    expect(due.counts).toEqual({ late: 1, today: 1, future: 1 });
    const ids = new Set(due.items.map((i) => i.id));
    expect(ids.has(lateOpp.id)).toBe(true);
    expect(ids.has(futureOpp.id)).toBe(false);
  });

  it('counts 51 late follow-ups even though items are capped at 50', async () => {
    const now = new Date();
    const today = ictDateOnlyOf(now);
    const lateAt = ictToUtc(addDaysToDateOnly(today, -1), '12:00');
    await testDbBypass(async (tx) => {
      for (let i = 0; i < 51; i += 1) {
        const contact = await tx.contact.create({
          data: {
            facilityId: facility.id,
            name: `Late Batch ${i}`,
            phone: `093311${String(i).padStart(4, '0')}`,
          },
        });
        await tx.opportunity.create({
          data: {
            facilityId: facility.id,
            contactId: contact.id,
            stage: 'O1_LEAD',
            assignedToId: saleAppUserId,
            nextActionAt: lateAt,
            nextActionNote: 'Late batch',
          },
        });
      }
    });

    const due = await sale.crm.opportunityDueFollowUps();
    expect(due.counts.late).toBe(51);
    expect(due.items).toHaveLength(50);
  });

  it('future nextActionAt suppresses isRotting', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Worked Rotting',
      phone: nextPhone(),
    });
    await testDbBypass((tx) =>
      tx.opportunity.update({
        where: { id: opp.id },
        data: { stageChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      }),
    );

    let list = await sale.crm.opportunityList({ pageSize: 100 });
    expect(list.items.find((i) => i.id === opp.id)?.isRotting).toBe(true);

    await sale.crm.opportunitySetNextAction({
      opportunityId: opp.id,
      nextActionAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      nextActionNote: 'Working it',
    });

    list = await sale.crm.opportunityList({ pageSize: 100 });
    expect(list.items.find((i) => i.id === opp.id)?.isRotting).toBe(false);
  });

  it('rejects next action on lost opportunity', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'No Action Lost',
      phone: nextPhone(),
    });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityMarkLost({
      opportunityId: opp.id,
      lostReason: 'other',
    });
    await expect(
      sale.crm.opportunitySetNextAction({
        opportunityId: opp.id,
        nextActionAt: new Date().toISOString(),
        nextActionNote: 'Nope',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects clearing next action on a lost opportunity (mirrors setNextAction guard)', async () => {
    const opp = await sale.crm.opportunityCreate({
      contactName: 'Clear On Lost',
      phone: nextPhone(),
    });
    await sale.crm.opportunitySetNextAction({
      opportunityId: opp.id,
      nextActionAt: new Date(Date.now() + 60_000).toISOString(),
      nextActionNote: 'Before lost',
    });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'other' });

    await expect(
      sale.crm.opportunityClearNextAction({ opportunityId: opp.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
