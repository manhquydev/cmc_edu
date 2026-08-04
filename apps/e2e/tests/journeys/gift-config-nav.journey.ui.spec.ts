// P4-02 journey — Cấu hình quà đổi sao (/admin/engagement/gifts), with the
// negation this flow exists to prove: sale KHÔNG thấy entry "Quà tặng".
//
// Manifest cross-check (step 2 of phase-05-journey-10-luong-loi.md):
// flow-manifest.ts's P4-02 entry expects `gift.upsert` at
// `/admin/engagement/gifts` — this journey drives exactly that mutation via
// the real "Thêm phần thưởng" form.
//
// Negation mechanism (D5, per the phase doc): `menuNav.assertEntryAbsent`,
// not `expect().rejects`. Verified against `packages/auth/src/index.ts`:
// `gift.upsert` is `['giam_doc_kinh_doanh', 'giam_doc_dao_tao']` — `sale` is
// not in that list, so `nav-registry.ts`'s "Quà tặng" child entry (gated on
// `{ module: 'gift', action: 'upsert' }`) is filtered OUT of sale's sidebar
// by `isNavChildVisible`, while the "Gắn kết" MODULE itself stays visible
// (sale holds `rewards.manage`, so the sibling "Đổi thưởng" child keeps the
// module row from being hidden entirely) — this is exactly the
// child-level-absent-but-module-visible case `assertEntryAbsent`'s own
// header comment documents handling, and the more precise of the two cases
// this journey could hit (proving the specific entry is gone, not just that
// the module happens to be invisible for an unrelated reason).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P4-02 journey — cấu hình quà đổi sao (Quà tặng), sale không thấy entry', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('GĐKD creates a gift via the real Quà tặng screen; sale never sees the entry in its own side-nav', async ({
    browser,
  }) => {
    const giftName = `E2E P4-02 Gift ${randomUUID().slice(0, 8)}`;

    // --- GĐKD: real UI create ---
    const gdkdContext = await browser.newContext();
    const gdkdPage = await gdkdContext.newPage();
    const gdkdCookie = mintStaffCookie({
      userId: `e2e-p402-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await gdkdContext.addCookies(cookiePair(STAFF_COOKIE_NAME, gdkdCookie));
    await gdkdPage.goto('/cockpit');

    await menuNav(gdkdPage, 'Gắn kết', 'Quà tặng', { role: 'giam_doc_kinh_doanh' });
    await expect(gdkdPage).toHaveURL(/\/admin\/engagement\/gifts/);

    await gdkdPage.getByRole('button', { name: 'Thêm phần thưởng' }).click();
    await gdkdPage.getByLabel('Tên phần thưởng').fill(giftName);
    // Type a DISTINCT star cost (7) rather than leaving the NumberInput default
    // (1): the readback below asserts the persisted `starsRequired`, and a value
    // equal to the form default would make that assertion vacuous (it could pass
    // even if the typed value were dropped). NumberInput renders a spinbutton,
    // not a labelled text input (same selector P4-01's journey uses).
    await gdkdPage.getByRole('spinbutton', { name: 'Số sao cần' }).fill('7');
    await gdkdPage.getByRole('button', { name: 'Tạo', exact: true }).click();

    const row = await findInList(gdkdPage, (text) => text.includes(giftName));
    await expect(row).toBeVisible();

    // ── business invariant ──
    // The row appearing proves gift.upsert RAN, but not that it stored the star
    // cost that was typed (7). Read the gift back through the authorized staff
    // query (same GĐKD role that holds `gift.list`) and assert the persisted
    // `starsRequired` — the number a stakeholder configuring a reward cares
    // about. This turns P4-02 from reachable-only into verified-correct.
    const gifts = await createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: `e2e-p402-gdkd-readback-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    }).gift.list.query({});
    const createdGift = gifts.find((g) => g.name === giftName);
    expect(createdGift, `quà "${giftName}" phải đọc lại được qua gift.list`).toBeTruthy();
    assertBusinessInvariant('quà lưu đúng số sao đã nhập', createdGift!.starsRequired, 7);

    await gdkdContext.close();

    // --- sale: the entry must be genuinely absent from sale's own side-nav ---
    const saleContext = await browser.newContext();
    const salePage = await saleContext.newPage();
    const saleCookie = mintStaffCookie({
      userId: `e2e-p402-sale-${randomUUID().slice(0, 8)}`,
      roles: ['sale'],
      facilityId,
    });
    await saleContext.addCookies(cookiePair(STAFF_COOKIE_NAME, saleCookie));
    await salePage.goto('/cockpit');

    await menuNav.assertEntryAbsent(salePage, 'Gắn kết', 'Quà tặng', { role: 'sale' });

    await saleContext.close();
  });
});
