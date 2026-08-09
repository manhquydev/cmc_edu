// P1 CRM report journey — sale opens "Báo cáo tuyển sinh" through the real
// menu and sees the three time-labeled blocks (funnel / cohort / closed).
// Read-only surface; does not mutate pipeline state.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

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

test.describe('CRM report journey — báo cáo tuyển sinh', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);

  test('sale opens report via menu and sees three report blocks', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-crm-report-sale-${runId}`,
          roles: ['sale'],
          facilityId,
        }),
      ),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Tài chính & Điều hành', 'Báo cáo tuyển sinh', { role: 'sale' });
    await expect(page).toHaveURL(/\/crm\/report/);

    await expect(page.getByTestId('crm-report-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Báo cáo tuyển sinh' })).toBeVisible();

    // Three time-labeled blocks must render (empty data is fine — structure is the proof).
    await expect(page.getByTestId('crm-report-funnel')).toBeVisible();
    await expect(page.getByText('Mốc thời gian:')).toHaveCount(3);
    await expect(page.getByTestId('crm-report-cohort')).toBeVisible();
    await expect(page.getByTestId('crm-report-closed')).toBeVisible();

    // Lost-reason baseline table (may be empty for a fresh facility).
    await expect(
      page.getByText('Lý do mất (baseline cho theo dõi rơi lead)'),
    ).toBeVisible();

    await context.close();
  });
});
