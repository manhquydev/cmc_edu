// P3-II KPI score integration tests (US-024, WF-P3-05, QĐ0011).
//
// Covers:
//   - kpi.submit: employee submits own KPI (draft→submitted, kpiMax cap)
//   - kpi.confirm: direct manager confirms (submitted→confirmed)
//   - kpi.approve: GĐKD/GĐĐT approves (confirmed→approved)
//   - kpi.override: director overrides value + sets override=true + audit reason
//   - kpi.getForUser: own readable; other user FORBIDDEN; GĐKD readable

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

// ---------------------------------------------------------------------------
// Test identities
// ---------------------------------------------------------------------------

const EMPLOYEE_USER_ID = 'kpi-test-employee-001';
const MANAGER_USER_ID  = 'kpi-test-manager-001';
const DIRECTOR_USER_ID = 'kpi-test-director-001';
const OTHER_USER_ID    = 'kpi-test-other-001';

const TEST_PERIOD = '2099-07';

let facilityId: string;
let employeeAppUserId: string;
let managerAppUserId: string;
let otherAppUserId: string;

beforeEach(async () => {
  const facility = await createTestFacility('KpiTest-Facility');
  facilityId = facility.id;

  const manager = await seedAppUser({
    facilityId,
    userId: MANAGER_USER_ID,
    fullName: 'Trần Giám Đốc ĐT',
    position: 'giam_doc_dao_tao',
  });
  managerAppUserId = manager.id;

  // Employee with manager = the director above
  const employee = await seedAppUser({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    fullName: 'Nguyễn Giáo Viên',
    position: 'giao_vien',
    managerId: managerAppUserId,
  });
  employeeAppUserId = employee.id;

  // Director (GĐKD) for approve/override
  await seedAppUser({
    facilityId,
    userId: DIRECTOR_USER_ID,
    fullName: 'Lê Giám Đốc KD',
    position: 'giam_doc_kinh_doanh',
  });

  // Unrelated employee
  const other = await seedAppUser({
    facilityId,
    userId: OTHER_USER_ID,
    fullName: 'Võ Người Khác',
    position: 'sale',
  });
  otherAppUserId = other.id;

  // Seed SalaryRate for employee so kpiMax is available
  await testDbBypass((tx) =>
    tx.salaryRate.create({
      data: {
        facilityId,
        appUserId: employeeAppUserId,
        baseSalary: 10_000_000,
        variablePayRate: 0.1,
        kpiMax: 5_000_000,
      },
    }),
  );
});

afterEach(async () => {
  await cleanupFacility(facilityId);
});

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function employeeCtx() {
  return buildStaffContext({ facilityId, userId: EMPLOYEE_USER_ID, roles: ['giao_vien'] });
}

function managerCtx() {
  return buildStaffContext({ facilityId, userId: MANAGER_USER_ID, roles: ['giam_doc_dao_tao'] });
}

function directorCtx() {
  return buildStaffContext({ facilityId, userId: DIRECTOR_USER_ID, roles: ['giam_doc_kinh_doanh'] });
}

function otherCtx() {
  return buildStaffContext({ facilityId, userId: OTHER_USER_ID, roles: ['sale'] });
}

const employeeCaller = () => appRouter.createCaller(employeeCtx());
const managerCaller  = () => appRouter.createCaller(managerCtx());
const directorCaller = () => appRouter.createCaller(directorCtx());
const otherCaller    = () => appRouter.createCaller(otherCtx());

// ---------------------------------------------------------------------------
// Tests — kpi.submit
// ---------------------------------------------------------------------------

describe('kpi.submit', () => {
  it('employee submits own KPI score → status becomes submitted', async () => {
    const result = await employeeCaller().kpi.submit({
      period: TEST_PERIOD,
      value: 4_000_000,
    });
    expect(result.status).toBe('submitted');
    expect(result.appUserId).toBe(employeeAppUserId);
    expect(Number(result.value)).toBe(4_000_000);
  });

  it('rejects value exceeding kpiMax', async () => {
    await expect(
      employeeCaller().kpi.submit({
        period: TEST_PERIOD,
        value: 6_000_000, // exceeds kpiMax=5M
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('cannot resubmit an already-submitted score', async () => {
    await employeeCaller().kpi.submit({ period: TEST_PERIOD, value: 3_000_000 });

    await expect(
      employeeCaller().kpi.submit({ period: TEST_PERIOD, value: 4_000_000 }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ---------------------------------------------------------------------------
// Tests — kpi.confirm
// ---------------------------------------------------------------------------

describe('kpi.confirm', () => {
  let kpiScoreId: string;

  beforeEach(async () => {
    const score = await employeeCaller().kpi.submit({
      period: TEST_PERIOD,
      value: 4_000_000,
    });
    kpiScoreId = score.id;
  });

  it('direct manager confirms submitted KPI → status becomes confirmed', async () => {
    const result = await managerCaller().kpi.confirm({ kpiScoreId });
    expect(result.status).toBe('confirmed');
    expect(result.confirmedBy).toBe(MANAGER_USER_ID);
  });

  it('non-manager cannot confirm → FORBIDDEN', async () => {
    // Director (GĐKD) is NOT the direct manager of the employee
    await expect(
      directorCaller().kpi.confirm({ kpiScoreId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('cannot confirm a non-submitted score', async () => {
    // Confirm once (submitted→confirmed)
    await managerCaller().kpi.confirm({ kpiScoreId });
    // Try again → already confirmed
    await expect(
      managerCaller().kpi.confirm({ kpiScoreId }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ---------------------------------------------------------------------------
// Tests — kpi.approve
// ---------------------------------------------------------------------------

describe('kpi.approve', () => {
  let kpiScoreId: string;

  beforeEach(async () => {
    const score = await employeeCaller().kpi.submit({
      period: TEST_PERIOD,
      value: 4_000_000,
    });
    kpiScoreId = score.id;
    await managerCaller().kpi.confirm({ kpiScoreId });
  });

  it('GĐKD approves confirmed KPI → status becomes approved', async () => {
    const result = await directorCaller().kpi.approve({ kpiScoreId });
    expect(result.status).toBe('approved');
    expect(result.approvedBy).toBe(DIRECTOR_USER_ID);
  });

  it('GĐĐT can also approve confirmed KPI', async () => {
    const result = await managerCaller().kpi.approve({ kpiScoreId });
    expect(result.status).toBe('approved');
  });

  it('employee cannot approve → FORBIDDEN', async () => {
    await expect(
      employeeCaller().kpi.approve({ kpiScoreId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('cannot approve non-confirmed score', async () => {
    // Create a fresh submitted (not confirmed) score for other employee
    const otherScore = await testDbBypass((tx) =>
      tx.kpiScore.create({
        data: {
          facilityId,
          appUserId: otherAppUserId,
          period: TEST_PERIOD,
          value: 1_000_000,
          kpiMax: 2_000_000,
          status: 'submitted',
          submittedBy: OTHER_USER_ID,
        },
      }),
    );
    await expect(
      directorCaller().kpi.approve({ kpiScoreId: otherScore.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ---------------------------------------------------------------------------
// Tests — kpi.override
// ---------------------------------------------------------------------------

describe('kpi.override', () => {
  let kpiScoreId: string;

  beforeEach(async () => {
    const score = await employeeCaller().kpi.submit({
      period: TEST_PERIOD,
      value: 4_000_000,
    });
    kpiScoreId = score.id;
  });

  it('director overrides value → override=true + overrideReason set', async () => {
    const result = await directorCaller().kpi.override({
      kpiScoreId,
      value: 3_500_000,
      overrideReason: 'Điều chỉnh theo kết quả đánh giá hội đồng',
    });

    expect(Number(result.value)).toBe(3_500_000);
    expect(result.override).toBe(true);
    expect(result.overrideReason).toBe('Điều chỉnh theo kết quả đánh giá hội đồng');
    expect(result.approvedBy).toBe(DIRECTOR_USER_ID);
  });

  it('override can be applied at any status (e.g. approved)', async () => {
    await managerCaller().kpi.confirm({ kpiScoreId });
    await directorCaller().kpi.approve({ kpiScoreId });

    // Override an approved score
    const result = await directorCaller().kpi.override({
      kpiScoreId,
      value: 2_000_000,
      overrideReason: 'Phát hiện sai sót trong báo cáo',
    });
    expect(result.override).toBe(true);
    expect(Number(result.value)).toBe(2_000_000);
  });

  it('rejects override exceeding kpiMax', async () => {
    await expect(
      directorCaller().kpi.override({
        kpiScoreId,
        value: 10_000_000, // exceeds kpiMax=5M
        overrideReason: 'Test',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ---------------------------------------------------------------------------
// Tests — kpi.getForUser (privacy gate)
// ---------------------------------------------------------------------------

describe('kpi.getForUser privacy gate', () => {
  let kpiScoreId: string;

  beforeEach(async () => {
    const score = await employeeCaller().kpi.submit({
      period: TEST_PERIOD,
      value: 4_000_000,
    });
    kpiScoreId = score.id;
  });

  it('employee can read their own KPI score', async () => {
    const result = await employeeCaller().kpi.getForUser({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(result.id).toBe(kpiScoreId);
  });

  it('unrelated employee cannot read another\'s KPI score → FORBIDDEN', async () => {
    await expect(
      otherCaller().kpi.getForUser({
        appUserId: employeeAppUserId,
        period: TEST_PERIOD,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('GĐKD director can read any KPI score in facility', async () => {
    const result = await directorCaller().kpi.getForUser({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(result.id).toBe(kpiScoreId);
  });

  it('GĐĐT (direct manager) can read their report\'s KPI score', async () => {
    const result = await managerCaller().kpi.getForUser({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(result.id).toBe(kpiScoreId);
  });
});
