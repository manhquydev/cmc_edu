// findInList — turns UAT §4.2 ("hand a role only what it can see on screen,
// never an id minted in another role's context") into a reusable journey
// step.
//
// Every consumer of this helper is a role that must locate something a
// DIFFERENT role's context created earlier in the same journey (a receipt by
// its displayed code, a class by its displayed code, a staff member by their
// displayed name) — the predicate always runs over the row's rendered text,
// never a `.dataset.id` or a captured mutation response. That is enforced at
// the type level too: the signature below has no `id` parameter to smuggle
// one through.
//
// No fixed CSS selector for "a row" is assumed (@cmc/ui's DataTable renders
// through a third-party `@astryxdesign/core/Table`, and other screens use
// plain markup) — callers pass `rowSelector`, a Playwright locator string
// scoped under `within` (defaults to the whole page).

import type { Locator, Page } from '@playwright/test';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_INTERVAL_MS = 200;
/** Matches @cmc/ui DataTable's underlying `@astryxdesign/core/Table` (a
 *  semantic `<table>`) as well as any plain `<table>` markup — the two row
 *  shapes every consumer of this helper has hit so far. Override
 *  `rowSelector` for a screen that renders a list some other way (a card
 *  grid, a custom `<div>` stack). */
const DEFAULT_ROW_SELECTOR = 'table tbody tr, [role="row"]';

export interface FindInListOptions {
  /** Scope the search to a container (e.g. a specific table) instead of the
   *  whole page — disambiguates when more than one list renders at once. */
  within?: Locator | Page;
  /** Playwright locator string for one row/item. */
  rowSelector?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

function scopeOf(page: Page, opts: FindInListOptions): Locator | Page {
  return opts.within ?? page;
}

/**
 * Polls the rendered list until one row's VISIBLE text satisfies `predicate`,
 * then returns that row's `Locator` for the caller to click/read further.
 * Never accepts an id — the only way to identify the target is what the
 * predicate can read off the screen.
 */
async function findInListImpl(
  page: Page,
  predicate: (visibleText: string) => boolean,
  opts: FindInListOptions = {},
): Promise<Locator> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const rowSelector = opts.rowSelector ?? DEFAULT_ROW_SELECTOR;
  const scope = scopeOf(page, opts);

  const deadline = Date.now() + timeoutMs;
  let lastSeenCount = 0;
  let lastSeenTexts: string[] = [];

  while (Date.now() < deadline) {
    const rows = scope.locator(rowSelector);
    const count = await rows.count();
    lastSeenCount = count;
    lastSeenTexts = [];
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      const text = (await row.innerText()).trim();
      lastSeenTexts.push(text);
      if (predicate(text)) {
        return row;
      }
    }
    await page.waitForTimeout(pollIntervalMs);
  }

  throw new Error(
    `findInList: no row under "${rowSelector}" matched the predicate within ${timeoutMs}ms ` +
      `(last saw ${lastSeenCount} row(s): ${JSON.stringify(lastSeenTexts)}).`,
  );
}

/**
 * Negation primitive companion to `findInList`: passes when, after the list
 * has settled (same poll-until-timeout window — a slow-loading list is given
 * the full window to prove the item is really absent, not just not-yet-there),
 * no row matches `predicate`.
 */
async function assertAbsent(
  page: Page,
  predicate: (visibleText: string) => boolean,
  opts: FindInListOptions = {},
): Promise<void> {
  let found: Locator | undefined;
  try {
    found = await findInListImpl(page, predicate, opts);
  } catch {
    // No match within the window — exactly the passing case.
    return;
  }
  const text = await found.innerText();
  throw new Error(
    `findInList.assertAbsent: a row matching the predicate IS present ` +
      `(text: ${JSON.stringify(text.trim())}) — expected no match.`,
  );
}

export const findInList = Object.assign(findInListImpl, { assertAbsent });
