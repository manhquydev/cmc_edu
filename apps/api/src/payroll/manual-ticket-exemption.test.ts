// HR remediation phase 2 (red-team #13, Implementation Step 1): an approved
// ManualAttendanceTicket for a calendar date exempts EVERY shift registered
// that date from both `unpunchedDays` and per-shift late/early penalty —
// pending/rejected tickets do NOT exempt. A ticket approved AFTER a payslip
// was finalized does not retroactively change the payslip, but
// `manualPunch.approve`'s response carries `warning: 'PAYSLIP_FINALIZED'`.

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

let facilityId: string;
let employeeAppUserId: string;
let groupId: string;
let templateId: string;

const DIRECTOR_USER_ID = 'ticket-exempt-director-001';
const EMPLOYEE_USER_ID = 'ticket-exempt-employee-001';

const TEST_PERIOD = '2099-08';
const SHIFT_START = '09:00';
const SHIFT_END = '17:00';

const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);
const directorCtx = () =>
  buildStaffContext({ facilityId, userId: DIRECTOR_USER_ID, roles: ['giam_doc_kinh_doanh'] });
const directorCaller = () => caller(directorCtx());
// super_admin bypasses the caller-vs-tier branch-scope check (R2-6 post-audit
// fix) — directorCtx is giam_doc_kinh_doanh and would be out-of-branch for
// the GIAO_VIEN tier this file assigns.
const superAdminCaller = () =>
  caller(buildStaffContext({ facilityId, userId: 'ticket-exempt-superadmin-001', roles: ['super_admin'] }));

async function seedRegisteredShift(dateOnly: string): Promise<void> {
  const reg = await testDbBypass((tx) =>
    tx.shiftRegistration.create({
      data: {
        facilityId,
        appUserId: employeeAppUserId,
        shiftGroupId: groupId,
        fromDate: ictToUtc(dateOnly, '00:00'),
        toDate: ictToUtc(dateOnly, '00:00'),
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
        date: ictToUtc(dateOnly, '00:00'),
        shiftTemplateId: templateId,
      },
    }),
  );
}

async function seedTicket(
  dateOnly: string,
  status: 'pending' | 'approved' | 'rejected',
): Promise<{ id: string }> {
  return testDbBypass((tx) =>
    tx.manualAttendanceTicket.create({
      data: {
        facilityId,
        appUserId: employeeAppUserId,
        ticketDate: ictToUtc(dateOnly, '00:00'),
        status,
        note: '',
      },
    }),
  );
}

beforeEach(async () => {
  const facility = await createTestFacility('TicketExemptTest-Facility');
  facilityId = facility.id;

  const director = await seedAppUser({
    facilityId,
    userId: DIRECTOR_USER_ID,
    fullName: 'Lê Giám Đốc KD',
    position: 'giam_doc_kinh_doanh',
  });

  // managerId = director — manualPunch.approve's anti-self-approve gate
  // requires the reviewer to be the ticket owner's direct manager.
  const employee = await seedAppUser({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    fullName: 'Nguyễn Nhân Viên',
    position: 'giao_vien',
    managerId: director.id,
  });
  employeeAppUserId = employee.id;
  await testDbBypass((tx) =>
    tx.appUser.update({ where: { id: employee.id }, data: { roles: ['giao_vien'] } }),
  );

  const group = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: { facilityId, name: 'Ca GV Test', type: 'GIAO_VIEN', selectionMode: 'SINGLE' },
    }),
  );
  groupId = group.id;
  const template = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: { facilityId, shiftGroupId: group.id, name: 'Ca Ngày', startTime: SHIFT_START, endTime: SHIFT_END },
    }),
  );
  templateId = template.id;

  const tier = await directorCaller().salaryTier.create({
    name: 'Bậc GV Test',
    type: 'GIAO_VIEN',
    baseSalary: 10_000_000,
    unitRate: 100_000,
    requiredShifts: 20,
    requiredMetric: 120,
  });
  await superAdminCaller().compensation.assignTier({ appUserId: employeeAppUserId, tierId: tier.id });
});

afterEach(async () => {
  await cleanupFacility(facilityId);
});

describe('manual ticket exemption — no punches at all', () => {
  it('approved ticket exempts a fully-unpunched day from unpunchedDays', async () => {
    const date = '2099-08-05';
    await seedRegisteredShift(date);
    await seedTicket(date, 'approved');

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.unpunchedDays).toBe(0);
    expect(Number(payslip.penaltyAmount)).toBe(0);
  });

  it('pending ticket does NOT exempt — still counted as unpunched', async () => {
    const date = '2099-08-06';
    await seedRegisteredShift(date);
    await seedTicket(date, 'pending');

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.unpunchedDays).toBe(1);
  });

  it('rejected ticket does NOT exempt — still counted as unpunched', async () => {
    const date = '2099-08-07';
    await seedRegisteredShift(date);
    await seedTicket(date, 'rejected');

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.unpunchedDays).toBe(1);
  });

  it('no ticket at all → still counted as unpunched', async () => {
    const date = '2099-08-08';
    await seedRegisteredShift(date);

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.unpunchedDays).toBe(1);
  });
});

describe('manual ticket exemption — late/early punches present', () => {
  it('approved ticket exempts a late-punch day from penalty entirely (full credit)', async () => {
    const date = '2099-08-10';
    await seedRegisteredShift(date);
    await testDbBypass((tx) =>
      tx.timePunch.createMany({
        data: [
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '10:00') }, // 60 min late
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '15:00') }, // 120 min early
        ],
      }),
    );
    await seedTicket(date, 'approved');

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.lateMinutes).toBe(0);
    expect(payslip.earlyMinutes).toBe(0);
    expect(Number(payslip.penaltyAmount)).toBe(0);
    expect(payslip.unpunchedDays).toBe(0);
  });

  it('pending ticket does NOT exempt — late/early punches are still penalized', async () => {
    const date = '2099-08-11';
    await seedRegisteredShift(date);
    await testDbBypass((tx) =>
      tx.timePunch.createMany({
        data: [
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '10:00') }, // 60 min late
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '15:00') }, // 120 min early
        ],
      }),
    );
    await seedTicket(date, 'pending');

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    expect(payslip.lateMinutes).toBe(60);
    expect(payslip.earlyMinutes).toBe(120);
    expect(Number(payslip.penaltyAmount)).toBe(60 * 500 + 120 * 1000);
  });
});

describe('manual ticket approved AFTER finalize', () => {
  it('does not retroactively change the finalized payslip, and approve() returns a warning', async () => {
    const date = '2099-08-15';
    await seedRegisteredShift(date);
    // No punches, no ticket yet — assemble sees this day as unpunched.
    const assembled = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(assembled.unpunchedDays).toBe(1);

    const finalized = await directorCaller().payslip.finalize({ payslipId: assembled.id });
    expect(finalized.status).toBe('finalized');

    // Employee submits a manual ticket for that date AFTER the period was finalized.
    const ticket = await caller(
      buildStaffContext({ facilityId, userId: EMPLOYEE_USER_ID, roles: ['giao_vien'] }),
    ).manualPunch.create({ ticketDate: date, note: 'Quên chấm công' });
    expect(ticket.status).toBe('pending');

    const approveResult = await directorCaller().manualPunch.approve({ ticketId: ticket.id, note: '' });
    expect(approveResult.status).toBe('approved');
    expect((approveResult as { warning?: string }).warning).toBe('PAYSLIP_FINALIZED');

    // The payslip itself is untouched — assemble() was never called again.
    const stillFinalized = await directorCaller().payslip.getForUser({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(stillFinalized.status).toBe('finalized');
    expect(stillFinalized.unpunchedDays).toBe(1);
  });

  it('approve() has NO warning when the ticket period is still a draft payslip (or unassembled)', async () => {
    const date = '2099-08-16';
    await seedRegisteredShift(date);

    const ticket = await caller(
      buildStaffContext({ facilityId, userId: EMPLOYEE_USER_ID, roles: ['giao_vien'] }),
    ).manualPunch.create({ ticketDate: date, note: 'Quên chấm công' });

    const approveResult = await directorCaller().manualPunch.approve({ ticketId: ticket.id, note: '' });
    expect(approveResult.status).toBe('approved');
    expect((approveResult as { warning?: string }).warning).toBeUndefined();
  });
});
