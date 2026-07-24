// P3-02 journey — Duyệt phiếu chấm công offsite theo track (/hr/checkin,
// same route as P3-01's punch — the page's own tabs distinguish "tự chấm
// công" from the approval inbox).
//
// Manifest cross-check (step 2 of phase-05-journey-10-luong-loi.md):
// flow-manifest.ts's P3-02 entry expects
// `manualPunch.approve, manualPunch.reject, manualPunch.resubmit,
// manualPunch.list` at `/hr/checkin` — this journey drives `list` (both
// scopes) and `approve` for real; `sale` creates the offsite ticket as an
// automatic side effect of `checkInOut.punch` (checkin/router.ts's own
// `ensureDayTicket`, ADR 0043 — there is no separate "create a manual
// ticket" mutation left to call, `manualPunch.create` was removed).
//
// Negation mechanism (D5): `findInList.assertAbsent`, checked against the
// REAL track-filtering logic in `checkin/router.ts` (`manualPunch.list`,
// lines ~416-436, read in full before writing this): a director's `inbox`
// scope filters `ManualAttendanceTicket` by `appUser.roles hasSome
// trackRoles`, where `trackRoles` is derived from WHICH director role the
// caller holds — `giam_doc_kinh_doanh` -> `['sale']`,
// `giam_doc_dao_tao` -> `['giao_vien']`. A `sale`-owned ticket therefore
// matches ONLY the GĐKD track query; `giam_doc_dao_tao`'s own inbox query
// (`trackRoles: ['giao_vien']`) can never match it, regardless of the
// ticket's status — this is the negation asserted below, checked while the
// ticket is still `pending` (before GĐKD ever touches it), so the absence
// cannot be mistaken for "not created yet".
//
// Two setup prerequisites this journey drives through REAL admin UI rather
// than a DB seed, because a real UI path for both genuinely exists (grepped
// before deciding, per this phase's own diligence bar):
//   1. `checkInOut.punch` only records `withinNetwork: false` when an active
//      `FacilityNetwork` row exists and the caller's IP does not match it —
//      `/admin/network-ip` (super_admin, `facilityNetwork.manage`) is a real
//      CRUD screen with a create form and an activate ("Bật") toggle.
//   2. `ensureDayTicket` only creates a ticket when the puncher has a
//      registered shift TODAY — `/admin/shift-config` (super_admin,
//      `compensationPolicy.manage` nav gate) is a real screen that creates
//      `ShiftGroup`/`ShiftTemplate` rows via `shift.createGroup`/
//      `createTemplate`.
// The ONE piece neither role's real UI can produce is the ShiftRegistration
// ENTRY itself for TODAY: `shift.submit` deliberately rejects a non-future
// `fromDate` (apps/api/src/shift/router.ts:204-207, a deliberate policy
// guard, not an unbuilt screen) — no real staff session can register a shift
// for the same day they punch in. `seedApprovedShiftRegistration` (db.ts,
// already established for the same reason by earlier HR-remediation specs)
// is reused here for exactly that one seam; the ShiftGroup/ShiftTemplate ids
// it needs are read back by their real, UI-created NAMES
// (`findShiftTemplateByNames`), never invented.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { ictDateOnlyOf } from '@cmc/domain-time';
import { mintStaffCookie } from '../../src/session-injection.js';
import { seedApprovedShiftRegistration, findShiftTemplateByNames, findAppUserByUserId } from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P3-02 journey — duyệt phiếu chấm công offsite theo track', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('sale punches offsite (real ticket created), GĐĐT never sees it in inbox, a real GĐKD approves it', async ({
    browser,
  }) => {
    const groupName = `E2E P3-02 Group ${randomUUID().slice(0, 8)}`;
    const templateName = `E2E P3-02 Template ${randomUUID().slice(0, 8)}`;
    const cidrLabel = `E2E P3-02 Offsite ${randomUUID().slice(0, 8)}`;
    const saleFullName = `E2E P3-02 Sale ${randomUUID().slice(0, 8)}`;

    // --- super_admin: real UI setup (shift catalog + offsite network range) ---
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const adminCookie = mintStaffCookie({
      userId: `e2e-p302-admin-${randomUUID().slice(0, 8)}`,
      roles: ['super_admin'],
      facilityId,
    });
    await adminContext.addCookies(cookiePair(STAFF_COOKIE_NAME, adminCookie));
    await adminPage.goto('/cockpit');

    await menuNav(adminPage, 'Quản trị', 'Ca làm việc', { role: 'super_admin' });
    await expect(adminPage).toHaveURL(/\/admin\/shift-config/);
    await adminPage.getByLabel('Tên nhóm ca').fill(groupName);
    await adminPage.getByRole('button', { name: 'Thêm nhóm ca' }).click();
    await expect(adminPage.getByText(groupName)).toBeVisible();

    await adminPage.getByLabel('Tên mẫu ca').fill(templateName);
    await adminPage.getByLabel('Bắt đầu (HH:mm)').fill('08:00');
    await adminPage.getByLabel('Kết thúc (HH:mm)').fill('17:00');
    await adminPage.getByRole('button', { name: '+ Thêm mẫu ca' }).click();
    await expect(adminPage.getByText(templateName)).toBeVisible();

    await menuNav(adminPage, 'Quản trị', 'IP mạng', { role: 'super_admin' });
    await expect(adminPage).toHaveURL(/\/admin\/network-ip/);
    await adminPage.getByRole('button', { name: 'Thêm dải mạng' }).click();
    // Astryx's Dialog is native-`<dialog>`-based (network-ip.tsx's own
    // TODO(astryx-review) comment) and keeps BOTH the create and edit
    // dialogs mounted in the DOM regardless of `isOpen` (only visually
    // hidden), so an unscoped `getByLabel('CIDR')` is ambiguous against the
    // (always-present, empty) edit-dialog form. `role="dialog"` is the
    // element's IMPLICIT native role (no literal `role` attribute to match
    // via `[role="dialog"]`), so scope by the tag itself + visible text.
    const createDialog = adminPage.locator('dialog').filter({ hasText: 'Thêm dải mạng' });
    // Deliberately does NOT match loopback (127.0.0.1/::1) — see db.ts's
    // `seedFacilityNetwork` header for the same finding this real-UI create
    // relies on: an e2e HTTP client always hits the api server from loopback.
    await createDialog.getByLabel('CIDR').fill('10.0.0.0/24');
    await createDialog.getByLabel('Nhãn').fill(cidrLabel);
    await createDialog.getByRole('button', { name: 'Tạo', exact: true }).click();
    const networkRow = await findInList(adminPage, (text) => text.includes(cidrLabel));
    // PO decision (network-router.ts): a new range defaults to `isActive:
    // false` — must be explicitly turned on, same as a real admin would.
    await networkRow.getByRole('button', { name: 'Bật' }).click();
    await expect(adminPage.getByText('Đang bật').first()).toBeVisible();
    await adminContext.close();

    // --- sale's staff identity: real /admin/users super_admin UI
    // (createStaffViaAdminUi), same as every other journey in this suite.
    // `roleLabels: ['Sale']` is NOT cosmetic here — unlike checkIn.punch's own
    // permission gate (cookie-only), `manualPunch.list`'s track filter reads
    // the ticket owner's `AppUser.roles` DB column directly
    // (`appUser: { roles: { hasSome: trackRoles } }`, checkin/router.ts:~432)
    // to decide which director's inbox a ticket belongs to — so the seeded
    // AppUser row must actually carry `sale` in that column or the ticket
    // would match neither track's inbox query. ---
    const saleUserId = `e2e-p302-sale-${randomUUID().slice(0, 8)}`;
    await createStaffViaAdminUi(browser, {
      facilityId,
      userId: saleUserId,
      fullName: saleFullName,
      position: 'sale',
      roleLabels: ['Sale'],
    });
    const sale = await findAppUserByUserId({ facilityId, userId: saleUserId });
    if (!sale) {
      throw new Error(
        `P3-02 setup: no AppUser found for userId "${saleUserId}" after createStaffViaAdminUi — ` +
          'creation did not persist as expected.',
      );
    }
    // --- today's shift registration (the one seam with no real same-day UI
    // path — see file header) ---
    const catalog = await findShiftTemplateByNames({ facilityId, groupName, templateName });
    if (!catalog) {
      throw new Error(
        `P3-02 setup: ShiftGroup/ShiftTemplate "${groupName}"/"${templateName}" not found after the real ` +
          '/admin/shift-config create — the UI create likely failed silently.',
      );
    }
    await seedApprovedShiftRegistration({
      facilityId,
      appUserId: sale.id,
      shiftGroupId: catalog.shiftGroupId,
      shiftTemplateId: catalog.shiftTemplateId,
      dates: [ictDateOnlyOf(new Date())],
    });

    // --- sale: real punch -> offsite + hasShift -> reason required -> ticket ---
    const saleContext = await browser.newContext();
    const salePage = await saleContext.newPage();
    const saleCookie = mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId });
    await saleContext.addCookies(cookiePair(STAFF_COOKIE_NAME, saleCookie));
    await salePage.goto('/cockpit');

    await menuNav(salePage, 'Nhân sự', 'Chấm công', { role: 'sale' });
    await expect(salePage).toHaveURL(/\/hr\/checkin/);
    // Scoped to the content area (`.sh-main`) — the side-nav's own "Chấm
    // công" child entry (just clicked by menuNav above) carries the exact
    // same accessible name as this page's punch action button.
    const saleContent = salePage.locator('.sh-main');
    await saleContent.getByRole('button', { name: 'Chấm công', exact: true }).click();

    await expect(salePage.getByText('Ngoài mạng cơ sở — cần nhập lý do')).toBeVisible();
    // `exact: true`: the always-mounted (native-`<dialog>`-based, same as
    // network-ip.tsx) ResubmitDialog's own TextArea is labeled "Lý do gửi
    // lại", which a default substring `getByLabel('Lý do')` also matches.
    await salePage.getByLabel('Lý do', { exact: true }).fill('E2E: ngoài mạng cơ sở, chấm công từ nhà');
    await salePage.getByRole('button', { name: 'Xác nhận' }).click();
    await expect(saleContent.getByText('Đã ghi nhận', { exact: true })).toBeVisible();
    await saleContext.close();

    // --- GĐĐT: negation — sale's ticket is NOT in a different track's inbox ---
    const gddtContext = await browser.newContext();
    const gddtPage = await gddtContext.newPage();
    const gddtCookie = mintStaffCookie({
      userId: `e2e-p302-gddt-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });
    await gddtContext.addCookies(cookiePair(STAFF_COOKIE_NAME, gddtCookie));
    await gddtPage.goto('/cockpit');

    await menuNav(gddtPage, 'Nhân sự', 'Chấm công', { role: 'giam_doc_dao_tao' });
    await gddtPage.getByRole('button', { name: 'Duyệt chấm công' }).click();
    await findInList.assertAbsent(gddtPage, (text) => text.includes(saleFullName));
    await gddtContext.close();

    // --- GĐKD: real approve, same track as sale ---
    const gdkdContext = await browser.newContext();
    const gdkdPage = await gdkdContext.newPage();
    const gdkdCookie = mintStaffCookie({
      userId: `e2e-p302-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await gdkdContext.addCookies(cookiePair(STAFF_COOKIE_NAME, gdkdCookie));
    await gdkdPage.goto('/cockpit');

    await menuNav(gdkdPage, 'Nhân sự', 'Chấm công', { role: 'giam_doc_kinh_doanh' });
    await gdkdPage.getByRole('button', { name: 'Duyệt chấm công' }).click();
    const ticketRow = await findInList(gdkdPage, (text) => text.includes(saleFullName));
    await ticketRow.getByRole('button', { name: 'Duyệt' }).click();
    const confirmDialog = gdkdPage.getByRole('alertdialog');
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Duyệt' }).click();
    await expect(gdkdPage.getByText('Đã duyệt yêu cầu chấm công.')).toBeVisible();

    await gdkdContext.close();
  });
});
