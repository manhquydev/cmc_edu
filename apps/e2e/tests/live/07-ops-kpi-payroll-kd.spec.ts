// 07-ops-kpi-payroll-kd — REAL-ENVIRONMENT KPI + payroll on the live VPS (KD branch).
// Covers P3-05 (bậc lương → gán → tính lương → chốt), P3-06 (nộp + xác nhận phiếu KPI)
// and P3-08 (tất toán kỳ, branch-scope KINH_DOANH) for roles GĐKD + sale:
//   1. super_admin creates a dedicated KPI sale through the real /admin/users dialog
//      WITH "Quản lý trực tiếp" = GĐKD (the manager link kpi.confirm enforces:
//      scoreOwner.managerId === confirmUser.id — the journey's seedManagerLink has
//      a REAL UI path in users.tsx, so we use it).
//   2. GĐKD creates a KINH_DOANH salary tier and assigns it to the sale (the tier
//      assignment is load-bearing: kpi.submitSlip refuses "Chưa gán bậc lương").
//   3. sale: /hr/my → kpi.refresh ("Tính lại") + kpi.submitSlip ("Nộp") for a PAST
//      period (submission opens day 3 of the FOLLOWING month — pastPeriodIct(2)).
//   4. GĐKD confirms the slip (kpi.confirm), assembles + finalizes the payslip
//      (payslip.assemble/finalize — bulkApprove skips unfinalized payslips), then
//      settles the whole period (kpi.bulkApprove).
//   5. Invariant: payslip.my (self-scoped, real sale session) status=finalized and
//      totalNet >= tier base (auto-score of a fresh sale in a past period is 0, so
//      totalNet = base + kpiBonus(0) - penalty(0) = 10.000.000).
//
// All sessions are REAL UI logins via live-auth; every page is error-captured.

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { createStaffViaLiveUi } from '../../src/live/live-ui.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { liveStaffRoleClient } from '../../src/live/live-trcp.js';
import { updateCredentialsFile } from '../../src/live/live-credentials.js';
import { liveRunId } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrors,
  staffIdentity,
  staffFullName,
  pastPeriodIct,
} from './live-spec-utils.js';

const scratch = newScratch();
const PERIOD = pastPeriodIct(2);
const KPI_SALE_KEY = 'kpiSale';

test.describe('07-ops-kpi-payroll-kd — phiếu KPI + chốt lương (KD branch, live)', () => {
  test.setTimeout(240_000);

  test('GĐKD tạo bậc lương → gán sale → sale nộp KPI → xác nhận → chốt lương → tất toán kỳ', async ({ browser }) => {
    const rid = liveRunId();
    const identity = staffIdentity('kpi-sale');
    const saleName = 'Live KPI Sale ' + rid;
    const tierName = 'KPI KD Bậc ' + rid;

    // 1. super_admin: create the dedicated KPI sale with manager = GĐKD.
    const sa = await openStaffSession(browser, 'superAdmin');
    attachErrors(sa.page, scratch);
    try {
      await createStaffViaLiveUi(sa.page, {
        userId: identity.userId,
        fullName: saleName,
        email: identity.email,
        role: 'sale',
        position: 'Nhân viên kinh doanh',
        tempPassword: identity.tempPassword,
        managerFullName: staffFullName('giam_doc_kinh_doanh'),
      });
      updateCredentialsFile((file) => {
        file.staff[KPI_SALE_KEY] = {
          email: identity.email,
          password: identity.tempPassword,
          userId: identity.userId,
          changedAt: new Date().toISOString(),
        };
      });
      recordCreated(scratch, 'staff-account', 'kpi-sale email', identity.email);
      console.log('[07-ops-kpi-payroll-kd] created KPI sale with manager=GĐKD');
    } finally {
      await closeRoleSession(sa);
    }

    // 2. GĐKD: create the KINH_DOANH tier + assign it to the sale.
    const gdkd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gdkd.page, scratch);
    try {
      await menuNav(gdkd.page, 'Nhân sự', 'Bậc lương', { role: 'giam_doc_kinh_doanh' });
      await expect(gdkd.page).toHaveURL(/\/hr\/salary-tiers/);
      await gdkd.page.getByRole('button', { name: '+ Thêm bậc lương' }).click();
      await gdkd.page.getByLabel('Tên bậc').fill(tierName);
      await gdkd.page.getByLabel('Lương cơ bản (VND)').fill('10000000');
      await gdkd.page.getByLabel('Đơn giá (VND)').fill('50000');
      await gdkd.page.getByLabel('Công ca yêu cầu').fill('22');
      await gdkd.page.getByLabel('Chỉ số yêu cầu (giờ dạy / doanh thu)').fill('100000000');
      await gdkd.page.getByRole('button', { name: 'Thêm bậc' }).click();
      await expect(gdkd.page.getByRole('row', { name: new RegExp(tierName) })).toBeVisible();
      recordCreated(scratch, 'salary-tier', 'name', tierName);
      console.log('[07-ops-kpi-payroll-kd] salary tier created');

      // Gán bậc tab → assign to the KPI sale.
      // The tab's accessible name is "Gán bậc Sale / giáo viên" (salary-tiers.tsx
      // nav section) — substring match, same as the local journey.
      await gdkd.page.getByRole('button', { name: /^Gán bậc/ }).click();
      const assignRow = gdkd.page.getByRole('row', { name: new RegExp(saleName) });
      await expect(assignRow).toBeVisible({ timeout: 15_000 });
      await assignRow.getByRole('button', { name: 'Gán bậc' }).click();
      await assignRow.getByRole('combobox', { name: 'Bậc lương' }).click();
      await gdkd.page.getByRole('option', { name: tierName }).click();
      await assignRow.getByRole('button', { name: 'Lưu' }).click();
      await expect(assignRow.getByRole('button', { name: 'Gán bậc' })).toBeVisible({ timeout: 15_000 });
      console.log('[07-ops-kpi-payroll-kd] tier assigned to KPI sale');
    } finally {
      await closeRoleSession(gdkd);
    }

    // 3. sale: compute + submit own KPI slip for the past period.
    const sale = await openStaffSession(browser, KPI_SALE_KEY);
    attachErrors(sale.page, scratch);
    try {
      await menuNav(sale.page, 'Nhân sự', 'Của tôi', { role: 'sale' });
      await sale.page.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
      await sale.page.getByRole('button', { name: 'Tính lại' }).click();
      await expect(sale.page.getByText('Nháp', { exact: true })).toBeVisible({ timeout: 15_000 });
      await Promise.all([
        sale.page.waitForResponse((r) => r.url().includes('kpi.submitSlip') && r.status() === 200),
        sale.page.getByRole('button', { name: 'Nộp' }).click(),
      ]);
      await expect(sale.page.getByText('Chờ xác nhận', { exact: true })).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'kpi-slip', 'period', PERIOD);
      console.log('[07-ops-kpi-payroll-kd] sale submitted KPI slip for ' + PERIOD);
    } finally {
      await closeRoleSession(sale);
    }

    // 4. GĐKD: confirm → finalize payroll → bulkApprove the period.
    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      // 4a. confirm (kpi.confirm) — board → form.
      await menuNav(gd.page, 'Nhân sự', 'KPI', { role: 'giam_doc_kinh_doanh' });
      await gd.page.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
      const kpiRow = gd.page.getByRole('row', { name: new RegExp(saleName) });
      await expect(kpiRow).toBeVisible({ timeout: 15_000 });
      await kpiRow.getByRole('button', { name: 'Mở phiếu', exact: true }).click();
      await expect(gd.page).toHaveURL(/\/hr\/kpi\/[0-9a-f-]{36}/i);
      await gd.page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      const confirmDialog = gd.page.getByRole('alertdialog');
      await Promise.all([
        gd.page.waitForResponse((r) => r.url().includes('kpi.confirm') && r.status() === 200),
        confirmDialog.getByRole('button', { name: 'Xác nhận', exact: true }).click(),
      ]);
      await expect(gd.page.getByText('Đã xác nhận phiếu KPI.')).toBeVisible({ timeout: 15_000 });
      console.log('[07-ops-kpi-payroll-kd] GĐKD confirmed the KPI slip');

      // 4b. payroll: assemble + finalize for the SAME period (bulkApprove skips
      // non-finalized payslips — the journey's squeeze proof).
      await menuNav(gd.page, 'Nhân sự', 'Chốt lương', { role: 'giam_doc_kinh_doanh' });
      await expect(gd.page).toHaveURL(/\/hr\/payroll/);
      await gd.page.getByLabel('Kỳ lương (YYYY-MM)').fill(PERIOD);
      const payRow = gd.page.getByRole('row', { name: new RegExp(saleName) });
      await expect(payRow).toBeVisible({ timeout: 15_000 });
      await payRow.click();
      await expect(gd.page.getByText('Chưa có bảng lương', { exact: true })).toBeVisible({ timeout: 15_000 });
      await gd.page.getByRole('button', { name: 'Tính lương' }).click();
      await expect(gd.page.getByText('Nháp', { exact: true })).toBeVisible({ timeout: 15_000 });
      await gd.page.getByRole('button', { name: 'Chốt bảng lương' }).click();
      await expect(gd.page.getByText('Đã chốt', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(gd.page.getByRole('button', { name: 'Mở lại' })).toBeVisible();
      recordCreated(scratch, 'payslip', 'period', PERIOD);
      console.log('[07-ops-kpi-payroll-kd] payslip assembled + finalized');

      // 4c. bulkApprove the whole period.
      await menuNav(gd.page, 'Nhân sự', 'KPI', { role: 'giam_doc_kinh_doanh' });
      await gd.page.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
      await gd.page.getByRole('button', { name: 'Đã trả lương kỳ ' + PERIOD }).click();
      const bulkDialog = gd.page.getByRole('alertdialog');
      await Promise.all([
        gd.page.waitForResponse((r) => r.url().includes('kpi.bulkApprove') && r.status() === 200),
        bulkDialog.getByRole('button', { name: 'Tất toán' }).click(),
      ]);
      // The success banner reads "Đã tất toán N phiếu KPI." — match it
      // exactly, NOT /đã duyệt/ which also matches the (hidden) status-filter
      // option rendered earlier in DOM order.
      await expect(gd.page.getByText(/Đã tất toán \d+ phiếu KPI/)).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'kpi-settle', 'period', PERIOD);
      console.log('[07-ops-kpi-payroll-kd] period settled (bulkApprove)');
    } finally {
      await closeRoleSession(gd);
    }

    // 5. Invariant: the sale reads back their own finalized payslip (self-scoped
    //    payslip.my — the real session cookie of the KPI sale).
    const saleClient = liveStaffRoleClient(KPI_SALE_KEY);
    const slip = await saleClient.payslip.my.query({ period: PERIOD });
    expect(slip, 'phiếu lương kỳ ' + PERIOD + ' của sale phải đọc lại được').not.toBeNull();
    expect(slip!.status, 'phiếu lương phải ở trạng thái finalized').toBe('finalized');
    expect(Number(slip!.totalNet), 'totalNet = base(10.000.000) + kpi(0) - penalty(0)').toBeGreaterThanOrEqual(10_000_000);
    recordCreated(scratch, 'payslip-my', 'period+totalNet', PERIOD + '=' + slip!.totalNet);
    console.log('[07-ops-kpi-payroll-kd] payslip.my finalized, totalNet=' + slip!.totalNet);

    await assertNoErrors(sale.page, scratch.collectors[0]!, 'KPI + payroll KD smoke');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
