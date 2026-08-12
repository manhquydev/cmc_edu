// P4-01 journey — Đổi quà bằng sao (/admin/engagement/rewards).
//
// Manifest cross-check (step 2 of phase-05-journey-10-luong-loi.md):
// flow-manifest.ts's P4-01 entry expects
// `rewards.approve, rewards.deliver, rewards.reject, rewards.list` (plus the
// LMS-only `rewards.redeem`/`listForStudent`) at `/admin/engagement/rewards`
// — this journey drives `approve`, `deliver`, and `list` for real via the
// STAFF redemption queue, the admin-side half of this flow this whole plan
// is scoped to (`hoc_vien` — the redeemer — is the LMS/student role and out
// of scope here, same call as this phase's own instructions).
//
// Reward seed exception (db.ts, "Phase 5" header — same category/rigor as
// Phase 4's `seedClassBatch`/`seedPresentAttendance`): `rewards.redeem` is
// the ONLY mutation that ever creates a Reward row, and it is `lmsProcedure`
// -gated (student-only, `apps/api/src/rewards/reward-router.ts`) — genuinely
// unreachable from any admin session, and deliberately out of scope per the
// note above. Grepped `apps/admin/src/pages/engagement`: `rewards.tsx` only
// ever CONSUMES `rewards.list` + the 3 review mutations; nothing there
// creates a Reward. The Gift the seeded Reward points at is NOT part of that
// exception — it is created by a real `giam_doc_kinh_doanh` session on
// `/admin/engagement/gifts` first, and the seed resolves it by its
// DISPLAYED name (never a smuggled id), same principle as
// `findEnrollmentByClassAndStudentName`.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import { seedPendingReward } from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P4-01 journey — đổi quà bằng sao (Đổi thưởng)', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('GĐKD creates a gift; sale approves then delivers a pending redemption on the real Đổi thưởng queue', async ({
    browser,
  }) => {
    const giftName = `E2E P4-01 Gift ${randomUUID().slice(0, 8)}`;

    // --- GĐKD: real UI create (prerequisite catalog entry, gift.upsert) ---
    const gdkdContext = await browser.newContext();
    const gdkdPage = await gdkdContext.newPage();
    const gdkdCookie = mintStaffCookie({
      userId: `e2e-p401-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await gdkdContext.addCookies(cookiePair(STAFF_COOKIE_NAME, gdkdCookie));
    await gdkdPage.goto('/cockpit');

    await menuNav(gdkdPage, 'Gắn kết', 'Quà tặng', { role: 'giam_doc_kinh_doanh' });
    await gdkdPage.getByRole('button', { name: 'Thêm phần thưởng' }).click();
    await gdkdPage.getByLabel('Tên phần thưởng').fill(giftName);
    await gdkdPage.getByRole('button', { name: 'Tạo', exact: true }).click();
    const giftRow = await findInList(gdkdPage, (text) => text.includes(giftName));
    await expect(giftRow).toBeVisible();
    await gdkdContext.close();

    // --- seed: the one write no admin session can reach (see file header) ---
    await seedPendingReward({ facilityId, giftName });

    // --- sale: real approve + deliver on the staff redemption queue ---
    const saleContext = await browser.newContext();
    const salePage = await saleContext.newPage();
    const saleCookie = mintStaffCookie({
      userId: `e2e-p401-sale-${randomUUID().slice(0, 8)}`,
      roles: ['sale'],
      facilityId,
    });
    await saleContext.addCookies(cookiePair(STAFF_COOKIE_NAME, saleCookie));
    await salePage.goto('/cockpit');

    await menuNav(salePage, 'Gắn kết', 'Đổi thưởng', { role: 'sale' });
    await expect(salePage).toHaveURL(/\/admin\/engagement\/rewards/);

    const pendingRow = await findInList(salePage, (text) => text.includes(giftName));
    // Form-depth: list is index-only → Mở phiếu → UUID form, then ConfirmDialog.
    await pendingRow.getByRole('button', { name: 'Mở phiếu' }).click();
    await expect(salePage).toHaveURL(/\/admin\/engagement\/rewards\/[0-9a-f-]{36}/i);

    await salePage.getByRole('button', { name: 'Duyệt', exact: true }).click();
    const approveDialog = salePage.getByRole('alertdialog');
    await expect(approveDialog).toBeVisible();
    await approveDialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(salePage.getByText(/Đã duyệt yêu cầu đổi quà/)).toBeVisible();
    await expect(salePage.getByText('Đã duyệt').first()).toBeVisible();

    await salePage.getByRole('button', { name: 'Giao quà', exact: true }).click();
    const deliverDialog = salePage.getByRole('alertdialog');
    await expect(deliverDialog).toBeVisible();
    await deliverDialog.getByRole('button', { name: 'Giao quà', exact: true }).click();
    await expect(salePage.getByText(/Đã giao quà/)).toBeVisible();
    await expect(salePage.getByText('Đã giao').first()).toBeVisible();
    // Delivered is terminal — no further form HITL remains.
    await expect(salePage.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0);
    await expect(salePage.getByRole('button', { name: 'Giao quà', exact: true })).toHaveCount(0);
    await expect(salePage.getByRole('button', { name: 'Từ chối', exact: true })).toHaveCount(0);

    await saleContext.close();
  });
});
