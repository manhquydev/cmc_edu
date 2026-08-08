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
    // "Vai trò" is required on create (users.tsx's isFormValid), so a role
    // must be picked here — 'Sale' rather than the target 'Giáo viên' below,
    // so the roles-modal step (user.updateRoles) still proves a real
    // transition instead of a no-op re-pick of the same role.
    await page.getByRole('button', { name: 'Thêm nhân viên' }).click();
    const createDialog = page.getByRole('dialog');
    await page.getByLabel('User ID (auth identity)').fill(staffUserId);
    await page.getByLabel('Họ tên').fill(staffName);
    await page.getByLabel('Email').fill(`${staffUserId}@e2e.cmc`);
    await page.getByLabel('Vị trí').fill('Giáo viên E2E');
    // Unscoped `getByLabel('Vai trò')` is ambiguous (strict mode: 3 elements)
    // — Astryx's Dialog keeps every Dialog on the page mounted even when
    // closed, so it can also match controls in the (closed) roles-assignment
    // dialog below. Scope to the open create dialog, same as the roles-modal
    // step further down already does for its own "Roles" MultiSelector.
    await createDialog.getByRole('button', { name: 'Vai trò', exact: true }).click();
    await page.getByRole('option', { name: 'Sale', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tạo' }).click();
    // The create dialog closes on success — wait before searching the table.
    await expect(page.getByRole('button', { name: 'Tạo' })).toHaveCount(0);

    // Narrow the list to this account before reading rows. user.list sorts
    // createdAt:asc and the table paginates at 20/page starting on page 1, so a
    // freshly-created account always lands on the LAST page — invisible to
    // findInList (which only scans the rendered page) once the shared-facility
    // roster exceeds 20 users. Driving the FilterBar's server-side search keeps
    // this journey robust regardless of how many accounts other specs seed.
    // Target the field by its label (same reactive FilterBar the audit-log and
    // enrollment journeys drive) — the label-bound input fires the debounced
    // onChange that user.list({ search }) reads; a placeholder locator does not.
    await page.getByLabel('Tìm kiếm').fill(staffName);

    // The new account appears in the list, carrying the role picked at create
    // time — not yet the target 'Giáo viên' role this journey exists to prove.
    // The Roles column renders the canonical `formatRole` label ('Sale'), not
    // the raw DB slug — same source the create dialog's picker options use.
    const row = await findInList(page, (text) => text.includes(staffName));
    await expect(row.getByText('Sale', { exact: true })).toBeVisible();
    await expect(row.getByText('Giáo viên', { exact: true })).toHaveCount(0);

    // --- assign a role through the roles modal ---
    // openRolesModal pre-selects the row's existing DB roles (['sale']), so
    // the modal opens with 'Sale' already checked — toggle it off and
    // 'Giáo viên' on to fully replace it, not just append.
    await row.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // `dialog.getByLabel('Roles')` is ambiguous here (strict mode: 2
    // elements) — with a role already pre-selected (see above), the
    // MultiSelector's own `hasClear` button renders too, labeled
    // `aria-label="Clear all Roles"`, which `getByLabel`'s default substring
    // match also picks up. `getByRole('button', { name: 'Roles', exact:
    // true })` matches only the trigger (no `role="combobox"` override since
    // `hasSearch` is set — same reasoning as create-staff-via-admin-ui.ts's
    // "Vai trò" trigger).
    await dialog.getByRole('button', { name: 'Roles', exact: true }).click();
    await page.getByRole('option', { name: 'Sale', exact: true }).click();
    await page.getByRole('option', { name: 'Giáo viên', exact: true }).click();
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(dialog).toHaveCount(0);

    // The role now shows as a badge on the row — the canonical 'Giáo viên'
    // label. It replaced the create-time 'Sale' badge asserted above: that
    // transition is the living proof updateRoles persisted. Exact match keeps
    // this off the "Giáo viên E2E" position cell, which is not an exact hit.
    const updatedRow = await findInList(page, (text) => text.includes(staffName));
    await expect(updatedRow.getByText('Giáo viên', { exact: true })).toBeVisible();
    await expect(updatedRow.getByText('Sale', { exact: true })).toHaveCount(0);

    await context.close();
  });
});
