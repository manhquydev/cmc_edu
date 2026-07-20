// crm.opportunityList integration tests (K11 remediation, deep-review
// consolidated report): the only list/kanban surface in the P1 CRM pipeline
// had zero test coverage. Covers pagination math, stage filter, the
// permission gate, and RLS.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, testDbBypass } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('crm.opportunityList (K11)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let saleA: Caller;
  let saleB: Caller;
  let hr: Caller;

  beforeEach(async () => {
    facilityA = await createTestFacility('CRM List Facility A');
    facilityB = await createTestFacility('CRM List Facility B');
    saleA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'sale-crmlist-a', roles: ['sale'] }),
    );
    saleB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'sale-crmlist-b', roles: ['sale'] }),
    );
    hr = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'hr-crmlist-a', roles: ['hr'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('paginates correctly: page 1 and page 2 at pageSize 2 never overlap, and total matches created count', async () => {
    for (let i = 0; i < 5; i += 1) {
      await saleA.crm.opportunityCreate({ contactName: `List Contact ${i}`, phone: `090100020${i}` });
    }

    const page1 = await saleA.crm.opportunityList({ page: 1, pageSize: 2 });
    const page2 = await saleA.crm.opportunityList({ page: 2, pageSize: 2 });

    expect(page1.total).toBe(5);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(2);
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);

    const page1Ids = new Set(page1.items.map((o) => o.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it('filters by stage', async () => {
    const opp = await saleA.crm.opportunityCreate({ contactName: 'Stage Filter Contact', phone: '0901000210' });
    await saleA.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });

    const o1List = await saleA.crm.opportunityList({ stage: 'O1_LEAD' });
    expect(o1List.items.some((o) => o.id === opp.id)).toBe(false);

    const o2List = await saleA.crm.opportunityList({ stage: 'O2_CONTACTED' });
    expect(o2List.items.some((o) => o.id === opp.id)).toBe(true);
  });

  it('forbids a role without crm.opportunityList permission', async () => {
    await expect(hr.crm.opportunityList({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('searches by partial contact name (case-insensitive) and partial phone (formatting-agnostic) — phase-03', async () => {
    await saleA.crm.opportunityCreate({ contactName: 'Nguyễn Thị Hoa', phone: '0912345678' });
    await saleA.crm.opportunityCreate({ contactName: 'Trần Văn Nam', phone: '0987654321' });

    const byName = await saleA.crm.opportunityList({ search: 'hoa' });
    expect(byName.items).toHaveLength(1);
    expect(byName.items[0].contact.name).toBe('Nguyễn Thị Hoa');

    // Phone stored as '0912345678'; searching with spaces/dashes still matches.
    const byPhone = await saleA.crm.opportunityList({ search: '091 234-5678' });
    expect(byPhone.items).toHaveLength(1);
    expect(byPhone.items[0].contact.phone).toBe('0912345678');

    const noMatch = await saleA.crm.opportunityList({ search: 'zzzznone' });
    expect(noMatch.items).toHaveLength(0);
  });

  it('lost filter: exclude (default) hides lost, only shows lost, include shows all — phase-03', async () => {
    const openOpp = await saleA.crm.opportunityCreate({ contactName: 'Open Lead', phone: '0901000300' });
    await saleA.crm.opportunityAdvance({ opportunityId: openOpp.id, toStage: 'O2_CONTACTED' });
    await saleA.crm.opportunityAdvance({ opportunityId: openOpp.id, toStage: 'O3_TEST_SCHEDULED' });

    const lostOpp = await saleA.crm.opportunityCreate({ contactName: 'Lost Lead', phone: '0901000301' });
    await saleA.crm.opportunityAdvance({ opportunityId: lostOpp.id, toStage: 'O2_CONTACTED' });
    await saleA.crm.opportunityAdvance({ opportunityId: lostOpp.id, toStage: 'O3_TEST_SCHEDULED' });
    await saleA.crm.opportunityMarkLost({ opportunityId: lostOpp.id, lostReason: 'no_response' });

    // A won (O5) opp — closedAt set, but NOT lost — must always be visible.
    const wonOpp = await testDbBypass(async (tx) => {
      const contact = await tx.contact.create({ data: { facilityId: facilityA.id, name: 'Won Lead', phone: '0901000302' } });
      return tx.opportunity.create({ data: { facilityId: facilityA.id, contactId: contact.id, stage: 'O5_ENROLLED', closedAt: new Date() } });
    });

    const excluded = await saleA.crm.opportunityList({ lost: 'exclude', pageSize: 100 });
    const excludedIds = new Set(excluded.items.map((o) => o.id));
    expect(excludedIds.has(openOpp.id)).toBe(true);
    expect(excludedIds.has(wonOpp.id)).toBe(true);
    expect(excludedIds.has(lostOpp.id)).toBe(false);

    const defaulted = await saleA.crm.opportunityList({ pageSize: 100 });
    expect(new Set(defaulted.items.map((o) => o.id)).has(lostOpp.id)).toBe(false); // default == exclude

    const only = await saleA.crm.opportunityList({ lost: 'only', pageSize: 100 });
    const onlyIds = new Set(only.items.map((o) => o.id));
    expect(onlyIds.has(lostOpp.id)).toBe(true);
    expect(onlyIds.has(openOpp.id)).toBe(false);
    expect(onlyIds.has(wonOpp.id)).toBe(false);

    const all = await saleA.crm.opportunityList({ lost: 'include', pageSize: 100 });
    const allIds = new Set(all.items.map((o) => o.id));
    expect(allIds.has(lostOpp.id)).toBe(true);
    expect(allIds.has(openOpp.id)).toBe(true);
    expect(allIds.has(wonOpp.id)).toBe(true);
  });

  it('stageCounts exclude lost and lostCount counts lost — phase-03', async () => {
    // 2 open (O1, O2), 1 lost (from O2), 1 won (O5).
    await saleA.crm.opportunityCreate({ contactName: 'SC Open1', phone: '0901000310' });
    const o2 = await saleA.crm.opportunityCreate({ contactName: 'SC Open2', phone: '0901000311' });
    await saleA.crm.opportunityAdvance({ opportunityId: o2.id, toStage: 'O2_CONTACTED' });
    const lost = await saleA.crm.opportunityCreate({ contactName: 'SC Lost', phone: '0901000312' });
    await saleA.crm.opportunityAdvance({ opportunityId: lost.id, toStage: 'O2_CONTACTED' });
    await saleA.crm.opportunityMarkLost({ opportunityId: lost.id, lostReason: 'other' });
    await testDbBypass(async (tx) => {
      const contact = await tx.contact.create({ data: { facilityId: facilityA.id, name: 'SC Won', phone: '0901000313' } });
      return tx.opportunity.create({ data: { facilityId: facilityA.id, contactId: contact.id, stage: 'O5_ENROLLED', closedAt: new Date() } });
    });

    const res = await saleA.crm.opportunityList({ pageSize: 100 });
    expect(res.stageCounts.O1_LEAD ?? 0).toBe(1);
    expect(res.stageCounts.O2_CONTACTED ?? 0).toBe(1); // the lost one (also O2) is excluded
    expect(res.stageCounts.O5_ENROLLED ?? 0).toBe(1);
    expect(res.lostCount).toBe(1);
  });

  it('enforces RLS: facility B never sees facility A opportunities', async () => {
    const opp = await saleA.crm.opportunityCreate({ contactName: 'RLS List Contact', phone: '0901000211' });

    const listB = await saleB.crm.opportunityList({});
    expect(listB.items.some((o) => o.id === opp.id)).toBe(false);
  });
});
