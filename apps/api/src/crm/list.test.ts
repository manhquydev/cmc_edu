// crm.opportunityList integration tests (K11 remediation, deep-review
// consolidated report): the only list/kanban surface in the P1 CRM pipeline
// had zero test coverage. Covers pagination math, stage filter, the
// permission gate, and RLS.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility } from '../test/db.js';

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

  it('enforces RLS: facility B never sees facility A opportunities', async () => {
    const opp = await saleA.crm.opportunityCreate({ contactName: 'RLS List Contact', phone: '0901000211' });

    const listB = await saleB.crm.opportunityList({});
    expect(listB.items.some((o) => o.id === opp.id)).toBe(false);
  });
});
