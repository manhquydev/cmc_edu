// KPI managerId-tree integration tests — HR remediation phase 3 REWRITE
// (docs/20, plan.md "KPI auto-score & lifecycle").
//
// `kpi.submit` (the old seed primitive for every describe block here) is
// REMOVED (red-team #10) — this file now seeds a KpiScore directly via
// `testDbBypass` (test-only insert helper, per the phase-03 spec) instead of
// driving it through a router mutation. Preserves the managerId-TREE
// coverage the old file exercised: employee -> direct manager (GĐĐT) ->
// unrelated director (GĐKD), confirm/override/bulkApprove access control
// across that tree.
//
// Covers:
//   - kpi.confirm: direct manager confirms; non-manager FORBIDDEN;
//     re-confirm BAD_REQUEST
//   - kpi.bulkApprove: branch-scoped director approves a confirmed score;
//     non-director FORBIDDEN; a non-confirmed score is left untouched
//   - kpi.override: director overrides value + audit trail; approved-source
//     van (super_admin + reopened payslip only)
//   - kpi.myScore: owner reads their own score; no cross-owner read exists
//     anymore (getForUser removed — directors use kpi.list instead)

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
// Test identities — managerId tree: employee -> manager (GĐĐT); director
// (GĐKD) is UNRELATED to the employee (no managerId edge).
// ---------------------------------------------------------------------------

const EMPLOYEE_USER_ID = 'kpi-tree-employee-001';
const MANAGER_USER_ID = 'kpi-tree-manager-001';
const DIRECTOR_USER_ID = 'kpi-tree-director-001';
const OTHER_USER_ID = 'kpi-tree-other-001';

const TEST_PERIOD = '2099-07';

let facilityId: string;
let employeeAppUserId: string;
let managerAppUserId: string;
let otherAppUserId: string;

beforeEach(async () => {
  const facility = await createTestFacility('KpiTree-Facility');
  facilityId = facility.id;

  const manager = await seedAppUser({
    facilityId,
    userId: MANAGER_USER_ID,
    fullName: 'Trần Giám Đốc ĐT',
    position: 'giam_doc_dao_tao',
  });
  managerAppUserId = manager.id;
  await testDbBypass((tx) =>
    tx.appUser.update({ where: { id: manager.id }, data: { roles: ['giam_doc_dao_tao'] } }),
  );

  // Employee with manager = the director above — the managerId TREE edge.
  const employee = await seedAppUser({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    fullName: 'Nguyễn Giáo Viên',
    position: 'giao_vien',
    managerId: managerAppUserId,
  });
  employeeAppUserId = employee.id;
  await testDbBypass((tx) =>
    tx.appUser.update({ where: { id: employee.id }, data: { roles: ['giao_vien'] } }),
  );

  // Director (GĐKD) — UNRELATED to the employee (no managerId edge to them).
  await seedAppUser({
    facilityId,
    userId: DIRECTOR_USER_ID,
    fullName: 'Lê Giám Đốc KD',
    position: 'giam_doc_kinh_doanh',
  });
  await testDbBypass((tx) =>
    tx.appUser.updateMany({ where: { userId: DIRECTOR_USER_ID }, data: { roles: ['giam_doc_kinh_doanh'] } }),
  );

  // Unrelated employee (sale).
  const other = await seedAppUser({
    facilityId,
    userId: OTHER_USER_ID,
    fullName: 'Võ Người Khác',
    position: 'sale',
  });
  otherAppUserId = other.id;
  await testDbBypass((tx) => tx.appUser.update({ where: { id: other.id }, data: { roles: ['sale'] } }));
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
function superAdminCtx() {
  return buildStaffContext({ facilityId, userId: 'kpi-tree-superadmin-001', roles: ['super_admin'] });
}

const employeeCaller = () => appRouter.createCaller(employeeCtx());
const managerCaller = () => appRouter.createCaller(managerCtx());
const directorCaller = () => appRouter.createCaller(directorCtx());
const otherCaller = () => appRouter.createCaller(otherCtx());
const superAdminCaller = () => appRouter.createCaller(superAdminCtx());

// ---------------------------------------------------------------------------
// Test-only seed primitive — replaces the old `kpi.submit` seed (removed,
// red-team #10). Direct DB insert, same shape `refresh` would produce.
// ---------------------------------------------------------------------------

async function seedKpiScore(opts: {
  appUserId: string;
  period?: string;
  value?: number;
  status?: 'draft' | 'submitted' | 'confirmed' | 'approved';
}): Promise<{ id: string; status: string }> {
  return testDbBypass((tx) =>
    tx.kpiScore.create({
      data: {
        facilityId,
        appUserId: opts.appUserId,
        period: opts.period ?? TEST_PERIOD,
        value: opts.value ?? 4_000_000,
        status: opts.status ?? 'submitted',
      },
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests — kpi.confirm (managerId tree)
// ---------------------------------------------------------------------------

describe('kpi.confirm (managerId tree)', () => {
  let kpiScoreId: string;

  beforeEach(async () => {
    const score = await seedKpiScore({ appUserId: employeeAppUserId, status: 'submitted' });
    kpiScoreId = score.id;
  });

  it('direct manager confirms submitted KPI → status becomes confirmed', async () => {
    const result = await managerCaller().kpi.confirm({ kpiScoreId });
    expect(result.status).toBe('confirmed');
    expect(result.confirmedBy).toBe(MANAGER_USER_ID);
  });

  it('an unrelated director (no managerId edge) cannot confirm → FORBIDDEN', async () => {
    await expect(directorCaller().kpi.confirm({ kpiScoreId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('cannot confirm a non-submitted score', async () => {
    await managerCaller().kpi.confirm({ kpiScoreId });
    await expect(managerCaller().kpi.confirm({ kpiScoreId })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('employee cannot confirm their own submitted score → FORBIDDEN', async () => {
    await expect(employeeCaller().kpi.confirm({ kpiScoreId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ---------------------------------------------------------------------------
// Tests — kpi.bulkApprove (managerId tree — GĐKD is out-of-branch for GV)
// ---------------------------------------------------------------------------

describe('kpi.bulkApprove (managerId tree)', () => {
  let kpiScoreId: string;

  beforeEach(async () => {
    const score = await seedKpiScore({ appUserId: employeeAppUserId, status: 'submitted' });
    kpiScoreId = score.id;
    await managerCaller().kpi.confirm({ kpiScoreId });
    await testDbBypass((tx) =>
      tx.payslip.create({
        data: {
          facilityId, appUserId: employeeAppUserId, period: TEST_PERIOD, status: 'finalized',
          baseSalary: 0, variablePay: 0, kpiBonus: 0, penaltyAmount: 0, totalNet: 0,
        },
      }),
    );
  });

  it('GĐĐT (giao_vien branch) bulk-approves the confirmed KPI → status becomes approved', async () => {
    const result = await managerCaller().kpi.bulkApprove({ period: TEST_PERIOD });
    expect(result.approved).toBe(1);

    const score = await testDbBypass((tx) => tx.kpiScore.findUniqueOrThrow({ where: { id: kpiScoreId } }));
    expect(score.status).toBe('approved');
    expect(score.approvedBy).toBe(MANAGER_USER_ID);
  });

  it('GĐKD (sale branch — out of scope for this GV score) bulk-approve leaves it untouched', async () => {
    const result = await directorCaller().kpi.bulkApprove({ period: TEST_PERIOD });
    expect(result.approved).toBe(0);

    const score = await testDbBypass((tx) => tx.kpiScore.findUniqueOrThrow({ where: { id: kpiScoreId } }));
    expect(score.status).toBe('confirmed');
  });

  it('employee cannot bulk-approve → FORBIDDEN', async () => {
    await expect(employeeCaller().kpi.bulkApprove({ period: TEST_PERIOD })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('super_admin bulk-approves across both branches', async () => {
    const result = await superAdminCaller().kpi.bulkApprove({ period: TEST_PERIOD });
    expect(result.approved).toBe(1);
  });

  it('a merely-submitted (not confirmed) score is left untouched by bulkApprove', async () => {
    const submittedOnly = await seedKpiScore({ appUserId: otherAppUserId, status: 'submitted' });
    await testDbBypass((tx) =>
      tx.payslip.create({
        data: {
          facilityId, appUserId: otherAppUserId, period: TEST_PERIOD, status: 'finalized',
          baseSalary: 0, variablePay: 0, kpiBonus: 0, penaltyAmount: 0, totalNet: 0,
        },
      }),
    );
    await directorCaller().kpi.bulkApprove({ period: TEST_PERIOD });
    const score = await testDbBypass((tx) => tx.kpiScore.findUniqueOrThrow({ where: { id: submittedOnly.id } }));
    expect(score.status).toBe('submitted');
  });
});

// ---------------------------------------------------------------------------
// Tests — kpi.override
// ---------------------------------------------------------------------------

describe('kpi.override', () => {
  let kpiScoreId: string;

  beforeEach(async () => {
    const score = await seedKpiScore({ appUserId: employeeAppUserId, status: 'submitted' });
    kpiScoreId = score.id;
  });

  it('director overrides value → override=true + overrideReason set + status confirmed', async () => {
    // Branch-scope (R2-6, post-audit fix): the employee is giao_vien, so the
    // in-branch director is the GĐĐT (managerCaller), not the unrelated GĐKD
    // (directorCaller) — see the dedicated branch-scope tests below.
    const result = await managerCaller().kpi.override({
      kpiScoreId,
      value: 3_500_000,
      overrideReason: 'Điều chỉnh theo kết quả đánh giá hội đồng',
    });

    expect(Number(result.value)).toBe(3_500_000);
    expect(result.override).toBe(true);
    expect(result.overrideReason).toBe('Điều chỉnh theo kết quả đánh giá hội đồng');
    expect(result.status).toBe('confirmed');
    expect(result.confirmedBy).toBe(MANAGER_USER_ID);
  });

  it('GĐKD (out-of-branch director) cannot override a giao_vien score → FORBIDDEN', async () => {
    await expect(
      directorCaller().kpi.override({ kpiScoreId, value: 1, overrideReason: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('overriding an already-approved score requires super_admin AND a reopened (draft) payslip', async () => {
    await testDbBypass((tx) => tx.kpiScore.update({ where: { id: kpiScoreId }, data: { status: 'approved' } }));

    // Director (not super_admin) → FORBIDDEN.
    await expect(
      directorCaller().kpi.override({ kpiScoreId, value: 1, overrideReason: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // super_admin, but no payslip yet → BAD_REQUEST.
    await expect(
      superAdminCaller().kpi.override({ kpiScoreId, value: 1, overrideReason: 'x' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const payslip = await testDbBypass((tx) =>
      tx.payslip.create({
        data: {
          facilityId, appUserId: employeeAppUserId, period: TEST_PERIOD, status: 'draft',
          baseSalary: 0, variablePay: 0, kpiBonus: 0, penaltyAmount: 0, totalNet: 0,
        },
      }),
    );
    expect(payslip.status).toBe('draft'); // reopened state

    const result = await superAdminCaller().kpi.override({
      kpiScoreId,
      value: 2_000_000,
      overrideReason: 'Phát hiện sai sót sau tất toán',
    });
    expect(result.override).toBe(true);
    expect(Number(result.value)).toBe(2_000_000);
    expect(result.status).toBe('confirmed');
  });

  it('director cannot override their own KPI score (anti-self)', async () => {
    // Director has no slip in this system, but confirm the code path holds
    // even if a score happened to be attributed to their own appUserId.
    const selfOwnedScore = await testDbBypass((tx) =>
      tx.appUser.findFirstOrThrow({ where: { userId: DIRECTOR_USER_ID, facilityId } }),
    );
    const ownScore = await seedKpiScore({ appUserId: selfOwnedScore.id, status: 'submitted', period: '2099-08' });
    await expect(
      directorCaller().kpi.override({ kpiScoreId: ownScore.id, value: 1, overrideReason: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('employee cannot override (missing kpi.approve permission) → FORBIDDEN', async () => {
    await expect(
      employeeCaller().kpi.override({ kpiScoreId, value: 1, overrideReason: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ---------------------------------------------------------------------------
// Tests — kpi.myScore (self-scoped read; cross-owner read no longer exists)
// ---------------------------------------------------------------------------

describe('kpi.myScore', () => {
  beforeEach(async () => {
    await seedKpiScore({ appUserId: employeeAppUserId, status: 'submitted' });
  });

  it('employee reads their own KPI score', async () => {
    const result = await employeeCaller().kpi.myScore({ period: TEST_PERIOD });
    expect(result?.appUserId).toBe(employeeAppUserId);
  });

  it('an unrelated employee has no own score for this period → null', async () => {
    const result = await otherCaller().kpi.myScore({ period: TEST_PERIOD });
    expect(result).toBeNull();
  });

  it('a director sees the score via kpi.list (branch-scoped), not a direct getForUser call', async () => {
    const rows = await managerCaller().kpi.list({ period: TEST_PERIOD });
    expect(rows.some((r) => r.appUserId === employeeAppUserId)).toBe(true);
  });
});
