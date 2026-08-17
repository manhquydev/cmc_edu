// live-ui — REAL admin-UI helpers for the live suite, driven on a page that
// is already authenticated as the live super admin (openStaffSession).
//
// createStaffViaLiveUi: drives the real /admin/users create dialog
// (apps/admin/src/pages/admin/users.tsx) — including the "Vai trò"
// MultiSelector (same interaction contract documented in
// src/journey/create-staff-via-admin-ui.ts: scope to the open dialog,
// click the trigger, click role="option" rows, Escape) AND the optional
// "Mật khẩu đầu tiên" field so the account can actually log in (its first
// login then forces the /change-password rotation handled by live-auth).

import { expect, type Page } from '@playwright/test';

import { menuNav } from '../journey/menu-nav.js';
import { findInList } from '../journey/find-in-list.js';

const DIALOG_SETTLE_TIMEOUT_MS = 10_000;

export type LiveStaffRole = 'sale' | 'giam_doc_kinh_doanh' | 'giam_doc_dao_tao' | 'giao_vien' | 'super_admin';

export interface CreateStaffViaLiveUiOptions {
  userId: string;
  fullName: string;
  email: string;
  /** DB role slug whose formatRole() label is picked in the dialog. */
  role: LiveStaffRole;
  position: string;
  /** Initial (temp) password — the account must rotate it at first login. */
  tempPassword: string;
  /** Optional direct manager ("Quản lý trực tiếp" Selector) — pick the row
   *  whose DISPLAYED fullName matches. Required by kpi.confirm (scoreOwner
   *  must have managerId === confirming director). */
  managerFullName?: string;
}

/** Opens /admin/users through the real nav, then creates one staff account
 *  and asserts the new row appears by its displayed fullName. */
export async function createStaffViaLiveUi(page: Page, opts: CreateStaffViaLiveUiOptions): Promise<void> {
  await openUsersPage(page);
  await createStaffInDialog(page, opts);
}

/** Real nav to /admin/users (super_admin-gated, nav-registry 'Quản trị'). */
export async function openUsersPage(page: Page): Promise<void> {
  await menuNav(page, 'Quản trị', 'Người dùng', { role: 'super_admin' });
  await expect(page).toHaveURL(/\/admin\/users/);
}

/** Drives ONLY the create dialog on a page already at /admin/users. The
 *  caller is responsible for filtering the list so findInList can confirm the
 *  new row (default list pageSize is 20 and the facility accumulates staff). */
export async function createStaffInDialog(page: Page, opts: CreateStaffViaLiveUiOptions): Promise<void> {
  await page.getByRole('button', { name: 'Thêm nhân viên' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('User ID (auth identity)').fill(opts.userId);
  await dialog.getByLabel('Họ tên').fill(opts.fullName);
  await dialog.getByLabel('Email').fill(opts.email);
  await dialog.getByLabel('Vị trí').fill(opts.position);

  // "Vai trò" is ambiguous unscoped (every Dialog on the page stays mounted) —
  // scope to the open dialog, same as users.test.tsx / create-staff-via-admin-ui.
  await dialog.getByRole('button', { name: 'Vai trò', exact: true }).click();
  const roleLabel = roleLabelFor(opts.role);
  await page.getByRole('option', { name: roleLabel, exact: true }).click();
  await page.keyboard.press('Escape');

  // Optional "Quản lý trực tiếp" Selector (Astryx): trigger by visible label,
  // pick the roster row by its displayed fullName. The roster is the full
  // user.list (users.tsx loads it when the dialog opens), so any staff role
  // created earlier in the campaign is selectable.
  if (opts.managerFullName) {
    await dialog.getByRole('combobox', { name: 'Quản lý trực tiếp' }).click();
    await page
      .getByRole('option', { name: new RegExp(escapeRegExp(opts.managerFullName)) })
      .click();
  }

  await dialog.getByLabel('Mật khẩu đầu tiên').fill(opts.tempPassword);

  await dialog.getByRole('button', { name: 'Tạo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tạo', exact: true })).toHaveCount(0, {
    timeout: DIALOG_SETTLE_TIMEOUT_MS,
  });

  // Filter by name so findInList is not stuck on the first page of older rows.
  const search = page.getByPlaceholder(/Tên, email, mã NV/i);
  if (await search.count()) {
    await search.fill(opts.fullName);
    await page.waitForTimeout(500); // debounce matches users.tsx 300ms
  }
  await findInList(page, (text) => text.includes(opts.fullName));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roleLabelFor(role: LiveStaffRole): string {
  // formatRole labels as rendered by ROLE_OPTIONS (users.tsx):
  //   super_admin → 'Quản trị hệ thống', sale → 'Sale', etc.
  const labels: Record<string, string> = {
    super_admin: 'Quản trị hệ thống',
    giam_doc_kinh_doanh: 'Giám đốc kinh doanh',
    giam_doc_dao_tao: 'Giám đốc đào tạo',
    sale: 'Sale',
    giao_vien: 'Giáo viên',
  };
  return labels[role] ?? role;
}
