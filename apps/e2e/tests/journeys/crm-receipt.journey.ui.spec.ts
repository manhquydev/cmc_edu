// P1-02 journey — Tạo phiếu học phí từ cơ hội (ADR-B: vào qua CRM, không
// `/finance`).
//
// Manifest cross-check (step 2 of phase-05-journey-10-luong-loi.md):
// flow-manifest.ts's P1-02 entry expects `finance.receiptCreate` at
// `/finance/new` — this journey drives exactly that mutation/route, reached
// the ADR-B way: sale advances a real Opportunity to O4_TESTED on the CRM
// pipeline (`/crm`, P1-01's own screen), then clicks that card's real
// "Tạo phiếu thu" button (`pipeline.tsx`'s `OpportunityCard`), which
// navigates to `/finance/new?opportunityId=<id>` — never a direct
// `page.goto()`, and never through `Xếp lớp`'s "tạo phiếu thu mới" link
// (that path is F1/F2's, already covered, and belongs to enrollment.enroll's
// existing-student flow, not the CRM funnel this journey exists to prove).
//
// `crm.opportunityAdvance` is a one-step state machine (server-enforced,
// apps/api/src/crm/router.ts: "rejects ... non-adjacent targets") — reaching
// O4_TESTED from a freshly created O1_LEAD genuinely requires 3 real
// "Chuyển lên" clicks, not a shortcut. Each click is followed by a fresh
// lookup of the "Chuyển lên" button rather than reusing a stale locator,
// because `pipeline.tsx`'s own optimistic-update + invalidate on
// `opportunityAdvance` moves the card into a different stage column (a
// different DOM position) after every advance.
//
// Uniqueness note: this journey creates the only Opportunity this e2e run
// ever puts through the CRM funnel, so "the one visible Chuyển lên button on
// screen" and "the one visible Ghi danh button on screen" are unambiguous
// without needing findInList's row-scoping — no other journey in this suite
// touches `/crm`. `pipeline.tsx`'s own `OpportunityCard` labels this action
// "Ghi danh" (the equivalent button on `opportunity-detail.tsx` is labeled
// "Tạo phiếu thu" instead — same navigation, different page, different
// label).
//
// ClassBatch seed exception: same PO-approved exception as F1/F2 (db.ts
// header) — no admin screen creates a Course/ClassBatch.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import { seedClassBatch } from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('P1-02 journey — tạo phiếu học phí từ cơ hội (CRM → /finance/new)', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('sale advances a real Opportunity to O4_TESTED on the CRM pipeline and creates a receipt from its own "Tạo phiếu thu" link', async ({
    context,
    page,
  }) => {
    const seeded = await seedClassBatch({ facilityId });

    const contactName = `E2E P1-02 Lead ${randomUUID().slice(0, 8)}`;
    const contactPhone = randomVnPhone();

    const cookie = mintStaffCookie({
      userId: `e2e-p102-sale-${randomUUID().slice(0, 8)}`,
      roles: ['sale'],
      facilityId,
    });
    await context.addCookies([
      { name: STAFF_COOKIE_NAME, value: cookie, domain: '127.0.0.1', path: '/' },
      { name: STAFF_COOKIE_NAME, value: cookie, domain: 'localhost', path: '/' },
    ]);
    await page.goto('/cockpit');

    await menuNav(page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
    await expect(page).toHaveURL(/\/crm$/);

    // --- create the lead (O1_LEAD) ---
    await page.getByRole('button', { name: 'Thêm cơ hội' }).click();
    await page.getByLabel('Họ tên').fill(contactName);
    await page.getByLabel('Số điện thoại').fill(contactPhone);
    await page.getByRole('button', { name: 'Tạo', exact: true }).click();
    await expect(page.getByText(contactName)).toBeVisible();

    // --- advance O1 -> O2 -> O3 -> O4_TESTED, one real click at a time ---
    // Scope "Chuyển lên" to this journey's card — deep-link / prior journeys
    // leave other open opportunities on the shared facility (strict-mode trap).
    for (let step = 0; step < 3; step += 1) {
      const opportunityCard = page
        .locator('.sh-content div')
        .filter({ hasText: contactName })
        .filter({ has: page.getByRole('button', { name: 'Chuyển lên' }) })
        .last();
      const advanceButton = opportunityCard.getByRole('button', { name: 'Chuyển lên' });
      await expect(advanceButton).toBeVisible();
      await advanceButton.click();
      // Settle: the optimistic update + onSettled invalidate both land before
      // the next click reads the (possibly relocated) button.
      await expect(page.getByText(contactName)).toBeVisible();
    }
    // --- O4_TESTED: real "Ghi danh" click navigates to /finance/new ---
    // `OpportunityCard` only renders this button when `opp.stage ===
    // 'O4_TESTED'` — its mere visibility here IS the proof all 3 one-step
    // advances landed exactly on stage, since a non-adjacent jump is
    // server-rejected (crm/router.ts) and would have left "Chuyển lên" showing
    // instead. Scoped to the specific OpportunityCard containing this
    // journey's own `contactName` (pipeline.tsx: one `<div>` per card, name +
    // button as siblings) rather than just ".sh-content" — a CI retry
    // (playwright.config.ts: retries: 1 under CI) that got this far before an
    // earlier version of this test failed on a later assertion would leave a
    // second, orphaned O4_TESTED opportunity from the first attempt still on
    // screen, and an unscoped "the only visible Ghi danh button" query would
    // then resolve to 2 elements — scoping by this run's own contact name
    // stays correct even when that happens.
    // `pipeline.tsx`'s `OpportunityCard` renders the contact name inside its
    // own inner `HStack` (a sibling of the "Ghi danh" button, not an
    // ancestor) — filtering by `hasText` alone and taking `.last()` grabs
    // that inner, button-less `HStack` div instead of the card. Also
    // requiring `has` a "Ghi danh" button (mirrors
    // shift-config-admin.journey.ui.spec.ts's `groupCard` pattern) narrows to
    // divs that contain both, and `.last()` then correctly picks the
    // innermost of those — the card's own `Stack` wrapper.
    const opportunityCard = page
      .locator('.sh-content div')
      .filter({ hasText: contactName })
      .filter({ has: page.getByRole('button', { name: 'Ghi danh' }) })
      .last();
    const createReceiptButton = opportunityCard.getByRole('button', { name: 'Ghi danh' });
    await expect(createReceiptButton).toBeVisible();
    await createReceiptButton.click();
    await expect(page).toHaveURL(/\/finance\/new\?opportunityId=/);

    // Prefilled from the opportunity's contact (receipt-create.tsx's own
    // effect) — proves the deep-link actually carried the opportunity, not
    // just the URL shape. The phone is normalized on `crm.opportunityCreate`
    // (contact-phone-normalize-dedup-unique migration) — `Contact.phone`
    // stores the `84`-prefixed international form, not the raw `0`-prefixed
    // form this journey typed, so the prefilled value is compared against
    // that normalized shape rather than the original input.
    await expect(page.getByLabel('Họ tên học viên')).toHaveValue(contactName);
    const normalizedPhone = `84${contactPhone.slice(1)}`;
    await expect(page.getByLabel('SĐT phụ huynh')).toHaveValue(normalizedPhone);

    // The lead was created with only name + phone (no email), so the
    // opportunity-prefill effect leaves this field empty — receipt-create.tsx
    // now REQUIRES it (parent's LMS OTP login credential), so it must be
    // filled here or the real submit stays silently blocked client-side.
    await page.getByLabel('Email phụ huynh').fill(`e2e-p102-parent-${randomUUID().slice(0, 8)}@e2e.cmc`);

    await page.getByRole('button', { name: /^Lớp học/ }).click();
    await page.getByRole('option', { name: new RegExp(seeded.code) }).click();
    // Same HTML5 step-mismatch diagnosis as finance-receipt.journey.ui.spec.ts:
    // the native `min={1} step={100000}` spinbutton silently blocks submission
    // for a value that isn't `1 + k*100000`.
    await page.getByRole('spinbutton', { name: /^Học phí/ }).fill('5000001');

    await page.getByRole('button', { name: 'Tạo phiếu thu' }).click();
    // `sale` lacks `finance.receiptGet` (packages/auth), so receipt-create.tsx's
    // own onSuccess does NOT navigate to `/finance/:id` for this role — it
    // stays on `/finance/new` and renders the receipt's code in an in-place
    // success banner instead (its own comment: "would land straight on Không
    // tìm thấy phiếu thu if we navigated there"). That banner, not a URL
    // change, is the real, current proof `finance.receiptCreate` ran.
    await expect(page.getByText(/^Đã tạo phiếu thu /)).toBeVisible();

    // ── business invariant ──
    // The banner proves a receipt was CREATED; it says nothing about whether it
    // stored the tuition amount that was typed (5000001). `sale` cannot read it
    // back — it lacks finance.receiptGet/receiptList (packages/auth SoD roster)
    // — so a manager-role client reads the same facility's queue and asserts the
    // persisted number. This is the assertion that turns P1-02 from
    // `reachable-only` (green, unchecked) into `verified-correct` in
    // business:verify. Read-path is real (goes through the authorized query +
    // RLS facility scope), not a DB back-door.
    const bannerText = await page.getByText(/^Đã tạo phiếu thu /).textContent();
    const receiptCode = bannerText!.replace('Đã tạo phiếu thu ', '').trim();

    const managerClient = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: `e2e-p102-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    // Newest-first (orderBy createdAt desc), pageSize 100 » the handful of
    // receipts a single e2e run creates, so the just-created one is on page 1.
    const { items } = await managerClient.finance.receiptList.query({ pageSize: 100 });
    const created = items.find((r) => r.code === receiptCode);
    expect(created, `receipt ${receiptCode} phải đọc lại được trong hàng đợi cùng cơ sở`).toBeTruthy();

    // No discount in this journey, so netAmount === the tuition typed in
    // (finance/router.ts: receiptCreate sets `netAmount: input.amount`).
    assertBusinessInvariant('phiếu thu lưu đúng học phí đã nhập (VND)', created!.netAmount, 5000001);
  });
});
