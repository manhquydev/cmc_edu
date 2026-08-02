// ADM-05 journey — Cấu hình ca làm: a super admin creates a shift group, adds a
// shift template to it, and saves the late/early penalty policy — the full shift
// configuration surface. Covers all five declared procedures: shift.createGroup,
// shift.listGroups (the group card appears), shift.createTemplate,
// compensationPolicy.get (loads on open) and compensationPolicy.upsert (save).
//
// The synth facility already seeds some shift groups, so this run's group is
// found by a unique name, and the template form (rendered once per group card)
// is scoped to that card before filling.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('ADM-05 journey — cấu hình ca làm (nhóm + mẫu ca + chính sách phạt)', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const groupName = `E2E ADM-05 Nhóm ${runId}`;
  const templateName = `E2E Mẫu ${runId}`;

  test('a super admin creates a shift group, a template, and saves the penalty policy', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-adm05-sa-${runId}`, roles: ['super_admin'], facilityId })),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Nhân sự', 'Ca làm việc', { role: 'super_admin' });
    await expect(page).toHaveURL(/\/admin\/shift-config/);

    // --- create a shift group (default type Kinh doanh) ---
    await page.getByLabel('Tên nhóm ca').fill(groupName);
    await page.getByRole('button', { name: 'Thêm nhóm ca' }).click();

    // The group card appears (shift.listGroups), initially with no templates.
    const groupCard = page
      .locator('div')
      .filter({ hasText: groupName })
      .filter({ has: page.getByLabel('Tên mẫu ca') })
      .last();
    await expect(groupCard).toBeVisible();
    await expect(groupCard.getByText('Chưa có mẫu ca nào.')).toBeVisible();

    // --- add a template to THIS group (the form is per-group) ---
    await groupCard.getByLabel('Tên mẫu ca').fill(templateName);
    await groupCard.getByLabel('Bắt đầu (HH:mm)').fill('08:30');
    await groupCard.getByLabel('Kết thúc (HH:mm)').fill('18:00');
    await groupCard.getByRole('button', { name: '+ Thêm mẫu ca' }).click();

    // The template now shows on the group card — the no-template line is gone.
    await expect(groupCard.getByText(templateName)).toBeVisible();
    await expect(groupCard.getByText('08:30–18:00')).toBeVisible();
    await expect(groupCard.getByText('Chưa có mẫu ca nào.')).toHaveCount(0);

    // --- save the penalty policy (on its own tab; fields are NumberInputs) ---
    // Both rates are required — the Save button stays disabled until both are set.
    await page.getByRole('button', { name: 'Chính sách phạt' }).click();
    await page.getByRole('spinbutton', { name: /Phạt mỗi phút đi muộn/ }).fill('5000');
    await page.getByRole('spinbutton', { name: /Phạt mỗi phút về sớm/ }).fill('8000');
    await page.getByRole('button', { name: 'Lưu chính sách' }).click();
    await expect(page.getByText('Đã lưu chính sách phạt.')).toBeVisible();

    await context.close();
  });
});
