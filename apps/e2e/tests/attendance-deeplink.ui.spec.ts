// Phase 3: attendance workspace URL state hydrate.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../src/session-injection.js';
import { seedClassBatch } from '../src/db.js';
import { seedStaffWithPassword } from '../src/seed-staff-password.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const ADMIN_ORIGIN = 'http://localhost:4173';

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('attendance deep-link hydrate', () => {
  test.use({ baseURL: ADMIN_ORIGIN });

  test('URL with classBatchId + sessionId selects the right class/session', async ({
    browser,
  }) => {
    const runId = randomUUID().slice(0, 8);
    const { classBatchId, code, sessionIds } = await seedClassBatch({ facilityId });
    const sessionId = sessionIds[0]!;
    expect(sessionId).toBeTruthy();

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    // giao_vien has class.read + attendance.mark for the picker page.
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-att-dl-${runId}`,
          roles: ['giao_vien'],
          facilityId,
        }),
      ),
    );

    await page.goto(
      `/teaching/attendance?classBatchId=${classBatchId}&sessionId=${sessionId}`,
    );

    // Class code from seed should appear in the class selector value/label area.
    await expect(page.getByText(new RegExp(code)).first()).toBeVisible();
    // Session selector should show a date (not the empty placeholder alone).
    await expect(page.getByRole('combobox', { name: 'Chọn buổi học' })).toBeVisible();
    await context.close();
  });

  test('logout deep-link → form login → attendance params still hydrate', async ({
    page,
    context,
  }) => {
    const staff = await seedStaffWithPassword({ roles: ['giao_vien'] });
    const { classBatchId, code, sessionIds } = await seedClassBatch({ facilityId });
    const sessionId = sessionIds[0]!;
    const target = `/teaching/attendance?classBatchId=${classBatchId}&sessionId=${sessionId}`;

    await context.clearCookies();
    await page.goto(target);
    await expect(page).toHaveURL(/\/login\?returnTo=/);

    await page.getByLabel(/^Email/).fill(staff.email);
    await page.getByLabel(/^Mật khẩu/).fill(staff.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL(`${ADMIN_ORIGIN}${target}`);
    await expect(page.getByText(new RegExp(code)).first()).toBeVisible();
  });
});
