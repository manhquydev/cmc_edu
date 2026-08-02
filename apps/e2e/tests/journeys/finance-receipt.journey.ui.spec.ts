// F1 regression journey — Phiếu thu (finance receipt) create -> approve.
//
// One of the 3 flows that were dead for 16 days (docs/codebase-summary.md).
// Drives the real UI for both money-gate roles: `sale` creates a draft
// receipt, a DIFFERENT director role finds it by its displayed student name
// and approves it — proving the create/approve/notify chain the same way a
// person actually walks it, not by asserting the permission registry alone.
//
// ClassBatch/Course seed exception (documented per phase-04's PO callout,
// 2026-07-24 — same category as F4's `seedAppUser` staff row): grepped the
// whole admin app (`apps/admin/src/pages`) for any UI that CREATES a Course
// or ClassBatch — none exists. `classes/index.tsx`, `courses/index.tsx`,
// `finance/receipt-create.tsx` and `enrollment/class-placement.tsx` only ever
// CONSUME `classBatch.list`/`course.list`. `seedClassBatch` (apps/e2e/src/db.ts)
// fills that one gap directly via Prisma; every step below still goes
// through real UI.
//
// Navigation note: the "Phiếu thu" nav entry (`/finance`) is gated by
// `finance.receiptList`, which `sale` does NOT hold (packages/auth/src/index.ts)
// — so `sale` cannot reach the receipt list/create flow via that entry. The
// real path `sale` DOES have is "Xếp lớp" (`enrollment.enroll`, which `sale`
// holds), whose own screen (class-placement.tsx) carries a real inline link
// ("tạo phiếu thu mới") straight to `/finance/new` for exactly this reason
// (its own on-page banner: "Để ghi danh học viên mới, hãy tạo phiếu thu mới").
// That link is a genuine UI click, not a `page.goto()`.
//
// Same reason `sale` locates nothing by receipt CODE: `finance.receiptCreate`'s
// own onSuccess checks `canDo('finance', 'receiptGet')` — gated to
// `giam_doc_kinh_doanh`/`giam_doc_dao_tao` only, NOT `sale` — and only
// navigates to `/finance/<id>` when that holds; for `sale` it stays on
// `/finance/new` and shows the receipt's code in an in-place success banner
// instead (real app behavior, receipt-create.tsx's own comment: "would land
// straight on Không tìm thấy phiếu thu if we navigated there"). The approver
// below instead finds the row by the student name typed into the create
// form — a real, visible column on the receipt list (`studentName`), unique
// enough with the random suffix — and its own navigation into detail is what
// this test reads `receiptId` from, `sale` never observes the UUID at all.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import {
  seedClassBatch,
  drainEmailOutboxOnce,
  getEmailOutboxStatusByReceiptId,
  deleteEmailOutboxByReceiptId,
} from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('F1 journey — finance receipt (Phiếu thu)', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('sale creates a receipt for a real class, a different GĐ finds it by its displayed student name and approves it, and the notification email reaches "sent"', async ({
    browser,
  }) => {
    const seeded = await seedClassBatch({ facilityId });

    const studentName = `E2E F1 Student ${randomUUID().slice(0, 8)}`;
    const parentEmail = `e2e-f1-${randomUUID().slice(0, 8)}@e2e.cmc`;
    const parentPhone = randomVnPhone();

    let receiptId = '';
    try {
      // --- sale: create the draft receipt ---
      const saleContext = await browser.newContext();
      const salePage = await saleContext.newPage();
      const saleCookie = mintStaffCookie({
        userId: `e2e-f1-sale-${randomUUID().slice(0, 8)}`,
        roles: ['sale'],
        facilityId,
      });
      await saleContext.addCookies([
        { name: STAFF_COOKIE_NAME, value: saleCookie, domain: '127.0.0.1', path: '/' },
        { name: STAFF_COOKIE_NAME, value: saleCookie, domain: 'localhost', path: '/' },
      ]);
      // Landing screen after "login" — not the destination this journey
      // proves, same as F4's own goto-to-cockpit.
      await salePage.goto('/cockpit');

      await menuNav(salePage, 'Tài chính & Điều hành', 'Xếp lớp', { role: 'sale' });
      await salePage.getByText('tạo phiếu thu mới').click();
      await expect(salePage).toHaveURL(/\/finance\/new/);

      await salePage.getByLabel('Họ tên học viên').fill(studentName);
      await salePage.getByLabel('SĐT phụ huynh').fill(parentPhone);
      // Required so `finance.receiptApprove` actually enqueues a notification
      // email (`enqueueReceiptEmail` no-ops on a null parentEmail) — this is
      // what makes the outbox assertion below meaningful rather than vacuous.
      await salePage.getByLabel('Email phụ huynh').fill(parentEmail);

      await salePage.getByRole('button', { name: /^Lớp học/ }).click();
      await salePage.getByRole('option', { name: new RegExp(seeded.code) }).click();

      // NumberInput renders a native `min={1} step={100000}` spinbutton —
      // the browser's own HTML5 step-mismatch constraint silently blocks
      // form submission (no submit event, no network call, no visible error)
      // for a value that isn't `1 + k*100000`. 5_000_001 satisfies it and
      // still reads as "5 triệu" / stays under the 20M second-eye threshold.
      const amountInput = salePage.getByRole('spinbutton', { name: /^Học phí/ });
      await amountInput.fill('5000001');

      await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
      // `sale` lacks `finance.receiptGet` (packages/auth) — receipt-create.tsx's
      // own onSuccess only navigates to `/finance/:id` when the caller holds
      // that permission; for `sale` it stays on `/finance/new` and shows the
      // receipt's code in an in-place success banner instead (its own comment:
      // "would land straight on Không tìm thấy phiếu thu if we navigated
      // there"). The receipt's UUID is only observable later, from the
      // approver's own navigation into detail below (real behavior, not a
      // test-driven goto) — that is where `receiptId` is read for this test's
      // own later DB-side outbox lookup/teardown.
      await expect(salePage.getByText(/^Đã tạo phiếu thu /)).toBeVisible();
      await saleContext.close();

      // --- a DIFFERENT GĐ: find the receipt by the displayed student name, approve ---
      const approverContext = await browser.newContext();
      const approverPage = await approverContext.newPage();
      const approverCookie = mintStaffCookie({
        userId: `e2e-f1-gdkd-${randomUUID().slice(0, 8)}`,
        roles: ['giam_doc_kinh_doanh'],
        facilityId,
      });
      await approverContext.addCookies([
        { name: STAFF_COOKIE_NAME, value: approverCookie, domain: '127.0.0.1', path: '/' },
        { name: STAFF_COOKIE_NAME, value: approverCookie, domain: 'localhost', path: '/' },
      ]);
      await approverPage.goto('/cockpit');

      await menuNav(approverPage, 'Tài chính & Điều hành', 'Phiếu thu', { role: 'giam_doc_kinh_doanh' });
      const row = await findInList(approverPage, (text) => text.includes(studentName));
      await row.click();
      await expect(approverPage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
      // The receipt id is the last path segment — the only place Playwright can
      // observe it (receiptCreate's response is not visible to the browser
      // tests, and `sale` above never navigates there to read it either).
      const approverUrl = approverPage.url();
      receiptId = approverUrl.slice(approverUrl.lastIndexOf('/') + 1);
      await expect(approverPage.getByRole('heading', { name: /^Phiếu thu /, level: 4 })).toBeVisible();

      await approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
      const dialog = approverPage.getByRole('alertdialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();

      // Status visibly changed: the success panel (provisioning: 'ok') is the
      // most specific real signal, and the draft-only approve button is gone.
      await expect(
        approverPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
      ).toBeVisible();
      await expect(approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toHaveCount(0);

      await approverContext.close();

      // --- notification email reaches "sent" (never a real mailbox) ---
      // No worker process runs in this e2e harness (global-setup only spawns
      // the api server) — `drainEmailOutboxOnce` runs the same
      // `relayEmailOutbox` function the real worker calls on its own
      // interval, once, via a Console transport (matches the non-production
      // default `apps/api/src/worker/index.ts` itself would pick). The
      // assertion below reads only the outbox row's `status` column — same
      // principle as scripts/ops-smoke.sh's mark 5.
      await drainEmailOutboxOnce();
      await expect
        .poll(() => getEmailOutboxStatusByReceiptId(receiptId), { timeout: 10_000, intervals: [200] })
        .toBe('sent');
    } finally {
      if (receiptId) await deleteEmailOutboxByReceiptId(receiptId);
    }
  });
});
