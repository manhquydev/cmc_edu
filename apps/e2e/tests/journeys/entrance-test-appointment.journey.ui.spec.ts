// P4-04 journey — the entrance-test appointment lifecycle. A sale creates a lead
// through the real CRM UI, moves it to "đã liên hệ", schedules two entrance
// tests (testAppointment.schedule), marks one as a no-show
// (testAppointment.noShow) and completes the other (testAppointment.complete).
// The opportunity's appointment list (testAppointment.forOpportunity) is the
// evidence surface throughout.
//
// Ordering is forced by the server, not by preference (apps/api/src/appointment/
// router.ts): scheduling at O2_CONTACTED auto-advances the opportunity to
// O3_TEST_SCHEDULED, and completing at O3_TEST_SCHEDULED auto-advances it to
// O4_TESTED — at which point `canScheduleTest` is false and the "Đặt lịch test"
// button is gone. So BOTH appointments must be scheduled before either is
// completed, and the completion is left for last.

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

test.describe('P4-04 journey — test đầu vào: đặt lịch → vắng mặt → hoàn thành', () => {
  test.use({ baseURL: 'http://localhost:4173' });
  test.setTimeout(120_000);

  const runId = randomUUID().slice(0, 8);
  const leadName = `E2E P4-04 KH ${runId}`;
  // Distinct slots so each appointment row is addressable by its rendered time.
  // The list renders them as "HH:mm dd/MM/yyyy" (fmtAppointmentTime, ICT).
  const slotDone = '2026-08-03T10:00';
  const slotNoShow = '2026-08-03T14:00';
  const rowDone = '10:00 03/08/2026';
  const rowNoShow = '14:00 03/08/2026';

  test('a sale schedules two entrance tests, marks one no-show and completes the other', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p404-sale-${runId}`, roles: ['sale'], facilityId })),
    );
    await page.goto('/cockpit');
    await menuNav(page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
    await expect(page).toHaveURL(/\/crm/);

    // --- create the lead (opens at O1_LEAD) ---
    await page.getByRole('button', { name: 'Thêm cơ hội' }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.getByLabel('Họ tên').fill(leadName);
    await createDialog.getByLabel('Số điện thoại').fill(`09${runId.replace(/\D/g, '').padEnd(8, '7').slice(0, 8)}`);
    await createDialog.getByRole('button', { name: 'Tạo' }).click();
    await expect(createDialog).toHaveCount(0);

    // --- open its detail page ---
    await page.getByText(leadName, { exact: true }).click();
    await expect(page).toHaveURL(/\/crm\/opportunities\//);

    // --- O1_LEAD → O2_CONTACTED (schedule is rejected at O1) ---
    // PRODUCT DEFECT this journey exposed (2026-07-26 — recorded, NOT fixed here:
    // this plan only measures). opportunity-detail.tsx renders from
    // `crm.opportunityGet` (line 80), but `advanceMutation.onSuccess` invalidates
    // only `crm.opportunityList` (line 95). Nothing invalidates the query the page
    // actually reads, so after a successful advance the stage badge and the
    // action buttons keep showing the OLD stage indefinitely — the first run of
    // this spec waited 120s and "Đặt lịch test" never appeared, even though the
    // server had advanced the opportunity. A reload is the only way the user sees
    // the new stage.
    //
    // The reload here is that workaround. It waits for the mutation's own
    // response first: reloading straight after the click aborts the in-flight
    // POST, which is a race in the test, not a second product bug.
    await expect(page.getByText('Cơ hội — Tiếp cận')).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('crm.opportunityAdvance') && r.status() === 200),
      page.getByRole('button', { name: 'Chuyển lên' }).click(),
    ]);
    await page.reload();
    await expect(page.getByText('Cơ hội — Đã liên hệ')).toBeVisible();

    // --- schedule BOTH tests before completing either (see header note) ---
    await scheduleTest(page, slotDone);
    await expect(appointmentRowStatus(page, rowDone, 'Đã đặt lịch')).toBeVisible();
    await scheduleTest(page, slotNoShow);
    await expect(appointmentRowStatus(page, rowNoShow, 'Đã đặt lịch')).toBeVisible();

    // --- mark the 14:00 one as a no-show ---
    // Each action waits for its own response before moving on. The status text
    // ("Hoàn thành"/"Vắng mặt") is ALSO the label of the row's action buttons, so
    // asserting it while the row is still `scheduled` would pass vacuously off the
    // button — the badge is only unambiguous once the buttons are gone. Hence:
    // act, wait for the server, and assert the badges after the reload below.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('testAppointment.noShow') && r.status() === 200),
      appointmentRowActions(page, rowNoShow).getByRole('button', { name: 'Vắng mặt' }).click(),
    ]);

    // --- complete the 10:00 one (advances the opportunity to O4_TESTED) ---
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('testAppointment.complete') && r.status() === 200),
      appointmentRowActions(page, rowDone).getByRole('button', { name: 'Hoàn thành' }).click(),
    ]);
    // Completing at O3_TEST_SCHEDULED auto-advances the opportunity to O4_TESTED,
    // so the scheduling action is no longer offered. Reload first: this is the
    // SAME stale-view defect noted above, at its second call site —
    // `useTestAppointmentActions` invalidates `crm.opportunityList` and
    // `testAppointment.forOpportunity` but never `crm.opportunityGet`, which is
    // what renders the stage badge and these stage-gated buttons. Without the
    // reload the page still offers "Đặt lịch test" for an opportunity the server
    // has already moved past it.
    await page.reload();
    // The action buttons carry the SAME labels as the status badges ("Hoàn thành"
    // / "Vắng mặt"), so a per-row text assertion alone passes vacuously off a
    // still-`scheduled` row's own button — verified: skipping the no-show action
    // left this spec green until these two count assertions were added. Buttons
    // render only while a row is `scheduled`, so requiring zero of them across the
    // list proves BOTH rows really left that state, and only then is the badge
    // text below unambiguous.
    // Anchor on presence BEFORE asserting absence. Straight after a reload a
    // `toHaveCount(0)` is satisfied by "not rendered yet", which made this spec
    // pass even with the no-show action removed — the absence only means anything
    // once the list is on screen.
    await expect(page.getByText(rowNoShow)).toBeVisible();
    await expect(page.getByText(rowDone)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hoàn thành' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vắng mặt' })).toHaveCount(0);
    await expect(appointmentRowStatus(page, rowNoShow, 'Vắng mặt')).toBeVisible();
    await expect(appointmentRowStatus(page, rowDone, 'Hoàn thành')).toBeVisible();
    await expect(page.getByText('Cơ hội — Đã kiểm tra')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đặt lịch test' })).toHaveCount(0);

    await context.close();
  });
});

/** Opens the "Đặt lịch test" dialog, sets the slot and submits. */
async function scheduleTest(page: import('@playwright/test').Page, slotLocal: string): Promise<void> {
  await page.getByRole('button', { name: 'Đặt lịch test' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Thời gian test').fill(slotLocal);
  await dialog.getByRole('button', { name: 'Đặt lịch' }).click();
  await expect(dialog).toHaveCount(0);
}

/** The action area of the appointment row for a given rendered time. Rows are
 *  flex containers, not table rows, so the row is the innermost div that holds
 *  BOTH the time text and the row's own action buttons — requiring the button is
 *  what separates the row from the inner time+badge stack nested inside it. */
function appointmentRowActions(page: import('@playwright/test').Page, timeText: string) {
  return page
    .locator('div')
    .filter({ hasText: timeText })
    .filter({ has: page.getByRole('button', { name: 'Hoàn thành' }) })
    .last();
}

/** The same row addressed for reading its status badge. Used after an action,
 *  when the buttons are gone (they only render while status is `scheduled`). */
function appointmentRowStatus(
  page: import('@playwright/test').Page,
  timeText: string,
  status: string,
) {
  return page.locator('div').filter({ hasText: timeText }).filter({ hasText: status }).last();
}
