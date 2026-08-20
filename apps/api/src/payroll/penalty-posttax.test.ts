// P3-II payroll integration tests (US-023, WF-P3-05/06, QĐ0025/0012) —
// REWRITTEN for the salary-tier model (HR remediation phase 2, R3-4/R3-6).
//
// Covers:
//   - payslip.assemble creates/updates a draft Payslip from live TimePunch data
//   - baseSalary comes from the assigned SalaryTier (salaryTier.create +
//     compensation.assignTier), NOT the retired SalaryRate columns
//   - penalty is an independent deduction line (never merged into kpiBonus)
//   - per-shift penalty (R3-6/R3-7): GV MULTIPLE-mode 2 shifts/day pair
//     correctly and independently; an absent shift carries no penalty
//   - deterministic ordering regardless of DB row insertion order
//   - punch without an approved shift entry → flaggedPunches, NOT penalized
//   - KpiScore status gate: confirmed/approved count, submitted does not
//   - no tier assigned → FORBIDDEN
//   - target role GĐ/super_admin → BAD_REQUEST ("lương GĐ ngoài hệ thống")
//   - finalize locks; cannot assemble again until reopen
//   - payslip.getForUser: own readable, other user FORBIDDEN, GĐKD readable

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
let employeeAppUserId: string;
let gvTierId: string;

const DIRECTOR_USER_ID = 'payroll-test-director-001';
const EMPLOYEE_USER_ID = 'payroll-test-employee-001';
const OTHER_USER_ID = 'payroll-test-other-001';

// Period where we'll seed test data — far in the future so no real punches interfere
const TEST_PERIOD = '2099-06';
// A date within the test period for shift entries and punches
const TEST_DATE = '2099-06-10';

// Shift times: 09:00–17:00 ICT
const SHIFT_START_TIME = '09:00';
const SHIFT_END_TIME = '17:00';

// Clock-in 30 min late (09:30 ICT), clock-out 30 min early (16:30 ICT)
const LATE_CLOCKIN_UTC = ictToUtc(TEST_DATE, '09:30'); // 30 min late
const EARLY_CLOCKOUT_UTC = ictToUtc(TEST_DATE, '16:30'); // 30 min early

// docs/20 §3: fallback 500đ/phút muộn, 1000đ/phút sớm when no CompensationPolicy.
const EXPECTED_LATE_MINUTES = 30;
const EXPECTED_EARLY_MINUTES = 30;
const EXPECTED_PENALTY = 30 * 500 + 30 * 1000; // 45000
// Fixture tier amount — docs/19, docs/20, docs/22 do not publish a SalaryTier catalog.
// TODO(golden: needs operator): GV/KD baseSalary, unitRate, requiredShifts, requiredMetric.
const TIER_BASE_SALARY = 10_000_000;
let gvGroupId: string;

beforeEach(async () => {
  const facility = await createTestFacility('PayrollTest-Facility');
  facilityId = facility.id;

  const employee = await seedAppUser({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    fullName: 'Nguyễn Nhân Viên',
    position: 'giao_vien',
  });
  employeeAppUserId = employee.id;
  await testDbBypass((tx) =>
    tx.appUser.update({ where: { id: employee.id }, data: { roles: ['giao_vien'] } }),
  );

  await seedAppUser({
    facilityId,
    userId: OTHER_USER_ID,
    fullName: 'Trần Người Khác',
    position: 'sale',
  });

  // Director (no AppUser needed for director actions in payroll)
  await seedAppUser({
    facilityId,
    userId: DIRECTOR_USER_ID,
    fullName: 'Lê Giám Đốc KD',
    position: 'giam_doc_kinh_doanh',
  });

  // Seed ShiftGroup + ShiftTemplate
  const group = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: {
        facilityId,
        name: 'Ca Giáo Viên Test',
        type: 'GIAO_VIEN',
        selectionMode: 'MULTIPLE',
      },
    }),
  );
  gvGroupId = group.id;
  const template = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: {
        facilityId,
        shiftGroupId: group.id,
        name: 'Ca Ngày',
        startTime: SHIFT_START_TIME,
        endTime: SHIFT_END_TIME,
      },
    }),
  );

  // Seed an approved ShiftRegistration + Entry for TEST_DATE
  const reg = await testDbBypass((tx) =>
    tx.shiftRegistration.create({
      data: {
        facilityId,
        appUserId: employeeAppUserId,
        shiftGroupId: group.id,
        fromDate: ictToUtc(TEST_DATE, '00:00'),
        toDate: ictToUtc(TEST_DATE, '00:00'),
        status: 'approved',
        selectionMode: 'SINGLE',
      },
    }),
  );
  await testDbBypass((tx) =>
    tx.shiftRegistrationEntry.create({
      data: {
        facilityId,
        shiftRegistrationId: reg.id,
        date: ictToUtc(TEST_DATE, '00:00'),
        shiftTemplateId: template.id,
      },
    }),
  );

  // Seed TimePunches: clock-in 09:30, clock-out 16:30 (late + early)
  await testDbBypass((tx) =>
    tx.timePunch.create({
      data: {
        facilityId,
        appUserId: employeeAppUserId,
        method: 'ip',
        punchAt: LATE_CLOCKIN_UTC,
      },
    }),
  );
  await testDbBypass((tx) =>
    tx.timePunch.create({
      data: {
        facilityId,
        appUserId: employeeAppUserId,
        method: 'ip',
        punchAt: EARLY_CLOCKOUT_UTC,
      },
    }),
  );

  // Seed SalaryTier + assignTier (R3-4 — upsertRate is gone). Created via
  // super_admin (bypasses the caller-vs-tier branch-scope check, R2-6
  // post-audit fix) — directorCaller is giam_doc_kinh_doanh and would be
  // out-of-branch for this GIAO_VIEN tier.
  const tier = await superAdminCaller().salaryTier.create({
    name: 'Bậc GV Test',
    type: 'GIAO_VIEN',
    baseSalary: TIER_BASE_SALARY,
    unitRate: 100_000,
    requiredShifts: 20,
    requiredMetric: 120,
  });
  gvTierId = tier.id;
  await superAdminCaller().compensation.assignTier({
    appUserId: employeeAppUserId,
    tierId: gvTierId,
  });
});

afterEach(async () => {
  await cleanupFacility(facilityId);
});

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function directorCtx() {
  return buildStaffContext({
    facilityId,
    userId: DIRECTOR_USER_ID,
    roles: ['giam_doc_kinh_doanh'],
  });
}

function employeeCtx() {
  return buildStaffContext({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    roles: ['giao_vien'],
  });
}

function otherEmployeeCtx() {
  return buildStaffContext({
    facilityId,
    userId: OTHER_USER_ID,
    roles: ['sale'],
  });
}

const directorCaller = () => appRouter.createCaller(directorCtx());
const employeeCaller = () => appRouter.createCaller(employeeCtx());
const otherCaller = () => appRouter.createCaller(otherEmployeeCtx());
// super_admin bypasses the caller-vs-tier branch-scope check (R2-6 post-audit
// fix) — directorCtx is giam_doc_kinh_doanh and would be out-of-branch for
// the GIAO_VIEN tiers this file assigns in beforeEach.
const superAdminCaller = () =>
  appRouter.createCaller(
    buildStaffContext({ facilityId, userId: 'payroll-test-superadmin-001', roles: ['super_admin'] }),
  );
const gddtCaller = () =>
  appRouter.createCaller(
    buildStaffContext({ facilityId, userId: 'payroll-test-gddt-001', roles: ['giam_doc_dao_tao'] }),
  );

// ---------------------------------------------------------------------------
// Tests — salaryTier.create + compensation.assignTier
// ---------------------------------------------------------------------------

describe('salaryTier.create + compensation.assignTier', () => {
  it('assignTier creates a SalaryRate pointing at the tier (legacy cols stay null)', async () => {
    const rate = await testDbBypass((tx) =>
      tx.salaryRate.findUnique({ where: { appUserId: employeeAppUserId } }),
    );
    expect(rate).not.toBeNull();
    expect(rate!.tierId).toBe(gvTierId);
    expect(rate!.baseSalary).toBeNull();
  });

  it('non-director cannot create a tier or assign one', async () => {
    await expect(
      employeeCaller().salaryTier.create({
        name: 'Bậc rogue',
        type: 'GIAO_VIEN',
        baseSalary: 1,
        unitRate: 1,
        requiredShifts: 1,
        requiredMetric: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      employeeCaller().compensation.assignTier({ appUserId: employeeAppUserId, tierId: gvTierId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('assignTier rejects a tier whose type does not match the target role', async () => {
    const saleTier = await directorCaller().salaryTier.create({
      name: 'Bậc Sale Test',
      type: 'KINH_DOANH',
      baseSalary: 8_000_000,
      unitRate: 50_000,
      requiredShifts: 22,
      requiredMetric: 100_000_000,
    });
    // employeeAppUserId is giao_vien — a KINH_DOANH tier must be rejected.
    await expect(
      directorCaller().compensation.assignTier({ appUserId: employeeAppUserId, tierId: saleTier.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('assignTier rejects a target whose role is GĐ/super_admin ("lương GĐ ngoài hệ thống")', async () => {
    const director2 = await seedAppUser({
      facilityId,
      userId: 'payroll-test-director-002',
      fullName: 'Phạm Giám Đốc ĐT',
      position: 'giam_doc_dao_tao',
    });
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: director2.id }, data: { roles: ['giam_doc_dao_tao'] } }),
    );
    await expect(
      directorCaller().compensation.assignTier({ appUserId: director2.id, tierId: gvTierId }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // -------------------------------------------------------------------------
  // Branch-scope (R2-6, post-audit fix): caller's director ROLE must match
  // the tier's `type` — independent of the existing target-role↔tier.type
  // defense-in-depth check above.
  // -------------------------------------------------------------------------

  it('GĐKD (sale branch) assigning a GIAO_VIEN tier → FORBIDDEN', async () => {
    // employeeAppUserId + gvTierId are both giao_vien/GIAO_VIEN — the target
    // role matches the tier, but the CALLER (gdkd) is out of branch scope.
    await expect(
      directorCaller().compensation.assignTier({ appUserId: employeeAppUserId, tierId: gvTierId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('GĐĐT (giao_vien branch) assigning a KINH_DOANH tier → FORBIDDEN', async () => {
    const saleUser = await seedAppUser({
      facilityId,
      userId: 'payroll-test-branch-sale-001',
      fullName: 'Đỗ Nhân Viên Sale',
      position: 'sale',
    });
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: saleUser.id }, data: { roles: ['sale'] } }),
    );
    const saleTier = await directorCaller().salaryTier.create({
      name: 'Bậc Sale Branch Test',
      type: 'KINH_DOANH',
      baseSalary: 8_000_000,
      unitRate: 50_000,
      requiredShifts: 22,
      requiredMetric: 100_000_000,
    });
    await expect(
      gddtCaller().compensation.assignTier({ appUserId: saleUser.id, tierId: saleTier.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('super_admin assigns tiers across both branches', async () => {
    const saleUser = await seedAppUser({
      facilityId,
      userId: 'payroll-test-branch-sale-002',
      fullName: 'Bùi Nhân Viên Sale',
      position: 'sale',
    });
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: saleUser.id }, data: { roles: ['sale'] } }),
    );
    const saleTier = await directorCaller().salaryTier.create({
      name: 'Bậc Sale Superadmin Test',
      type: 'KINH_DOANH',
      baseSalary: 8_000_000,
      unitRate: 50_000,
      requiredShifts: 22,
      requiredMetric: 100_000_000,
    });

    const saleRate = await superAdminCaller().compensation.assignTier({
      appUserId: saleUser.id,
      tierId: saleTier.id,
    });
    expect(saleRate.tierId).toBe(saleTier.id);

    const gvRate = await superAdminCaller().compensation.assignTier({
      appUserId: employeeAppUserId,
      tierId: gvTierId,
    });
    expect(gvRate.tierId).toBe(gvTierId);
  });
});

// ---------------------------------------------------------------------------
// Tests — payslip.assemble
// ---------------------------------------------------------------------------

describe('payslip.assemble', () => {
  it('creates a draft Payslip with correct penalty from live TimePunch data', async () => {
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.status).toBe('draft');
    expect(payslip.lateMinutes).toBe(EXPECTED_LATE_MINUTES);
    expect(payslip.earlyMinutes).toBe(EXPECTED_EARLY_MINUTES);
    // Penalty is an INDEPENDENT line: lateMinutes×500 + earlyMinutes×1000 (docs/20 §3)
    expect(Number(payslip.penaltyAmount)).toBe(EXPECTED_PENALTY);
    // baseSalary comes from the assigned SalaryTier
    expect(Number(payslip.baseSalary)).toBe(TIER_BASE_SALARY);
    // variablePay is ALWAYS 0 — deprecated column (docs/22 ADR 0044)
    expect(Number(payslip.variablePay)).toBe(0);
  });

  it('totalNet = baseSalary + kpiBonus − penaltyAmount (docs/20 §3); clamp ≥ 0; penalty ≤ earnings', async () => {
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    const baseSalary = Number(payslip.baseSalary);
    const kpiBonus = Number(payslip.kpiBonus);
    const penaltyAmount = Number(payslip.penaltyAmount);

    expect(penaltyAmount).toBeGreaterThan(0);
    expect(Number(payslip.totalNet)).toBe(baseSalary + kpiBonus - penaltyAmount);
    expect(Number(payslip.totalNet)).toBeGreaterThanOrEqual(0); // docs/20 §3 clamp
    expect(penaltyAmount).toBeLessThanOrEqual(baseSalary + kpiBonus); // docs/20 §3 cap
  });

  it('docs/20 §3: penaltyAmount is capped at baseSalary+kpiBonus; totalNet never negative', async () => {
    // Tiny fixture base (not a catalog rate) so the live 45_000 raw penalty exceeds earnings.
    const tiny = await superAdminCaller().salaryTier.create({
      name: 'Bậc GV Trần cap',
      type: 'GIAO_VIEN',
      baseSalary: 20_000,
      unitRate: 100_000,
      requiredShifts: 20,
      requiredMetric: 120,
    });
    await superAdminCaller().compensation.assignTier({
      appUserId: employeeAppUserId,
      tierId: tiny.id,
    });

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(EXPECTED_PENALTY).toBeGreaterThan(20_000);
    expect(Number(payslip.baseSalary)).toBe(20_000);
    expect(Number(payslip.kpiBonus)).toBe(0);
    expect(Number(payslip.penaltyAmount)).toBe(20_000);
    expect(Number(payslip.totalNet)).toBe(0);
  });

  it('updates an existing draft Payslip on re-assemble (e.g. after re-assigning a bigger tier)', async () => {
    const first = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    const biggerTier = await superAdminCaller().salaryTier.create({
      name: 'Bậc GV Lớn',
      type: 'GIAO_VIEN',
      baseSalary: 20_000_000,
      unitRate: 150_000,
      requiredShifts: 22,
      requiredMetric: 150,
    });
    await superAdminCaller().compensation.assignTier({
      appUserId: employeeAppUserId,
      tierId: biggerTier.id,
    });

    const second = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(second.id).toBe(first.id); // same row updated
    expect(Number(second.baseSalary)).toBe(20_000_000);
  });

  it('punch on day without approved shift → flaggedPunches (NOT penalized)', async () => {
    const extraDate = '2099-06-20';
    await testDbBypass((tx) =>
      tx.timePunch.create({
        data: {
          facilityId,
          appUserId: employeeAppUserId,
          method: 'ip',
          punchAt: ictToUtc(extraDate, '10:00'),
        },
      }),
    );

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.flaggedPunches).toBeGreaterThan(0);
    expect(Number(payslip.penaltyAmount)).toBe(EXPECTED_PENALTY); // unchanged
  });

  it('ADR 0043 — an extra mid-day punch on a day WITH a registered shift does NOT inflate flaggedPunches', async () => {
    // TEST_DATE already has one registered shift + 2 punches (09:30/16:30,
    // seeded in beforeEach). Add a 3rd stray punch mid-day — under the new
    // day-level model only the day's first/last punch matter for pairing,
    // and flaggedPunches is scoped ONLY to days with NO registered shift at
    // all (router.ts's separate loop) — a mid-day punch on a shift-day is
    // simply invisible, not flagged (deliberate narrowing vs the old
    // per-shift `unassignedPunches` count, ledger item R5).
    await testDbBypass((tx) =>
      tx.timePunch.create({
        data: { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TEST_DATE, '12:00') },
      }),
    );

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.flaggedPunches).toBe(0);
    expect(payslip.lateMinutes).toBe(EXPECTED_LATE_MINUTES);
    expect(payslip.earlyMinutes).toBe(EXPECTED_EARLY_MINUTES);
  });

  it('no tier assigned → FORBIDDEN ("chưa gán bậc lương")', async () => {
    const noTierUser = await seedAppUser({
      facilityId,
      userId: 'payroll-test-no-tier-001',
      fullName: 'Chưa Gán Bậc',
      position: 'giao_vien',
    });
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: noTierUser.id }, data: { roles: ['giao_vien'] } }),
    );

    await expect(
      directorCaller().payslip.assemble({ appUserId: noTierUser.id, period: TEST_PERIOD }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('target role GĐ/super_admin → BAD_REQUEST ("lương GĐ ngoài hệ thống")', async () => {
    const director2 = await seedAppUser({
      facilityId,
      userId: 'payroll-test-director-003',
      fullName: 'GĐ Ngoài Hệ Thống',
      position: 'giam_doc_kinh_doanh',
    });
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: director2.id }, data: { roles: ['giam_doc_kinh_doanh'] } }),
    );

    await expect(
      directorCaller().payslip.assemble({ appUserId: director2.id, period: TEST_PERIOD }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ---------------------------------------------------------------------------
// Tests — per-shift penalty (R3-6/R3-7 — MULTIPLE-mode determinism)
// ---------------------------------------------------------------------------

describe('payslip.assemble — per-shift penalty (GV MULTIPLE mode)', () => {
  const TWO_SHIFT_DATE = '2099-06-15';
  let ca1Id: string;
  let ca2Id: string;

  beforeEach(async () => {
    ca1Id = (
      await testDbBypass((tx) =>
        tx.shiftTemplate.create({
          data: { facilityId, shiftGroupId: gvGroupId, name: 'Ca 1', startTime: '08:00', endTime: '12:00' },
        }),
      )
    ).id;
    ca2Id = (
      await testDbBypass((tx) =>
        tx.shiftTemplate.create({
          data: { facilityId, shiftGroupId: gvGroupId, name: 'Ca 2', startTime: '13:00', endTime: '17:00' },
        }),
      )
    ).id;
  });

  async function seedTwoShiftDay(): Promise<void> {
    const reg = await testDbBypass((tx) =>
      tx.shiftRegistration.create({
        data: {
          facilityId,
          appUserId: employeeAppUserId,
          shiftGroupId: gvGroupId,
          fromDate: ictToUtc(TWO_SHIFT_DATE, '00:00'),
          toDate: ictToUtc(TWO_SHIFT_DATE, '00:00'),
          status: 'approved',
          selectionMode: 'MULTIPLE',
        },
      }),
    );
    // Insert ca2's entry BEFORE ca1's — DB row order must NOT affect
    // outcome; the router sorts by ShiftTemplate.startTime (R3-6).
    await testDbBypass((tx) =>
      tx.shiftRegistrationEntry.create({
        data: { facilityId, shiftRegistrationId: reg.id, date: ictToUtc(TWO_SHIFT_DATE, '00:00'), shiftTemplateId: ca2Id },
      }),
    );
    await testDbBypass((tx) =>
      tx.shiftRegistrationEntry.create({
        data: { facilityId, shiftRegistrationId: reg.id, date: ictToUtc(TWO_SHIFT_DATE, '00:00'), shiftTemplateId: ca1Id },
      }),
    );
  }

  it('2 shifts/day: both on-time, back-to-back punches pair correctly (no false penalty)', async () => {
    await seedTwoShiftDay();
    await testDbBypass((tx) =>
      tx.timePunch.createMany({
        data: [
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '07:55') },
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '12:05') },
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '12:55') },
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '17:05') },
        ],
      }),
    );

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // Only TEST_DATE's late(30)+early(30) contributes — the 2-shift day is on-time.
    expect(payslip.lateMinutes).toBe(EXPECTED_LATE_MINUTES);
    expect(payslip.earlyMinutes).toBe(EXPECTED_EARLY_MINUTES);
    expect(payslip.unpunchedDays).toBe(0);
  });

  it('one absent shift on the 2-shift day does not penalize the other shift, and counts unpunched', async () => {
    await seedTwoShiftDay();
    // Only ca2's punches exist; ca1 has none → ca1 is "vắng" (absent).
    await testDbBypass((tx) =>
      tx.timePunch.createMany({
        data: [
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '13:00') },
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '17:00') },
        ],
      }),
    );

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // ca1 absent → +1 unpunched, NO minute penalty from it.
    expect(payslip.unpunchedDays).toBe(1);
    // Only TEST_DATE's late/early minutes are present — ca2 was on-time.
    expect(payslip.lateMinutes).toBe(EXPECTED_LATE_MINUTES);
    expect(payslip.earlyMinutes).toBe(EXPECTED_EARLY_MINUTES);
    expect(Number(payslip.penaltyAmount)).toBe(EXPECTED_PENALTY);
  });

  it('ADR 0043 — a mid-day late punch on shift 2 is invisible to day-level late/early (only day\'s first/last punch matter)', async () => {
    await seedTwoShiftDay();
    await testDbBypass((tx) =>
      tx.timePunch.createMany({
        data: [
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '07:55') },
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '12:00') },
          // ca2's in-punch (13:20) is 20 min "late" relative to ca2 alone, but
          // under the day-level model only the day's absolute FIRST (07:55)
          // and LAST (17:00) punch determine late/early — this mid-day punch
          // no longer produces a penalty on its own (ADR 0043 §1, deliberate
          // loosening vs the old per-shift model — see plan Validation Log #1).
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '13:20') },
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TWO_SHIFT_DATE, '17:00') },
        ],
      }),
    );

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // TWO_SHIFT_DATE's day-level pair is [07:55, 17:00] — checkin before ca1's
    // 08:00 start (not late) and checkout after ca2's 17:00 end (not early),
    // so this day contributes 0. Only TEST_DATE's 30/30 shows.
    expect(payslip.lateMinutes).toBe(EXPECTED_LATE_MINUTES);
    expect(payslip.earlyMinutes).toBe(EXPECTED_EARLY_MINUTES);
    expect(payslip.unpunchedDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — KpiScore status gate (confirmed/approved count, submitted does not)
// ---------------------------------------------------------------------------

describe('payslip.assemble — KpiScore status gate', () => {
  it('confirmed KpiScore.value is included as kpiBonus ("Phần KPI")', async () => {
    await testDbBypass((tx) =>
      tx.kpiScore.create({
        data: { facilityId, appUserId: employeeAppUserId, period: TEST_PERIOD, value: 1_200_000, status: 'confirmed' },
      }),
    );
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(Number(payslip.kpiBonus)).toBe(1_200_000);
    expect(Number(payslip.baseSalary)).toBe(TIER_BASE_SALARY);
    expect(Number(payslip.penaltyAmount)).toBe(EXPECTED_PENALTY);
    // docs/20 §3 + docs/22 ADR 0044: kpiBonus is the "Phần KPI" (confirmed KpiScore.value)
    expect(Number(payslip.totalNet)).toBe(TIER_BASE_SALARY + 1_200_000 - EXPECTED_PENALTY);
    expect(Number(payslip.totalNet)).toBeGreaterThanOrEqual(0);
  });

  it('approved KpiScore.value is included as kpiBonus', async () => {
    await testDbBypass((tx) =>
      tx.kpiScore.create({
        data: { facilityId, appUserId: employeeAppUserId, period: TEST_PERIOD, value: 900_000, status: 'approved' },
      }),
    );
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(Number(payslip.kpiBonus)).toBe(900_000);
  });

  it('submitted KpiScore.value is NOT counted (only confirmed|approved)', async () => {
    await testDbBypass((tx) =>
      tx.kpiScore.create({
        data: { facilityId, appUserId: employeeAppUserId, period: TEST_PERIOD, value: 700_000, status: 'submitted' },
      }),
    );
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(Number(payslip.kpiBonus)).toBe(0);
  });

  it('draft KpiScore.value is NOT counted', async () => {
    await testDbBypass((tx) =>
      tx.kpiScore.create({
        data: { facilityId, appUserId: employeeAppUserId, period: TEST_PERIOD, value: 500_000, status: 'draft' },
      }),
    );
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(Number(payslip.kpiBonus)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — payslip.finalize + payslip.reopen
// ---------------------------------------------------------------------------

describe('payslip.finalize + reopen', () => {
  it('finalize locks the payslip; assemble again → BAD_REQUEST; reopen allows reassembly', async () => {
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // Finalize
    const finalized = await directorCaller().payslip.finalize({ payslipId: payslip.id });
    expect(finalized.status).toBe('finalized');

    // Assemble on finalized → blocked
    await expect(
      directorCaller().payslip.assemble({
        appUserId: employeeAppUserId,
        period: TEST_PERIOD,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    // Reopen → draft
    const reopened = await directorCaller().payslip.reopen({ payslipId: payslip.id });
    expect(reopened.status).toBe('draft');

    // Now assemble works again
    const reassembled = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(reassembled.status).toBe('draft');
  });
});

// ---------------------------------------------------------------------------
// Tests — payslip.getForUser (privacy gate)
// ---------------------------------------------------------------------------

describe('payslip.getForUser privacy gate', () => {
  let payslipId: string;

  beforeEach(async () => {
    const p = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    payslipId = p.id;
  });

  it('employee can read their own payslip', async () => {
    const result = await employeeCaller().payslip.getForUser({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(result.id).toBe(payslipId);
  });

  it('other employee cannot read someone else\'s payslip → FORBIDDEN', async () => {
    await expect(
      otherCaller().payslip.getForUser({
        appUserId: employeeAppUserId,
        period: TEST_PERIOD,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('director (GĐKD) can read any employee payslip in facility', async () => {
    const result = await directorCaller().payslip.getForUser({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(result.id).toBe(payslipId);
  });
});
