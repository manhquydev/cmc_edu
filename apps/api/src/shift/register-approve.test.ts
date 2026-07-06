// P3-II shift registration + approval integration tests (US-022, WF-P3-03/04).
//
// Covers: submit (happy path), ticket-lock, past-date rejection, SINGLE-mode
// duplicate date rejection, approve (happy + FORBIDDEN + anti-self-approve),
// and cancel.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';
import { ictToUtc } from '@cmc/domain-time';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let facilityId: string;
let employeeAppUserId: string;   // giao_vien
let managerAppUserId: string;    // giam_doc_dao_tao
let kdEmployeeAppUserId: string; // sale (KINH_DOANH group)
let shiftGroupId: string;
let shiftTemplateId: string;
let kdShiftGroupId: string;
let kdShiftTemplateId: string;

const EMPLOYEE_USER_ID = 'shift-test-employee-001';
const MANAGER_USER_ID  = 'shift-test-manager-001';
const KD_USER_ID       = 'shift-test-kd-001';

// A future date for tests — far enough ahead to always be "future"
const FUTURE_DATE = '2099-01-15';
const FUTURE_DATE2 = '2099-01-16';

beforeEach(async () => {
  const facility = await createTestFacility('ShiftTest-Facility');
  facilityId = facility.id;

  const employee = await seedAppUser({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    fullName: 'Nguyễn Giáo Viên',
    position: 'giao_vien',
  });
  employeeAppUserId = employee.id;

  const manager = await seedAppUser({
    facilityId,
    userId: MANAGER_USER_ID,
    fullName: 'Trần Giám Đốc',
    position: 'giam_doc_dao_tao',
  });
  managerAppUserId = manager.id;

  const kdEmployee = await seedAppUser({
    facilityId,
    userId: KD_USER_ID,
    fullName: 'Lê Sale',
    position: 'sale',
  });
  kdEmployeeAppUserId = kdEmployee.id;

  // Seed GIAO_VIEN ShiftGroup + ShiftTemplate via DB bypass (setup, not subject under test)
  const group = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: {
        facilityId,
        name: 'Ca Giáo Viên',
        type: 'GIAO_VIEN',
        selectionMode: 'SINGLE',
      },
    }),
  );
  shiftGroupId = group.id;

  const template = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: {
        facilityId,
        shiftGroupId,
        name: 'Ca Sáng',
        startTime: '09:00',
        endTime: '17:00',
      },
    }),
  );
  shiftTemplateId = template.id;

  // Seed KINH_DOANH ShiftGroup + ShiftTemplate
  const kdGroup = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: {
        facilityId,
        name: 'Ca Kinh Doanh',
        type: 'KINH_DOANH',
        selectionMode: 'MULTIPLE',
      },
    }),
  );
  kdShiftGroupId = kdGroup.id;

  const kdTemplate = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: {
        facilityId,
        shiftGroupId: kdGroup.id,
        name: 'Ca KD Sáng',
        startTime: '08:00',
        endTime: '16:00',
      },
    }),
  );
  kdShiftTemplateId = kdTemplate.id;
});

afterEach(async () => {
  await cleanupFacility(facilityId);
});

// ---------------------------------------------------------------------------
// Helper: make a caller for the employee
// ---------------------------------------------------------------------------
function employeeCtx() {
  return buildStaffContext({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    roles: ['giao_vien'],
  });
}

function managerCtx() {
  return buildStaffContext({
    facilityId,
    userId: MANAGER_USER_ID,
    roles: ['giam_doc_dao_tao'],
  });
}

function kdCtx() {
  return buildStaffContext({
    facilityId,
    userId: KD_USER_ID,
    roles: ['sale'],
  });
}

const caller = (ctx: ReturnType<typeof buildStaffContext>) =>
  appRouter.createCaller(ctx);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shift.submit', () => {
  it('creates a ShiftRegistration with entries', async () => {
    const result = await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });

    expect(result.status).toBe('submitted');
    expect(result.appUserId).toBe(employeeAppUserId);
    expect(result.selectionMode).toBe('SINGLE');
  });

  it('ticket-lock: second submit rejects BAD_REQUEST while first is submitted', async () => {
    // First submit succeeds
    await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });

    // Second submit must fail
    await expect(
      caller(employeeCtx()).shift.submit({
        shiftGroupId,
        fromDate: FUTURE_DATE2,
        toDate: FUTURE_DATE2,
        entries: [{ date: FUTURE_DATE2, shiftTemplateId }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects fromDate in the past', async () => {
    await expect(
      caller(employeeCtx()).shift.submit({
        shiftGroupId,
        fromDate: '2020-01-01',
        toDate: '2020-01-01',
        entries: [{ date: '2020-01-01', shiftTemplateId }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('SINGLE mode rejects two entries on the same date', async () => {
    // Need a second template in the GIAO_VIEN group to try submitting
    const template2 = await testDbBypass((tx) =>
      tx.shiftTemplate.create({
        data: {
          facilityId,
          shiftGroupId,
          name: 'Ca Chiều',
          startTime: '13:00',
          endTime: '21:00',
        },
      }),
    );

    await expect(
      caller(employeeCtx()).shift.submit({
        shiftGroupId,
        fromDate: FUTURE_DATE,
        toDate: FUTURE_DATE,
        entries: [
          { date: FUTURE_DATE, shiftTemplateId },
          { date: FUTURE_DATE, shiftTemplateId: template2.id },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects entries from the wrong shift group type (position mismatch)', async () => {
    // giao_vien trying to use KINH_DOANH group
    await expect(
      caller(employeeCtx()).shift.submit({
        shiftGroupId: kdShiftGroupId,
        fromDate: FUTURE_DATE,
        toDate: FUTURE_DATE,
        entries: [{ date: FUTURE_DATE, shiftTemplateId: kdShiftTemplateId }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('shift.approve', () => {
  let registrationId: string;

  beforeEach(async () => {
    const reg = await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });
    registrationId = reg.id;
  });

  it('manager approves → status becomes approved', async () => {
    const result = await caller(managerCtx()).shift.approve({ registrationId });
    expect(result.status).toBe('approved');
  });

  it('non-manager (same role without the right group type) → FORBIDDEN', async () => {
    // KINH_DOANH director cannot approve GIAO_VIEN registration
    const kdManagerCtx = buildStaffContext({
      facilityId,
      userId: 'shift-kdmgr-001',
      roles: ['giam_doc_kinh_doanh'],
    });
    await expect(
      caller(kdManagerCtx).shift.approve({ registrationId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('anti-self-approve: employee cannot approve their own registration', async () => {
    // Give the employee the approve permission by making them a director — but
    // self-approve is blocked regardless of role
    const selfDirectorCtx = buildStaffContext({
      facilityId,
      userId: EMPLOYEE_USER_ID, // same userId as employee who submitted
      roles: ['giam_doc_dao_tao'],
    });
    await expect(
      caller(selfDirectorCtx).shift.approve({ registrationId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('cannot approve a cancelled registration', async () => {
    await caller(employeeCtx()).shift.cancel({ registrationId });
    await expect(
      caller(managerCtx()).shift.approve({ registrationId }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('shift.cancel', () => {
  it('owner can cancel a submitted registration', async () => {
    const reg = await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });

    const result = await caller(employeeCtx()).shift.cancel({ registrationId: reg.id });
    expect(result.status).toBe('cancelled');
  });

  it('director can cancel an approved registration', async () => {
    const reg = await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });
    await caller(managerCtx()).shift.approve({ registrationId: reg.id });

    const result = await caller(managerCtx()).shift.cancel({ registrationId: reg.id });
    expect(result.status).toBe('cancelled');
  });

  it('unrelated staff cannot cancel someone else\'s registration', async () => {
    const reg = await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FUTURE_DATE,
      toDate: FUTURE_DATE,
      entries: [{ date: FUTURE_DATE, shiftTemplateId }],
    });

    const unrelatedCtx = buildStaffContext({
      facilityId,
      userId: KD_USER_ID,
      roles: ['sale'],
    });
    await expect(
      caller(unrelatedCtx).shift.cancel({ registrationId: reg.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
