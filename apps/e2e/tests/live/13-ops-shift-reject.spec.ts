// 13-ops-shift-reject — REAL-ENVIRONMENT Từ chối đăng ký ca (P3-07) on the live VPS.
// Happy path (06-ops-hr) only approved; the REJECT leg with required reason
// (min 3 chars) is a separate server-guarded transition (shift.reject):
//   sale registers a shift for tomorrow → GĐKD opens /go/shiftRegistration/:id
//   → "Từ chối" → dialog "Từ chối đăng ký ca" (lý do ≥3 ký tự) → status "Đã từ chối".
// Group/template creation is the same real UI as 06.

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
// Use day +2, not tomorrow: 06-ops-hr already registered the SAME sale for
// tomorrow (overlap guard: "already have a submitted or approved registration
// overlapping this date range" — seen on the first live run).
const tomorrow = addDaysToDateOnly(ictDateOnlyOf(new Date()), 2);

test.describe('13-ops-shift-reject — Từ chối đăng ký ca kèm lý do (P3-07, live)', () => {
  test('sale đăng ký ca; GĐKD Từ chối kèm lý do → trạng thái Đã từ chối', async ({ browser }) => {
    const rid = liveRunId();
    const groupName = 'Reject Ca KD ' + rid;
    const templateName = 'Reject Ca ' + rid;

    // 1. super_admin: create Kinh doanh shift group + template (same UI as 06).
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
      console.log('[13-ops-shift-reject] shift group+template created');
    } finally {
      await closeRoleSession(sa);
    }

    // 2. sale: register the shift (P3-03).
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
      await sale.page.getByRole('checkbox', { name: new RegExp(tomorrow + ' ' + templateName) }).check();
      await sale.page.getByRole('button', { name: 'Gửi đăng ký' }).click();
      await expect(sale.page).toHaveURL(/\/hr\/shifts\/[0-9a-f-]{36}$/i, { timeout: 15_000 });
      regUrl = sale.page.url();
      recordCreated(scratch, 'shift-reg', 'url', regUrl);
      console.log('[13-ops-shift-reject] sale registered shift');
    } finally {
      await closeRoleSession(sale);
    }

    // 3. GĐKD: reject with a reason (P3-07) — the anti-happy path.
    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      const regId = regUrl.match(/\/hr\/shifts\/([0-9a-f-]{36})/i)?.[1]!;
      await gd.page.goto('/go/shiftRegistration/' + regId);
      await expect(gd.page).toHaveURL(new RegExp('/hr/shifts/' + regId + '$'), { timeout: 15_000 });
      await expect(gd.page.getByRole('button', { name: 'Từ chối', exact: true })).toBeVisible({ timeout: 15_000 });
      await gd.page.getByRole('button', { name: 'Từ chối', exact: true }).click();
      const rejectDialog = gd.page.getByRole('dialog', { name: 'Từ chối đăng ký ca' });
      // Lý do < 3 ký tự → nút Từ chối disabled (edge: validation).
      await rejectDialog.getByLabel('Lý do từ chối').fill('x');
      await expect(rejectDialog.getByRole('button', { name: 'Từ chối', exact: true })).toBeDisabled();
      await rejectDialog.getByLabel('Lý do từ chối').fill('Trùng lịch đào tạo — live UAT');
      await Promise.all([
        gd.page.waitForResponse((r) => r.url().includes('shift.reject') && r.status() === 200),
        rejectDialog.getByRole('button', { name: 'Từ chối', exact: true }).click(),
      ]);
      await expect(gd.page.getByText('Đã từ chối', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'shift-reject', 'regId', regId);
      console.log('[13-ops-shift-reject] GĐKD rejected shift with reason');
    } finally {
      await closeRoleSession(gd);
    }

    await assertNoErrorsAll(scratch, 'shift reject edge');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
