// 09-ops-rewards — REAL-ENVIRONMENT đổi quà surface (admin ERP) on the live VPS.
// P4-02 (GĐKD cấu hình quà — gift.upsert) + P4-01 staff half (rewards.list queue
// renders for a sale):
//   1. GĐKD opens /admin/engagement/gifts through the real nav, creates a gift
//      (name + starsRequired) and finds it in the list by its displayed name.
//   2. sale opens /admin/engagement/rewards (Đổi thưởng queue) — rewards.list
//      renders without errors (fresh campaign → empty queue is fine).
//
// Scope note (honest boundary): the redeem→approve→deliver HITL chain needs a
// PENDING Reward, and rewards.redeem is student-gated (LMS, lmsProcedure) — no
// staff session can create one, and the live suite never writes the DB (read-only
// psql via docker exec, live-otp). The full star economy (grade → stars → redeem
// → approve → deliver) is covered by the local journey lms-stars-redeem-cycle and
// deliberately NOT duplicated live this round (needs exercise publish + delivery
// + student LMS session) — documented gap, same call the local rewards journey
// makes with its seedPendingReward exception.

import { test, expect } from '@playwright/test';

import { openStaffSession, closeRoleSession } from '../../src/live/live-auth.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { liveRunId } from '../../src/live/live-state.js';
import {
  newScratch,
  attachErrors,
  finishLiveSpec,
  recordCreated,
  assertNoErrors,
} from './live-spec-utils.js';

const scratch = newScratch();

test.describe('09-ops-rewards — cấu hình quà + hàng đợi đổi thưởng (live)', () => {
  test('GĐKD tạo quà; sale mở Đổi thưởng queue render không lỗi', async ({ browser }) => {
    const rid = liveRunId();
    const giftName = 'Live Quà ' + rid;

    // 1. GĐKD: create the gift (P4-02).
    const gdkd = await openStaffSession(browser, 'giam_doc_kinh_doanh');
    attachErrors(gdkd.page, scratch);
    try {
      await menuNav(gdkd.page, 'Gắn kết', 'Quà tặng', { role: 'giam_doc_kinh_doanh' });
      await expect(gdkd.page).toHaveURL(/\/admin\/engagement\/gifts/);
      await gdkd.page.getByRole('button', { name: 'Thêm phần thưởng' }).click();
      await gdkd.page.getByLabel('Tên phần thưởng').fill(giftName);
      await gdkd.page.getByRole('spinbutton', { name: 'Số sao cần' }).fill('3');
      await gdkd.page.getByRole('button', { name: 'Tạo', exact: true }).click();
      const giftRow = await findInList(gdkd.page, (text) => text.includes(giftName));
      await expect(giftRow).toBeVisible({ timeout: 15_000 });
      recordCreated(scratch, 'gift', 'name', giftName);
      console.log('[09-ops-rewards] gift created by GĐKD');
    } finally {
      await closeRoleSession(gdkd);
    }

    // 2. sale: open the Đổi thưởng queue — rewards.list must render clean.
    const sale = await openStaffSession(browser, 'sale');
    attachErrors(sale.page, scratch);
    try {
      await menuNav(sale.page, 'Gắn kết', 'Đổi thưởng', { role: 'sale' });
      await expect(sale.page).toHaveURL(/\/admin\/engagement\/rewards/);
      // The queue's status filter proves the list surface hydrated.
      await expect(sale.page.getByRole('combobox', { name: 'Trạng thái' })).toBeVisible({ timeout: 15_000 });
      console.log('[09-ops-rewards] rewards queue rendered for sale');
    } finally {
      await closeRoleSession(sale);
    }

    await assertNoErrors(sale.page, scratch.collectors[0]!, 'rewards surface smoke');
  });

  test.afterEach(async ({}, testInfo) => {
    finishLiveSpec(testInfo, scratch);
  });
});
