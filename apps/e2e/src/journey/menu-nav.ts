// menuNav — turns UAT §4.3 ("a role must reach its screens through the real
// nav, and must not see nav it has no permission for") into a reusable
// journey step.
//
// DOM contract (packages/ui/src/components/side-nav.tsx): a module row is a
// `<button class="sh-item">` whose accessible name is `mod.label` (its
// LineIcon carries `aria-hidden="true"`, so the icon never leaks into the
// name). Clicking it toggles `active`, at which point its permission-filtered
// children render as `<button class="sh-subitem">` inside a `.sh-sub`
// container — SideNav computes that filter from `isChildVisible`/`canDo`, so
// this helper exercises the exact gate the nav renders from, not a copy of
// it. No `data-testid` exists on either button and none was needed: the
// visible label is enough to select by role, per §4.2 (find by what a person
// sees, not an id).
//
// No `page.goto()` to the destination screen is used anywhere here — every
// navigation is the two real clicks (module, then child) a person would make.

import { expect, type Locator, type Page } from '@playwright/test';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface MenuNavOptions {
  /** Role name, surfaced only in the failure message — makes a failed
   *  assertion name "which entry, for which role" instead of a bare timeout. */
  role?: string;
  timeoutMs?: number;
}

function navRoot(page: Page): Locator {
  return page.locator('.sh-nav');
}

function entryLabel(moduleLabel: string, childLabel: string): string {
  return `${moduleLabel} → ${childLabel}`;
}

function roleSuffix(role: string | undefined): string {
  return role ? ` (role: ${role})` : '';
}

/**
 * Opens the side-nav module `moduleLabel`, then clicks its child
 * `childLabel`, exactly like a person would. FAILS (throws) the moment the
 * module or the child is not visible for the current session — that failure
 * IS the proof requested by §4.3, not a bug in the helper.
 */
async function menuNavImpl(
  page: Page,
  moduleLabel: string,
  childLabel: string,
  opts: MenuNavOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const nav = navRoot(page);

  const moduleButton = nav.getByRole('button', { name: moduleLabel, exact: true });
  await expect(
    moduleButton,
    `menuNav: module "${moduleLabel}" is not visible in the side-nav${roleSuffix(opts.role)} — ` +
      `expected it to be reachable for this session.`,
  ).toBeVisible({ timeout: timeoutMs });
  await moduleButton.click();

  const childButton = nav.locator('.sh-sub').getByRole('button', { name: childLabel, exact: true });
  await expect(
    childButton,
    `menuNav: entry "${entryLabel(moduleLabel, childLabel)}" is not visible in the side-nav${roleSuffix(opts.role)} — ` +
      `either the permission gate hid it (§4.3 regression) or the label changed.`,
  ).toBeVisible({ timeout: timeoutMs });
  await childButton.click();
}

export interface AssertEntryAbsentOptions extends MenuNavOptions {
  /** Extra time given to the settle signal (Tổng quan render) before giving up. */
  settleTimeoutMs?: number;
}

/**
 * Negation primitive (M2): passes when `childLabel` under `moduleLabel` is
 * genuinely absent for the current session — either because the whole module
 * row is filtered out (`visibleModulesFor`'s module-level gate) or because the
 * module is visible but the specific child is filtered out
 * (`isNavChildVisible`). Both are legitimate "absent" outcomes; this helper
 * does not care which one produced it.
 *
 * Settled-wait: "Tổng quan" (cockpit) carries no permission gate and is
 * unconditionally the first entry in `NAV_MODULES`, but `Shell` computes
 * `modules` as `me ? visibleModulesFor(...) : []` — so the WHOLE nav renders
 * empty until the `session.me` query resolves. Asserting absence the instant
 * this function is called would trivially "pass" against that empty
 * pre-load state, which is exactly the false-absent this settled-wait exists
 * to prevent (Phase 5 reuses this same primitive for its "should NOT see
 * this" journeys, so getting this wrong here would silently under-prove every
 * one of those too). Waiting for "Tổng quan" to render first proves the nav
 * has hydrated with the real, role-derived module list before this checks
 * anything is missing from it.
 */
async function assertEntryAbsent(
  page: Page,
  moduleLabel: string,
  childLabel: string,
  opts: AssertEntryAbsentOptions = {},
): Promise<void> {
  const nav = navRoot(page);

  await expect(
    nav.getByRole('button', { name: 'Tổng quan', exact: true }),
    'menuNav.assertEntryAbsent: side-nav never settled (cockpit entry, which has no ' +
      'permission gate, did not render) — cannot tell a genuine absence from a nav that ' +
      'never loaded.',
  ).toBeVisible({ timeout: opts.settleTimeoutMs ?? DEFAULT_TIMEOUT_MS });

  const moduleButton = nav.getByRole('button', { name: moduleLabel, exact: true });
  if ((await moduleButton.count()) === 0) {
    // Whole module row filtered out (visibleModulesFor) — the child is
    // absent a fortiori. This IS a pass, not something to investigate further.
    return;
  }
  await moduleButton.click();

  const childButton = nav.locator('.sh-sub').getByRole('button', { name: childLabel, exact: true });
  // `.toHaveCount(0)` polls up to its timeout rather than sampling once, so a
  // child that appears only after a slow re-render is still caught — the
  // settled-wait above already ruled out the "nav hasn't loaded at all" case,
  // this one covers "this specific child's render is still in flight".
  await expect(
    childButton,
    `menuNav.assertEntryAbsent: entry "${entryLabel(moduleLabel, childLabel)}" IS visible` +
      `${roleSuffix(opts.role)} — expected it to be absent.`,
  ).toHaveCount(0, { timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS });
}

export const menuNav = Object.assign(menuNavImpl, { assertEntryAbsent });
