// ADM-02 journey — Quản trị tài khoản nhân sự: a super admin creates a staff
// account and assigns it a role, both through the real /admin/users UI.
//
// Covers 3 of the 4 declared procedures — user.create (create dialog),
// user.list (the table the new row appears in), user.updateRoles (the roles
// modal). The fourth, user.update, is a REAL manifest/UI drift: it carries the
// managerId setter but no screen calls it —
//   rg "user\.update\b|user\.update\." apps/admin/src → 0 matches
// — so no journey can drive it. Recorded here and in the manifest note.
//
// The MultiSelector interaction (open "Roles" → toggle option → Escape → the
// Dialog's own "Lưu" persists via updateRoles) mirrors the decoded pattern in
// create-staff-via-admin-ui.ts; written inline here because this flow's subject
// IS this screen, so the create and the role change are both observable steps.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
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

test.describe('ADM-02 journey — quản trị nhân sự: tạo tài khoản + gán vai trò', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const staffName = `E2E ADM-02 NV ${runId}`;
  const staffUserId = `e2e-adm02-nv-${runId}`;

  test('a super admin creates a staff account and assigns a role', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-adm02-sa-${runId}`, roles: ['super_admin'], facilityId })),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Quản trị', 'Người dùng', { role: 'super_admin' });
    await expect(page).toHaveURL(/\/admin\/users/);

    // --- create the staff account ---
    await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
    await page.getByLabel('User ID (auth identity)').fill(staffUserId);
    await page.getByLabel('Họ tên').fill(staffName);
    await page.getByLabel('Email').fill(`${staffUserId}@e2e.cmc`);
    await page.getByLabel('Vị trí').fill('Giáo viên E2E');
    await page.getByRole('button', { name: 'Tạo' }).click();
    // The create dialog closes on success — wait before searching the table.
    await expect(page.getByRole('button', { name: 'Tạo' })).toHaveCount(0);

    // The new account appears in the list; a fresh staff has no role badge yet.
    const row = await findInList(page, (text) => text.includes(staffName));
    await expect(row.getByText('giao_vien', { exact: true })).toHaveCount(0);

    // --- assign a role through the roles modal ---
    await row.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Roles').click();
    await page.getByRole('option', { name: 'Giáo viên', exact: true }).click();
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(dialog).toHaveCount(0);

    // The role now shows as a badge on the row — the value 'giao_vien', not the
    // 'Giáo viên' label. The badge was absent before (asserted above) and
    // present now: that transition is the living proof updateRoles persisted.
    const updatedRow = await findInList(page, (text) => text.includes(staffName));
    await expect(updatedRow.getByText('giao_vien', { exact: true })).toBeVisible();

    await context.close();
  });
});
