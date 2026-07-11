// HR remediation phase 4: `shift.listGroups` / `shift.myRegistrations` /
// `shift.pendingForApproval` — RLS-scoped read procedures for the UI.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

let facilityId: string;
let otherFacilityId: string;
let shiftGroupId: string;
let shiftTemplateId: string;

const EMPLOYEE_A = 'list-proc-employee-a';
const EMPLOYEE_B = 'list-proc-employee-b';
const GV_MANAGER = 'list-proc-gv-manager';
const KD_MANAGER = 'list-proc-kd-manager';

const FUTURE_DATE = '2099-04-10';

const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

beforeEach(async () => {
  const facility = await createTestFacility('ShiftListProc-Facility');
  facilityId = facility.id;
  const other = await createTestFacility('ShiftListProc-Other-Facility');
  otherFacilityId = other.id;

  await seedAppUser({ facilityId, userId: EMPLOYEE_A, position: 'giao_vien' });
  await seedAppUser({ facilityId, userId: EMPLOYEE_B, position: 'giao_vien' });
  await seedAppUser({ facilityId, userId: GV_MANAGER, position: 'giam_doc_dao_tao' });
  await seedAppUser({ facilityId, userId: KD_MANAGER, position: 'giam_doc_kinh_doanh' });

  const group = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: { facilityId, name: 'Ca Giáo Viên', type: 'GIAO_VIEN', selectionMode: 'SINGLE' },
    }),
  );
  shiftGroupId = group.id;
  const template = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: { facilityId, shiftGroupId, name: 'Ca Sáng', startTime: '09:00', endTime: '17:00' },
    }),
  );
  shiftTemplateId = template.id;

  await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: { facilityId, name: 'Ca Kinh Doanh', type: 'KINH_DOANH', selectionMode: 'MULTIPLE' },
    }),
  );
});

afterEach(async () => {
  await cleanupFacility(facilityId);
  await cleanupFacility(otherFacilityId);
});

function employeeACtx() {
  return buildStaffContext({ facilityId, userId: EMPLOYEE_A, roles: ['giao_vien'] });
}
function employeeBCtx() {
  return buildStaffContext({ facilityId, userId: EMPLOYEE_B, roles: ['giao_vien'] });
}
function gvManagerCtx() {
  return buildStaffContext({ facilityId, userId: GV_MANAGER, roles: ['giam_doc_dao_tao'] });
}
function kdManagerCtx() {
  return buildStaffContext({ facilityId, userId: KD_MANAGER, roles: ['giam_doc_kinh_doanh'] });
}

describe('shift.listGroups', () => {
  it('any active staff session sees groups with nested templates', async () => {
    const groups = await caller(employeeACtx()).shift.listGroups();
    const gv = groups.find((g) => g.id === shiftGroupId);
    expect(gv).toBeTruthy();
    expect(gv?.templates.some((t) => t.id === shiftTemplateId)).toBe(true);
  });

  it('does not leak groups from another facility', async () => {
    const otherGroup = await testDbBypass((tx) =>
      tx.shiftGroup.create({
        data: {
          facilityId: otherFacilityId,
          name: 'Other Facility Group',
          type: 'GIAO_VIEN',
          selectionMode: 'SINGLE',
        },
      }),
    );
    const groups = await caller(employeeACtx()).shift.listGroups();
    expect(groups.some((g) => g.id === otherGroup.id)).toBe(false);
  });
});

describe('shift.myRegistrations', () => {
  it('returns only the caller\'s own registrations with entries + status', async () => {
    await caller(employeeACtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });

    const mine = await caller(employeeACtx()).shift.myRegistrations();
    expect(mine).toHaveLength(1);
    expect(mine[0]?.status).toBe('submitted');
    expect(mine[0]?.entries).toHaveLength(1);

    const bMine = await caller(employeeBCtx()).shift.myRegistrations();
    expect(bMine).toHaveLength(0);
  });

  it('reflects rejectReason after a rejection', async () => {
    const reg = await caller(employeeACtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });
    await caller(gvManagerCtx()).shift.reject({ registrationId: reg.id, reason: 'Không hợp lệ.' });

    const mine = await caller(employeeACtx()).shift.myRegistrations();
    expect(mine[0]?.status).toBe('rejected');
    expect(mine[0]?.rejectReason).toBe('Không hợp lệ.');
  });
});

describe('shift.pendingForApproval', () => {
  it('GIAO_VIEN director sees only GIAO_VIEN submissions, with submitter name', async () => {
    await caller(employeeACtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });

    const pending = await caller(gvManagerCtx()).shift.pendingForApproval();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.shiftGroup.type).toBe('GIAO_VIEN');
    expect(pending[0]?.appUser.fullName).toBeTruthy();
  });

  it('KINH_DOANH director does not see GIAO_VIEN submissions', async () => {
    await caller(employeeACtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });

    const pending = await caller(kdManagerCtx()).shift.pendingForApproval();
    expect(pending).toHaveLength(0);
  });

  it('non-director (no shift.approve permission) → FORBIDDEN', async () => {
    await expect(caller(employeeACtx()).shift.pendingForApproval()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
