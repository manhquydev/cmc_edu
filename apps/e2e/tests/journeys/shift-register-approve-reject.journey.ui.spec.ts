// P3-03 + P3-04 + P3-07 journey — the shift registration lifecycle: a sale
// registers a future shift, a director rejects it with a reason (P3-07), the
// sale resubmits, the director approves it (P3-04), and the sale cancels it
// (P3-03). One spec because the ticket-lock (at most one 'submitted'
// registration per person) forces this exact order — a resubmit is only
// possible after a rejection.
//
// Setup is real UI: a super admin creates a Kinh doanh shift group + template
// (the sale's position resolves to KINH_DOANH, so the group type must match),
// and the sale is created through /admin/users. shift.submit requires a FUTURE
// fromDate, so tomorrow (ICT) is used.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { addDaysToDateOnly, ictDateOnlyOf } from '@cmc/domain-time';
import { mintStaffCookie } from '../../src/session-injection.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const tomorrow = addDaysToDateOnly(ictDateOnlyOf(new Date()), 1);

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P3-03/04/07 journey — đăng ký ca: từ chối → nộp lại → duyệt → hủy', () => {
  // Admin lives on :4173. createStaffViaAdminUi makes its own context via
  // browser.newContext() with no baseURL, which inherits this test-level one —
  // without it that context would default to the LMS (:4174) and land on login.
  test.use({ baseURL: 'http://localhost:4173' });
  // Four browser contexts and a full reject→resubmit→approve→cancel cycle — well
  // past the 30s default.
  test.setTimeout(120_000);

  const runId = randomUUID().slice(0, 8);
  const groupName = `E2E P3 Nhóm KD ${runId}`;
  const templateName = `E2E P3 Ca ${runId}`;
  const saleName = `E2E P3 Sale ${runId}`;
  const saleUserId = `e2e-p3shift-sale-${runId}`;

  async function submitRegistration(browser: import('@playwright/test').Browser): Promise<void> {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    try {
      const page = await context.newPage();
      await context.addCookies(cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId })));
      await page.goto('/cockpit');
      await menuNav(page, 'Nhân sự', 'Đăng ký ca', { role: 'sale' });
      // SubmitTab is the default tab. Pick the group (its templates then load).
      await page.getByRole('combobox', { name: /Nhóm ca/ }).click();
      await page.getByRole('option', { name: new RegExp(groupName) }).click();
      await page.getByLabel('Từ ngày (YYYY-MM-DD)').fill(tomorrow);
      await page.getByLabel('Đến ngày (YYYY-MM-DD)').fill(tomorrow);
      // The single default day entry: its date + template. exact:true so it
      // doesn't also match "Từ ngày"/"Đến ngày".
      await page.getByLabel('Ngày (YYYY-MM-DD)', { exact: true }).fill(tomorrow);
      await page.getByRole('combobox', { name: /Mẫu ca/ }).click();
      await page.getByRole('option', { name: new RegExp(templateName) }).click();
      await page.getByRole('button', { name: 'Gửi đăng ký' }).click();
      await expect(page.getByText('Đăng ký ca đã gửi, chờ GĐ duyệt.')).toBeVisible();
    } finally {
      await context.close();
    }
  }

  test('a sale registers a shift, a director rejects then approves it, and the sale cancels', async ({ browser }) => {
    // --- setup: super admin creates a Kinh doanh group + template ---
    const adminContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const adminPage = await adminContext.newPage();
    await adminContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p3shift-sa-${runId}`, roles: ['super_admin'], facilityId })),
    );
    await adminPage.goto('/cockpit');
    await menuNav(adminPage, 'Nhân sự', 'Ca làm việc', { role: 'super_admin' });
    await adminPage.getByLabel('Tên nhóm ca').fill(groupName);
    await adminPage.getByRole('button', { name: 'Thêm nhóm ca' }).click();
    const groupCard = adminPage.locator('div').filter({ hasText: groupName }).filter({ has: adminPage.getByLabel('Tên mẫu ca') }).last();
    await expect(groupCard).toBeVisible();
    await groupCard.getByLabel('Tên mẫu ca').fill(templateName);
    await groupCard.getByLabel('Bắt đầu (HH:mm)').fill('08:00');
    await groupCard.getByLabel('Kết thúc (HH:mm)').fill('17:00');
    await groupCard.getByRole('button', { name: '+ Thêm mẫu ca' }).click();
    await expect(groupCard.getByText(templateName)).toBeVisible();
    await adminContext.close();

    // --- setup: the sale who will register (position → KINH_DOANH) ---
    await createStaffViaAdminUi(browser, { facilityId, userId: saleUserId, fullName: saleName, position: 'Sale' });

    // --- sale submits the registration ---
    await submitRegistration(browser);

    // --- director (GĐKD) rejects with a reason (P3-07) ---
    const gdContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const gdPage = await gdContext.newPage();
    await gdContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p3shift-gd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    await gdPage.goto('/cockpit');
    await menuNav(gdPage, 'Nhân sự', 'Đăng ký ca', { role: 'giam_doc_kinh_doanh' });
    await gdPage.locator('main.console-main').getByRole('button', { name: /Duyệt.*Từ chối/ }).click();
    const pendingRow = gdPage.getByRole('row', { name: new RegExp(saleName) });
    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole('button', { name: 'Từ chối' }).click();
    const rejectDialog = gdPage.getByRole('dialog');
    await rejectDialog.getByRole('textbox').fill('Trùng ca với NV khác — E2E');
    await rejectDialog.getByRole('button', { name: 'Từ chối' }).click();
    await expect(gdPage.getByRole('row', { name: new RegExp(saleName) })).toHaveCount(0);

    // --- sale resubmits (only possible now the previous one is rejected) ---
    await submitRegistration(browser);

    // --- director approves (P3-04) ---
    await gdPage.reload();
    await gdPage.locator('main.console-main').getByRole('button', { name: /Duyệt.*Từ chối/ }).click();
    const pending2 = gdPage.getByRole('row', { name: new RegExp(saleName) });
    await expect(pending2).toBeVisible();
    await pending2.getByRole('button', { name: 'Duyệt' }).click();
    // "Duyệt" opens a ConfirmDialog whose own confirm is also labelled "Duyệt".
    const approveDialog = gdPage.getByRole('alertdialog');
    await approveDialog.getByRole('button', { name: 'Duyệt' }).click();
    await expect(gdPage.getByRole('row', { name: new RegExp(saleName) })).toHaveCount(0);
    await gdContext.close();

    // ── business invariant (read AFTER approve, BEFORE the sale cancels) ──
    // The pending queue emptying only proves the reg LEFT 'submitted' — a reject
    // clears it too, so it does NOT prove the approve landed on 'approved'. No
    // director-facing read returns an approved reg (pendingForApproval is
    // submitted-only), so the OWNER reads it back. shift.myRegistrations is
    // self-scoped (resolves the AppUser from ctx.subject.userId), so this client
    // MUST reuse saleUserId — the exact id that minted the sale's cookie above
    // and that createStaffViaAdminUi seeded as an AppUser row. This run's sale
    // has one rejected reg + one resubmitted reg; exactly that resubmitted one
    // must now read back as 'approved'. This must run before the cancel step
    // below, which would flip it to 'cancelled'.
    const saleReadClient = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: saleUserId,
      roles: ['sale'],
      facilityId,
    });
    const myRegs = await saleReadClient.shift.myRegistrations.query();
    assertBusinessInvariant(
      'đăng ký ca sau duyệt = đúng 1 bản ghi approved',
      myRegs.filter((r) => r.status === 'approved').length,
      1,
    );

    // --- sale cancels the approved registration (P3-03) ---
    const saleContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const salePage = await saleContext.newPage();
    await saleContext.addCookies(cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId })));
    await salePage.goto('/cockpit');
    await menuNav(salePage, 'Nhân sự', 'Đăng ký ca', { role: 'sale' });
    await salePage.getByRole('button', { name: /Đăng ký của tôi/ }).click();
    const myRow = salePage.getByRole('row', { name: /approved|Đã duyệt/ });
    await expect(myRow.first()).toBeVisible();
    await myRow.first().getByRole('button', { name: 'Hủy' }).click();
    const cancelDialog = salePage.getByRole('alertdialog');
    await cancelDialog.getByRole('button', { name: 'Hủy ca' }).click();
    // After cancelling, the row is no longer approved.
    await expect(salePage.getByText(/Đã hủy|cancelled/i).first()).toBeVisible();

    await saleContext.close();
  });
});
