// HR remediation phase 4: `payslip.my` — self-scoped payslip read, no
// dedicated permission key. Returns null when nothing has been assembled yet.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, seedAppUser, testDbBypass } from '../test/db.js';

let facilityId: string;
let employeeAppUserId: string;

const EMPLOYEE_USER_ID = 'payslip-my-employee-001';
const OTHER_USER_ID = 'payslip-my-other-001';

const TEST_PERIOD = '2099-07';

const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

function employeeCtx() {
  return buildStaffContext({ facilityId, userId: EMPLOYEE_USER_ID, roles: ['giao_vien'] });
}
function otherCtx() {
  return buildStaffContext({ facilityId, userId: OTHER_USER_ID, roles: ['sale'] });
}

beforeEach(async () => {
  const facility = await createTestFacility('PayslipMy-Facility');
  facilityId = facility.id;

  const employee = await seedAppUser({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    fullName: 'Nguyễn Nhân Viên',
    position: 'giao_vien',
  });
  employeeAppUserId = employee.id;

  await seedAppUser({ facilityId, userId: OTHER_USER_ID, fullName: 'Trần Người Khác', position: 'sale' });
});

afterEach(async () => {
  await cleanupFacility(facilityId);
});

describe('payslip.my', () => {
  it('returns null when nothing has been assembled for the period', async () => {
    const result = await caller(employeeCtx()).payslip.my({ period: TEST_PERIOD });
    expect(result).toBeNull();
  });

  it("returns the caller's own payslip once assembled", async () => {
    await testDbBypass((tx) =>
      tx.payslip.create({
        data: {
          facilityId,
          appUserId: employeeAppUserId,
          period: TEST_PERIOD,
          status: 'draft',
          baseSalary: 10_000_000,
          variablePay: 0,
          kpiBonus: 0,
          penaltyAmount: 0,
          totalNet: 10_000_000,
          lateMinutes: 0,
          earlyMinutes: 0,
          unpunchedDays: 0,
          flaggedPunches: 0,
        },
      }),
    );

    const result = await caller(employeeCtx()).payslip.my({ period: TEST_PERIOD });
    expect(result?.period).toBe(TEST_PERIOD);
    expect(Number(result?.totalNet)).toBe(10_000_000);
  });

  it("does not return another user's payslip", async () => {
    await testDbBypass((tx) =>
      tx.payslip.create({
        data: {
          facilityId,
          appUserId: employeeAppUserId,
          period: TEST_PERIOD,
          status: 'draft',
          baseSalary: 10_000_000,
          variablePay: 0,
          kpiBonus: 0,
          penaltyAmount: 0,
          totalNet: 10_000_000,
          lateMinutes: 0,
          earlyMinutes: 0,
          unpunchedDays: 0,
          flaggedPunches: 0,
        },
      }),
    );

    const result = await caller(otherCtx()).payslip.my({ period: TEST_PERIOD });
    expect(result).toBeNull();
  });
});
