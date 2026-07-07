// P3-II payroll integration tests (US-023, WF-P3-05/06, QĐ0025/0012).
//
// Covers:
//   - payslip.assemble creates/updates a draft Payslip from live TimePunch data
//   - penalty is an independent deduction line (never merged into variablePay)
//   - punch without approved shift → flaggedPunches, NOT penalized
//   - finalize locks; cannot assemble again until reopen
//   - payslip.getForUser: own readable, other user FORBIDDEN, GĐKD readable
//   - compensation.upsertRate: creates/updates SalaryRate

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

const DIRECTOR_USER_ID  = 'payroll-test-director-001';
const EMPLOYEE_USER_ID  = 'payroll-test-employee-001';
const OTHER_USER_ID     = 'payroll-test-other-001';

// Period where we'll seed test data — far in the future so no real punches interfere
const TEST_PERIOD = '2099-06';
// A date within the test period for shift entries and punches
const TEST_DATE = '2099-06-10';

// Shift times: 09:00–17:00 ICT
const SHIFT_START_TIME = '09:00';
const SHIFT_END_TIME   = '17:00';

// Clock-in 30 min late (09:30 ICT), clock-out 30 min early (16:30 ICT)
const LATE_CLOCKIN_UTC  = ictToUtc(TEST_DATE, '09:30');  // 30 min late
const EARLY_CLOCKOUT_UTC = ictToUtc(TEST_DATE, '16:30'); // 30 min early

// Expected penalty: 30×500 + 30×1000 = 15000 + 30000 = 45000
const EXPECTED_LATE_MINUTES  = 30;
const EXPECTED_EARLY_MINUTES = 30;
const EXPECTED_PENALTY       = 30 * 500 + 30 * 1000; // 45000

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
        selectionMode: 'SINGLE',
      },
    }),
  );
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

  // Seed SalaryRate via compensation.upsertRate
  await directorCaller().compensation.upsertRate({
    appUserId: employeeAppUserId,
    baseSalary: 10_000_000,
    variablePayRate: 0.1,
    kpiMax: 2_000_000,
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
const otherCaller    = () => appRouter.createCaller(otherEmployeeCtx());

// ---------------------------------------------------------------------------
// Tests — compensation.upsertRate
// ---------------------------------------------------------------------------

describe('compensation.upsertRate', () => {
  it('creates a SalaryRate and can update it', async () => {
    // Already created in beforeEach — verify by reading from DB
    const rate = await testDbBypass((tx) =>
      tx.salaryRate.findUnique({ where: { appUserId: employeeAppUserId } }),
    );
    expect(rate).not.toBeNull();
    expect(Number(rate!.baseSalary)).toBe(10_000_000);
    expect(Number(rate!.variablePayRate)).toBe(0.1);

    // Update
    await directorCaller().compensation.upsertRate({
      appUserId: employeeAppUserId,
      baseSalary: 12_000_000,
      variablePayRate: 0.15,
      kpiMax: 3_000_000,
    });

    const updated = await testDbBypass((tx) =>
      tx.salaryRate.findUnique({ where: { appUserId: employeeAppUserId } }),
    );
    expect(Number(updated!.baseSalary)).toBe(12_000_000);
  });

  it('non-director cannot upsert rate', async () => {
    await expect(
      employeeCaller().compensation.upsertRate({
        appUserId: employeeAppUserId,
        baseSalary: 9_000_000,
        variablePayRate: 0.1,
        kpiMax: 1_000_000,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
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
    // Penalty is an INDEPENDENT line: lateMinutes×500 + earlyMinutes×1000
    expect(Number(payslip.penaltyAmount)).toBe(EXPECTED_PENALTY);
  });

  it('penalty is independent: variablePay = baseSalary × variablePayRate (not affected by penalty)', async () => {
    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    const baseSalary = Number(payslip.baseSalary);
    const variablePay = Number(payslip.variablePay);
    const penaltyAmount = Number(payslip.penaltyAmount);

    // variablePay must equal baseSalary × 0.1, regardless of penalty
    expect(variablePay).toBeCloseTo(baseSalary * 0.1, 2);
    // penaltyAmount must NOT be zero (we have late+early punches)
    expect(penaltyAmount).toBeGreaterThan(0);
    // totalNet = base + variable + kpi - penalty (no kpi for now)
    expect(Number(payslip.totalNet)).toBeCloseTo(
      baseSalary + variablePay + Number(payslip.kpiBonus) - penaltyAmount,
      0,
    );
  });

  it('updates an existing draft Payslip on re-assemble', async () => {
    const first = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // Change salary rate then reassemble
    await directorCaller().compensation.upsertRate({
      appUserId: employeeAppUserId,
      baseSalary: 20_000_000,
      variablePayRate: 0.05,
      kpiMax: 2_000_000,
    });

    const second = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(second.id).toBe(first.id); // same row updated
    expect(Number(second.baseSalary)).toBe(20_000_000);
  });

  it('punch on day without approved shift → flaggedPunches (NOT penalized)', async () => {
    // Seed another punch on a day with no approved shift entry
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

    // The extra punch should be flagged, NOT penalized
    expect(payslip.flaggedPunches).toBeGreaterThan(0);
    // Penalty from the extra punch day should NOT be added
    expect(Number(payslip.penaltyAmount)).toBe(EXPECTED_PENALTY); // unchanged
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
    // otherEmployee tries to read employeeAppUserId's payslip
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
