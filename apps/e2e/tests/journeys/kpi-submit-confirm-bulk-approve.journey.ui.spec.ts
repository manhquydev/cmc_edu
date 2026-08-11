// P3-06 + P3-08 journey — the KPI slip lifecycle. A sale submits their own KPI
// slip for a PAST period (kpi.submitSlip), their direct manager confirms it
// (kpi.confirm), and the same director then settles the whole period
// (kpi.bulkApprove). One spec because each step is the server-side precondition
// of the next: only a `submitted` slip can be confirmed, and only a `confirmed`
// one can be approved.
//
// Period is 2026-06, deliberately in the past: `submitSlipOpensAt` opens
// submission on day 3 of the FOLLOWING month in ICT
// (apps/api/src/kpi/auto-score.ts), so a past period is submittable today
// without mocking the clock — the plan's feared time-travel blocker does not
// apply.
//
// Two preconditions are easy to get wrong and both fail SILENTLY:
//   - `kpi.confirm` requires `scoreOwner.managerId === confirmUser.id`, so the
//     director must exist as an AppUser and be linked as the sale's manager.
//   - `kpi.bulkApprove` SKIPS any confirmed score whose Payslip for the period
//     is not `finalized` (`skippedUnfinalized`). Without the payroll step the
//     bulk action runs and changes nothing, which would look like a pass.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { seedManagerLink } from '../../src/db.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const PERIOD = '2026-06';

/** Switches the KPI inbox's status filter. It is an Astryx Selector with a
 *  visible label, so the trigger resolves by that label and the choice by its
 *  option text. */
async function selectStatusFilter(page: import('@playwright/test').Page, label: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Trạng thái' }).click();
  await page.getByRole('option', { name: label }).click();
}

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P3-06/P3-08 journey — phiếu KPI: nộp → xác nhận → tất toán kỳ', () => {
  test.use({ baseURL: 'http://localhost:4173' });
  test.setTimeout(180_000);

  const runId = randomUUID().slice(0, 8);
  const saleName = `E2E P306 Sale ${runId}`;
  const saleUserId = `e2e-p306-sale-${runId}`;
  const gdName = `E2E P306 GD ${runId}`;
  const gdUserId = `e2e-p306-gd-${runId}`;
  const tierName = `E2E P306 Bậc KD ${runId}`;

  test('a sale submits a KPI slip, their manager confirms it, and the period is settled', async ({ browser }) => {
    // --- setup: both people exist as AppUsers, created through the real UI ---
    await createStaffViaAdminUi(browser, {
      facilityId,
      userId: saleUserId,
      fullName: saleName,
      position: 'Sale',
      roleLabels: ['Sale'],
    });
    // The director needs an AppUser row of their own: kpi.confirm resolves the
    // confirming user from ctx.subject.userId and fails closed without it.
    await createStaffViaAdminUi(browser, {
      facilityId,
      userId: gdUserId,
      fullName: gdName,
      position: 'Giám đốc kinh doanh',
    });
    // No UI assigns a manager — see seedManagerLink.
    await seedManagerLink({ facilityId, reportUserId: saleUserId, managerUserId: gdUserId });

    // --- the director sets up the salary tier the sale needs ---
    const gdContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const gdPage = await gdContext.newPage();
    await gdContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: gdUserId, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    await gdPage.goto('/cockpit');
    await menuNav(gdPage, 'Nhân sự', 'Bậc lương', { role: 'giam_doc_kinh_doanh' });
    await gdPage.getByRole('button', { name: '+ Thêm bậc lương' }).click();
    await gdPage.getByLabel('Tên bậc').fill(tierName);
    await gdPage.getByLabel('Lương cơ bản (VND)').fill('10000000');
    await gdPage.getByLabel('Đơn giá (VND)').fill('50000');
    await gdPage.getByLabel('Công ca yêu cầu').fill('22');
    await gdPage.getByLabel('Chỉ số yêu cầu (giờ dạy / doanh thu)').fill('100000000');
    await gdPage.getByRole('button', { name: 'Thêm bậc' }).click();
    await expect(gdPage.getByRole('row', { name: new RegExp(tierName) })).toBeVisible();

    // kpi.submitSlip refuses a person with no tier ("Chưa gán bậc lương…").
    await gdPage.getByRole('button', { name: 'Gán bậc' }).click();
    const assignRow = gdPage.getByRole('row', { name: new RegExp(saleName) });
    await assignRow.getByRole('button', { name: 'Gán bậc' }).click();
    await assignRow.getByRole('combobox', { name: 'Bậc lương' }).click();
    await gdPage.getByRole('option', { name: tierName }).click();
    await assignRow.getByRole('button', { name: 'Lưu' }).click();
    await expect(assignRow.getByRole('button', { name: 'Gán bậc' })).toBeVisible();

    // --- the sale computes and submits their own slip (P3-06, submit half) ---
    const saleContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const salePage = await saleContext.newPage();
    await saleContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId })),
    );
    await salePage.goto('/cockpit');
    await menuNav(salePage, 'Nhân sự', 'Của tôi', { role: 'sale' });
    await salePage.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
    // "Tính lại" creates the draft KpiScore; without it there is nothing to submit.
    await salePage.getByRole('button', { name: 'Tính lại' }).click();
    await expect(salePage.getByText('Nháp', { exact: true })).toBeVisible();
    await Promise.all([
      salePage.waitForResponse((r) => r.url().includes('kpi.submitSlip') && r.status() === 200),
      salePage.getByRole('button', { name: 'Nộp' }).click(),
    ]);
    await expect(salePage.getByText('Chờ xác nhận', { exact: true })).toBeVisible();
    await saleContext.close();

    // --- the direct manager confirms the slip (P3-06, confirm half) ---
    // Confirm comes BEFORE payroll is finalized. The two rules squeeze the order
    // from both sides and the journey proved it: `kpi.confirm` rejects with 403
    // "Payslip for this period is finalized — reopen it before confirming", while
    // `kpi.bulkApprove` skips any score whose payslip is NOT finalized. So the one
    // workable sequence is confirm → finalize payroll → settle.
    await menuNav(gdPage, 'Nhân sự', 'KPI', { role: 'giam_doc_kinh_doanh' });
    await gdPage.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
    const kpiRow = gdPage.getByRole('row', { name: new RegExp(saleName) });
    await expect(kpiRow).toBeVisible();
    // Confirm is form-only (list index + bulk period settle only).
    await kpiRow.getByRole('button', { name: 'Mở phiếu' }).click();
    await expect(gdPage).toHaveURL(/\/hr\/kpi\/[0-9a-f-]{36}/i);
    await gdPage.getByRole('button', { name: 'Xác nhận' }).click();
    const confirmDialog = gdPage.getByRole('alertdialog');
    await Promise.all([
      gdPage.waitForResponse((r) => r.url().includes('kpi.confirm') && r.status() === 200),
      confirmDialog.getByRole('button', { name: 'Xác nhận' }).click(),
    ]);
    await expect(gdPage.getByText(/Đã xác nhận|confirmed/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Back to board: filter confirmed and find the row.
    await menuNav(gdPage, 'Nhân sự', 'KPI', { role: 'giam_doc_kinh_doanh' });
    await gdPage.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
    await selectStatusFilter(gdPage, 'Đã xác nhận');
    await expect(gdPage.getByRole('row', { name: new RegExp(saleName) })).toBeVisible();

    // ── business invariant (P3-06) ──
    // The row moving into the "Đã xác nhận" filter proves the list re-queried,
    // but the durable proof is the persisted KpiScore.status. Read it back
    // through the authorized director query (kpi.list, GĐKD track = sale) and
    // assert the slip is really 'confirmed' (kpi/router.ts: confirm writes
    // `status: 'confirmed'`). gdUserId is reused as the reader — it already
    // exists as an AppUser and holds the director role, so kpi.list returns the
    // sale's track. This turns the confirm half from reachable-only into
    // verified-correct.
    const directorClient = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: gdUserId,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    const confirmedScores = await directorClient.kpi.list.query({ period: PERIOD, status: 'confirmed' });
    const confirmedRow = confirmedScores.find((s) => s.fullName === saleName);
    expect(confirmedRow, `KPI của ${saleName} phải xuất hiện dưới trạng thái confirmed`).toBeTruthy();
    assertBusinessInvariant('phiếu KPI sau xác nhận có trạng thái confirmed', confirmedRow!.status, 'confirmed');

    // --- now finalize payroll: bulkApprove skips scores without a finalized
    // payslip, so without this the settle step would run and change nothing ---
    await menuNav(gdPage, 'Nhân sự', 'Chốt lương', { role: 'giam_doc_kinh_doanh' });
    await gdPage.getByLabel('Kỳ lương (YYYY-MM)').fill(PERIOD);
    await gdPage.getByRole('row', { name: new RegExp(saleName) }).click();
    await gdPage.getByRole('button', { name: 'Tính lương' }).click();
    await expect(gdPage.getByText('Nháp', { exact: true })).toBeVisible();
    await gdPage.getByRole('button', { name: 'Chốt bảng lương' }).click();
    await expect(gdPage.getByText('Đã chốt', { exact: true })).toBeVisible();

    // --- settle the whole period (P3-08) ---
    await menuNav(gdPage, 'Nhân sự', 'KPI', { role: 'giam_doc_kinh_doanh' });
    await gdPage.getByLabel('Kỳ (YYYY-MM)').fill(PERIOD);
    await gdPage.getByRole('button', { name: `Đã trả lương kỳ ${PERIOD}` }).click();
    const bulkDialog = gdPage.getByRole('alertdialog');
    await Promise.all([
      gdPage.waitForResponse((r) => r.url().includes('kpi.bulkApprove') && r.status() === 200),
      bulkDialog.getByRole('button', { name: 'Tất toán' }).click(),
    ]);
    // Same shape of proof as the confirm step: the slip leaves "Đã xác nhận" and
    // turns up under "Đã duyệt".
    await expect(gdPage.getByRole('row', { name: new RegExp(saleName) })).toHaveCount(0);
    await selectStatusFilter(gdPage, 'Đã duyệt');
    await expect(gdPage.getByRole('row', { name: new RegExp(saleName) })).toBeVisible();

    // ── business invariant (P3-08) ──
    // bulkApprove only flips scores whose payslip is finalized and only from
    // 'confirmed' (kpi/router.ts: the atomic `status: 'confirmed'` claim). The
    // "Đã duyệt" filter row is the UI hint; the durable proof is the persisted
    // status. Re-read via the same director query and assert the settled slip is
    // really 'approved' — verified-correct for the settle half.
    const approvedScores = await directorClient.kpi.list.query({ period: PERIOD, status: 'approved' });
    const approvedRow = approvedScores.find((s) => s.fullName === saleName);
    expect(approvedRow, `KPI của ${saleName} phải xuất hiện dưới trạng thái approved`).toBeTruthy();
    assertBusinessInvariant('phiếu KPI sau tất toán có trạng thái approved', approvedRow!.status, 'approved');

    await gdContext.close();
  });
});
