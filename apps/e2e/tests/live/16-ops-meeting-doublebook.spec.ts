// 16-ops-meeting-doublebook — REAL-ENVIRONMENT họp PH trùng giờ (P4-03 E4) on the live VPS.
// parentMeeting.schedule ALWAYS succeeds; a same-slot double-booking returns a
// non-fatal warning string on the success payload and the dialog stays open
// with a "Đã đặt lịch — trùng giờ" banner + single "Đóng" action. This edge
// (warning UI) is separate from the happy path 10-ops-meeting.
//
// Precondition: 02 provisioned a student (state.contactName).

import { test, expect, type Page } from '@playwright/test';

import { addDaysToDateOnly, ictDateOnlyOf } from '@cmc/domain-time';

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

/** Opens "Đặt lịch họp", picks the student, sets the slot, submits. Returns
 *  WITHOUT waiting for the dialog to close — the caller decides whether the
 *  dialog auto-closes (clean) or stays open (double-book warning). */
async function scheduleMeetingKeepOpen(page: Page, studentName: string, slotLocal: string): Promise<void> {
  await page.getByRole('button', { name: 'Đặt lịch họp' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Học viên').fill(studentName);
  await dialog.getByText(studentName, { exact: true }).click();
  await dialog.getByLabel('Thời gian họp').fill(slotLocal);
  await dialog.getByRole('button', { name: 'Đặt lịch' }).click();
}

test.describe('16-ops-meeting-doublebook — họp trùng giờ: warning mềm, vẫn tạo (live)', () => {
  test('đặt họp thứ 2 cùng giờ → dialog giữ mở + banner trùng giờ + Đóng', async ({ browser }) => {
    const state = readLiveState();
    const studentName = state.contactName;
    test.skip(!studentName, '02 did not provision a student — meeting needs a real student.');

    const tomorrow = addDaysToDateOnly(ictDateOnlyOf(new Date()), 1);
    const slot = tomorrow + 'T10:00';

    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      await menuNav(gd.page, 'Tài chính & Điều hành', 'Họp sau bán', { role: 'giam_doc_kinh_doanh' });
      await expect(gd.page).toHaveURL(/\/crm\/post-sale-meeting/);

      // 1. First meeting at the slot (clean schedule → dialog auto-closes).
      await scheduleMeetingKeepOpen(gd.page, studentName!, slot);
      await expect(gd.page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
      const firstRow = gd.page.getByRole('row', { name: new RegExp(studentName!) });
      await expect(firstRow).toBeVisible({ timeout: 15_000 });
      await expect(firstRow.getByText('Đã đặt lịch')).toBeVisible();
      recordCreated(scratch, 'parent-meeting', 'slot-first', slot);

      // 2. Second meeting at the SAME slot → warning, dialog stays open.
      await scheduleMeetingKeepOpen(gd.page, studentName!, slot);
      const warnDialog = gd.page.getByRole('dialog');
      await expect(warnDialog.getByText(/trùng giờ/i)).toBeVisible({ timeout: 15_000 });
      await expect(warnDialog.getByRole('button', { name: 'Đóng', exact: true })).toBeVisible();
      // The meeting IS created despite the warning (soft double-book).
      recordCreated(scratch, 'parent-meeting', 'double-book-warning', slot);
      console.log('[16-ops-meeting-doublebook] double-book warning shown, meeting created');

      // 3. Close the dialog; both rows exist for the student.
      await warnDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
      await expect(gd.page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
      const rows = gd.page.getByRole('row', { name: new RegExp(studentName!) });
      await expect(rows).toHaveCount(2, { timeout: 15_000 });
      console.log('[16-ops-meeting-doublebook] two scheduled meetings visible in the list');
    } finally {
      await closeRoleSession(gd);
    }

    await assertNoErrorsAll(scratch, 'meeting double-book edge');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
