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
    for (let step = 0; step < 3; step += 1) {
      const advanceButton = page.getByRole('button', { name: 'Chuyển lên' });
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
    // instead. Scoped to `.sh-content` (packages/ui/src/components/
    // app-frame.tsx) — the persistent topbar quick-action button
    // (`shell.tsx`'s `sh-cta`) is ALSO labeled "Ghi danh" and lives in the
    // sibling `.sh-top` region, so an unscoped query is ambiguous.
    const createReceiptButton = page.locator('.sh-content').getByRole('button', { name: 'Ghi danh' });
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
    // Real app navigation on `finance.receiptCreate` success — the destination
    // 403s for `sale` (finance.receiptGet excludes sale, packages/auth), which
    // is expected/unasserted, same as F1/F2. Only the URL shape (real receipt
    // id) proves the mutation this flow exists to prove actually ran.
    await expect(page).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
  });
});
