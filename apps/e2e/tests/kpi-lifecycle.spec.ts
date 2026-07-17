// KPI + payroll lifecycle e2e (HR remediation phase 6, docs/20 — WF-P3-05/06,
// ADR 0044 "KPI auto-score + session-done engine"): the one cross-module,
// multi-actor flow no single-router integration test can reach — SalaryTier
// assignment + backdated Receipt/ShiftRegistration/TimePunch fixtures feed
// `kpi.refresh`'s formula, through the full `submitSlip -> confirm ->
// payslip.assemble -> payslip.finalize -> bulkApprove` lifecycle, asserting
// the branch-scope (ROLE, not position free-text) gate along the way.
//
// Period '2026-05' is a PAST ICT month relative to any real wall-clock time
// this suite runs at (today >= 2026-07-12) — `kpi.submitSlip`'s day-3-of-
// next-month guard is satisfied naturally, no mocked clock. This does NOT
// cover the day-3 BOUNDARY itself (23:59+07/00:00+07) — that is a phase 3
// unit-test concern (apps/api/src/kpi/lifecycle.test.ts), not this e2e's job
// (docs/20, red-team #9).
//
// API-driven (tRPC), no browser. Uses the ephemeral facility from
// global-setup.ts.

import { test, expect } from '@playwright/test';
import { ictToUtc } from '@cmc/domain-time';
import {
  getReceiptApprovedAt,
  seedAppUser,
  seedApprovedReceipt,
  seedApprovedShiftRegistration,
  seedTimePunchPair,
} from '../src/db.js';
import { createE2eStaffClient } from '../src/trpc-client.js';
import { randomVnPhone } from '../src/random-vn-phone.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

const PERIOD = '2026-05';
const SHIFT_START = '09:00';
const SHIFT_END = '17:00';
const SHIFT_DATES = ['2026-05-04', '2026-05-05'];
const TIER_BASE_SALARY = 8_000_000;
const TIER_UNIT_RATE = 2_000_000;
const TIER_REQUIRED_SHIFTS = SHIFT_DATES.length;
const TIER_REQUIRED_METRIC = 10_000_000;
const RECEIPT_NET_AMOUNT = TIER_REQUIRED_METRIC; // 100% metricPct

test.describe('kpi + payroll lifecycle: refresh -> submitSlip -> confirm -> assemble -> bulkApprove', () => {
  test('sale full lifecycle, branch-scope gate, receipt approvedAt stamp', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);

    const gdkdAppUser = await seedAppUser({
      facilityId,
      userId: `e2e-kpi-gdkd-${suffix}`,
      position: 'giam_doc_kinh_doanh',
      roles: ['giam_doc_kinh_doanh'],
    });
    const saleAppUser = await seedAppUser({
      facilityId,
      userId: `e2e-kpi-sale-${suffix}`,
      position: 'sale',
      managerId: gdkdAppUser.id,
      roles: ['sale'],
    });

    const gdkd = createE2eStaffClient(baseUrl, {
      userId: `e2e-kpi-gdkd-${suffix}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    const gddt = createE2eStaffClient(baseUrl, {
      userId: `e2e-kpi-gddt-${suffix}`,
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });
    const sale = createE2eStaffClient(baseUrl, {
      userId: `e2e-kpi-sale-${suffix}`,
      roles: ['sale'],
      facilityId,
    });

    // -------------------------------------------------------------------
    // FMA red-team #10 assertion: `finance.receiptApprove` stamps
    // `approvedAt` (API-driven action; DB-truth assertion since `ReceiptDto`
    // deliberately omits `approvedAt` — apps/api/src/finance/router.ts).
    // Uses "now" (real time, outside PERIOD) so it cannot leak into the
    // period-metric assertions below.
    // -------------------------------------------------------------------
    const course = await gddt.course.create.mutate({ program: 'UCREA', name: `E2E KPI FMA Course ${suffix}` });
    const classBatch = await gddt.classBatch.create.mutate({
      courseId: course.id,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      slots: [{ weekday: 2, startTime: '08:00', endTime: '09:00' }],
    });
    const fmaReceiptResult = await sale.finance.receiptCreate.mutate({
      studentName: 'E2E KPI FMA Student',
      parentPhone: randomVnPhone(),
      amount: 3_000_000,
      classBatchId: classBatch.classBatch.id,
    });
    if (fmaReceiptResult.status !== 'success') {
      throw new Error(`receiptCreate failed: ${fmaReceiptResult.message}`);
    }
    expect(await getReceiptApprovedAt(fmaReceiptResult.receipt.id)).toBeNull();
    await gdkd.finance.receiptApprove.mutate({ receiptId: fmaReceiptResult.receipt.id });
    expect(await getReceiptApprovedAt(fmaReceiptResult.receipt.id)).toBeInstanceOf(Date);

    // -------------------------------------------------------------------
    // Seed: SalaryTier + assignTier, past-period revenue, approved shift
    // registration + full in/out punch pairs at the shift boundary (zero
    // penalty — ADR 0043 day-level pairing, @cmc/domain-payroll's
    // `computeDayAttendance` via apps/api/src/attendance/resolve-day-credit.ts).
    // -------------------------------------------------------------------
    const tier = await gdkd.salaryTier.create.mutate({
      name: `E2E KPI Tier ${suffix}`,
      type: 'KINH_DOANH',
      baseSalary: TIER_BASE_SALARY,
      unitRate: TIER_UNIT_RATE,
      requiredShifts: TIER_REQUIRED_SHIFTS,
      requiredMetric: TIER_REQUIRED_METRIC,
    });
    await gdkd.compensation.assignTier.mutate({ appUserId: saleAppUser.id, tierId: tier.id });

    await seedApprovedReceipt({
      facilityId,
      createdByAppUserId: saleAppUser.id,
      netAmount: RECEIPT_NET_AMOUNT,
      approvedAt: ictToUtc('2026-05-15', '10:00'),
    });

    const shiftGroup = await gdkd.shift.createGroup.mutate({
      name: `E2E KPI Shift Group ${suffix}`,
      type: 'KINH_DOANH',
      selectionMode: 'SINGLE',
    });
    const shiftTemplate = await gdkd.shift.createTemplate.mutate({
      shiftGroupId: shiftGroup.id,
      name: `Ca ngày ${suffix}`,
      startTime: SHIFT_START,
      endTime: SHIFT_END,
    });
    await seedApprovedShiftRegistration({
      facilityId,
      appUserId: saleAppUser.id,
      shiftGroupId: shiftGroup.id,
      shiftTemplateId: shiftTemplate.id,
      dates: SHIFT_DATES,
    });
    for (const date of SHIFT_DATES) {
      await seedTimePunchPair({ facilityId, appUserId: saleAppUser.id, date, startTime: SHIFT_START, endTime: SHIFT_END });
    }

    // -------------------------------------------------------------------
    // kpi.refresh — assert the "PHẦN NHÂN" formula: %côngca × %chỉ-số ×
    // đơnGiá, both percentages at 100% by construction above.
    // -------------------------------------------------------------------
    const refreshed = await sale.kpi.refresh.mutate({ period: PERIOD });
    expect(refreshed.tierMissing).toBe(false);
    expect(refreshed.shiftActual).toBe(TIER_REQUIRED_SHIFTS);
    expect(Number(refreshed.metricValue)).toBe(RECEIPT_NET_AMOUNT);
    expect(Number(refreshed.value)).toBe(TIER_UNIT_RATE); // 1.0 × 1.0 × unitRate

    // -------------------------------------------------------------------
    // kpi.submitSlip — past period clears the day-3 guard naturally.
    // -------------------------------------------------------------------
    const submitted = await sale.kpi.submitSlip.mutate({ period: PERIOD });
    expect(submitted.status).toBe('submitted');
    const kpiScoreId = submitted.id;

    // -------------------------------------------------------------------
    // kpi.confirm — direct manager (GĐKD, per the seeded managerId chain).
    // -------------------------------------------------------------------
    const confirmed = await gdkd.kpi.confirm.mutate({ kpiScoreId });
    expect(confirmed.status).toBe('confirmed');

    // -------------------------------------------------------------------
    // payslip.assemble — base(tier) + value − penalty, penalty = 0.
    // -------------------------------------------------------------------
    const assembled = await gdkd.payslip.assemble.mutate({ appUserId: saleAppUser.id, period: PERIOD });
    expect(Number(assembled.baseSalary)).toBe(TIER_BASE_SALARY);
    expect(Number(assembled.kpiBonus)).toBe(TIER_UNIT_RATE);
    expect(Number(assembled.variablePay)).toBe(0);
    expect(assembled.lateMinutes).toBe(0);
    expect(assembled.earlyMinutes).toBe(0);
    expect(assembled.unpunchedDays).toBe(0);
    expect(Number(assembled.penaltyAmount)).toBe(0);
    expect(Number(assembled.totalNet)).toBe(TIER_BASE_SALARY + TIER_UNIT_RATE);

    await gdkd.payslip.finalize.mutate({ payslipId: assembled.id });

    // -------------------------------------------------------------------
    // kpi.bulkApprove — branch-scope by target ROLE: GĐĐT's bulkApprove
    // (giao_vien branch) must NOT touch this sale slip, even though the
    // payslip is now finalized.
    // -------------------------------------------------------------------
    const gddtBulk = await gddt.kpi.bulkApprove.mutate({ period: PERIOD });
    expect(gddtBulk.approved).toBe(0);
    const stillConfirmed = await sale.kpi.myScore.query({ period: PERIOD });
    expect(stillConfirmed?.status).toBe('confirmed');

    // GĐKD's bulkApprove (sale branch) approves it.
    const gdkdBulk = await gdkd.kpi.bulkApprove.mutate({ period: PERIOD });
    expect(gdkdBulk.approved).toBe(1);
    const finalScore = await sale.kpi.myScore.query({ period: PERIOD });
    expect(finalScore?.status).toBe('approved');
  });
});
