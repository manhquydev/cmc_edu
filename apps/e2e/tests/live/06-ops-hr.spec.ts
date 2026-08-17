// 06-ops-hr — REAL-ENVIRONMENT HR ops smoke on the live VPS (deverp/devlms).
// Covers flows the 00-05 campaign did not: P3-01 chấm công (check-in punch),
// P3-03 đăng ký công ca (shift registration by a sale), P3-04 duyệt ca (approve
// by GĐKD). All sessions are REAL UI logins via live-auth (staff created by
// 00-setup-roles with temp passwords; first login rotates them).

import { test, expect } from '@playwright/test';
import { addDaysToDateOnly, ictDateOnlyOf } from '@cmc/domain-time';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { liveRunId } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrorsAll,
} from './live-spec-utils.js';

const scratch = newScratch();
const tomorrow = addDaysToDateOnly(ictDateOnlyOf(new Date()), 1);

test.describe('06-ops-hr — chấm công + đăng ký ca + duyệt ca (live)', () => {
  test('giao_vien chấm công; sale đăng ký ca; GĐKD duyệt', async ({ browser }) => {
    const rid = liveRunId();
    const groupName = `Ops Ca KD ${rid}`;
    const templateName = `Ops Ca ${rid}`;

    // 1. giao_vien: check-in punch (P3-01)
    const gv = await openStaffSession(browser, 'giao_vien');
    attachErrors(gv.page, scratch);
    try {
      await menuNav(gv.page, 'Nhân sự', 'Chấm công', { role: 'giao_vien' });
      await expect(gv.page).toHaveURL(/\/hr\/checkin/);
      const content = gv.page.locator('main.console-main');
      await content.getByRole('button', { name: 'Chấm công', exact: true }).click();
      await expect(content.getByText('Đã ghi nhận', { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(content.getByRole('button', { name: 'Đã chấm công ✓', exact: true })).toBeVisible();
      recordCreated(scratch, 'checkin', 'punch', 'ok');
      console.log('[06-ops-hr] check-in punch OK');
    } finally {
      await closeRoleSession(gv);
    }

    // 2. super_admin: create Kinh doanh shift group + template
    const sa = await openStaffSession(browser, 'superAdmin');
    attachErrors(sa.page, scratch);
    try {
      await menuNav(sa.page, 'Nhân sự', 'Ca làm việc', { role: 'super_admin' });
      await sa.page.getByLabel('Tên nhóm ca').fill(groupName);
      await sa.page.getByRole('button', { name: 'Thêm nhóm ca' }).click();
      const groupCard = sa.page
        .locator('div')
        .filter({ hasText: groupName })
        .filter({ has: sa.page.getByLabel('Tên mẫu ca') })
        .last();
      await expect(groupCard).toBeVisible();
      await groupCard.getByLabel('Tên mẫu ca').fill(templateName);
      await groupCard.getByLabel('Bắt đầu (HH:mm)').fill('08:00');
      await groupCard.getByLabel('Kết thúc (HH:mm)').fill('17:00');
      await groupCard.getByRole('button', { name: '+ Thêm mẫu ca' }).click();
      await expect(groupCard.getByText(templateName)).toBeVisible({ timeout: 10_000 });
      recordCreated(scratch, 'shift-group', 'name', groupName);
      console.log('[06-ops-hr] shift group+template created');
    } finally {
      await closeRoleSession(sa);
    }

    // 3. sale: register the shift (P3-03)
    const sale = await openStaffSession(browser, 'sale');
    attachErrors(sale.page, scratch);
    let regUrl = '';
    try {
      await sale.page.goto('/hr/shifts/new');
      await expect(sale.page).toHaveURL(/\/hr\/shifts\/new$/);
      await sale.page.getByRole('combobox', { name: /Nhóm ca/ }).click();
      await sale.page.getByRole('option', { name: new RegExp(groupName) }).click();
      await sale.page.getByLabel('Từ ngày').fill(tomorrow);
      await sale.page.getByLabel('Đến ngày').fill(tomorrow);
      await sale.page.getByRole('checkbox', { name: new RegExp(`${tomorrow} ${templateName}`) }).check();
      await sale.page.getByRole('button', { name: 'Gửi đăng ký' }).click();
      await expect(sale.page).toHaveURL(/\/hr\/shifts\/[0-9a-f-]{36}$/i, { timeout: 15_000 });
      regUrl = sale.page.url();
      recordCreated(scratch, 'shift-reg', 'url', regUrl);
      console.log('[06-ops-hr] sale registered shift');
    } finally {
      await closeRoleSession(sale);
    }

    // 4. GĐKD: approve the registration (P3-04)
    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      const regId = regUrl.match(/\/hr\/shifts\/([0-9a-f-]{36})/i)?.[1]!;
      await gd.page.goto(`/go/shiftRegistration/${regId}`);
      await expect(gd.page).toHaveURL(new RegExp(`/hr/shifts/${regId}$`), { timeout: 15_000 });
      await expect(gd.page.getByRole('button', { name: 'Duyệt', exact: true })).toBeVisible({ timeout: 15_000 });
      await gd.page.getByRole('button', { name: 'Duyệt', exact: true }).click();
      const approveDialog = gd.page.getByRole('alertdialog');
      await approveDialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
      await expect(gd.page.getByText('Đã duyệt (approved).')).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'shift-approve', 'regId', regId);
      console.log('[06-ops-hr] GĐKD approved shift');
    } finally {
      await closeRoleSession(gd);
    }

    await assertNoErrorsAll(scratch, 'HR ops smoke');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});