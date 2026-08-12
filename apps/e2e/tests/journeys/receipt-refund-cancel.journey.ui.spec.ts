// P1-08 journey — Huỷ phiếu / hoàn tiền (/finance/:id, /finance/refund).
//
// Manifest cross-check: flow-manifest.ts P1-08 expects
// `finance.receiptCancel, finance.refundCreate` at `/finance/:id` +
// `/finance/refund` (models Receipt + RefundRecord). This journey drives both
// mutations via the real staff UI after a sale creates a draft and a GĐKD
// approves it (same create/approve walk as F1 / P1-03).
//
// Path under test (resource-centric form-depth):
//   1. sale → Xếp lớp → tạo phiếu thu (draft)
//   2. giam_doc_kinh_doanh → Phiếu thu → open row → Duyệt & Kích hoạt
//   3. same GĐKD → Hoàn tiền index → Mở phiếu → partial refundCreate
//   4. same form → receiptCancel with reason
// Durable state is read back via finance.receiptGet (authorized), not from
// captured mutation responses.

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

test.describe('P1-08 journey — huỷ phiếu / hoàn tiền', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('sale creates a receipt; GĐKD approves, records a partial refund via /finance/refund form-depth, then cancels the receipt', async ({
    browser,
  }) => {
    const seeded = await seedClassBatch({ facilityId });

    const studentName = `E2E P1-08 Student ${randomUUID().slice(0, 8)}`;
    const parentPhone = randomVnPhone();
    const parentEmail = `e2e-p108-parent-${randomUUID().slice(0, 8)}@e2e.cmc`;
    // 5_000_001 satisfies NumberInput min/step and stays under second-eye.
    const netAmount = 5_000_001;
    const refundAmount = 1_000_000;

    // --- sale: create draft receipt (same path as F1 / P1-03) ---
    const saleContext = await browser.newContext();
    const salePage = await saleContext.newPage();
    const saleCookie = mintStaffCookie({
      userId: `e2e-p108-sale-${randomUUID().slice(0, 8)}`,
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
    await salePage.getByLabel('Email phụ huynh').fill(parentEmail);
    await salePage.getByRole('combobox', { name: /^Lớp học/ }).click();
    await salePage.getByRole('option', { name: new RegExp(seeded.code) }).click();
    await salePage.getByRole('spinbutton', { name: /^Học phí/ }).fill(String(netAmount));
    await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
    await expect(salePage.getByText(/^Đã tạo phiếu thu /)).toBeVisible();
    await saleContext.close();

    // --- GĐKD: approve (SoD — different actor from sale) ---
    const gdkdContext = await browser.newContext();
    const gdkdPage = await gdkdContext.newPage();
    const gdkdCookie = mintStaffCookie({
      userId: `e2e-p108-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await gdkdContext.addCookies(cookiePair(STAFF_COOKIE_NAME, gdkdCookie));
    await gdkdPage.goto('/cockpit');

    await menuNav(gdkdPage, 'Tài chính & Điều hành', 'Phiếu thu', {
      role: 'giam_doc_kinh_doanh',
    });
    const draftRow = await findInList(gdkdPage, (text) => text.includes(studentName));
    await draftRow.click();
    await expect(gdkdPage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
    const receiptUrl = gdkdPage.url();
    const receiptId = receiptUrl.slice(receiptUrl.lastIndexOf('/') + 1);

    await gdkdPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    const approveDialog = gdkdPage.getByRole('alertdialog');
    await expect(approveDialog).toBeVisible();
    await approveDialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    await expect(
      gdkdPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
    ).toBeVisible();
    await expect(gdkdPage.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toHaveCount(0);

    // --- refund via /finance/refund index → form (refundCreate) ---
    await menuNav(gdkdPage, 'Tài chính & Điều hành', 'Hoàn tiền', {
      role: 'giam_doc_kinh_doanh',
    });
    await expect(gdkdPage).toHaveURL(/\/finance\/refund/);
    const approvedRow = await findInList(gdkdPage, (text) => text.includes(studentName));
    await approvedRow.getByRole('button', { name: 'Mở phiếu' }).click();
    await expect(gdkdPage).toHaveURL(new RegExp(`/finance/${receiptId}$`));

    // Overview section "Hoàn tiền" — partial amount then ConfirmDialog.
    await gdkdPage.getByLabel(/Số tiền hoàn/).fill(String(refundAmount));
    await gdkdPage.getByRole('button', { name: 'Ghi hoàn tiền', exact: true }).click();
    const refundDialog = gdkdPage.getByRole('alertdialog');
    await expect(refundDialog).toBeVisible();
    await refundDialog.getByRole('button', { name: 'Ghi hoàn tiền', exact: true }).click();

    // UI ledger: prior empty copy gone; partial refund line visible.
    await expect(gdkdPage.getByText('Chưa có lần hoàn nào trên phiếu này.')).toHaveCount(0);
    await expect(gdkdPage.getByText(/−1\.000\.000 đ/)).toBeVisible();

    // --- cancel same form (receiptCancel) ---
    const cancelReason = `E2E P1-08 cancel ${randomUUID().slice(0, 8)}`;
    await gdkdPage.getByLabel(/Lý do huỷ/).fill(cancelReason);
    await gdkdPage.getByRole('button', { name: 'Huỷ phiếu thu', exact: true }).click();
    const cancelDialog = gdkdPage.getByRole('alertdialog');
    await expect(cancelDialog).toBeVisible();
    await cancelDialog.getByRole('button', { name: 'Huỷ phiếu thu', exact: true }).click();

    // Statusbar / badge: cancelled terminal.
    await expect(gdkdPage.getByText('Đã hủy').first()).toBeVisible();
    await expect(gdkdPage.getByRole('button', { name: 'Huỷ phiếu thu', exact: true })).toHaveCount(
      0,
    );

    // ── business invariants (authorized read-back) ──
    const client = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: `e2e-p108-gdkd-readback-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    const receipt = await client.finance.receiptGet.query({ receiptId });
    assertBusinessInvariant('phiếu thu sau huỷ có trạng thái cancelled', receipt.status, 'cancelled');
    assertBusinessInvariant(
      'sổ hoàn append-only còn đúng số tiền partial refund',
      receipt.refundedTotal ?? 0,
      refundAmount,
    );
    assertBusinessInvariant(
      'receiptGet lists the partial RefundRecord',
      (receipt.refunds ?? []).reduce((s, r) => s + r.amount, 0),
      refundAmount,
    );

    await gdkdContext.close();
  });
});
