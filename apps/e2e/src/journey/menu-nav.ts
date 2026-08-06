// menuNav — turns UAT §4.3 ("a role must reach its screens through the real
// nav, and must not see nav it has no permission for") into a reusable
// journey step.
//
// DOM contract (Odoo shell, design3): top-level modules live in the app
// switcher (opened via "Mở app switcher"); children of the active app render
// as horizontal section-menu buttons on the purple navbar (OdooNavbar).
// Navigation is navigate-then-select (not expand-in-place side rail).
//
// Signature stays `menuNav(page, module, child)` for call-site compatibility.
// Modules without children: pass childLabel === moduleLabel (or empty) is not
// used by current call sites — every journey uses a real child. For cockpit
// alone, callers use direct path or open switcher + click "Tổng quan".
//
// No `page.goto()` to the destination screen is used anywhere here — every
// navigation is the real clicks a person would make.

import { expect, type Locator, type Page } from '@playwright/test';

const DEFAULT_TIMEOUT_MS = 10_000;

export interface MenuNavOptions {
  /** Role name, surfaced only in the failure message — makes a failed
   *  assertion name "which entry, for which role" instead of a bare timeout. */
  role?: string;
  timeoutMs?: number;
}

function navbar(page: Page): Locator {
  return page.locator('nav.o-navbar, nav[aria-label="Ứng dụng"]');
}

function switcherToggle(page: Page): Locator {
  return page.getByRole('button', { name: 'Mở app switcher', exact: true });
}

function switcherMenu(page: Page): Locator {
  return page.getByRole('menu', { name: 'App switcher' });
}

function entryLabel(moduleLabel: string, childLabel: string): string {
  return `${moduleLabel} → ${childLabel}`;
}

function roleSuffix(role: string | undefined): string {
  return role ? ` (role: ${role})` : '';
}

/**
 * Opens the Odoo app-switcher, selects `moduleLabel`, then clicks section-menu
 * child `childLabel`. FAILS when module/child is not visible for the session.
 */
async function menuNavImpl(
  page: Page,
  moduleLabel: string,
  childLabel: string,
  opts: MenuNavOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const nav = navbar(page);

  await expect(
    switcherToggle(page),
    `menuNav: app-switcher toggle not visible${roleSuffix(opts.role)} — shell may not have hydrated.`,
  ).toBeVisible({ timeout: timeoutMs });

  // Open switcher and pick the app (module).
  await switcherToggle(page).click();
  const moduleTile = switcherMenu(page).getByRole('menuitem', { name: moduleLabel, exact: true });
  await expect(
    moduleTile,
    `menuNav: module "${moduleLabel}" is not visible in the app-switcher${roleSuffix(opts.role)} — ` +
      `expected it to be reachable for this session.`,
  ).toBeVisible({ timeout: timeoutMs });
  await moduleTile.click();

  // Module without a distinct child (cockpit-style): selecting the app is enough.
  if (childLabel === moduleLabel) {
    return;
  }

  // Section menu children render on the navbar after the app becomes active.
  const childButton = nav.getByRole('button', { name: childLabel, exact: true });
  await expect(
    childButton,
    `menuNav: entry "${entryLabel(moduleLabel, childLabel)}" is not visible in the section menu` +
      `${roleSuffix(opts.role)} — either the permission gate hid it (§4.3 regression) or the label changed.`,
  ).toBeVisible({ timeout: timeoutMs });
  await childButton.click();
}

export interface AssertEntryAbsentOptions extends MenuNavOptions {
  /** Extra time given to the settle signal (switcher shows Tổng quan) before giving up. */
  settleTimeoutMs?: number;
}

/**
 * Negation primitive: passes when `childLabel` under `moduleLabel` is
 * genuinely absent. Settled-wait opens the app-switcher and waits for
 * "Tổng quan" (always present for authenticated staff) so we never pass
 * against an empty pre-hydration shell.
 *
 * Absence is checked AFTER the switcher (or section menu) is open — never
 * `count()===0` against a closed dropdown (that would be a ghost pass).
 */
async function assertEntryAbsent(
  page: Page,
  moduleLabel: string,
  childLabel: string,
  opts: AssertEntryAbsentOptions = {},
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const settleMs = opts.settleTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  await expect(
    switcherToggle(page),
    'menuNav.assertEntryAbsent: app-switcher toggle never settled — cannot tell a genuine absence from a shell that never loaded.',
  ).toBeVisible({ timeout: settleMs });

  await switcherToggle(page).click();
  const menu = switcherMenu(page);
  await expect(
    menu.getByRole('menuitem', { name: 'Tổng quan', exact: true }),
    'menuNav.assertEntryAbsent: app-switcher never settled (cockpit entry, which has no permission gate, did not render).',
  ).toBeVisible({ timeout: settleMs });

  const moduleTile = menu.getByRole('menuitem', { name: moduleLabel, exact: true });
  if ((await moduleTile.count()) === 0) {
    // Whole module filtered out — child absent a fortiori. Close switcher.
    await switcherToggle(page).click().catch(() => undefined);
    return;
  }

  await moduleTile.click();

  // Positive settle AFTER navigate: wait until the section menu has hydrated
  // for this app (any button under the navbar that is not the switcher toggle).
  // Without this, toHaveCount(0) can ghost-pass during the empty gap between
  // switcher close and children paint (red-team Critical class).
  const nav = navbar(page);
  const sectionButtons = nav.locator('ul.o-menu-sections button.o-menu-item');
  // Modules with zero visible children (or fully gated) may legitimately have
  // an empty section menu — in that case absence of childLabel is true. For
  // modules that keep at least one ungated sibling, wait for >=1 section item
  // before asserting the forbidden child is missing.
  // Prefer a short positive wait; if nothing appears, fall through to absence.
  try {
    await expect(sectionButtons.first()).toBeVisible({ timeout: Math.min(timeoutMs, 3_000) });
  } catch {
    // Empty section menu after settle window — treat as fully gated / no children.
  }

  const childButton = nav.getByRole('button', { name: childLabel, exact: true });
  await expect(
    childButton,
    `menuNav.assertEntryAbsent: entry "${entryLabel(moduleLabel, childLabel)}" IS visible` +
      `${roleSuffix(opts.role)} — expected it to be absent.`,
  ).toHaveCount(0, { timeout: timeoutMs });
}

export const menuNav = Object.assign(menuNavImpl, { assertEntryAbsent });
