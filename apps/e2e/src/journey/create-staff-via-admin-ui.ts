// createStaffViaAdminUi — the ONLY real UI path that creates an AppUser
// (`/admin/users`, super_admin-gated via `user.manage` — nav-registry.ts's
// `admin` module carries `roles: ['super_admin']`). Replaces the seedAppUser
// direct-DB write the payroll/session-assessment journeys used to justify
// with a disproven "no UI path exists" claim:
// apps/admin/src/pages/admin/users.tsx has a real, working `trpc.user.create`
// form. Runs in its OWN browser context (super_admin) and closes it before
// returning — same per-role-context pattern the rest of this journey suite
// already uses for every other actor (see
// session-assessment-roster.journey.ui.spec.ts's sale/GĐKD/teacher contexts).
//
// The create dialog's "Vai trò" field is REQUIRED (users.tsx's `isFormValid`
// gates "Tạo" on `form.roles.length > 0`) and its value is sent straight
// through in the `user.create` mutation input (`roles: form.roles`,
// apps/api/src/user/router.ts persists it as `DbRole[]` on the new row) — so
// picking roles at create time is both necessary (to unblock "Tạo") and
// sufficient (no separate post-creation step needed to land them on
// `AppUser.roles`). This replaces an earlier version of this helper that
// created the account with NO role, then drove a second "Roles"
// MultiSelector in a distinct post-creation modal via `user.updateRoles` —
// dropped because the create dialog now covers the same DB column directly.
//
// MultiSelector interaction pattern (first use of this @astryxdesign/core
// primitive anywhere in the admin app or its e2e tests — no prior Playwright
// pattern existed to reuse; this was discovered by driving the real dialog
// and inspecting its rendered markup/ARIA tree):
//   - Trigger: `page.getByLabel('Vai trò')` resolves the `<button
//     aria-haspopup="listbox">` directly (its `<label for>` already points at
//     it) — no role+name locator combo needed.
//   - Clicking it opens a `role="listbox"` popover
//     (`aria-multiselectable="true"`) with `role="option"` rows, matched by
//     their visible label (e.g. "Giáo viên").
//   - Clicking an option TOGGLES its `aria-selected` WITHOUT closing the
//     popover — every option meant to be picked in one call must be clicked
//     while the popover stays open; there is no per-pick confirm step.
//   - `Escape` dismisses the popover; picks already made stay in the
//     Dialog's own `form.roles` React state — nothing else needs to
//     "confirm" the popover before the create dialog's own "Tạo" submits it.

import { randomUUID } from 'node:crypto';
import { expect, type Browser } from '@playwright/test';
import { mintStaffCookie } from '../session-injection.js';
import { findInList } from './find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const DEFAULT_TIMEOUT_MS = 10_000;

// Best-effort mapping from a free-text `position` (as callers across this
// suite already write it, with or without Vietnamese diacritics or the raw
// DB role slug) to the "Vai trò" option label the create dialog renders
// (users.tsx's `ROLE_LABELS`). Only used when a caller doesn't pass
// `roleLabels` explicitly — those callers don't care which DB role lands on
// the row (every permission gate this suite exercises reads roles from the
// signed cookie, not this column), so the match only needs to be sensible,
// not authoritative. Order matters: "kinh doanh" also appears inside "giám
// đốc kinh doanh", so the director patterns are checked before the plain
// "sale" one.
const ROLE_LABEL_BY_POSITION_PATTERN: Array<[RegExp, string]> = [
  [/gi[aá]m\s*đ[oố]c\s*đào\s*tạo|giam_doc_dao_tao/i, 'GĐ Đào tạo'],
  [/gi[aá]m\s*đ[oố]c\s*kinh\s*doanh|giam_doc_kinh_doanh/i, 'GĐ Kinh doanh'],
  [/gi[aá]o\s*vi[eê]n|giao_vien/i, 'Giáo viên'],
  [/super[\s_]?admin/i, 'Super Admin'],
  [/sale/i, 'Sale'],
];

function defaultRoleLabelForPosition(position: string): string {
  const match = ROLE_LABEL_BY_POSITION_PATTERN.find(([pattern]) => pattern.test(position));
  // 'Sale' is a safe, low-privilege fallback for a position string this
  // suite hasn't used before — it only needs to unblock the now-required
  // "Vai trò" field, not grant anything a specific caller didn't ask for via
  // `roleLabels`.
  return match ? match[1] : 'Sale';
}

export interface CreateStaffViaAdminUiOptions {
  facilityId: string;
  /** Must match the `userId` a later `mintStaffCookie` call in the SAME
   *  journey uses for this identity — the AppUser row this creates and the
   *  cookie'd session that acts as it must share the one `userId`. */
  userId: string;
  fullName: string;
  position: string;
  email?: string;
  /** Role LABELS as rendered in the create dialog's "Vai trò" MultiSelector
   *  (e.g. 'Giáo viên') to assign at creation. When omitted, a role is still
   *  picked — the field is required — inferred from `position` via
   *  `defaultRoleLabelForPosition`; only set this explicitly when a specific
   *  DB role matters downstream (e.g. a query that filters
   *  `AppUser.roles hasSome [...]` directly, not the signed-cookie claims
   *  every permission gate in this suite otherwise reads). */
  roleLabels?: string[];
}

/**
 * Drives the real `/admin/users` super_admin flow end-to-end: opens the
 * create-staff dialog, fills the required fields (including the required
 * "Vai trò" role picker), submits, and confirms the new row appears by its
 * displayed `fullName` (never a smuggled id — same `findInList` contract
 * every other journey step uses).
 */
export async function createStaffViaAdminUi(
  browser: Browser,
  opts: CreateStaffViaAdminUiOptions,
): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const cookie = mintStaffCookie({
      userId: `e2e-admin-provisioner-${randomUUID().slice(0, 8)}`,
      roles: ['super_admin'],
      facilityId: opts.facilityId,
    });
    await context.addCookies([
      { name: STAFF_COOKIE_NAME, value: cookie, domain: '127.0.0.1', path: '/' },
      { name: STAFF_COOKIE_NAME, value: cookie, domain: 'localhost', path: '/' },
    ]);

    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Thêm nhân viên' }).click();

    await page.getByLabel('User ID (auth identity)').fill(opts.userId);
    await page.getByLabel('Họ tên').fill(opts.fullName);
    await page.getByLabel('Email').fill(opts.email ?? `${opts.userId}@e2e.cmc`);
    await page.getByLabel('Vị trí').fill(opts.position);

    const roleLabelsToPick =
      opts.roleLabels && opts.roleLabels.length > 0
        ? opts.roleLabels
        : [defaultRoleLabelForPosition(opts.position)];
    await page.getByLabel('Vai trò').click();
    for (const label of roleLabelsToPick) {
      await page.getByRole('option', { name: label, exact: true }).click();
    }
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Tạo' }).click();

    // onSuccess closes the dialog — wait for the "Tạo" button to disappear
    // before searching the table, or a slow mutation could race findInList's
    // poll against a table that has not invalidated yet.
    await expect(page.getByRole('button', { name: 'Tạo' })).toHaveCount(0, {
      timeout: DEFAULT_TIMEOUT_MS,
    });

    await findInList(page, (text) => text.includes(opts.fullName));
  } finally {
    await context.close();
  }
}
