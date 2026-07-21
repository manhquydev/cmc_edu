// Admin shell UI safety net (Phase 1 of the Astryx UI migration).
//
// Captures the pre-Astryx shell + nav + DataTable behavior via real
// browser assertions BEFORE any component is migrated, so regressions during
// the legacy-UI → Astryx swap are caught by browser rendering, not just
// typecheck/build. Selectors use role/label/text, not legacy CSS classes,
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
    await expect(page.getByRole('button', { name: 'Tổng quan', exact: true })).toBeVisible();
  });

  test('finance nav entry navigates to receipts list with a DataTable', async ({ page }) => {
    await page.goto('/cockpit');

    // Nav item label combines an icon + text ("💰  Tài chính & Điều hành") —
    // match by substring so this survives icon/label formatting changes.
    // The parent module's own path is /finance (same as its "Phiếu thu"
    // child), so this one click already navigates — a second click on
    // "Phiếu thu" text is both redundant and ambiguous once the finance
    // page's own content (also containing that text) has rendered.
    await page.getByText(/tài chính & điều hành/i).click();

    await expect(page).toHaveURL(/\/finance/);

    // DataTable: this spec runs against a fresh ephemeral facility with no
    // receipts, so the empty state is what's expected here — @cmc/ui's
    // DataTable (packages/ui/src/components/data-table.tsx) renders
    // EmptyState in place of the table when data.length === 0 (a
    // deliberate, reasonable design choice on the Astryx port; the old
    // prior version kept table headers visible with EmptyState nested in
    // the body instead — also valid, just a different pattern). The
    // receipt-list page passes its own custom `empty` message ("Chưa có
    // phiếu thu nào") rather than DataTable's generic default, so assert
    // via EmptyState's implicit `status` role instead of hardcoded text.
    await expect(page.getByRole('status').filter({ hasText: 'Chưa có phiếu thu nào' })).toBeVisible();
  });
});
