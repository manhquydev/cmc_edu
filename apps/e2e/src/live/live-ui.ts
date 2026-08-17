// live-ui — REAL admin-UI helpers for the live suite, driven on a page that
// is already authenticated as the live super admin (openStaffSession).
//
// createStaffViaLiveUi: drives the real canonical staff create page
// (apps/admin/src/pages/hr/staff/staff-new.tsx at /hr/staff/new, D1) —
// including the "Vai trò" MultiSelector (same interaction contract documented
// in src/journey/create-staff-via-admin-ui.ts) AND the optional "Mật khẩu đầu
// tiên" field so the account can actually log in (its first login then forces
// the /change-password rotation handled by live-auth).

import { expect, type Page } from '@playwright/test';

import { menuNav } from '../journey/menu-nav.js';

const DIALOG_SETTLE_TIMEOUT_MS = 10_000;

export type LiveStaffRole = 'sale' | 'giam_doc_kinh_doanh' | 'giam_doc_dao_tao' | 'giao_vien' | 'super_admin';

export interface CreateStaffViaLiveUiOptions {
  userId: string;
  fullName: string;
  email: string;
  /** DB role slug whose formatRole() label is picked in the form. */
  role: LiveStaffRole;
  position: string;
  /** Initial (temp) password — the account must rotate it at first login. */
  tempPassword: string;
  /** Optional direct manager ("Quản lý trực tiếp" Selector) — pick the row
   *  whose DISPLAYED fullName matches. Required by kpi.confirm (scoreOwner
   *  must have managerId === confirming director). */
  managerFullName?: string;
}

/** Opens the HR Staff nav, then creates one staff account through the
 *  canonical /hr/staff/new form and lands on the created profile. */
export async function createStaffViaLiveUi(page: Page, opts: CreateStaffViaLiveUiOptions): Promise<void> {
  await openStaffPage(page);
  await createStaffInForm(page, opts);
}

/** Real nav to the HR Staff list (nav-registry 'Nhân sự' → 'Nhân viên'). */
export async function openStaffPage(page: Page): Promise<void> {
  await menuNav(page, 'Nhân sự', 'Nhân viên', { role: 'super_admin' });
  await expect(page).toHaveURL(/\/hr\/staff/);
}

/** Drives the create form on a page already at /hr/staff/new. Create-success
 *  navigates (replace) to the created profile URL. */
export async function createStaffInForm(page: Page, opts: CreateStaffViaLiveUiOptions): Promise<void> {
  await page.getByLabel('User ID (auth identity)').fill(opts.userId);
  await page.getByLabel('Họ tên').fill(opts.fullName);
  await page.getByLabel('Email').fill(opts.email);
  await page.getByLabel('Vị trí').fill(opts.position);

  // "Vai trò" — single trigger on the dedicated /new page; exact-name scoped.
  await page.getByRole('button', { name: 'Vai trò', exact: true }).click();
  const roleLabel = roleLabelFor(opts.role);
  await page.getByRole('option', { name: roleLabel, exact: true }).click();
  await page.keyboard.press('Escape');

  // Optional "Quản lý trực tiếp" Selector (Astryx): trigger by visible label,
  // pick the roster row by its displayed fullName. The roster comes from
  // user.managerPickList (staff-new.tsx), so any staff role created earlier in
  // the campaign is selectable.
  if (opts.managerFullName) {
    await page.getByRole('combobox', { name: 'Quản lý trực tiếp' }).click();
    await page
      .getByRole('option', { name: new RegExp(escapeRegExp(opts.managerFullName)) })
      .click();
  }

  await page.getByLabel('Mật khẩu đầu tiên').fill(opts.tempPassword);

  await page.getByRole('button', { name: 'Tạo', exact: true }).click();
  await expect(page).toHaveURL(/\/hr\/staff\/[0-9a-f-]{36}\/profile$/, {
    timeout: DIALOG_SETTLE_TIMEOUT_MS,
  });
  await expect(page.getByText(opts.fullName).first()).toBeVisible({
    timeout: DIALOG_SETTLE_TIMEOUT_MS,
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function roleLabelFor(role: LiveStaffRole): string {
  // formatRole labels as rendered by ROLE_OPTIONS (staff-new.tsx):
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
