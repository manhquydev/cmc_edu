// P1-03 journey — Duyệt phiếu kích hoạt học viên (/finance, /finance/:id),
// with the negation this flow exists to prove: sale KHÔNG tự duyệt được.
//
// Manifest cross-check (step 2 of phase-05-journey-10-luong-loi.md):
// flow-manifest.ts's P1-03 entry expects
// `finance.receiptApprove, finance.receiptGet, finance.receiptList` at
// `/finance` + `/finance/:id` — this journey drives all three for the real
// approver role (giam_doc_kinh_doanh) via the real UI, same mechanics as F1.
//
// Negation mechanism — deliberately NOT `findInList.assertAbsent` (unlike
// P3-02/P4-02): `finance.receiptGet` (`packages/auth/src/index.ts`) is
// `['giam_doc_kinh_doanh', 'giam_doc_dao_tao']` only — `sale` is excluded
// from the procedure ENTIRELY, not merely from a button on a screen it can
// load. finance-receipt.journey.ui.spec.ts (F1) already found the resulting
// real behavior: `sale`'s own browser, on the very receipt it just created,
// hits `receipt-detail.tsx`'s `error || !receipt` branch and renders a real
// "Không tìm thấy phiếu thu" permission-denied banner — asserting a list-row
// or button ABSENCE on a screen `sale` cannot even load would be a strictly
// weaker, more vacuous proof than asserting the actual denial banner the app
// renders. This journey asserts that banner directly, which is the stronger
// signal available here (per this phase's own explicit guidance for this
// flow).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import { seedClassBatch } from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P1-03 journey — duyệt phiếu kích hoạt học viên, sale không tự duyệt', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('sale creates a receipt and gets a real permission-denied banner on it; a different GĐKD finds and approves it', async ({
    browser,
  }) => {
    const seeded = await seedClassBatch({ facilityId });

    const studentName = `E2E P1-03 Student ${randomUUID().slice(0, 8)}`;
    const parentPhone = randomVnPhone();

    // --- sale: create the draft receipt, then hit the real 403 screen on it ---
    const saleContext = await browser.newContext();
    const salePage = await saleContext.newPage();
    const saleCookie = mintStaffCookie({
      userId: `e2e-p103-sale-${randomUUID().slice(0, 8)}`,
      roles: ['sale'],
      facilityId,
    });
    await saleContext.addCookies(cookiePair(STAFF_COOKIE_NAME, saleCookie));
    await salePage.goto('/cockpit');

    await menuNav(salePage, 'Tài chính & Điều hành', 'Xếp lớp', { role: 'sale' });
    await salePage.getByText('tạo phiếu thu mới').click();
    await expect(salePage).toHaveURL(/\/finance\/new/);

    await salePage.getByLabel('Họ tên học viên').fill(studentName);
    await salePage.getByLabel('SĐT phụ huynh').fill(parentPhone);
    await salePage.getByRole('button', { name: /^Lớp học/ }).click();
    await salePage.getByRole('option', { name: new RegExp(seeded.code) }).click();
    await salePage.getByRole('spinbutton', { name: /^Học phí/ }).fill('5000001');
    await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
    await expect(salePage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);

    // The negation: sale's OWN session, on the receipt it JUST created, gets
    // the real permission-denied screen — never the approve button.
    await expect(salePage.getByText('Không tìm thấy phiếu thu')).toBeVisible();
    await expect(salePage.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toHaveCount(0);
    await saleContext.close();

    // --- a DIFFERENT GĐKD: find by displayed student name, approve for real ---
    const approverContext = await browser.newContext();
    const approverPage = await approverContext.newPage();
    const approverCookie = mintStaffCookie({
      userId: `e2e-p103-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await approverContext.addCookies(cookiePair(STAFF_COOKIE_NAME, approverCookie));
    await approverPage.goto('/cockpit');

    await menuNav(approverPage, 'Tài chính & Điều hành', 'Phiếu thu', { role: 'giam_doc_kinh_doanh' });
    const row = await findInList(approverPage, (text) => text.includes(studentName));
    await row.click();
    await expect(approverPage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
    await expect(approverPage.getByRole('heading', { name: /^Phiếu thu /, level: 4 })).toBeVisible();

    await approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    const dialog = approverPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();

    await expect(
      approverPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
    ).toBeVisible();
    await expect(approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toHaveCount(0);

    await approverContext.close();
  });
});
