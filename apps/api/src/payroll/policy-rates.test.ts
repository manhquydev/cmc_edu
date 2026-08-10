// HR remediation phase 2: CompensationPolicy drives payslip.assemble's
// late/early penalty rates (fallback 500/1000 when a facility has none),
// and compensationPolicy.get/upsert are correctly facility-scoped (RLS).

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

let facilityA: string;
let facilityB: string;
let employeeAppUserId: string;

const DIRECTOR_A = 'policy-rates-director-a';
const DIRECTOR_B = 'policy-rates-director-b';
const EMPLOYEE_A = 'policy-rates-employee-a';

const TEST_PERIOD = '2099-09';
const TEST_DATE = '2099-09-10';
const SHIFT_START = '09:00';
const SHIFT_END = '17:00';

const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);
// super_admin bypasses the permission registry entirely (can()), so
// compensationPolicy.manage's [] roster is exercised via this role.
const superAdminACtx = () =>
  buildStaffContext({ facilityId: facilityA, userId: DIRECTOR_A, roles: ['super_admin'] });
const superAdminBCtx = () =>
  buildStaffContext({ facilityId: facilityB, userId: DIRECTOR_B, roles: ['super_admin'] });
const gdkdACtx = () =>
  buildStaffContext({ facilityId: facilityA, userId: DIRECTOR_A, roles: ['giam_doc_kinh_doanh'] });

beforeEach(async () => {
  const fA = await createTestFacility('PolicyRatesTest-Facility-A');
  const fB = await createTestFacility('PolicyRatesTest-Facility-B');
  facilityA = fA.id;
  facilityB = fB.id;

  const employee = await seedAppUser({
    facilityId: facilityA,
    userId: EMPLOYEE_A,
    fullName: 'Nguyễn Nhân Viên',
    position: 'giao_vien',
  });
  employeeAppUserId = employee.id;
  await testDbBypass((tx) =>
    tx.appUser.update({ where: { id: employee.id }, data: { roles: ['giao_vien'] } }),
  );

  await seedAppUser({ facilityId: facilityA, userId: DIRECTOR_A, fullName: 'GĐ A', position: 'giam_doc_kinh_doanh' });
  await seedAppUser({ facilityId: facilityB, userId: DIRECTOR_B, fullName: 'GĐ B', position: 'giam_doc_kinh_doanh' });

  const group = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: { facilityId: facilityA, name: 'Ca GV Test', type: 'GIAO_VIEN', selectionMode: 'SINGLE' },
    }),
  );
  const template = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: { facilityId: facilityA, shiftGroupId: group.id, name: 'Ca Ngày', startTime: SHIFT_START, endTime: SHIFT_END },
    }),
  );
  const reg = await testDbBypass((tx) =>
    tx.shiftRegistration.create({
      data: {
        facilityId: facilityA,
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
      data: { facilityId: facilityA, shiftRegistrationId: reg.id, date: ictToUtc(TEST_DATE, '00:00'), shiftTemplateId: template.id },
    }),
  );
  // 20 min late, 40 min early
  await testDbBypass((tx) =>
    tx.timePunch.createMany({
      data: [
        { facilityId: facilityA, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TEST_DATE, '09:20') },
        { facilityId: facilityA, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(TEST_DATE, '16:20') },
      ],
    }),
  );

  // Created + assigned via super_admin (bypasses the caller-vs-tier
  // branch-scope check, R2-6 post-audit fix) — gdkdACtx is giam_doc_kinh_doanh
  // and would be out-of-branch for a GIAO_VIEN tier.
  const tier = await caller(superAdminACtx()).salaryTier.create({
    name: 'Bậc GV Test',
    type: 'GIAO_VIEN',
    baseSalary: 10_000_000,
    unitRate: 100_000,
    requiredShifts: 20,
    requiredMetric: 120,
  });
  await caller(superAdminACtx()).compensation.assignTier({ appUserId: employeeAppUserId, tierId: tier.id });
});

afterEach(async () => {
  await cleanupFacility(facilityA);
  await cleanupFacility(facilityB);
});

describe('payslip.assemble — penalty rates', () => {
  it('uses CompensationPolicy rates (700/1200) when a facility row exists', async () => {
    await caller(superAdminACtx()).compensationPolicy.upsert({
      penaltyRatePerLateMinute: 700,
      penaltyRatePerEarlyMinute: 1200,
    });

    const payslip = await caller(gdkdACtx()).payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // 20×700 + 40×1200 = 14000 + 48000 = 62000
    expect(Number(payslip.penaltyAmount)).toBe(62_000);
  });

  it('falls back to 500/1000 when the facility has no CompensationPolicy row', async () => {
    const payslip = await caller(gdkdACtx()).payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // 20×500 + 40×1000 = 10000 + 40000 = 50000
    expect(Number(payslip.penaltyAmount)).toBe(50_000);
  });
});

describe('compensationPolicy.get/upsert — RLS + permission', () => {
  it('upsert creates then updates the same per-facility row', async () => {
    const created = await caller(superAdminACtx()).compensationPolicy.upsert({
      penaltyRatePerLateMinute: 700,
      penaltyRatePerEarlyMinute: 1200,
    });
    expect(Number(created.penaltyRatePerLateMinute)).toBe(700);

    const updated = await caller(superAdminACtx()).compensationPolicy.upsert({
      penaltyRatePerLateMinute: 800,
      penaltyRatePerEarlyMinute: 1300,
    });
    expect(updated.id).toBe(created.id);
    expect(Number(updated.penaltyRatePerLateMinute)).toBe(800);
  });

  it('get returns null when no policy has been set for the facility', async () => {
    const result = await caller(superAdminACtx()).compensationPolicy.get();
    expect(result).toBeNull();
  });

  it('RLS: facility B setting its own policy does not leak into facility A\'s get', async () => {
    await caller(superAdminBCtx()).compensationPolicy.upsert({
      penaltyRatePerLateMinute: 999,
      penaltyRatePerEarlyMinute: 999,
    });

    const resultA = await caller(superAdminACtx()).compensationPolicy.get();
    expect(resultA).toBeNull();
  });

  it('non-super_admin (giam_doc_kinh_doanh) is FORBIDDEN from compensationPolicy.manage', async () => {
    await expect(
      caller(gdkdACtx()).compensationPolicy.upsert({
        penaltyRatePerLateMinute: 1,
        penaltyRatePerEarlyMinute: 1,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(gdkdACtx()).compensationPolicy.get()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
