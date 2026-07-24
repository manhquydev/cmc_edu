// F4 regression journey — Chốt lương (payroll) staff roster.
//
// One of the 3 flows that were dead for 16 days (docs/codebase-summary.md:
// "hai giám đốc mở màn chốt lương mà danh sách nhân viên trống" — `user.list`
// needed `user.manage`, an empty roster only super_admin satisfies, so both
// directors this screen is BUILT for saw an empty list). This journey proves
// the regression stays fixed by driving the real UI, not by asserting the
// permission registry in isolation.
//
// Staff identity: created via the real `/admin/users` super_admin UI
// (`createStaffViaAdminUi`) — `user.create` IS reachable in-app, just
// super_admin-gated (nav-registry.ts: the `admin` module carries
// `roles: ['super_admin']`, and its `users` child gates on
// `{ module: 'user', action: 'manage' }`, the same key `user.create` itself
// requires). No role assignment is needed for this journey: `payroll.tsx`
// calls `trpc.user.pickList.useQuery({})` with no `role` filter, and
// `user.pickList` (apps/api/src/user/router.ts) only applies a `roles: {has}`
// predicate when a `role` argument is actually passed — omitted here, it
// returns every AppUser in the facility regardless of `roles`. Verified by
// reading both files before deciding to skip the roles modal for this
// journey.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('F4 journey — payroll roster (Chốt lương)', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative page.goto()/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('GĐ reaches Chốt lương via the real side-nav and sees a non-empty staff roster', async ({
    context,
    page,
    browser,
  }) => {
    const staffFullName = `E2E F4 Staff ${randomUUID().slice(0, 8)}`;
    await createStaffViaAdminUi(browser, {
      facilityId,
      userId: `e2e-f4-staff-${randomUUID().slice(0, 8)}`,
      fullName: staffFullName,
      position: 'giao_vien',
    });

    // giam_doc_dao_tao: holds `payslip.assemble` (nav gate for Chốt lương) and
    // `staff.pickList` (packages/auth/src/index.ts) — the role the screen is
    // built for, not super_admin.
    const cookie = mintStaffCookie({
      userId: `e2e-f4-gddt-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });
    await context.addCookies([
      { name: STAFF_COOKIE_NAME, value: cookie, domain: '127.0.0.1', path: '/' },
      { name: STAFF_COOKIE_NAME, value: cookie, domain: 'localhost', path: '/' },
    ]);

    // Landing screen after "login" — not the destination screen this journey
    // proves, so this goto does not stand in for the real navigation below.
    await page.goto('/cockpit');

    await menuNav(page, 'Nhân sự', 'Chốt lương', { role: 'giam_doc_dao_tao' });
    await expect(page).toHaveURL(/\/hr\/payroll/);

    // Non-empty per §requirement: the empty-state banner must NOT be showing...
    await expect(page.getByText('Chưa có nhân viên nào', { exact: true })).not.toBeVisible();

    // ...and the staff member created via the admin UI above must be a real,
    // visible row (findInList: located by displayed name, never by an
    // AppUser id smuggled across the two browser contexts).
    const row = await findInList(page, (text) => text.includes(staffFullName));
    await expect(row).toBeVisible();
  });
});
