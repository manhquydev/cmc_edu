// P3 journey — bulk lead import via paste → preview → confirm.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P3 journey — nhập lead hàng loạt', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const nameA = `E2E Bulk A ${runId}`;
  const nameB = `E2E Bulk B ${runId}`;
  const phoneA = randomVnPhone();
  const phoneB = randomVnPhone();

  test('sale previews and confirms a small paste list', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-bulk-sale-${runId}`,
          roles: ['sale'],
          facilityId,
        }),
      ),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Tài chính & Điều hành', 'Nhập lead hàng loạt', { role: 'sale' });
    await expect(page).toHaveURL(/\/crm\/bulk-import/);
    await expect(page.getByTestId('crm-bulk-import-page')).toBeVisible();

    const paste = `${nameA},${phoneA},,fanpage\n${nameB},${phoneB},,fanpage`;
    await page.getByLabel('Danh sách lead').fill(paste);
    await page.getByTestId('crm-bulk-preview-btn').getByRole('button').click();

    await expect(page.getByTestId('crm-bulk-preview')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Sẽ tạo:')).toBeVisible();
    await page.getByTestId('crm-bulk-confirm-btn').getByRole('button').click();

    await expect(page.getByTestId('crm-bulk-result')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Tạo 2/)).toBeVisible();

    await context.close();
  });
});
