// Admin shell UI safety net — Odoo navbar + app-switcher (design3 Phase 2).
//
// Auth: preview builds are production builds (import.meta.env.PROD), so the
// admin app's trpc client never sends the dev x-dev-user header — the only
// way in is a signed cmc_staff_session cookie (Mode B).

import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../src/session-injection.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('admin shell (UI safety net)', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  test.beforeEach(async ({ context }) => {
    const cookie = mintStaffCookie({
      userId: 'e2e-admin-shell-gdkd',
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await context.addCookies([
      {
        name: STAFF_COOKIE_NAME,
        value: cookie,
        domain: '127.0.0.1',
        path: '/',
      },
      {
        name: STAFF_COOKIE_NAME,
        value: cookie,
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('shell renders Odoo navbar brand and role after login redirect', async ({ page }) => {
    await page.goto('/cockpit');

    // Brand tracks active module (cockpit → Tổng quan); no separate "Admin" sub-brand.
    await expect(page.locator('.console-brand')).toHaveText('Tổng quan');

    // Role badge reflects the injected staff session.
    await expect(page.getByText('Giám đốc kinh doanh', { exact: true })).toBeVisible();

    // "Tổng quan" lives in the app-switcher, not as a always-visible side row.
    await page.getByRole('button', { name: 'Mở app switcher', exact: true }).click();
    await expect(
      page.getByRole('menu', { name: 'App switcher' }).getByRole('menuitem', { name: 'Tổng quan', exact: true }),
    ).toBeVisible();
  });

  test('finance nav entry navigates to receipts list with a DataTable', async ({ page }) => {
    await page.goto('/cockpit');

    await page.getByRole('button', { name: 'Mở app switcher', exact: true }).click();
    await page
      .getByRole('menu', { name: 'App switcher' })
      .getByRole('menuitem', { name: /tài chính/i })
      .click();

    await expect(page).toHaveURL(/\/finance/);

    await expect(page.getByRole('status').filter({ hasText: 'Chưa có phiếu thu nào' })).toBeVisible();
  });
});
