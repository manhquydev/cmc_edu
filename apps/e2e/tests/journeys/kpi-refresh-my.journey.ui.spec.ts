// P3-09 journey — Tính lại điểm KPI tự động: a staff member opens their own HR
// page and clicks "Tính lại" to have the system compute this period's KPI score.
//
// kpi.refresh is self-targeted and has no day-3 gate (unlike submit), so the
// staff can recompute the current period directly. Before the click there is no
// slip ("Chưa có phiếu KPI"); after it the score card appears — that transition
// is the proof. The staff is a real seeded AppUser so ctx.subject resolves to a
// scoreable row.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { ictMonthOf } from '@cmc/domain-time';
import { mintStaffCookie } from '../../src/session-injection.js';
import { seedAppUser } from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P3-09 journey — nhân viên tự tính lại điểm KPI kỳ hiện tại', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const staffUserId = `e2e-p309-nv-${runId}`;

  test.beforeAll(async () => {
    // A real staff row so kpi.refresh has a subject to score.
    await seedAppUser({ facilityId, userId: staffUserId, roles: ['sale'] });
  });

  test('a staff member recomputes their own KPI score for the current period', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: staffUserId, roles: ['sale'], facilityId })),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Nhân sự', 'Của tôi', { role: 'sale' });
    await expect(page).toHaveURL(/\/hr\/my/);

    // Before recomputing, the current period has no KPI slip. (The text appears
    // as both the banner title and its description, hence .first().)
    await expect(page.getByText('Chưa có phiếu KPI').first()).toBeVisible();

    // Recompute — kpi.refresh creates/updates this period's score, then the
    // page refetches and the score card replaces the empty state.
    await page.getByRole('button', { name: 'Tính lại' }).click();

    // The score card is now shown (its "Công ca" row is unique to a real score);
    // the empty-state banner is gone. This is the living proof the recompute ran.
    await expect(page.getByText(/Công ca/)).toBeVisible();
    await expect(page.getByText('Chưa có phiếu KPI')).toHaveCount(0);

    // ── business invariant ──
    // The score card replacing the empty state proves the UI re-fetched
    // something; it does not prove a current-period KpiScore row now durably
    // exists as a draft. kpi.myScore is self-scoped (resolves the AppUser from
    // ctx.subject.userId), so this client MUST reuse staffUserId — the exact id
    // seedAppUser created as an AppUser row and that minted the acting cookie.
    // The numeric `value` is auto-scored from near-empty seed activity (not a
    // stable constant), so the invariant asserts the STATE: the row now EXISTS
    // and is 'draft' — the real "recompute created the slip" proof.
    const period = ictMonthOf(new Date());
    const selfReadClient = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: staffUserId,
      roles: ['sale'],
      facilityId,
    });
    const score = await selfReadClient.kpi.myScore.query({ period });
    assertBusinessInvariant('phiếu KPI kỳ hiện tại được tạo (draft)', score?.status ?? null, 'draft');

    await context.close();
  });
});
