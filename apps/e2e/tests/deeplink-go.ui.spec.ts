// Phase 2b: /go/:entity/:id resolver + cold-nav entity paths.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../src/session-injection.js';
import { createE2eStaffClient } from '../src/trpc-client.js';
import {
  seedStaffWithPassword,
} from '../src/seed-staff-password.js';
import { randomVnPhone } from '../src/random-vn-phone.js';
import { STAFF_COOKIE_NAME } from '../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const baseUrl = process.env.E2E_BASE_URL!;
const ADMIN_ORIGIN = 'http://localhost:4173';

function opportunityPath(id: string) {
  return `/crm/opportunities/${id}`;
}
function goOpportunity(id: string) {
  return `/go/opportunity/${id}`;
}

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('/go resolver + entity cold-nav', () => {
  test.use({ baseURL: ADMIN_ORIGIN });

  test('/go/opportunity/:uuid when logged out → login → real opportunity URL', async ({
    page,
    context,
  }) => {
    const staff = await seedStaffWithPassword({ roles: ['sale'] });
    const runId = randomUUID().slice(0, 8);
    const sale = createE2eStaffClient(baseUrl, {
      userId: staff.userId,
      roles: staff.roles,
      facilityId,
    });
    const opp = await sale.crm.opportunityCreate.mutate({
      contactName: `E2E Go Lead ${runId}`,
      phone: randomVnPhone(),
    });

    await context.clearCookies();
    await page.goto(goOpportunity(opp.id));
    await expect(page).toHaveURL(/\/login\?returnTo=/);

    await page.getByLabel(/^Email/).fill(staff.email);
    await page.getByLabel(/^Mật khẩu/).fill(staff.password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL(`${ADMIN_ORIGIN}${opportunityPath(opp.id)}`);
  });

  test('/go/unknown and non-UUID id show EmptyState when logged in', async ({ browser }) => {
    const runId = randomUUID().slice(0, 8);
    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-go-sale-${runId}`,
          roles: ['sale'],
          facilityId,
        }),
      ),
    );

    await page.goto('/go/unknown/x');
    await expect(page.getByText('Liên kết không tồn tại')).toBeVisible();

    await page.goto(`/go/opportunity/not-a-uuid`);
    await expect(page.getByText('Liên kết không tồn tại')).toBeVisible();

    await context.close();
  });

  test('cold-nav opportunity detail renders contact name', async ({ browser }) => {
    const runId = randomUUID().slice(0, 8);
    const leadName = `E2E Cold Opp ${runId}`;
    const sale = createE2eStaffClient(baseUrl, {
      userId: `e2e-cold-sale-${runId}`,
      roles: ['sale'],
      facilityId,
    });
    const opp = await sale.crm.opportunityCreate.mutate({
      contactName: leadName,
      phone: randomVnPhone(),
    });

    const context = await browser.newContext({ baseURL: ADMIN_ORIGIN });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-cold-sale-${runId}`,
          roles: ['sale'],
          facilityId,
        }),
      ),
    );

    await page.goto(opportunityPath(opp.id));
    await expect(page.getByText(leadName).first()).toBeVisible();
    await context.close();
  });
});
