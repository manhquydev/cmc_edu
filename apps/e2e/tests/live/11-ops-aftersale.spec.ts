// 11-ops-aftersale — REAL-ENVIRONMENT chăm sóc sau bán (P4-05) on the live VPS.
// GĐKD walks an after-sale case for the student provisioned by
// 02-receipt-approve-enroll through the real /crm/aftersale UI:
//   Tạo case (afterSale.create → "Mở") → Tiếp nhận (afterSale.advance →
//   "Đang xử lý") → Giải quyết (afterSale.resolve → "Đã giải quyết") → Đóng
//   (afterSale.close → "Đã đóng"). Every transition only fires from the correct
//   prior status, so the linear walk is real.
//
// Graceful skip: when 02 did not provision a student, the spec skips.

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { readLiveState } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrors,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('11-ops-aftersale — chăm sóc sau bán: tạo → tiếp nhận → giải quyết → đóng (live)', () => {
  test('GĐKD tạo case sau bán và xử lý tới đóng', async ({ browser }) => {
    const state = readLiveState();
    const studentName = state.contactName;
    test.skip(!studentName, '02 did not provision a student — after-sale needs a real student.');

    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      await menuNav(gd.page, 'Tài chính & Điều hành', 'Sau bán', { role: 'giam_doc_kinh_doanh' });
      await expect(gd.page).toHaveURL(/\/crm\/aftersale/);

      // --- create the case (opens as "Mở") ---
      await gd.page.getByRole('button', { name: 'Tạo case' }).click();
      const createDialog = gd.page.getByRole('dialog');
      await createDialog.getByLabel('Học viên').fill(studentName!);
      await createDialog.getByText(studentName!, { exact: true }).click();
      await createDialog.getByLabel('Mô tả').fill('PH phản ánh chất lượng lớp — live UAT');
      await createDialog.getByRole('button', { name: 'Tạo' }).click();
      await expect(createDialog).toHaveCount(0, { timeout: 15_000 });

      const row = gd.page.getByRole('row', { name: new RegExp(studentName!) });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.getByText('Mở', { exact: true })).toBeVisible();
      recordCreated(scratch, 'after-sale-case', 'student', studentName!);

      // List is index-only — open the form for the lifecycle HITL.
      await row.getByRole('button', { name: 'Mở phiếu' }).click();
      await expect(gd.page).toHaveURL(/\/crm\/aftersale\/[0-9a-f-]{36}/i);

      // --- take it up (advance → "Đang xử lý") ---
      await gd.page.getByRole('button', { name: 'Tiếp nhận', exact: true }).click();
      await expect(gd.page.getByText('Đã tiếp nhận', { exact: false })).toBeVisible({ timeout: 15_000 });
      await expect(gd.page.getByRole('button', { name: 'Tiếp nhận', exact: true })).toHaveCount(0);
      console.log('[11-ops-aftersale] case taken up');

      // --- resolve it with an outcome (→ "Đã giải quyết") ---
      await gd.page.getByRole('button', { name: 'Giải quyết', exact: true }).click();
      const resolveDialog = gd.page.getByRole('dialog');
      await resolveDialog.getByLabel(/Kết quả xử lý/).fill('Đã gặp PH, đổi lớp phù hợp — live UAT');
      await resolveDialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
      await expect(gd.page.getByRole('button', { name: 'Đóng', exact: true })).toBeVisible({ timeout: 15_000 });
      console.log('[11-ops-aftersale] case resolved');

      // --- close it (→ "Đã đóng") ---
      await gd.page.getByRole('button', { name: 'Đóng', exact: true }).click();
      await expect(gd.page.getByRole('button', { name: 'Đóng', exact: true })).toHaveCount(0, {
        timeout: 15_000,
      });
      recordCreated(scratch, 'after-sale-case', 'status', 'closed');
      console.log('[11-ops-aftersale] case closed');
    } finally {
      await closeRoleSession(gd);
    }

    await assertNoErrors(gd.page, scratch.collectors[0]!, 'after-sale case lifecycle');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
