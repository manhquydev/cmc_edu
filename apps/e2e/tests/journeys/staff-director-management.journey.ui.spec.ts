// Phase 7 Staff archetypes the ADM-02 super_admin journey does not cover:
// director-positive management, list-row → detail, cold /hr/staff/:id/profile,
// F5 on the detail URL, Back to the list, and ordinary-role denial.
//
// There is no `giam_doc` role slug. The director who holds `user.manage`
// (nav leaf + create/list/get) is `giam_doc_kinh_doanh` (packages/auth).
// Sale has no `user.manage`; typed /hr/staff must render the same EmptyState
// deeplink-detail-gates asserts on a forbidden detail URL.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const ADMIN_ORIGIN = 'http://localhost:4173';
const STAFF_ID_RE = /\/hr\/staff\/([0-9a-f-]{36})/;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

function staffIdFromUrl(url: string): string {
  const id = url.match(STAFF_ID_RE)?.[1];
  if (!id) {
    throw new Error(`expected /hr/staff/:uuid in ${url}`);
  }
  return id;
}

test.describe('Phase 7 journey — director staff management on /hr/staff', () => {
  test.use({ baseURL: ADMIN_ORIGIN });

  test('director creates staff, row opens detail, F5/Back hold, cold profile hydrates', async ({
    browser,
  }) => {
    const runId = randomUUID().slice(0, 8);
    const staffName = `E2E P7 NV ${runId}`;
    const staffUserId = `e2e-p7-nv-${runId}`;

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p7-gdkd-${runId}`,
          roles: ['giam_doc_kinh_doanh'],
          facilityId,
        }),
      ),
    );
    await page.goto('/cockpit');

    // --- director positive: real nav lands on the canonical staff list ---
    await menuNav(page, 'Nhân sự', 'Nhân viên', { role: 'giam_doc_kinh_doanh' });
    await expect(page).toHaveURL(/\/hr\/staff/);

    // --- create via the dedicated /new form; success replace-navigates ---
    await page.goto('/hr/staff/new');
    await page.getByLabel('User ID (auth identity)').fill(staffUserId);
    await page.getByLabel('Họ tên').fill(staffName);
    await page.getByLabel('Email').fill(`${staffUserId}@e2e.cmc`);
    await page.getByLabel('Vị trí').fill('Nhân viên kinh doanh');
    await page.getByRole('button', { name: 'Vai trò', exact: true }).click();
    await page.getByRole('option', { name: 'Sale', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Tạo', exact: true }).click();

    await expect(page).toHaveURL(/\/hr\/staff\/[0-9a-f-]{36}\/profile$/);
    await expect(page.getByText(staffName).first()).toBeVisible();
    const staffId = staffIdFromUrl(page.url());

    // --- row → detail: list is index-only; click opens /hr/staff/:id/profile ---
    await page.goto('/hr/staff');
    await page.getByPlaceholder('Tên, email, mã NV…').fill(staffName);
    const row = await findInList(page, (text) => text.includes(staffName));
    await row.getByText(staffName, { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/hr/staff/${staffId}`));
    await expect(page.getByText(staffName).first()).toBeVisible();

    // --- F5 on the detail URL keeps address + hydrated name ---
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/hr/staff/${staffId}`));
    await expect(page.getByText(staffName).first()).toBeVisible();

    // --- Back from list → detail returns to the staff list ---
    await page.goBack();
    await expect(page).toHaveURL(/\/hr\/staff\/?(?:\?.*)?$/);
    await expect(page.getByText(staffName).first()).toBeVisible();

    // --- cold deep-link: fresh page, no location.state ---
    const coldPage = await context.newPage();
    await coldPage.goto(`/hr/staff/${staffId}/profile`);
    await expect(coldPage).toHaveURL(new RegExp(`/hr/staff/${staffId}/profile`));
    await expect(coldPage.getByText(staffName).first()).toBeVisible();
    await coldPage.close();

    await context.close();
  });

  test('sale hitting /hr/staff sees user.manage EmptyState', async ({ browser }) => {
    const runId = randomUUID().slice(0, 8);
    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-p7-sale-${runId}`,
          roles: ['sale'],
          facilityId,
        }),
      ),
    );

    await page.goto('/hr/staff');
    await expect(page.getByText('Không có quyền truy cập')).toBeVisible();
    await expect(page.getByText(/user\.manage/)).toBeVisible();

    await context.close();
  });
});
