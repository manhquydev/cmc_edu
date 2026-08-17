// 16-ops-meeting-doublebook — REAL-ENVIRONMENT họp PH trùng giờ (P4-03 E4) on the live VPS.
// parentMeeting.schedule ALWAYS succeeds; a same-slot double-booking returns a
// non-fatal warning string on the success payload and the dialog stays open
// with a "Đã đặt lịch — trùng giờ" banner + single "Đóng" action. This edge
// (warning UI) is separate from the happy path 10-ops-meeting.
//
// This spec provisions its OWN student + class via the real money chain
// (createLiveClass + receiptCreate → receiptApprove) — it does NOT depend on
// 02's student (10-ops-meeting already schedules the campaign student, so a
// private student keeps the row-count assertions unambiguous).

import { test, expect, type Page } from '@playwright/test';

import { addDaysToDateOnly, ictDateOnlyOf } from '@cmc/domain-time';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createLiveClass, liveStaffRoleClient } from '../../src/live/live-trcp.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrorsAll,
  runId,
  freshParentPhone,
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
    const rid = runId();
    const dbName = 'Live DB ' + rid;
    const dbPhone = freshParentPhone();

    // A private ClassBatch + a DEDICATED student keep row-count assertions
    // unambiguous vs 10-ops-meeting (which schedules the campaign student).
    // ClassBatch has no admin UI (PO-approved seed exception) → createLiveClass
    // via the live super-admin session (same as 02/03); the student then comes
    // through the real money chain (sale receiptCreate → GĐKD receiptApprove).
    const warm = await openStaffSession(browser, 'superAdmin');
    await closeRoleSession(warm);
    const liveClass = await createLiveClass({ courseName: 'Live DB Course ' + rid });
    const classBatchId = liveClass.classBatch.id;
    recordCreated(scratch, 'class-batch', 'double-book class', liveClass.classBatch.code);

    const saleClient = liveStaffRoleClient('sale');
    const receiptRes = await saleClient.finance.receiptCreate.mutate({
      studentName: dbName,
      parentPhone: dbPhone,
      parentEmail: 'live-db-' + rid + '@cmcvn.edu.vn',
      amount: 5000001,
      classBatchId,
    });
    if (receiptRes.status !== 'success') {
      throw new Error('16: receiptCreate failed: ' + receiptRes.message);
    }
    const gdkdClient = liveStaffRoleClient('giam_doc_kinh_doanh');
    const approved = await gdkdClient.finance.receiptApprove.mutate({
      receiptId: receiptRes.receipt.id,
    });
    expect(approved.receipt.status).toBe('approved');
    recordCreated(scratch, 'receipt', 'dedicated double-book receipt', receiptRes.receipt.id);
    recordCreated(scratch, 'student', 'dedicated double-book student', dbName);

    const tomorrow = addDaysToDateOnly(ictDateOnlyOf(new Date()), 1);
    const slot = tomorrow + 'T10:00';

    const gd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gd.page, scratch);
    try {
      await menuNav(gd.page, 'Tài chính & Điều hành', 'Họp sau bán', { role: 'giam_doc_kinh_doanh' });
      await expect(gd.page).toHaveURL(/\/crm\/post-sale-meeting/);

      // 1. First meeting at the slot (clean schedule → dialog auto-closes).
      await scheduleMeetingKeepOpen(gd.page, dbName, slot);
      await expect(gd.page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
      const firstRow = gd.page.getByRole('row', { name: new RegExp(dbName) });
      await expect(firstRow).toBeVisible({ timeout: 15_000 });
      await expect(firstRow.getByText('Đã đặt lịch')).toBeVisible();
      recordCreated(scratch, 'parent-meeting', 'slot-first', slot);

      // 2. Second meeting at the SAME slot → warning, dialog stays open.
      await scheduleMeetingKeepOpen(gd.page, dbName, slot);
      const warnDialog = gd.page.getByRole('dialog');
      // Title "Đã đặt lịch — trùng giờ" + description both match /trùng giờ/ — .first().
      await expect(warnDialog.getByText(/trùng giờ/i).first()).toBeVisible({ timeout: 15_000 });
      await expect(warnDialog.getByRole('button', { name: 'Đóng', exact: true })).toBeVisible();
      // The meeting IS created despite the warning (soft double-book).
      recordCreated(scratch, 'parent-meeting', 'double-book-warning', slot);
      console.log('[16-ops-meeting-doublebook] double-book warning shown, meeting created');

      // 3. Close the dialog; BOTH rows exist for the dedicated student.
      await warnDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
      await expect(gd.page.getByRole('dialog')).toHaveCount(0, { timeout: 15_000 });
      const rows = gd.page.getByRole('row', { name: new RegExp(dbName) });
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
