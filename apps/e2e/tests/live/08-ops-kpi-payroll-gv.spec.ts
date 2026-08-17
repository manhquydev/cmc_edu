// 08-ops-kpi-payroll-gv — REAL-ENVIRONMENT KPI + payroll on the live VPS (GV branch).
// Same lifecycle as 07 but for roles GĐĐT + giao_vien: the salary tier is typed
// GIAO_VIEN (salary-tiers Loại selector defaults to KINH_DOANH — the Gán bậc tab
// filters tiers by target role, so the teacher's assign only offers GIAO_VIEN
// tiers), the KPI slip is submitted by the giao_vien, confirmed + settled by
// GĐĐT (kpi.bulkApprove is branch-scoped by ROLE: GĐĐT settles the GIAO_VIEN
// bucket). The payslip is assembled + finalized by GĐĐT (both directors hold
// payslip.assemble/finalize) before the settle step.
//
// Manager link: the giao_vien is created through the real /admin/users dialog
// with "Quản lý trực tiếp" = GĐĐT (kpi.confirm needs scoreOwner.managerId ===
// confirming director). Period = 2 months back (submission opens day 3 of the
// following month).

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
const KPI_GV_KEY = 'kpiGv';

test.describe('08-ops-kpi-payroll-gv — phiếu KPI + chốt lương (GV branch, live)', () => {
  test.setTimeout(240_000);

  test('GĐĐT tạo bậc GIAO_VIEN → gán giáo viên → GV nộp KPI → xác nhận → chốt lương → tất toán kỳ', async ({ browser }) => {
    const rid = liveRunId();
    const identity = staffIdentity('kpi-gv');
    const gvName = 'Live KPI GV ' + rid;
    const tierName = 'KPI GV Bậc ' + rid;

    // 1. super_admin: create the dedicated KPI giao_vien with manager = GĐĐT.
    const sa = await openStaffSession(browser, 'superAdmin');
    attachErrors(sa.page, scratch);
    try {
      await createStaffViaLiveUi(sa.page, {
        userId: identity.userId,
        fullName: gvName,
        email: identity.email,
        role: 'giao_vien',
        position: 'Giáo viên',
        tempPassword: identity.tempPassword,
        managerFullName: staffFullName('giam_doc_dao_tao'),
      });
      updateCredentialsFile((file) => {
        file.staff[KPI_GV_KEY] = {
          email: identity.email,
          password: identity.tempPassword,
          userId: identity.userId,
          changedAt: new Date().toISOString(),
        };
      });
      recordCreated(scratch, 'staff-account', 'kpi-gv email', identity.email);
      console.log('[08-ops-kpi-payroll-gv] created KPI giao_vien with manager=GĐĐT');
    } finally {
      await closeRoleSession(sa);
    }

    // 2. GĐĐT: create the GIAO_VIEN tier + assign it to the giao_vien.
    const gddt = await openStaffSession(browser, 'giam_doc_dao_tao');
    attachErrors(gddt.page, scratch);
    try {
      await menuNav(gddt.page, 'Nhân sự', 'Bậc lương', { role: 'giam_doc_dao_tao' });
      await expect(gddt.page).toHaveURL(/\/hr\/salary-tiers/);
      await gddt.page.getByRole('button', { name: '+ Thêm bậc lương' }).click();
      await gddt.page.getByLabel('Tên bậc').fill(tierName);
      // Type selector defaults to KINH_DOANH — switch to GIAO_VIEN so the Gán
      // bậc tab offers it for a giao_vien row.
      await gddt.page.getByRole('combobox', { name: 'Loại' }).click();
      await gddt.page.getByRole('option', { name: 'Giáo viên' }).click();
      await gddt.page.getByLabel('Lương cơ bản (VND)').fill('8000000');
      await gddt.page.getByLabel('Đơn giá (VND)').fill('40000');
      await gddt.page.getByLabel('Công ca yêu cầu').fill('20');
      await gddt.page.getByLabel('Chỉ số yêu cầu (giờ dạy / doanh thu)').fill('80');
      await gddt.page.getByRole('button', { name: 'Thêm bậc' }).click();
      await expect(gddt.page.getByRole('row', { name: new RegExp(tierName) })).toBeVisible();
      recordCreated(scratch, 'salary-tier', 'name', tierName);
      console.log('[08-ops-kpi-payroll-gv] GIAO_VIEN salary tier created');

      // The tab's accessible name is "Gán bậc Sale / giáo viên" (salary-tiers.tsx
      // nav section) — substring match, same as the local journey.
      await gddt.page.getByRole('button', { name: /^Gán bậc/ }).click();
      const assignRow = gddt.page.getByRole('row', { name: new RegExp(gvName) });
      await expect(assignRow).toBeVisible({ timeout: 15_000 });
      await assignRow.getByRole('button', { name: 'Gán bậc' }).click();
      await assignRow.getByRole('combobox', { name: 'Bậc lương' }).click();
      await gddt.page.getByRole('option', { name: tierName }).click();
      await assignRow.getByRole('button', { name: 'Lưu' }).click();
      await expect(assignRow.getByRole('button', { name: 'Gán bậc' })).toBeVisible({ timeout: 15_000 });
      console.log('[08-ops-kpi-payroll-gv] tier assigned to KPI giao_vien');
    } finally {
      await closeRoleSession(gddt);
    }

    // 3. giao_vien: compute + submit own KPI slip.
    const gv = await openStaffSession(browser, KPI_GV_KEY);
    attachErrors(gv.page, scratch);
    try {
      await menuNav(gv.page, 'Nhân sự', 'Của tôi', { role: 'giao_vien' });
      await gv.page.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
      await gv.page.getByRole('button', { name: 'Tính lại' }).click();
      await expect(gv.page.getByText('Nháp', { exact: true })).toBeVisible({ timeout: 15_000 });
      await Promise.all([
        gv.page.waitForResponse((r) => r.url().includes('kpi.submitSlip') && r.status() === 200),
        gv.page.getByRole('button', { name: 'Nộp' }).click(),
      ]);
      await expect(gv.page.getByText('Chờ xác nhận', { exact: true })).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'kpi-slip', 'period', PERIOD);
      console.log('[08-ops-kpi-payroll-gv] giao_vien submitted KPI slip for ' + PERIOD);
    } finally {
      await closeRoleSession(gv);
    }

    // 4. GĐĐT: confirm → finalize payroll → bulkApprove (GV bucket).
    const gd = await openStaffSession(browser, 'giam_doc_dao_tao');
    attachErrors(gd.page, scratch);
    try {
      await menuNav(gd.page, 'Nhân sự', 'KPI', { role: 'giam_doc_dao_tao' });
      await gd.page.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
      const kpiRow = gd.page.getByRole('row', { name: new RegExp(gvName) });
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
      console.log('[08-ops-kpi-payroll-gv] GĐĐT confirmed the KPI slip');

      await menuNav(gd.page, 'Nhân sự', 'Chốt lương', { role: 'giam_doc_dao_tao' });
      await expect(gd.page).toHaveURL(/\/hr\/payroll/);
      await gd.page.getByLabel('Kỳ lương (YYYY-MM)').fill(PERIOD);
      const payRow = gd.page.getByRole('row', { name: new RegExp(gvName) });
      await expect(payRow).toBeVisible({ timeout: 15_000 });
      await payRow.click();
      await expect(gd.page.getByText('Chưa có bảng lương', { exact: true })).toBeVisible({ timeout: 15_000 });
      await gd.page.getByRole('button', { name: 'Tính lương' }).click();
      await expect(gd.page.getByText('Nháp', { exact: true })).toBeVisible({ timeout: 15_000 });
      await gd.page.getByRole('button', { name: 'Chốt bảng lương' }).click();
      await expect(gd.page.getByText('Đã chốt', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(gd.page.getByRole('button', { name: 'Mở lại' })).toBeVisible();
      recordCreated(scratch, 'payslip', 'period', PERIOD);
      console.log('[08-ops-kpi-payroll-gv] payslip assembled + finalized');

      await menuNav(gd.page, 'Nhân sự', 'KPI', { role: 'giam_doc_dao_tao' });
      await gd.page.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
      await gd.page.getByRole('button', { name: 'Đã trả lương kỳ ' + PERIOD }).click();
      const bulkDialog = gd.page.getByRole('alertdialog');
      await Promise.all([
        gd.page.waitForResponse((r) => r.url().includes('kpi.bulkApprove') && r.status() === 200),
        bulkDialog.getByRole('button', { name: 'Tất toán' }).click(),
      ]);
      await expect(gd.page.getByText(/đã tất toán|đã duyệt/i).first()).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'kpi-settle', 'period', PERIOD);
      console.log('[08-ops-kpi-payroll-gv] period settled (bulkApprove, GV bucket)');
    } finally {
      await closeRoleSession(gd);
    }

    // 5. Invariant: the giao_vien reads back their finalized payslip.
    const gvClient = liveStaffRoleClient(KPI_GV_KEY);
    const slip = await gvClient.payslip.my.query({ period: PERIOD });
    expect(slip, 'phiếu lương kỳ ' + PERIOD + ' của giao_vien phải đọc lại được').not.toBeNull();
    expect(slip!.status, 'phiếu lương phải ở trạng thái finalized').toBe('finalized');
    expect(Number(slip!.totalNet), 'totalNet = base(8.000.000) + kpi(0) - penalty(0)').toBeGreaterThanOrEqual(8_000_000);
    recordCreated(scratch, 'payslip-my', 'period+totalNet', PERIOD + '=' + slip!.totalNet);
    console.log('[08-ops-kpi-payroll-gv] payslip.my finalized, totalNet=' + slip!.totalNet);

    await assertNoErrors(gv.page, scratch.collectors[0]!, 'KPI + payroll GV smoke');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
