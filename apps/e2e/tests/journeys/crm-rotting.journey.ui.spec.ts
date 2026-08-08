// P2 journey — rotting badge on the CRM board.
// Ages stageChangedAt via Prisma seed helper (plan: seed-backdate, no clock mock).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { withFacility } from '@cmc/db';

import { mintStaffCookie } from '../../src/session-injection.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { getDb } from '../../src/db.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

async function ageOpportunityByName(name: string): Promise<void> {
  await withFacility(
    getDb(),
    null,
    async (tx) => {
      const contact = await tx.contact.findFirst({
        where: { facilityId, name },
        select: { id: true },
      });
      if (!contact) {
        throw new Error(`No contact found to age for name=${name}`);
      }
      const updated = await tx.opportunity.updateMany({
        where: { facilityId, contactId: contact.id },
        data: { stageChangedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      });
      if (updated.count === 0) {
        throw new Error(`No opportunity found to age for contact name=${name}`);
      }
    },
    { bypass: true },
  );
}

test.describe('P2 journey — cơ hội đang nguội', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const leadName = `E2E Rotting ${runId}`;
  const leadPhone = randomVnPhone();

  test('aged lead shows rotting badge; advance clears it', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({
          userId: `e2e-rotting-sale-${runId}`,
          roles: ['sale'],
          facilityId,
        }),
      ),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
    await expect(page).toHaveURL(/\/crm/);

    await page.getByRole('button', { name: 'Thêm cơ hội' }).click();
    await page.getByLabel('Họ tên').fill(leadName);
    await page.getByLabel('Số điện thoại').fill(leadPhone);
    await page.getByRole('button', { name: 'Tạo' }).click();

    const nameOnBoard = page.getByText(leadName, { exact: true });
    await expect(nameOnBoard).toBeVisible();

    await ageOpportunityByName(leadName);
    await page.reload();
    await expect(page.getByText(leadName, { exact: true })).toBeVisible();
    await expect(page.getByTestId('crm-rotting-badge').first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Chuyển lên' }).first().click();
    await page.reload();
    await expect(page.getByText(leadName, { exact: true })).toBeVisible();

    await context.close();
  });
});
