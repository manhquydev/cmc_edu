// phase-10 (PO decision #3): opportunity owner (assignedToId) + lead source.
// Covers the creator-default rule, the source zod enum, and the row-level
// ownership matrix for crm.opportunityAssign (the registry can() is role-only).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('crm opportunity owner + source (phase-10)', () => {
  let facility: { id: string };
  let saleOwner: Caller; // has an AppUser row
  let saleOther: Caller; // has an AppUser row
  let manager: Caller; // GĐ KD
  let saleOwnerAppUserId: string;
  let saleOtherAppUserId: string;
  let phoneSeq = 0;

  beforeEach(async () => {
    facility = await createTestFacility('Owner Facility');
    const a = await seedAppUser({ facilityId: facility.id, userId: 'sale-owner', position: 'sale' });
    const b = await seedAppUser({ facilityId: facility.id, userId: 'sale-other', position: 'sale' });
    saleOwnerAppUserId = a.id;
    saleOtherAppUserId = b.id;
    saleOwner = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-owner', roles: ['sale'] }),
    );
    saleOther = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-other', roles: ['sale'] }),
    );
    manager = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-owner-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    phoneSeq = 0;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  function nextPhone() {
    phoneSeq += 1;
    return `09630000${String(phoneSeq).padStart(2, '0')}`;
  }

  it('a sale owns the leads they create; source is persisted', async () => {
    const opp = await saleOwner.crm.opportunityCreate({ contactName: 'Owned Lead', phone: nextPhone(), source: 'fanpage' });
    const row = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }));
    expect(row.assignedToId).toBe(saleOwnerAppUserId);
    expect(row.source).toBe('fanpage');
  });

  it('a GĐ KD creates an unassigned lead', async () => {
    const opp = await manager.crm.opportunityCreate({ contactName: 'Manager Lead', phone: nextPhone() });
    const row = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opp.id } }));
    expect(row.assignedToId).toBeNull();
  });

  it('rejects an invalid source value (zod enum)', async () => {
    await expect(
      // @ts-expect-error — intentionally invalid source to exercise the zod boundary
      saleOwner.crm.opportunityCreate({ contactName: 'Bad Source', phone: nextPhone(), source: 'tiktok' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('a sale can claim an UNASSIGNED lead for themselves', async () => {
    const opp = await manager.crm.opportunityCreate({ contactName: 'Unassigned', phone: nextPhone() });
    const assigned = await saleOwner.crm.opportunityAssign({ opportunityId: opp.id, assigneeUserId: 'sale-owner' });
    expect(assigned.assignedToId).toBe(saleOwnerAppUserId);
  });

  it('a sale CANNOT assign a lead to a different person', async () => {
    const opp = await manager.crm.opportunityCreate({ contactName: 'Steal Target', phone: nextPhone() });
    await expect(
      saleOwner.crm.opportunityAssign({ opportunityId: opp.id, assigneeUserId: 'sale-other' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a sale CANNOT unassign a lead (only a manager can)', async () => {
    const opp = await saleOwner.crm.opportunityCreate({ contactName: 'Own Then Unassign', phone: nextPhone() });
    await expect(
      saleOwner.crm.opportunityAssign({ opportunityId: opp.id, assigneeUserId: null }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("a sale CANNOT claim a lead already owned by someone else", async () => {
    const opp = await saleOther.crm.opportunityCreate({ contactName: 'Others Lead', phone: nextPhone() });
    // owned by sale-other now
    await expect(
      saleOwner.crm.opportunityAssign({ opportunityId: opp.id, assigneeUserId: 'sale-owner' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a sale CANNOT advance a colleague-owned opportunity', async () => {
    const opp = await saleOther.crm.opportunityCreate({ contactName: 'Advance Steal', phone: nextPhone() });
    await expect(
      saleOwner.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a sale CAN advance their own opportunity', async () => {
    const opp = await saleOwner.crm.opportunityCreate({ contactName: 'Advance Own', phone: nextPhone() });
    const advanced = await saleOwner.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    expect(advanced.stage).toBe('O2_CONTACTED');
  });

  it('a sale CAN advance an unassigned opportunity', async () => {
    const opp = await manager.crm.opportunityCreate({ contactName: 'Advance Unassigned', phone: nextPhone() });
    const advanced = await saleOwner.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    expect(advanced.stage).toBe('O2_CONTACTED');
  });

  it('a GĐ KD can advance any opportunity regardless of owner', async () => {
    const opp = await saleOther.crm.opportunityCreate({ contactName: 'Advance Manager', phone: nextPhone() });
    const advanced = await manager.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    expect(advanced.stage).toBe('O2_CONTACTED');
  });

  it('a sale CANNOT mark lost a colleague-owned opportunity', async () => {
    const opp = await saleOther.crm.opportunityCreate({ contactName: 'MarkLost Steal', phone: nextPhone() });
    await expect(
      saleOwner.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'no_response' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a sale CAN mark lost their own opportunity', async () => {
    const opp = await saleOwner.crm.opportunityCreate({ contactName: 'MarkLost Own', phone: nextPhone() });
    await expect(
      saleOwner.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'no_response' }),
    ).resolves.toMatchObject({ lostReason: 'no_response' });
  });

  it('a GĐ KD can (re)assign a lead to any sale, and can unassign', async () => {
    const opp = await saleOwner.crm.opportunityCreate({ contactName: 'Reassign Me', phone: nextPhone() });
    const reassigned = await manager.crm.opportunityAssign({ opportunityId: opp.id, assigneeUserId: 'sale-other' });
    expect(reassigned.assignedToId).toBe(saleOtherAppUserId);

    const unassigned = await manager.crm.opportunityAssign({ opportunityId: opp.id, assigneeUserId: null });
    expect(unassigned.assignedToId).toBeNull();
  });

  it('assignableStaff lists active facility staff for the owner-select', async () => {
    const staff = await manager.crm.assignableStaff();
    const userIds = staff.map((s) => s.userId);
    expect(userIds).toContain('sale-owner');
    expect(userIds).toContain('sale-other');
    expect(staff.every((s) => typeof s.fullName === 'string')).toBe(true);
  });

  it('opportunityList returns the resolved owner (userId + fullName)', async () => {
    const opp = await saleOwner.crm.opportunityCreate({ contactName: 'Listed Lead', phone: nextPhone() });
    const list = await manager.crm.opportunityList({ pageSize: 100 });
    const item = list.items.find((i) => i.id === opp.id);
    expect(item?.assignedTo?.userId).toBe('sale-owner');
    expect(typeof item?.assignedTo?.fullName).toBe('string');
  });
});
