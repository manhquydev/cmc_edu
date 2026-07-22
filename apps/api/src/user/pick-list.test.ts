// `user.pickList` — the narrow staff picker behind the payroll, salary-tier
// and teacher-assignment screens.
//
// Those three screens each need "who works here" to fill a dropdown. They used
// `user.list`, which requires `user.manage` — an empty roster only super_admin
// satisfies — so the directors the screens are built for got nothing back.
// `user.pickList` returns the handful of fields a dropdown needs under its own
// `staff.pickList` key, deliberately NOT reusing a money-gate permission: class
// administration must never end up depending on who may assemble payslips.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, seedAppUser } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('user.pickList (staff.pickList)', () => {
  let facility: { id: string };
  let otherFacility: { id: string };
  let gdkd: Caller;
  let gddt: Caller;
  let sale: Caller;
  let giaoVien: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('PickList-Facility');
    otherFacility = await createTestFacility('PickList-Other-Facility');

    await seedAppUser({ facilityId: facility.id, userId: 'pick-gv-1', fullName: 'Cô Giáo', roles: ['giao_vien'] });
    await seedAppUser({ facilityId: facility.id, userId: 'pick-sale-1', fullName: 'Anh Sale', roles: ['sale'] });
    await seedAppUser({ facilityId: otherFacility.id, userId: 'pick-gv-other', fullName: 'GV Cơ Sở Khác', roles: ['giao_vien'] });

    const caller = (userId: string, role: string): Caller =>
      appRouter.createCaller(buildStaffContext({ facilityId: facility.id, userId, roles: [role as never] }));

    gdkd = caller('pick-gdkd-001', 'giam_doc_kinh_doanh');
    gddt = caller('pick-gddt-001', 'giam_doc_dao_tao');
    sale = caller('pick-sale-001', 'sale');
    giaoVien = caller('pick-gv-001', 'giao_vien');
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupFacility(otherFacility.id);
  });

  it('lets giam_doc_kinh_doanh pick from the staff list', async () => {
    const result = await gdkd.user.pickList({});
    expect(result.items.map((u) => u.fullName)).toEqual(expect.arrayContaining(['Cô Giáo', 'Anh Sale']));
  });

  it('lets giam_doc_dao_tao pick from the staff list', async () => {
    const result = await gddt.user.pickList({});
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('forbids sale', async () => {
    await expect(sale.user.pickList({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('forbids giao_vien', async () => {
    await expect(giaoVien.user.pickList({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns only the fields a dropdown needs — no wider staff profile', async () => {
    const result = await gdkd.user.pickList({});
    const row = result.items.find((u) => u.fullName === 'Cô Giáo');
    expect(row).toBeDefined();
    expect(Object.keys(row!).sort()).toEqual(['employeeCode', 'fullName', 'id', 'position', 'roles']);
  });

  it('filters by role so a teacher picker only offers teachers', async () => {
    const result = await gddt.user.pickList({ role: 'giao_vien' });
    expect(result.items.map((u) => u.fullName)).toEqual(['Cô Giáo']);
  });

  it('never returns staff from another facility', async () => {
    const result = await gdkd.user.pickList({});
    expect(result.items.map((u) => u.fullName)).not.toContain('GV Cơ Sở Khác');
  });
});
