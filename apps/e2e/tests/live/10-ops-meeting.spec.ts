// 10-ops-meeting — REAL-ENVIRONMENT họp phụ huynh (P4-03) on the live VPS.
// GĐKD schedules a parent meeting for the student provisioned by
// 02-receipt-approve-enroll (student.lookup by displayed name — never an id),
// completes it with a result, then schedules a second meeting and cancels it.
// The list (parentMeeting.list) is the evidence surface throughout; every
// transition is driven through the real /crm/post-sale-meeting UI.
//
// Graceful skip: when 02 did not provision a student (or the campaign started
// here), the spec skips — coordinator's decision.

import { test, expect, type Page } from '@playwright/test';

import { addDaysToDateOnly, ictDateOnlyOf } from '@cmc/domain-time';
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { readLiveState } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrorsAll,
} from './live-spec-utils.js';

const scratch = newScratch();

/** Opens the "Đặt lịch họp" dialog, picks the student by name, sets the slot
 *  (YYYY-MM-DDTHH:mm), and submits. Returns once the dialog auto-closed. */
async function scheduleMeeting(page: Page, studentName: string, slotLocal: string): Promise<void> {
  await page.getByRole('button', { name: 'Đặt lịch họp' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Học viên').fill(studentName);
  await dialog.getByText(studentName, { exact: true }).click();
  await dialog.getByLabel('Thời gian họp').fill(slotLocal);
  await dialog.getByRole('button', { name: 'Đặt lịch' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 15_000 });
}

test.describe('10-ops-meeting — họp phụ huynh: đặt lịch → hoàn thành → hủy (live)', () => {
  test('GĐKD đặt lịch họp PH, hoàn thành, đặt lịch khác rồi hủy', async ({ browser }) => {
    const state = readLiveState();
    const studentName = state.contactName;
    test.skip(!studentName, '02 did not provision a student — meeting needs a real student.');

    // Future slot: tomorrow 09:00 / 14:00 ICT (DateTimeField local format).
    const tomorrow = addDaysToDateOnly(ictDateOnlyOf(new Date()), 1);
    const slot1 = tomorrow + 'T09:00';
    const slot2 = tomorrow + 'T14:00';

    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      await menuNav(gd.page, 'Tài chính & Điều hành', 'Họp sau bán', { role: 'giam_doc_kinh_doanh' });
      await expect(gd.page).toHaveURL(/\/crm\/post-sale-meeting/);

      // --- schedule the first meeting ---
      await scheduleMeeting(gd.page, studentName!, slot1);
      const firstRow = gd.page.getByRole('row', { name: new RegExp(escapeRegExp(studentName!)) });
      await expect(firstRow).toBeVisible({ timeout: 15_000 });
      await expect(firstRow.getByText('Đã đặt lịch')).toBeVisible();
      recordCreated(scratch, 'parent-meeting', 'slot1', slot1);

      // --- complete it with a result ---
      await firstRow.getByRole('button', { name: 'Hoàn thành' }).click();
      const completeDialog = gd.page.getByRole('dialog');
      await completeDialog.getByLabel('Kết quả buổi họp').fill('PH đồng ý lộ trình học — live UAT');
      await completeDialog.getByRole('button', { name: 'Xác nhận' }).click();
      await expect(
        gd.page.getByRole('row', { name: new RegExp(escapeRegExp(studentName!)) }).filter({ hasText: 'Hoàn thành' }),
      ).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'parent-meeting', 'slot1-completed', slot1);
      console.log('[10-ops-meeting] first meeting scheduled + completed');

      // --- schedule a second meeting and cancel it ---
      await scheduleMeeting(gd.page, studentName!, slot2);
      const scheduledRow = gd.page
        .getByRole('row', { name: new RegExp(escapeRegExp(studentName!)) })
        .filter({ hasText: 'Đã đặt lịch' });
      await expect(scheduledRow).toBeVisible({ timeout: 15_000 });
      await scheduledRow.getByRole('button', { name: 'Hủy' }).click();
      await expect(
        gd.page.getByRole('row', { name: new RegExp(escapeRegExp(studentName!)) }).filter({ hasText: 'Đã đặt lịch' }),
      ).toHaveCount(0, { timeout: 15_000 });
      await expect(
        gd.page.getByRole('row', { name: new RegExp(escapeRegExp(studentName!)) }).filter({ hasText: 'Đã hủy' }),
      ).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'parent-meeting', 'slot2-cancelled', slot2);
      console.log('[10-ops-meeting] second meeting cancelled');
    } finally {
      await closeRoleSession(gd);
    }

    await assertNoErrorsAll(scratch, 'parent meeting lifecycle');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
