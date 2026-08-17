// 14-ops-user-guards — REAL-ENVIRONMENT escalation guards (ADM-02 E12/E13) on the live VPS.
//
// Directors hold user.manage for staff provisioning but must NOT mint platform
// admins (user.create guard: "Only a super admin can create a super_admin
// account."). The /hr/staff/new form shows the full ACTIVE_ROLES list to every
// caller, so the guard is exercised the way a hostile director would:
//   1. GĐKD creates a user on /hr/staff/new and picks "Quản trị hệ thống" →
//      server FORBIDDEN (banner) — no new admin row appears.
//   2. GĐKD creates a normal sale account → succeeds (user.manage works),
//      landing on the created profile (/hr/staff/:id/profile).
//   3. GĐKD opens the Access section for that sale → resets the password
//      (E13: reset flow for an EXISTING user, not just create-time).

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { liveStaffRoleClient } from '../../src/live/live-trcp.js';
import { liveRunId } from '../../src/live/live-state.js';
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
      // GĐKD holds user.manage so the Staff leaf is visible under HR; the
      // canonical create surface is /hr/staff/new (D1). Direct URL access is
      // itself part of the permission contract under test.
      await gd.page.goto('/hr/staff/new');
      await expect(gd.page).toHaveURL(/\/hr\/staff\/new/);

      // 1. GĐKD cố tạo tài khoản super_admin → server FORBIDDEN.
      await gd.page.getByLabel('User ID (auth identity)').fill('live-guard-admin-' + rid);
      await gd.page.getByLabel('Họ tên').fill('Live Guard Admin ' + rid);
      await gd.page.getByLabel('Email').fill('live-guard-admin-' + rid + '@cmcvn.edu.vn');
      await gd.page.getByLabel('Vị trí').fill('Quản trị hệ thống');
      await gd.page.getByRole('button', { name: 'Vai trò', exact: true }).click();
      await gd.page.getByRole('option', { name: 'Quản trị hệ thống', exact: true }).click();
      await gd.page.keyboard.press('Escape');
      await gd.page.getByRole('button', { name: 'Tạo', exact: true }).click();
      // Server rejects; the form stays with an error banner.
      await expect(gd.page.getByText(/Only a super admin can create a super_admin/)).toBeVisible({
        timeout: 15_000,
      });
      await gd.page.getByRole('button', { name: 'Hủy', exact: true }).click();
      recordCreated(scratch, 'guard', 'create-super-admin-blocked', 'FORBIDDEN');
      console.log('[14-ops-user-guards] GĐKD blocked from creating super_admin');

      // 2. GĐKD tạo tài khoản sale bình thường → thành công, đáp xuống profile.
      await gd.page.goto('/hr/staff/new');
      await gd.page.getByLabel('User ID (auth identity)').fill(normalUserId);
      await gd.page.getByLabel('Họ tên').fill(normalName);
      await gd.page.getByLabel('Email').fill(normalEmail);
      await gd.page.getByLabel('Vị trí').fill('Nhân viên kinh doanh');
      await gd.page.getByRole('button', { name: 'Vai trò', exact: true }).click();
      await gd.page.getByRole('option', { name: 'Sale', exact: true }).click();
      await gd.page.keyboard.press('Escape');
      await gd.page.getByLabel('Mật khẩu đầu tiên').fill('CmcTemp!' + rid);
      await gd.page.getByRole('button', { name: 'Tạo', exact: true }).click();
      // Create-success navigates (replace) to the created profile.
      await expect(gd.page).toHaveURL(/\/hr\/staff\/[0-9a-f-]{36}\/profile$/, {
        timeout: 15_000,
      });
      await expect(gd.page.getByText(normalName).first()).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'staff-account', 'guard normal sale', normalEmail);
      console.log('[14-ops-user-guards] GĐKD created a normal sale');

      // 3. GĐKD reset mật khẩu cho user hiện hữu (E13) qua Access section.
      await gd.page.getByRole('link', { name: 'Quyền truy cập' }).click();
      await expect(gd.page).toHaveURL(/\/access$/);
      await gd.page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
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

    // 4. E12 (nửa sau): với real session GĐKD — user.update + user.resetPassword
    //    nhắm vào super_admin phải bị FORBIDDEN (không thể sửa email/isActive
    //    hay đặt lại mật khẩu của tài khoản quản trị).
    const gdClient = liveStaffRoleClient('giam_doc_kinh_doanh');
    const adminRow = (await gdClient.user.list.query({ search: 'admin@cmcvn.edu.vn' })).items.find(
      (u) => u.email === 'admin@cmcvn.edu.vn' && u.roles.includes('super_admin'),
    );
    expect(adminRow, 'admin@cmcvn.edu.vn phải tồn tại trong user.list').toBeTruthy();
    await expect(
      gdClient.user.update.mutate({ appUserId: adminRow!.id, email: 'evil@cmcvn.edu.vn' }),
    ).rejects.toThrow(/Only a super admin can update another super admin/);
    await expect(
      gdClient.user.resetPassword.mutate({ appUserId: adminRow!.id, tempPassword: 'CmcHack!' + rid }),
    ).rejects.toThrow(/Only a super admin can reset another super admin/);
    recordCreated(scratch, 'guard', 'update+reset super_admin blocked', adminRow!.id);
    console.log('[14-ops-user-guards] GĐKD blocked from update/resetPassword of super_admin');

    await assertNoErrorsAll(scratch, 'user guards edge (create/update/reset escalation)');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
