// ADM-02 journey — Quản trị tài khoản nhân sự: a super admin creates a staff
// account, edits its profile, assigns roles and resets its password — all
// through the canonical /hr/staff surface (D1).
//
// Covers the declared procedures: user.create (the /hr/staff/new form),
// user.list (the /hr/staff table), user.get (cold-start of the detail shell),
// user.managerPickList (the manager dropdown on new/profile), user.update
// (profile edit), user.updateRoles (Access section), user.resetPassword
// (Access section). The legacy /admin/users URL redirects (replace) to
// /hr/staff — asserted here so no second editable screen exists.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('ADM-02 journey — quản trị nhân sự: canonical /hr/staff surface', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const staffName = `E2E ADM-02 NV ${runId}`;
  const staffUserId = `e2e-adm02-nv-${runId}`;

  test('a super admin creates, edits, assigns roles and resets password on /hr/staff', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-adm02-sa-${runId}`, roles: ['super_admin'], facilityId })),
    );
    await page.goto('/cockpit');

    // --- discover the staff surface through the real nav (HR module) ---
    await menuNav(page, 'Nhân sự', 'Nhân viên', { role: 'super_admin' });
    await expect(page).toHaveURL(/\/hr\/staff/);

    // --- create the staff account through the dedicated /new form ---
    await page.goto('/hr/staff/new');
    await page.getByLabel('User ID (auth identity)').fill(staffUserId);
    await page.getByLabel('Họ tên').fill(staffName);
    await page.getByLabel('Email').fill(`${staffUserId}@e2e.cmc`);
    await page.getByLabel('Vị trí').fill('Nhân viên kinh doanh');
    // "Vai trò" is required; pick 'Sale' first so the Access-section step
    // below proves a real transition to 'Giáo viên' (user.updateRoles).
    await page.getByRole('button', { name: 'Vai trò', exact: true }).click();
    await page.getByRole('option', { name: 'Sale', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tạo' }).click();

    // Create-success navigates (replace) to the created profile — user.get
    // cold-starts the shell; the identity strip shows the new fullName.
    await expect(page).toHaveURL(/\/hr\/staff\/[0-9a-f-]{36}\/profile$/);
    await expect(page.getByText(staffName).first()).toBeVisible();

    // --- edit the profile (user.update) ---
    await page.getByLabel(/^Vị trí/).fill('Chuyên viên kinh doanh');
    await page.getByRole('button', { name: 'Lưu hồ sơ' }).click();
    await expect(page.getByText('Chuyên viên kinh doanh').first()).toBeVisible();

    // --- assign a role through the explicit Access section (user.updateRoles) ---
    await page.getByRole('link', { name: 'Quyền truy cập' }).click();
    await expect(page).toHaveURL(/\/access$/);
    await page.getByRole('button', { name: 'Gán vai trò' }).click();
    const rolesDialog = page.getByRole('dialog');
    await rolesDialog.getByRole('button', { name: 'Roles', exact: true }).click();
    await page.getByRole('option', { name: 'Sale', exact: true }).click();
    await page.getByRole('option', { name: 'Giáo viên', exact: true }).click();
    await page.keyboard.press('Escape');
    await rolesDialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(rolesDialog).toHaveCount(0);
    await expect(page.getByText(/Giáo viên/).first()).toBeVisible();

    // --- reset the password through the explicit Access dialog (user.resetPassword) ---
    await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    const resetDialog = page.getByRole('dialog');
    await resetDialog.getByLabel(/^Mật khẩu tạm/).fill('TempPass123!');
    await resetDialog.getByRole('button', { name: 'Đặt mật khẩu tạm' }).click();
    await expect(resetDialog.getByText(/Đã đặt mật khẩu tạm/)).toBeVisible();
    await resetDialog.getByRole('button', { name: 'Đóng' }).click();

    // --- legacy /admin/users redirects (replace) to the canonical list ---
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/hr\/staff/);
    await page.goto(`/admin/users/${'00000000-0000-4000-8000-000000000000'}`);
    await expect(page).toHaveURL(/\/hr\/staff\/00000000-0000-4000-8000-000000000000\/profile/);

    await context.close();
  });
});
