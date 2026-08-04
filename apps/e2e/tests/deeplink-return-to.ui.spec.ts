// Phase 1 deep-link returnTo: real staff form login preserves destination,
// rejects open-redirect shapes, and carries returnTo through change-password.
//
// Auth: these are the only admin UI specs that drive the email/password form.
// Everyone else mints a cmc_staff_session cookie (session-injection.ts).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { createE2eStaffClient } from '../src/trpc-client.js';
import {
  seedStaffMustChangePassword,
  seedStaffWithPassword,
} from '../src/seed-staff-password.js';
import { randomVnPhone } from '../src/random-vn-phone.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const baseUrl = process.env.E2E_BASE_URL!;
const ADMIN_ORIGIN = 'http://localhost:4173';

test.describe('deeplink returnTo (staff form login)', () => {
  // ui-chromium defaults to LMS :4174 — admin lives on :4173.
  test.use({ baseURL: ADMIN_ORIGIN });

  test('logout deep-link → form login → lands on original URL', async ({ page, context }) => {
    const staff = await seedStaffWithPassword({ roles: ['sale'] });

    // Fixture opportunity in the same facility the seeded sale belongs to.
    const runId = randomUUID().slice(0, 8);
    const saleClient = createE2eStaffClient(baseUrl, {
      userId: staff.userId,
      roles: staff.roles,
      facilityId,
    });
    const opp = await saleClient.crm.opportunityCreate.mutate({
      contactName: `E2E returnTo Lead ${runId}`,
      phone: randomVnPhone(),
    });
    const targetPath = `/crm/opportunities/${opp.id}`;

    // Ensure no leftover cookie from a previous test in this worker.
    await context.clearCookies();

    await page.goto(targetPath);
    await expect(page).toHaveURL(/\/login\?returnTo=/);

    await page.getByLabel(/^Email/).fill(staff.email);
    await page.getByLabel(/^Mật khẩu/).fill(staff.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL(`${ADMIN_ORIGIN}${targetPath}`);
  });

  test('malicious returnTo=//evil.com falls back to cockpit after login', async ({
    page,
    context,
  }) => {
    const staff = await seedStaffWithPassword({ roles: ['sale'] });
    await context.clearCookies();

    await page.goto(`/login?returnTo=${encodeURIComponent('//evil.com')}`);
    await page.getByLabel(/^Email/).fill(staff.email);
    await page.getByLabel(/^Mật khẩu/).fill(staff.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // safeReturnTo → '/' → index route redirects to /cockpit.
    await expect(page).toHaveURL(`${ADMIN_ORIGIN}/cockpit`);
  });

  test('mustChangePassword carries returnTo through change-password', async ({
    page,
    context,
  }) => {
    const staff = await seedStaffMustChangePassword({ roles: ['sale'] });
    const runId = randomUUID().slice(0, 8);
    const saleClient = createE2eStaffClient(baseUrl, {
      userId: staff.userId,
      roles: staff.roles,
      facilityId,
    });
    const opp = await saleClient.crm.opportunityCreate.mutate({
      contactName: `E2E mcp Lead ${runId}`,
      phone: randomVnPhone(),
    });
    const targetPath = `/crm/opportunities/${opp.id}`;
    const newPassword = `CmcRotated${randomUUID().slice(0, 8)}!`;

    await context.clearCookies();
    await page.goto(targetPath);
    await expect(page).toHaveURL(/\/login\?returnTo=/);

    await page.getByLabel(/^Email/).fill(staff.email);
    await page.getByLabel(/^Mật khẩu/).fill(staff.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // Forced rotation with returnTo preserved.
    await expect(page).toHaveURL(/\/change-password\?returnTo=/);

    // Accessible names include a "Required" suffix from PasswordInput — match
    // by prefix, not exact. "Mật khẩu mới" alone is a substring of
    // "Xác nhận mật khẩu mới", so keep the anchors that distinguish them.
    await page.getByLabel(/^Mật khẩu hiện tại/).fill(staff.password);
    await page.getByLabel(/^Mật khẩu mới/).fill(newPassword);
    await page.getByLabel(/^Xác nhận mật khẩu mới/).fill(newPassword);
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();

    await expect(page).toHaveURL(`${ADMIN_ORIGIN}${targetPath}`);
  });
});
