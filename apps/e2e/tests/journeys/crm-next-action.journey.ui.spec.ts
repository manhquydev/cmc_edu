// P4 journey — set next-action on detail; due item appears on cockpit WorkInbox.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { withFacility } from '@cmc/db';

import { mintStaffCookie } from '../../src/session-injection.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { getDb, seedAppUser } from '../../src/db.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

async function backdateNextActionByName(name: string): Promise<void> {
  await withFacility(
    getDb(),
    null,
    async (tx) => {
      const contact = await tx.contact.findFirst({
        where: { facilityId, name },
        select: { id: true },
      });
      if (!contact) {
        throw new Error(`No contact found for name=${name}`);
      }
      const updated = await tx.opportunity.updateMany({
        where: { facilityId, contactId: contact.id },
        data: { nextActionAt: new Date(Date.now() - 60 * 60 * 1000) },
      });
      if (updated.count === 0) {
        throw new Error(`No opportunity found to backdate nextAction for name=${name}`);
      }
    },
    { bypass: true },
  );
}

test.describe('P4 journey — nhắc việc theo cơ hội', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const leadName = `E2E NextAction ${runId}`;
  const leadPhone = randomVnPhone();
  const userId = `e2e-next-sale-${runId}`;

  test('sale sets next action; due shows on cockpit after backdate', async ({ browser }) => {
    // opportunityCreate assigns to the caller's AppUser when role=sale.
    // Due inbox filters assignedToId = me — seed the staff row first.
    await seedAppUser({
      facilityId,
      userId,
      fullName: `E2E Sale ${runId}`,
      roles: ['sale'],
    });

    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({ userId, roles: ['sale'], facilityId }),
      ),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
    await page.getByRole('button', { name: 'Thêm cơ hội' }).click();
    await page.getByLabel('Họ tên').fill(leadName);
    await page.getByLabel('Số điện thoại').fill(leadPhone);
    await page.getByRole('button', { name: 'Tạo' }).click();

    await page.getByText(leadName, { exact: true }).click();
    await expect(page).toHaveURL(/\/crm\/opportunities\//);
    await expect(page.getByTestId('crm-next-action')).toBeVisible();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ymd = tomorrow.toISOString().slice(0, 10);
    await page.getByLabel('Ngày hẹn').fill(ymd);
    await page.getByLabel('Việc cần làm').fill(`Gọi lại ${runId}`);
    await page.getByRole('button', { name: 'Lưu việc tiếp theo' }).click();
    await expect(page.getByText(`Gọi lại ${runId}`)).toBeVisible({ timeout: 10_000 });

    await backdateNextActionByName(leadName);

    await page.goto('/cockpit');
    await expect(page.getByTestId('crm-due-followups')).toBeVisible();
    await expect(page.getByText(`Gọi lại ${runId}`)).toBeVisible({ timeout: 15_000 });

    await context.close();
  });
});
