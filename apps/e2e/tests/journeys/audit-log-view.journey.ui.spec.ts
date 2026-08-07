// ADM-04 journey — Nhật ký hệ thống: a super admin finds their own auditable
// action in the audit log, and the "Người thực hiện" filter genuinely isolates
// by actor.
//
// Two super admins each do one auditable action (adding an IP range writes
// actor = ctx.subject.userId, action = 'facilityNetwork.create'). Then, filtered
// to actor A, the log shows A's entry and NOT B's. Proving B is excluded is what
// makes this a filter test rather than "the newest entry happens to be mine" —
// audit.list orders newest-first and is not facility-scoped, so without the
// exclusion a no-op filter would still surface A's own fresh entry.

import { randomUUID } from 'node:crypto';
import { test, expect, type Browser } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

/** Adds one inactive IP range as `userId` (an auditable facilityNetwork.create),
 *  in that actor's own context. Never activates it (see ADM-03). */
async function addIpRangeAs(browser: Browser, userId: string, cidr: string, label: string): Promise<void> {
  const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
  try {
    const page = await context.newPage();
    await context.addCookies(cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId, roles: ['super_admin'], facilityId })));
    await page.goto('/cockpit');
    await menuNav(page, 'Quản trị', 'IP mạng', { role: 'super_admin' });
    await page.getByRole('button', { name: 'Thêm dải mạng' }).click();
    const dialog = page.locator('dialog').filter({ hasText: 'Thêm dải mạng' });
    await dialog.getByLabel('CIDR').fill(cidr);
    await dialog.getByLabel('Nhãn').fill(label);
    await dialog.getByRole('button', { name: 'Tạo' }).click();
    await expect(page.getByRole('row', { name: new RegExp(cidr.replace(/[.]/g, '\\.')) })).toBeVisible();
  } finally {
    await context.close();
  }
}

test.describe('ADM-04 journey — nhật ký hệ thống: lọc theo người thực hiện', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const actorA = `e2e-adm04-a-${runId}`;
  const actorB = `e2e-adm04-b-${runId}`;
  const octetA = parseInt(runId.slice(0, 2), 16);

  test('the audit log filter isolates one actor from another', async ({ browser }) => {
    // Two actors each perform one auditable action.
    await addIpRangeAs(browser, actorA, `10.${octetA}.1.0/24`, `E2E ADM-04 A ${runId}`);
    await addIpRangeAs(browser, actorB, `10.${octetA}.2.0/24`, `E2E ADM-04 B ${runId}`);

    // Actor A opens the audit log and filters to their own id.
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: actorA, roles: ['super_admin'], facilityId })));
    await page.goto('/cockpit');
    await menuNav(page, 'Quản trị', 'Nhật ký hệ thống', { role: 'super_admin' });
    await expect(page).toHaveURL(/\/admin\/audit-log/);

    // Reactive FilterBar text field: page debounces 300ms then re-queries
    // audit.list — there is no "Lọc" submit button after the D4 FilterBar move.
    await page.getByLabel('Người thực hiện').fill(actorA);

    // A's entry is shown; B's is filtered out. The exclusion is the real proof
    // the filter works (not merely that A's fresh entry floated to the top).
    await expect(page.getByText(actorA, { exact: true })).toBeVisible();
    await expect(page.getByText(actorB, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('row', { name: /facilityNetwork\.create/ }).first()).toBeVisible();

    await context.close();
  });
});
