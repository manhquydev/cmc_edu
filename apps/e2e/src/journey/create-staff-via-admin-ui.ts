// createStaffViaAdminUi — drives the canonical staff create surface
// (`/hr/staff/new`, D1) to create an AppUser through the real UI. Replaces the
// seedAppUser direct-DB write the payroll/session-assessment journeys used to
// justify with a disproven "no UI path exists" claim. Runs in its OWN browser
// context (super_admin) and closes it before returning — same per-role-context
// pattern the rest of this journey suite already uses for every other actor
// (see session-assessment-roster.journey.ui.spec.ts's sale/GĐKD/teacher
// contexts).
//
// The create form's "Vai trò" field is REQUIRED (staff-new.tsx's `isFormValid`
// gates "Tạo" on `form.roles.length > 0`) and its value is sent straight
// through in the `user.create` mutation input (`roles: form.roles`,
// apps/api/src/user/router.ts persists it as `DbRole[]` on the new row) — so
// picking roles at create time is both necessary (to unblock "Tạo") and
// sufficient (no separate post-creation step needed to land them on
// `AppUser.roles`).
//
// MultiSelector interaction pattern (first use of this @astryxdesign/core
// primitive anywhere in the admin app or its e2e tests — no prior Playwright
// pattern existed to reuse; this was discovered by driving the real dialog
// and inspecting its rendered markup/ARIA tree):
//   - The trigger has no `role="combobox"` override when `hasSearch` is set
//     (as it is here), so it renders as a plain `<button>` named by its
//     `<label for>`. On the dedicated /new page there is a single "Vai trò"
//     trigger, so an exact-name query is unambiguous.
//   - Clicking it opens a `role="listbox"` popover
//     (`aria-multiselectable="true"`) with `role="option"` rows, matched by
//     their visible label (e.g. "Giáo viên").
//   - Clicking an option TOGGLES its `aria-selected` WITHOUT closing the
//     popover — every option meant to be picked in one call must be clicked
//     while the popover stays open; there is no per-pick confirm step.
//   - `Escape` dismisses the popover; picks already made stay in the form's
//     `form.roles` React state — nothing else needs to "confirm" the popover
//     before the create form's own "Tạo" submits it.

import { randomUUID } from 'node:crypto';
import { expect, type Browser } from '@playwright/test';
import { formatRole } from '@cmc/auth';
import { mintStaffCookie } from '../session-injection.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const DEFAULT_TIMEOUT_MS = 10_000;

// Best-effort mapping from a free-text `position` (as callers across this
// suite already write it, with or without Vietnamese diacritics or the raw
// DB role slug) to a DB role slug, which `formatRole` then renders into the
// exact "Vai trò" option label the create dialog shows. The dialog builds its
// options with `formatRole` too (users.tsx's `ROLE_OPTIONS`), so deriving the
// picked label from that same source keeps this helper from drifting when the
// canonical `@cmc/auth` labels change — they did once: users.tsx used to carry
// a local short-form map ('GĐ Kinh doanh', 'Super Admin') that was replaced by
// the canonical labels ('Giám đốc kinh doanh', 'Quản trị hệ thống'), which are
// what the options now render as. Only used when a caller doesn't pass
// `roleLabels` explicitly — those callers don't care which DB role lands on
// the row (every permission gate this suite exercises reads roles from the
// signed cookie, not this column), so the match only needs to be sensible,
// not authoritative. Order matters: "kinh doanh" also appears inside "giám
// đốc kinh doanh", so the director patterns are checked before the plain
// "sale" one.
const ROLE_SLUG_BY_POSITION_PATTERN: Array<[RegExp, string]> = [
  [/gi[aá]m\s*đ[oố]c\s*đào\s*tạo|giam_doc_dao_tao/i, 'giam_doc_dao_tao'],
  [/gi[aá]m\s*đ[oố]c\s*kinh\s*doanh|giam_doc_kinh_doanh/i, 'giam_doc_kinh_doanh'],
  [/gi[aá]o\s*vi[eê]n|giao_vien/i, 'giao_vien'],
  [/super[\s_]?admin/i, 'super_admin'],
  [/sale/i, 'sale'],
];

function defaultRoleLabelForPosition(position: string): string {
  const match = ROLE_SLUG_BY_POSITION_PATTERN.find(([pattern]) => pattern.test(position));
  // 'sale' is a safe, low-privilege fallback for a position string this
  // suite hasn't used before — it only needs to unblock the now-required
  // "Vai trò" field, not grant anything a specific caller didn't ask for via
  // `roleLabels`.
  return formatRole(match ? match[1] : 'sale');
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
 * Drives the real canonical staff surface (`/hr/staff/new`, D1) end-to-end:
 * opens the dedicated create page, fills the required fields (including the
 * required "Vai trò" role picker), submits, and confirms the browser lands on
 * the created profile URL (`/hr/staff/:id/profile`) — create-success navigates
 * with `replace`, so the submitted /new form is never left in history.
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

    await page.goto('/hr/staff/new');
    await page.getByLabel('User ID (auth identity)').fill(opts.userId);
    await page.getByLabel('Họ tên').fill(opts.fullName);
    await page.getByLabel('Email').fill(opts.email ?? `${opts.userId}@e2e.cmc`);
    await page.getByLabel('Vị trí').fill(opts.position);

    const roleLabelsToPick =
      opts.roleLabels && opts.roleLabels.length > 0
        ? opts.roleLabels
        : [defaultRoleLabelForPosition(opts.position)];
    // Same MultiSelector contract as the old dialog: the trigger renders as a
    // plain `<button>` (no `role="combobox"` override) because `hasSearch` is
    // set; on the dedicated /new page there is a single "Vai trò" trigger so
    // an exact-name scoped query is unambiguous.
    await page.getByRole('button', { name: 'Vai trò', exact: true }).click();
    for (const label of roleLabelsToPick) {
      await page.getByRole('option', { name: label, exact: true }).click();
    }
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Tạo' }).click();

    // Create-success navigates (replace) to the created profile — wait for the
    // URL to leave /hr/staff/new so a slow mutation cannot race the assertion.
    await expect(page).toHaveURL(/\/hr\/staff\/[0-9a-f-]{36}\/profile$/, {
      timeout: DEFAULT_TIMEOUT_MS,
    });

    // The profile header shows the created identity; confirm it by fullName
    // (never a smuggled id — same findInList contract spirit).
    await expect(page.getByText(opts.fullName).first()).toBeVisible({
      timeout: DEFAULT_TIMEOUT_MS,
    });
  } finally {
    await context.close();
  }
}
