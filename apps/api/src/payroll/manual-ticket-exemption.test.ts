// ADR 0043 phase 5 (supersedes HR remediation phase 2 / red-team #13): an
// APPROVED ManualAttendanceTicket makes an offsite day VALID for pairing —
// its FROZEN checkInAt/checkOutAt are used exactly like real live punches
// (R1 "freeze on approve"), NOT a blanket unconditional exemption. So an
// approved ticket with on-time hours credits the day with zero penalty, but
// an approved ticket whose frozen hours show a late/early punch STILL
// produces the corresponding penalty — approval means "this offsite day now
// counts", not "no penalty regardless of actual hours". Pending/rejected
// tickets never count (day stays unpunched). A ticket approved AFTER a
// payslip was finalized does not retroactively change the payslip, but
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
  hours?: { checkIn: string; checkOut: string },
): Promise<{ id: string }> {
  return testDbBypass((tx) =>
    tx.manualAttendanceTicket.create({
      data: {
        facilityId,
        appUserId: employeeAppUserId,
        ticketDate: ictToUtc(dateOnly, '00:00'),
        status,
        note: '',
        checkInAt: hours ? ictToUtc(dateOnly, hours.checkIn) : null,
        checkOutAt: hours ? ictToUtc(dateOnly, hours.checkOut) : null,
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
  it('approved ticket with on-time frozen hours credits the day, zero penalty', async () => {
    const date = '2099-08-05';
    await seedRegisteredShift(date);
    // Frozen hours matching the shift exactly (09:00-17:00) — director
    // confirms the employee worked the full shift despite the offsite punch.
    await seedTicket(date, 'approved', { checkIn: SHIFT_START, checkOut: SHIFT_END });

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
  it('ADR 0043 R1 — approved ticket uses its FROZEN hours for real pairing: late/early still penalized', async () => {
    const date = '2099-08-10';
    await seedRegisteredShift(date);
    // Live punches exist (offsite, withinNetwork defaults true here since
    // these are raw testDbBypass seeds — the point of this test is the
    // TICKET's frozen hours, not the live punch rows) matching the ticket.
    await testDbBypass((tx) =>
      tx.timePunch.createMany({
        data: [
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '10:00'), withinNetwork: false }, // 60 min late
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '15:00'), withinNetwork: false }, // 120 min early
        ],
      }),
    );
    await seedTicket(date, 'approved', { checkIn: '10:00', checkOut: '15:00' });

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // Approval made the day VALID for pairing — it did NOT erase the real
    // late/early hours frozen on the ticket. Same numbers as the "pending"
    // case below would show IF pending also counted (it doesn't — this test
    // proves approval ≠ blanket exemption, it means "this day's frozen hours
    // now count exactly like live on-network punches would").
    expect(payslip.lateMinutes).toBe(60);
    expect(payslip.earlyMinutes).toBe(120);
    expect(Number(payslip.penaltyAmount)).toBe(60 * 500 + 120 * 1000);
    expect(payslip.unpunchedDays).toBe(0);
  });

  it('ADR 0043 — offsite punches + pending ticket → day is NOT valid: unpunched, no late/early penalty', async () => {
    const date = '2099-08-11';
    await seedRegisteredShift(date);
    await testDbBypass((tx) =>
      tx.timePunch.createMany({
        data: [
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '10:00'), withinNetwork: false },
          { facilityId, appUserId: employeeAppUserId, method: 'ip', punchAt: ictToUtc(date, '15:00'), withinNetwork: false },
        ],
      }),
    );
    await seedTicket(date, 'pending', { checkIn: '10:00', checkOut: '15:00' });

    const payslip = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });

    // Not approved → day is invalid for pairing entirely (ADR 0043 Edge Case
    // Ledger: "phiếu pending → không công, dù có 2 punch") — unpunched, NOT
    // a late/early penalty on the raw punch times.
    expect(payslip.unpunchedDays).toBe(1);
    expect(payslip.lateMinutes).toBe(0);
    expect(payslip.earlyMinutes).toBe(0);
    expect(Number(payslip.penaltyAmount)).toBe(0);
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

    // Employee's manual ticket for that date, created AFTER the period was
    // finalized. ADR 0043 phase 4 removed manualPunch.create (tickets now
    // only originate from checkInOut.punch's ensureDayTicket) — seed directly.
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: { facilityId, appUserId: employeeAppUserId, ticketDate: ictToUtc(date, '00:00'), note: 'Quên chấm công' },
      }),
    );
    expect(ticket.status).toBe('pending');

    // ADR 0043 phase 4: approval is gated by GĐ track (owner is giao_vien →
    // requires giam_doc_dao_tao), and this file's directorCtx is deliberately
    // giam_doc_kinh_doanh (out-of-branch here, same as elsewhere in this
    // file) — use superAdminCaller() to bypass, consistent with the file's
    // existing branch-scope workaround convention.
    const approveResult = await superAdminCaller().manualPunch.approve({ ticketId: ticket.id, note: '' });
    expect(approveResult.status).toBe('approved');
    expect((approveResult as { warnings: string[] }).warnings).toContain('PAYSLIP_FINALIZED');

    // The payslip itself is untouched — assemble() was never called again.
    const stillFinalized = await directorCaller().payslip.getForUser({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    expect(stillFinalized.status).toBe('finalized');
    expect(stillFinalized.unpunchedDays).toBe(1);
  });

  it('approve() has NO PAYSLIP_FINALIZED warning when the ticket period is still a draft payslip (or unassembled)', async () => {
    const date = '2099-08-16';
    await seedRegisteredShift(date);

    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: { facilityId, appUserId: employeeAppUserId, ticketDate: ictToUtc(date, '00:00'), note: 'Quên chấm công' },
      }),
    );

    // See branch-scope note above — same GĐKD-vs-giao_vien-owner mismatch.
    const approveResult = await superAdminCaller().manualPunch.approve({ ticketId: ticket.id, note: '' });
    expect(approveResult.status).toBe('approved');
    // This ticket has no checkOutAt (never punched at all) — C2's
    // checkOutAt===null condition still fires SINGLE_PUNCH_NO_CREDIT here;
    // only PAYSLIP_FINALIZED is what this test asserts is absent.
    expect((approveResult as { warnings: string[] }).warnings).not.toContain('PAYSLIP_FINALIZED');
  });

  it('C2: a ticket both finalized-period AND single-punch (checkOutAt=null) carries BOTH warnings, neither is swallowed', async () => {
    const date = '2099-08-17';
    await seedRegisteredShift(date);
    const assembled = await directorCaller().payslip.assemble({
      appUserId: employeeAppUserId,
      period: TEST_PERIOD,
    });
    await directorCaller().payslip.finalize({ payslipId: assembled.id });

    // Single-punch ticket (checkInAt set, checkOutAt null) for the already-finalized period.
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: {
          facilityId,
          appUserId: employeeAppUserId,
          ticketDate: ictToUtc(date, '00:00'),
          note: 'Chỉ bấm 1 lần',
          checkInAt: ictToUtc(date, '09:00'),
        },
      }),
    );

    const approveResult = await superAdminCaller().manualPunch.approve({ ticketId: ticket.id, note: '' });
    expect(approveResult.status).toBe('approved');
    const warnings = (approveResult as { warnings: string[] }).warnings;
    expect(warnings).toContain('PAYSLIP_FINALIZED');
    expect(warnings).toContain('SINGLE_PUNCH_NO_CREDIT');
    expect(warnings).toHaveLength(2);
  });
});
