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
// load. `receipt-detail.tsx`'s `error || !receipt` branch renders a real
// "Không tìm thấy phiếu thu" permission-denied banner for any `sale` session
// that lands on `/finance/:id` — asserting a list-row or button ABSENCE on a
// screen `sale` cannot even load would be a strictly weaker, more vacuous
// proof than asserting the actual denial banner the app renders. This
// journey asserts that banner directly, which is the stronger signal
// available here (per this phase's own explicit guidance for this flow).
//
// Reaching that URL as `sale`: `finance.receiptCreate`'s own onSuccess
// (receipt-create.tsx) only auto-navigates the creator there when they hold
// `finance.receiptGet` — `sale` never does, so it stays on `/finance/new`
// with an in-place success banner and never sees the receipt's UUID. The
// negation below instead reaches `/finance/:id` directly, as a FRESH `sale`
// session, once the approver's own navigation (which does have
// `receiptGet`) reveals the real id — the permission boundary being proven
// is unchanged; only how the URL is reached changed with it.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import { seedClassBatch } from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
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
    // Required by receipt-create.tsx's validate() — the parent's LMS OTP
    // login credential, without it the real submit stays client-side blocked.
    await salePage.getByLabel('Email phụ huynh').fill(`e2e-p103-parent-${randomUUID().slice(0, 8)}@e2e.cmc`);
    await salePage.getByRole('combobox', { name: /^Lớp học/ }).click();
    await salePage.getByRole('option', { name: new RegExp(seeded.code) }).click();
    await salePage.getByRole('spinbutton', { name: /^Học phí/ }).fill('5000001');
    await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
    // `sale` lacks `finance.receiptGet` (packages/auth), so receipt-create.tsx's
    // own onSuccess does NOT navigate `sale` to `/finance/:id` — it stays on
    // `/finance/new` and shows the receipt's code in an in-place success
    // banner instead. `sale` therefore never observes the receipt's UUID here;
    // the negation below is proven directly, by URL, once the approver reveals
    // the real id further down.
    await expect(salePage.getByText(/^Đã tạo phiếu thu /)).toBeVisible();
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
    // The receipt id is the last path segment — the approver's role holds
    // `finance.receiptGet`, so this is the first (and only) place either role
    // in this test observes the real UUID.
    const approverUrl = approverPage.url();
    const receiptId = approverUrl.slice(approverUrl.lastIndexOf('/') + 1);

    // The negation this journey exists to prove: `sale` cannot view/approve
    // the very receipt it just created. `finance.receiptGet` excludes `sale`
    // entirely. The route is now wrapped in PermissionGate (finance.receiptGet),
    // so a FRESH sale session hits the gate EmptyState before the detail page
    // mounts — same boundary as the API, surfaced as "Không có quyền truy cập"
    // rather than the old in-page "Không tìm thấy phiếu thu" banner.
    const negationContext = await browser.newContext();
    const negationPage = await negationContext.newPage();
    const negationCookie = mintStaffCookie({
      userId: `e2e-p103-sale-negation-${randomUUID().slice(0, 8)}`,
      roles: ['sale'],
      facilityId,
    });
    await negationContext.addCookies(cookiePair(STAFF_COOKIE_NAME, negationCookie));
    await negationPage.goto(`/finance/${receiptId}`);
    await expect(negationPage.getByText('Không có quyền truy cập')).toBeVisible();
    await expect(negationPage.getByText(/finance\.receiptGet/)).toBeVisible();
    await expect(negationPage.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toHaveCount(0);
    await negationContext.close();

    await approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    const dialog = approverPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();

    await expect(
      approverPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
    ).toBeVisible();
    await expect(approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toHaveCount(0);

    // ── business invariant ──
    // The success banner + button disappearance prove the approve mutation RAN,
    // but not that the receipt's persisted state actually flipped to 'approved'
    // (finance/router.ts: receiptApprove writes `status: 'approved'` only under
    // the atomic `status: 'draft'` claim — a lost race would leave the row
    // untouched while the UI still showed the optimistic banner). Read the row
    // back through the authorized query (same GĐKD role that holds
    // `finance.receiptGet`) and assert the durable status. This turns P1-03 from
    // reachable-only into verified-correct: the number a stakeholder cares about
    // here is the STATE — the phiếu really is 'approved' server-side, not just
    // on screen. Read-path is real (authorized query + RLS facility scope), not
    // a DB back-door.
    const receipt = await createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: `e2e-p103-gdkd-readback-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    }).finance.receiptGet.query({ receiptId });
    assertBusinessInvariant('phiếu thu sau duyệt có trạng thái approved', receipt.status, 'approved');

    await approverContext.close();
  });
});
