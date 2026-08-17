// 14-ops-user-guards — REAL-ENVIRONMENT escalation guards (ADM-02 E12/E13) on the live VPS.
//
// Directors hold user.manage for staff provisioning but must NOT mint platform
// admins (user.create guard: "Only a super admin can create a super_admin
// account."). The users dialog shows the full ACTIVE_ROLES list to every
// caller, so the guard is exercised the way a hostile director would:
//   1. GĐKD creates a user and picks "Quản trị hệ thống" → server FORBIDDEN
//      (banner) — no new admin row appears.
//   2. GĐKD creates a normal sale account → succeeds (user.manage works).
//   3. GĐKD opens the reset-password modal for that sale → sets a temp password
//      (E13: reset flow for an EXISTING user, not just create-time).

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { liveRunId } from '../../src/live/live-state.js';
import { findInList } from '../../src/journey/find-in-list.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrorsAll,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('14-ops-user-guards — director không tạo được super_admin + resetPassword (live)', () => {
  test('GĐKD cố tạo super_admin bị chặn; tạo sale OK; reset mật khẩu user hiện hữu OK', async ({ browser }) => {
    const rid = liveRunId();
    const normalUserId = 'live-guard-sale-' + rid;
    const normalEmail = normalUserId + '@cmcvn.edu.vn';
    const normalName = 'Live Guard Sale ' + rid;

    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      // GĐKD holds user.manage but the 'Quản trị' nav group is super_admin-only
      // (nav-registry.test: GĐKD must NOT see Quản trị) — access is by URL,
      // which is itself the permission check under test.
      await gd.page.goto('/admin/users');
      await expect(gd.page).toHaveURL(/\/admin\/users/);

      // 1. GĐKD cố tạo tài khoản super_admin → server FORBIDDEN.
      await gd.page.getByRole('button', { name: 'Thêm nhân viên' }).click();
      const dialog = gd.page.getByRole('dialog');
      await dialog.getByLabel('User ID (auth identity)').fill('live-guard-admin-' + rid);
      await dialog.getByLabel('Họ tên').fill('Live Guard Admin ' + rid);
      await dialog.getByLabel('Email').fill('live-guard-admin-' + rid + '@cmcvn.edu.vn');
      await dialog.getByLabel('Vị trí').fill('Quản trị hệ thống');
      await dialog.getByRole('button', { name: 'Vai trò', exact: true }).click();
      await gd.page.getByRole('option', { name: 'Quản trị hệ thống', exact: true }).click();
      await gd.page.keyboard.press('Escape');
      await dialog.getByRole('button', { name: 'Tạo', exact: true }).click();
      // Server rejects; the dialog stays open with an error banner.
      await expect(dialog.getByText(/Only a super admin can create a super_admin/)).toBeVisible({
        timeout: 15_000,
      });
      await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
      recordCreated(scratch, 'guard', 'create-super-admin-blocked', 'FORBIDDEN');
      console.log('[14-ops-user-guards] GĐKD blocked from creating super_admin');

      // 2. GĐKD tạo tài khoản sale bình thường → thành công.
      await gd.page.getByRole('button', { name: 'Thêm nhân viên' }).click();
      const dialog2 = gd.page.getByRole('dialog');
      await dialog2.getByLabel('User ID (auth identity)').fill(normalUserId);
      await dialog2.getByLabel('Họ tên').fill(normalName);
      await dialog2.getByLabel('Email').fill(normalEmail);
      await dialog2.getByLabel('Vị trí').fill('Nhân viên kinh doanh');
      await dialog2.getByRole('button', { name: 'Vai trò', exact: true }).click();
      await gd.page.getByRole('option', { name: 'Sale', exact: true }).click();
      await gd.page.keyboard.press('Escape');
      await dialog2.getByLabel('Mật khẩu đầu tiên').fill('CmcTemp!' + rid);
      await dialog2.getByRole('button', { name: 'Tạo', exact: true }).click();
      await expect(gd.page.getByRole('button', { name: 'Tạo', exact: true })).toHaveCount(0, {
        timeout: 15_000,
      });
      // Tìm row mới.
      const search = gd.page.getByPlaceholder(/Tên, email, mã NV/i);
      await search.fill(normalName);
      await gd.page.waitForTimeout(500);
      const row = await findInList(gd.page, (text) => text.includes(normalName));
      await expect(row).toBeVisible();
      recordCreated(scratch, 'staff-account', 'guard normal sale', normalEmail);
      console.log('[14-ops-user-guards] GĐKD created a normal sale');

      // 3. GĐKD reset mật khẩu cho user hiện hữu (E13).
      await row.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
      const resetDialog = gd.page.getByRole('dialog');
      await resetDialog.getByLabel('Mật khẩu tạm').fill('CmcTempReset!' + rid);
      await resetDialog.getByRole('button', { name: 'Đặt mật khẩu tạm' }).click();
      await expect(resetDialog.getByText(/Đã đặt mật khẩu tạm/)).toBeVisible({ timeout: 15_000 });
      await resetDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
      recordCreated(scratch, 'password-reset', 'normal sale', normalEmail);
      console.log('[14-ops-user-guards] GĐKD reset password for existing user');
    } finally {
      await closeRoleSession(gd);
    }

    await assertNoErrorsAll(scratch, 'user guards edge');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
