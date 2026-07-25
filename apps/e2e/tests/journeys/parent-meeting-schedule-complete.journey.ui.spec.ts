// P4-03 journey — the post-sale parent-meeting lifecycle. A GĐKD schedules a
// meeting for a student (parentMeeting.schedule), completes it with a result
// (parentMeeting.complete), then schedules a second and cancels it
// (parentMeeting.cancel). The list (parentMeeting.list) is the evidence surface
// throughout.
//
// The student is a precondition, not the behavior under test: there is no
// `student.create` UI mutation anywhere (a student only ever comes into
// existence via the receipt money-chain), and the schedule dialog's StudentPicker
// only searches `student.lookup` by name — so one is seeded directly, the same
// way this suite seeds every other fixture row. All three meeting transitions
// are driven through the real admin UI.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { seedStudent } from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P4-03 journey — họp phụ huynh: đặt lịch → hoàn thành → hủy', () => {
  test.use({ baseURL: 'http://localhost:4173' });
  test.setTimeout(120_000);

  const runId = randomUUID().slice(0, 8);
  const studentName = `E2E P4-03 HV ${runId}`;

  test('a director schedules a parent meeting, completes it, then schedules and cancels another', async ({ browser }) => {
    // --- precondition: a student the picker can find by name ---
    await seedStudent({ facilityId, studentName });

    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p403-gd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    await page.goto('/cockpit');
    await menuNav(page, 'Tài chính & Điều hành', 'Họp sau bán', { role: 'giam_doc_kinh_doanh' });
    await expect(page).toHaveURL(/\/crm\/post-sale-meeting/);

    // --- schedule the first meeting ---
    // A clean (non-double-booked) schedule auto-closes the dialog on success;
    // only a same-slot warning keeps it open with a "Đóng" button.
    await scheduleMeeting(page, studentName, '2026-08-01T09:00');
    const firstRow = page.getByRole('row', { name: new RegExp(studentName) });
    await expect(firstRow).toBeVisible();
    await expect(firstRow.getByText('Đã đặt lịch')).toBeVisible();

    // --- complete it with a result ---
    await firstRow.getByRole('button', { name: 'Hoàn thành' }).click();
    const completeDialog = page.getByRole('dialog');
    await completeDialog.getByLabel('Kết quả buổi họp').fill('PH đồng ý lộ trình học — E2E');
    await completeDialog.getByRole('button', { name: 'Xác nhận' }).click();
    // The row's status flips to done; its "Hoàn thành" action button is gone
    // (actions only render for scheduled rows) but the status badge reads it.
    await expect(
      page.getByRole('row', { name: new RegExp(studentName) }).filter({ hasText: 'Hoàn thành' }),
    ).toBeVisible();

    // --- schedule a second meeting (different slot) and cancel it ---
    await scheduleMeeting(page, studentName, '2026-08-02T14:00');
    // Two rows now share the student name; the scheduled one carries the cancel
    // action (done rows render no actions).
    const scheduledRow = page
      .getByRole('row', { name: new RegExp(studentName) })
      .filter({ hasText: 'Đã đặt lịch' });
    await expect(scheduledRow).toBeVisible();
    // Cancel is a direct mutation (no confirm dialog).
    await scheduledRow.getByRole('button', { name: 'Hủy' }).click();
    // No scheduled row for this student remains — it is cancelled.
    await expect(
      page.getByRole('row', { name: new RegExp(studentName) }).filter({ hasText: 'Đã đặt lịch' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('row', { name: new RegExp(studentName) }).filter({ hasText: 'Đã hủy' }),
    ).toBeVisible();

    await context.close();
  });
});

/** Opens the "Đặt lịch họp" dialog, picks the student by name, sets the slot,
 *  and submits. Returns once the dialog has auto-closed on a clean schedule. */
async function scheduleMeeting(
  page: import('@playwright/test').Page,
  studentName: string,
  slotLocal: string,
): Promise<void> {
  await page.getByRole('button', { name: 'Đặt lịch họp' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Học viên').fill(studentName);
  // The picker renders each match as a clickable div showing the full name.
  await dialog.getByText(studentName, { exact: true }).click();
  await dialog.getByLabel('Thời gian họp').fill(slotLocal);
  await dialog.getByRole('button', { name: 'Đặt lịch' }).click();
  await expect(dialog).toHaveCount(0);
}
