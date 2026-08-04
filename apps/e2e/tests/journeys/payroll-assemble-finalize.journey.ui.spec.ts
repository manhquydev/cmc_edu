// P3-05 journey — the payroll assemble → finalize lifecycle. A GĐKD holds every
// permission this flow needs (salaryTier.manage, staff.pickList,
// payslip.assemble, payslip.finalize — packages/auth/src/index.ts), so one
// director drives the whole chain: create a KINH_DOANH salary tier, assign it to
// a sale, assemble that sale's payslip for the current period into a draft, then
// finalize it.
//
// The tier assignment is load-bearing, not decoration: payslip.assemble throws
// forbidden('Chưa gán bậc lương…') when SalaryRate.tierId is missing
// (payroll/router.ts). The sale is created through /admin/users WITH the DB
// 'sale' role (roleLabels: ['Sale']) because both the "Gán bậc" tab filter
// (roles.includes('sale')) and assignTier's server-side targetRole check read
// AppUser.roles from the DB — not the cookie.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { ictMonthOf } from '@cmc/domain-time';
import { mintStaffCookie } from '../../src/session-injection.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P3-05 journey — bảng lương: tạo bậc → gán bậc → tính lương → chốt', () => {
  // Admin/HR screens live on :4173. createStaffViaAdminUi makes its own context
  // with no baseURL, inheriting this one — without it that context defaults to
  // the LMS (:4174) and lands on login.
  test.use({ baseURL: 'http://localhost:4173' });
  test.setTimeout(120_000);

  const runId = randomUUID().slice(0, 8);
  const tierName = `E2E P3-05 Bậc KD ${runId}`;
  const saleName = `E2E P3-05 Sale ${runId}`;
  const saleUserId = `e2e-p305-sale-${runId}`;

  test('a director creates a tier, assigns it to a sale, then assembles and finalizes the payslip', async ({ browser }) => {
    // --- setup: the sale who will be paid (DB role 'sale' so the tier assign +
    // pickList filter both see it) ---
    await createStaffViaAdminUi(browser, {
      facilityId,
      userId: saleUserId,
      fullName: saleName,
      position: 'Sale',
      roleLabels: ['Sale'],
    });

    // --- the GĐKD does everything else ---
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p305-gd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    await page.goto('/cockpit');

    // --- create a KINH_DOANH salary tier (the "Loại" selector defaults to
    // KINH_DOANH, which matches the sale's role) ---
    await menuNav(page, 'Nhân sự', 'Bậc lương', { role: 'giam_doc_kinh_doanh' });
    await expect(page).toHaveURL(/\/hr\/salary-tiers/);
    await page.getByRole('button', { name: '+ Thêm bậc lương' }).click();
    await page.getByLabel('Tên bậc').fill(tierName);
    await page.getByLabel('Lương cơ bản (VND)').fill('10000000');
    await page.getByLabel('Đơn giá (VND)').fill('50000');
    await page.getByLabel('Công ca yêu cầu').fill('22');
    await page.getByLabel('Chỉ số yêu cầu (giờ dạy / doanh thu)').fill('100000000');
    await page.getByRole('button', { name: 'Thêm bậc' }).click();
    // The new tier lands in the catalog table.
    await expect(page.getByRole('row', { name: new RegExp(tierName) })).toBeVisible();

    // --- assign the tier to the sale (CmcTabs renders tab buttons) ---
    await page.getByRole('button', { name: 'Gán bậc' }).click();
    const assignRow = page.getByRole('row', { name: new RegExp(saleName) });
    await expect(assignRow).toBeVisible();
    await assignRow.getByRole('button', { name: 'Gán bậc' }).click();
    // The inline "Bậc lương" selector (label hidden) appears in the row.
    await assignRow.getByRole('combobox', { name: 'Bậc lương' }).click();
    await page.getByRole('option', { name: tierName }).click();
    await assignRow.getByRole('button', { name: 'Lưu' }).click();
    // On success the inline editor collapses back to the "Gán bậc" button.
    await expect(assignRow.getByRole('button', { name: 'Gán bậc' })).toBeVisible();

    // --- assemble the payslip for the current period ---
    await menuNav(page, 'Nhân sự', 'Chốt lương', { role: 'giam_doc_kinh_doanh' });
    await expect(page).toHaveURL(/\/hr\/payroll/);
    await page.getByRole('row', { name: new RegExp(saleName) }).click();
    // Before assembling there is no payslip for this period.
    await expect(page.getByText('Chưa có bảng lương', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tính lương (assemble)' }).click();
    // The draft breakdown renders with the tier's base salary; status is "Nháp".
    await expect(page.getByText('Phiếu lương', { exact: false })).toBeVisible();
    await expect(page.getByText('Nháp', { exact: true })).toBeVisible();
    await expect(page.getByText('10.000.000 đ').first()).toBeVisible();

    // --- finalize the payslip ---
    await page.getByRole('button', { name: 'Chốt bảng lương' }).click();
    // Status flips to finalized: the badge reads "Đã chốt" and the finalize
    // button is replaced by "Mở lại (reopen)".
    await expect(page.getByText('Đã chốt', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mở lại (reopen)' })).toBeVisible();

    // ── business invariant ──
    // The "Đã chốt" badge proves the slip was finalized; it says nothing about
    // whether totalNet equals base+kpi−penalty. This run's sale has no approved
    // punches and no confirmed KPI, so variablePay=kpiBonus=penalty=0 and
    // totalNet must equal the tier base salary (10.000.000 VND). payslip.my is
    // self-scoped (resolves the AppUser from ctx.subject.userId), so this client
    // MUST reuse saleUserId — the id createStaffViaAdminUi seeded as the sale's
    // AppUser row. totalNet is a Prisma Decimal serialized as a string over the
    // default JSON transformer, so it is coerced with Number() before comparing.
    const period = ictMonthOf(new Date());
    const saleReadClient = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: saleUserId,
      roles: ['sale'],
      facilityId,
    });
    const slip = await saleReadClient.payslip.my.query({ period });
    expect(slip, `phiếu lương kỳ ${period} của sale phải đọc lại được`).not.toBeNull();
    assertBusinessInvariant('phiếu lương chốt = base+kpi−penalty (VND)', Number(slip!.totalNet), 10000000);
    assertBusinessInvariant('phiếu lương ở trạng thái finalized', slip!.status, 'finalized');

    await context.close();
  });
});
