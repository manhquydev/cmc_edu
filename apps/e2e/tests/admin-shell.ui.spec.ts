// Admin shell UI safety net (Phase 1 of the Astryx UI migration).
//
// Captures CURRENT (Mantine) shell + nav + DataTable behavior via real
// browser assertions BEFORE any component is migrated, so regressions during
// the Mantine -> Astryx swap are caught by browser rendering, not just
// typecheck/build. Selectors use role/label/text, not Mantine CSS classes,
// so they survive the migration (see architecture note in phase-02).
//
// Auth: preview builds are production builds (import.meta.env.PROD), so the
// admin app's trpc client never sends the dev x-dev-user header — the only
// way in is a signed cmc_staff_session cookie (Mode B), minted here with the
// same env-derived secret the spawned api server verifies against.

import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../src/session-injection.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('admin shell (UI safety net)', () => {
  // ui-chromium project's baseURL defaults to the lms preview (:4174) since
  // most UI specs will be lms-flavored; admin lives on a different port and
  // must override it here or every relative page.goto() silently lands on
  // the wrong app.
  test.use({ baseURL: 'http://localhost:4173' });

  test.beforeEach(async ({ context }) => {
    // giam_doc_kinh_doanh: has finance.receiptList permission (packages/auth/src/index.ts),
    // so the Finance nav entry and Phiếu thu list page are both reachable.
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

  test('shell renders header, brand, and nav after login redirect', async ({ page }) => {
    await page.goto('/cockpit');

    // Header brand — present regardless of which module is active.
    await expect(page.getByText('CMC EDU', { exact: true })).toBeVisible();
    await expect(page.getByText('Admin', { exact: true })).toBeVisible();

    // Role badge reflects the injected staff session (proves the cookie auth
    // path actually resolved `me`, not just that the page didn't crash).
    await expect(page.getByText('giam_doc_kinh_doanh', { exact: true })).toBeVisible();

    // Nav: cockpit has no permission gate, always visible.
    await expect(page.getByRole('link', { name: /tổng quan/i }).or(page.getByText('Tổng quan'))).toBeVisible();
  });

  test('finance nav entry navigates to receipts list with a DataTable', async ({ page }) => {
    await page.goto('/cockpit');

    // Nav item label combines an icon + text ("💰  Tài chính & Điều hành" for
    // the parent, "🧾  Phiếu thu" for the child) — match by substring text so
    // this survives icon/label formatting changes.
    await page.getByText(/tài chính & điều hành/i).click();
    await page.getByText(/phiếu thu/i).click();

    await expect(page).toHaveURL(/\/finance/);

    // DataTable: assert a table structure exists (header row), regardless of
    // whether seeded data is present — this spec runs against a fresh
    // ephemeral facility with no receipts, so an empty body is expected.
    // The `table` role comes from the Mantine Table's native <table> markup
    // today; when Astryx's Table renders, the ARIA role must still be
    // preserved (or this spec must be updated deliberately, not silently
    // broken).
    await expect(page.getByRole('table')).toBeVisible();
  });
});
