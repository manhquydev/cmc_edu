// P3-01 journey — Chấm công cặp vào/ra mỗi ngày (/hr/checkin).
//
// Simplest of the 7 new journeys (plans/260723-1422-may-hoa-nghiem-thu-ba-tang/
// phase-05-journey-10-luong-loi.md): one role, one screen, real menu
// navigation, real punch. Manifest cross-check (step 2 of the phase doc):
// flow-manifest.ts's P3-01 entry expects `checkInOut.punch` at `/hr/checkin`
// — this journey drives both directly (giao_vien clicks "Chấm công" on the
// real page, the same `checkInOut.punch` mutation `check-in-out.tsx` wires).
//
// Staff identity: created via the real `/admin/users` super_admin UI
// (`createStaffViaAdminUi`) — `user.create` IS reachable in-app, just
// super_admin-gated (nav-registry.ts: the `admin` module carries
// `roles: ['super_admin']`). No role assignment is needed: `checkIn.punch`
// resolves the caller's `AppUser` row by `userId` alone (checkin/router.ts's
// `punch` handler), never reading the `AppUser.roles` DB column — the
// permission gate itself (`checkIn.punch`, packages/auth/src/index.ts) reads
// `ctx.subject.roles` off the signed cookie claims instead.
//
// No shift is registered for this role today, so `hasShift` is false in
// `checkInOut.punch` regardless of whatever offsite/network state another
// journey in this same run (P3-02) may have set up — the punch always
// succeeds without requiring a reason (see checkin/router.ts's
// `ensureDayTicket`), which is exactly what keeps this journey's outcome
// independent of run order relative to P3-02.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('P3-01 journey — chấm công cặp vào/ra (Chấm công)', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('giao_vien reaches Chấm công via the real side-nav and a punch is recorded', async ({ context, page, browser }) => {
    const userId = `e2e-p301-gv-${randomUUID().slice(0, 8)}`;
    await createStaffViaAdminUi(browser, {
      facilityId,
      userId,
      fullName: 'E2E P3-01 Giáo viên',
      position: 'giao_vien',
    });

    const cookie = mintStaffCookie({ userId, roles: ['giao_vien'], facilityId });
    await context.addCookies([
      { name: STAFF_COOKIE_NAME, value: cookie, domain: '127.0.0.1', path: '/' },
      { name: STAFF_COOKIE_NAME, value: cookie, domain: 'localhost', path: '/' },
    ]);

    // Landing screen after "login" — not the destination this journey proves.
    await page.goto('/cockpit');

    await menuNav(page, 'Nhân sự', 'Chấm công', { role: 'giao_vien' });
    await expect(page).toHaveURL(/\/hr\/checkin/);

    // Scoped to the content area (`main.console-main`, packages/ui/src/components/
    // app-frame.tsx), not the whole page — the side-nav's own "Chấm công"
    // child entry (just clicked by menuNav above) carries the exact same
    // accessible name as this page's punch action button, so an unscoped
    // query would be ambiguous.
    const content = page.locator('main.console-main');
    await content.getByRole('button', { name: 'Chấm công', exact: true }).click();

    // Real, visible confirmation — success banner + button flips to the
    // disabled "Đã chấm công ✓" state (check-in-out.tsx's own CheckInTab).
    await expect(content.getByText('Đã ghi nhận', { exact: true })).toBeVisible();
    await expect(content.getByRole('button', { name: 'Đã chấm công ✓', exact: true })).toBeVisible();
  });
});
