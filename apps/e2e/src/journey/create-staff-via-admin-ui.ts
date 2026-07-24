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
// MultiSelector interaction pattern (first use of this @astryxdesign/core
// primitive anywhere in the admin app or its e2e tests — no prior Playwright
// pattern existed to reuse; this was discovered by driving the real dialog
// and inspecting its rendered markup/ARIA tree):
//   - Trigger: `dialog.getByLabel('Roles')` resolves the `<button
//     aria-haspopup="listbox">` directly (its `<label for>` already points at
//     it) — no role+name locator combo needed.
//   - Clicking it opens a `role="listbox"` popover
//     (`aria-multiselectable="true"`) with `role="option"` rows, matched by
//     their visible label (e.g. "Giáo viên").
//   - Clicking an option TOGGLES its `aria-selected` WITHOUT closing the
//     popover — every option meant to be picked in one call must be clicked
//     while the popover stays open; there is no per-pick confirm step.
//   - `Escape` dismisses the popover; picks already made stay in the
//     Dialog's own `selectedRoles` React state (the popover itself has no
//     separate "confirm" control — the Dialog's own "Lưu" button is what
//     actually persists, via `user.updateRoles`).

import { randomUUID } from 'node:crypto';
import { expect, type Browser } from '@playwright/test';
import { mintStaffCookie } from '../session-injection.js';
import { findInList } from './find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface CreateStaffViaAdminUiOptions {
  facilityId: string;
  /** Must match the `userId` a later `mintStaffCookie` call in the SAME
   *  journey uses for this identity — the AppUser row this creates and the
   *  cookie'd session that acts as it must share the one `userId`. */
  userId: string;
  fullName: string;
  position: string;
  email?: string;
  /** Role LABELS as rendered in the roles modal (e.g. 'Giáo viên') to assign
   *  after creation. Omit when nothing downstream reads `AppUser.roles` from
   *  the DB: every permission gate in this suite so far
   *  (`requirePermission`, `assertTeacherOwnsClass`) reads `ctx.subject.roles`
   *  from the SIGNED COOKIE claims, not this column (apps/api/src/context.ts
   *  sets `subject: { userId: staffClaims.userId, roles: staffClaims.roles }`
   *  straight from the cookie) — so assigning a role here only matters for a
   *  screen that filters `user.pickList` by `role` or otherwise reads the
   *  column directly. Check the specific consumer before assuming either
   *  way; do not assign a role "just in case". */
  roleLabels?: string[];
}

/**
 * Drives the real `/admin/users` super_admin flow end-to-end: opens the
 * create-staff dialog, fills the 4 required fields, submits, locates the new
 * row by its displayed `fullName` (never a smuggled id — same `findInList`
 * contract every other journey step uses), and — when `roleLabels` is given —
 * opens that row's roles modal and assigns them via the real MultiSelector.
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
    await page.getByRole('button', { name: 'Tạo' }).click();

    // onSuccess closes the dialog — wait for the "Tạo" button to disappear
    // before searching the table, or a slow mutation could race findInList's
    // poll against a table that has not invalidated yet.
    await expect(page.getByRole('button', { name: 'Tạo' })).toHaveCount(0, {
      timeout: DEFAULT_TIMEOUT_MS,
    });

    const row = await findInList(page, (text) => text.includes(opts.fullName));

    if (opts.roleLabels && opts.roleLabels.length > 0) {
      await row.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByLabel('Roles').click();
      for (const label of opts.roleLabels) {
        await page.getByRole('option', { name: label }).click();
      }
      await page.keyboard.press('Escape');

      await dialog.getByRole('button', { name: 'Lưu' }).click();
      await expect(dialog).toHaveCount(0, { timeout: DEFAULT_TIMEOUT_MS });
    }
  } finally {
    await context.close();
  }
}
