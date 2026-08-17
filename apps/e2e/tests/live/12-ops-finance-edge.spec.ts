// 12-ops-finance-edge — REAL-ENVIRONMENT tài chính edge cases (P1-08 + P1-03 second-eye).
//
// 01/02 đã dùng opp của campaign cho phiếu đầu (O5) — spec này tạo OPP MỚI riêng:
//   sale tạo lead → advance O1→O4 (3 click, same as 01) → "Ghi danh" → phiếu 21.000.000.
// Edge cases:
//   1. Second-eye ADR-B: phiếu > 20.000.000 do sale tạo — GĐKD KHÔNG duyệt được
//      (canApprove=false → nút "Duyệt & Kích hoạt" không render). GĐĐT duyệt được.
//   2. I3 revert: huỷ phiếu ĐÃ DUYỆT kèm lý do bắt buộc → opportunity quay lại O4_TESTED.

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrorsAll,
  runId,
  freshParentPhone,
} from './live-spec-utils.js';

const scratch = newScratch();

function escapeRegExp(value: string): string {
  // eslint-disable-next-line no-useless-escape
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('12-ops-finance-edge — second-eye >20tr + huỷ phiếu I3 revert (live)', () => {
  test('phiếu 21tr: GĐKD bị chặn → GĐĐT duyệt → GĐKD huỷ (I3 revert O4)', async ({ browser }) => {
    const rid = runId();
    const edgeName = 'Live Edge ' + rid;
    const edgePhone = freshParentPhone();

    // 1. sale: tạo lead mới → advance O1→O4 (same pattern as 01) → phiếu 21tr.
    const sale = await openStaffSession(browser, 'sale');
    attachErrors(sale.page, scratch);
    let receiptUrl = '';
    try {
      await menuNav(sale.page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
      await expect(sale.page).toHaveURL(/\/crm$/);

      await sale.page.getByRole('button', { name: 'Thêm cơ hội' }).click();
      await sale.page.getByLabel('Họ tên').fill(edgeName);
      await sale.page.getByLabel('Số điện thoại').fill(edgePhone);
      await sale.page.getByRole('button', { name: 'Tạo', exact: true }).click();
      await expect(sale.page.getByText(edgeName)).toBeVisible();

      const cardName = new RegExp('^' + escapeRegExp(edgeName));
      for (let step = 0; step < 3; step += 1) {
        const card = sale.page.getByRole('button', { name: cardName });
        const advance = card.getByRole('button', { name: 'Chuyển lên', exact: true });
        await expect(advance).toBeVisible();
        await advance.click();
        await expect(sale.page.getByText(edgeName)).toBeVisible();
      }
      const card = sale.page.getByRole('button', { name: cardName });
      await expect(card.getByRole('button', { name: 'Ghi danh', exact: true })).toBeVisible();
      await card.getByRole('button', { name: 'Ghi danh', exact: true }).click();
      await expect(sale.page).toHaveURL(/\/finance\/new\?opportunityId=/i, { timeout: 15_000 });

      await sale.page.getByLabel(/Email phụ huynh/i).fill('live-finance-edge-' + rid + '@cmcvn.edu.vn');
      await sale.page.getByRole('combobox', { name: /^Lớp học/ }).click();
      await sale.page.getByRole('option', { name: new RegExp(escapeRegExp('CMCDEVEL')) }).first().click();
      await sale.page.getByRole('spinbutton', { name: /^Học phí/ }).fill('21000000');
      await sale.page.getByRole('button', { name: 'Tạo phiếu thu' }).click();
      // Dup-phone edge (P1-02 needs_confirmation): a fresh random phone can
      // still collide with an earlier campaign's parent phone — the server
      // answers needs_confirmation and the form shows "Cần xác nhận học sinh"
      // with a "Đây là bé mới" follow-up. This IS the edge under test, so the
      // spec confirms the new-student branch, then creates.
      const needsConfirm = sale.page.getByRole('button', { name: /Đây là bé mới/ });
      if (await needsConfirm.count()) {
        await needsConfirm.click();
        recordCreated(scratch, 'receipt-create', 'needs_confirmation resolved', 'new-student');
      }
      await expect(sale.page.getByText(/^Đã tạo phiếu thu /)).toBeVisible({ timeout: 20_000 });
      receiptUrl = sale.page.url();
      recordCreated(scratch, 'opportunity', 'edge O4 lead', edgeName);
      recordCreated(scratch, 'receipt', '21tr edge receipt', receiptUrl);
      console.log('[12-ops-finance-edge] sale created 21tr receipt for new O4 opp');
    } finally {
      await closeRoleSession(sale);
    }
    const receiptId = receiptUrl.match(/\/finance\/([0-9a-f-]{36})/i)?.[1]!;

    // 2. GĐKD: mở phiếu — KHÔNG duyệt được (second-eye): nút "Duyệt & Kích hoạt" không render.
    const gdkd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gdkd.page, scratch);
    try {
      await gdkd.page.goto('/finance/' + receiptId);
      await expect(gdkd.page.getByText('Nháp', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
      await expect(gdkd.page.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toHaveCount(0, { timeout: 15_000 });
      console.log('[12-ops-finance-edge] GĐKD blocked from 21tr receipt (second-eye)');
    } finally {
      await closeRoleSession(gdkd);
    }

    // 3. GĐĐT (second-eye): duyệt được → kích hoạt.
    const gddt = await openStaffSession(browser, 'giam_doc_dao_tao');
    attachErrors(gddt.page, scratch);
    try {
      await gddt.page.goto('/finance/' + receiptId);
      await expect(gddt.page.getByRole('button', { name: 'Duyệt & Kích hoạt' })).toBeVisible({ timeout: 20_000 });
      await gddt.page.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
      const confirmDialog = gddt.page.getByRole('alertdialog');
      await confirmDialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
      await expect(gddt.page.getByText('Đã duyệt', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
      recordCreated(scratch, 'receipt', '21tr approved by GĐĐT', receiptId);
      console.log('[12-ops-finance-edge] GĐĐT approved 21tr receipt');
    } finally {
      await closeRoleSession(gddt);
    }

    // 4. I3 revert: GĐKD huỷ phiếu đã duyệt kèm lý do → opp về O4_TESTED.
    const gdkd2 = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gdkd2.page, scratch);
    try {
      await gdkd2.page.goto('/finance/' + receiptId);
      await expect(gdkd2.page.getByRole('button', { name: 'Huỷ phiếu thu' })).toBeVisible({ timeout: 20_000 });
      await gdkd2.page.getByLabel('Lý do huỷ (bắt buộc)').fill('Live UAT: kiểm tra I3 revert + huỷ phiếu');
      await gdkd2.page.getByRole('button', { name: 'Huỷ phiếu thu' }).click();
      const cancelDialog = gdkd2.page.getByRole('alertdialog');
      await cancelDialog.getByRole('button', { name: 'Huỷ phiếu thu' }).click();
      await expect(gdkd2.page.getByText('Đã huỷ', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
      recordCreated(scratch, 'receipt', '21tr cancelled', receiptId);
      console.log('[12-ops-finance-edge] receipt cancelled');

      // I3: mở CRM → opp về O4_TESTED (card có nút "Ghi danh" trở lại).
      await menuNav(gdkd2.page, 'Tài chính & Điều hành', 'CRM', { role: 'giam_doc_kinh_doanh' });
      const cardAfter = gdkd2.page.getByRole('button', {
        name: new RegExp('^' + escapeRegExp(edgeName)),
      });
      await expect(cardAfter).toBeVisible({ timeout: 15_000 });
      await expect(cardAfter.getByRole('button', { name: 'Ghi danh', exact: true })).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'opportunity', 'I3 reverted to O4', edgeName);
      console.log('[12-ops-finance-edge] I3 revert: opportunity back to O4_TESTED');
    } finally {
      await closeRoleSession(gdkd2);
    }

    await assertNoErrorsAll(scratch, 'finance edge smoke');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
