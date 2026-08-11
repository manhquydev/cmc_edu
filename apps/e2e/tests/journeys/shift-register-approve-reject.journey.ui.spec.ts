// P3-03 + P3-04 + P3-07 journey — the shift registration lifecycle: a sale
// registers a future shift, a director rejects it with a reason (P3-07), the
// sale resubmits, the director approves it (P3-04), and the sale cancels it
// (P3-03). One spec because the ticket-lock (at most one 'submitted'
// registration per person) forces this exact order — a resubmit is only
// possible after a rejection.
//
// Setup is real UI: a super admin creates a Kinh doanh shift group + template
// (the sale's position resolves to KINH_DOANH, so the group type must match),
// and the sale is created through /admin/users. shift.submit requires a FUTURE
// fromDate, so tomorrow (ICT) is used.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { addDaysToDateOnly, ictDateOnlyOf } from '@cmc/domain-time';
import { mintStaffCookie } from '../../src/session-injection.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;
const tomorrow = addDaysToDateOnly(ictDateOnlyOf(new Date()), 1);

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P3-03/04/07 journey — đăng ký ca: từ chối → nộp lại → duyệt → hủy', () => {
  // Admin lives on :4173. createStaffViaAdminUi makes its own context via
  // browser.newContext() with no baseURL, which inherits this test-level one —
  // without it that context would default to the LMS (:4174) and land on login.
  test.use({ baseURL: 'http://localhost:4173' });
  // Four browser contexts and a full reject→resubmit→approve→cancel cycle — well
  // past the 30s default.
  test.setTimeout(120_000);

  const runId = randomUUID().slice(0, 8);
  const groupName = `E2E P3 Nhóm KD ${runId}`;
  const templateName = `E2E P3 Ca ${runId}`;
  const saleName = `E2E P3 Sale ${runId}`;
  const saleUserId = `e2e-p3shift-sale-${runId}`;

  /** Compose → submit → lands on form; returns registration UUID. */
  async function submitRegistration(browser: import('@playwright/test').Browser): Promise<string> {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    try {
      const page = await context.newPage();
      await context.addCookies(cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId })));
      // Record-centric compose URL (list may show two "Soạn phiếu mới" CTAs).
      await page.goto('/hr/shifts/new');
      await expect(page).toHaveURL(/\/hr\/shifts\/new$/);
      // Pick the group (its templates then load as matrix columns).
      await page.getByRole('combobox', { name: /Nhóm ca/ }).click();
      await page.getByRole('option', { name: new RegExp(groupName) }).click();
      await page.getByLabel('Từ ngày').fill(tomorrow);
      await page.getByLabel('Đến ngày').fill(tomorrow);
      // SINGLE matrix: checkbox cells, not radio rows.
      await page.getByRole('checkbox', { name: new RegExp(`${tomorrow} ${templateName}`) }).check();

      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByRole('button', { name: 'Gửi đăng ký' })).toBeVisible();
      const mobileLayout = await page.evaluate(() => {
        const viewport = window.innerWidth;
        const documentWidth = document.documentElement.scrollWidth;
        const overflowingElements = [...document.querySelectorAll<HTMLElement>('body *')]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              className: element.className,
              label: element.getAttribute('aria-label'),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter((element) => element.right > viewport)
          .slice(0, 12);

        return { viewport, documentWidth, overflowingElements };
      });
      expect(
        mobileLayout.documentWidth,
        `Elements outside the ${mobileLayout.viewport}px viewport: ${JSON.stringify(mobileLayout.overflowingElements)}`,
      ).toBeLessThanOrEqual(mobileLayout.viewport);

      await page.getByRole('button', { name: 'Gửi đăng ký' }).click();
      // After submit, form deep-link opens: /hr/shifts/{uuid}
      await expect(page).toHaveURL(/\/hr\/shifts\/[0-9a-f-]{36}$/i, { timeout: 15_000 });
      const match = page.url().match(/\/hr\/shifts\/([0-9a-f-]{36})/i);
      expect(match?.[1]).toBeTruthy();
      return match![1]!;
    } finally {
      await context.close();
    }
  }

  test('a sale registers a shift, a director rejects then approves it, and the sale cancels', async ({ browser }) => {
    // --- setup: super admin creates a Kinh doanh group + template ---
    const adminContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const adminPage = await adminContext.newPage();
    await adminContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p3shift-sa-${runId}`, roles: ['super_admin'], facilityId })),
    );
    await adminPage.goto('/cockpit');
    await menuNav(adminPage, 'Nhân sự', 'Ca làm việc', { role: 'super_admin' });
    await adminPage.getByLabel('Tên nhóm ca').fill(groupName);
    await adminPage.getByRole('button', { name: 'Thêm nhóm ca' }).click();
    const groupCard = adminPage.locator('div').filter({ hasText: groupName }).filter({ has: adminPage.getByLabel('Tên mẫu ca') }).last();
    await expect(groupCard).toBeVisible();
    await groupCard.getByLabel('Tên mẫu ca').fill(templateName);
    await groupCard.getByLabel('Bắt đầu (HH:mm)').fill('08:00');
    await groupCard.getByLabel('Kết thúc (HH:mm)').fill('17:00');
    await groupCard.getByRole('button', { name: '+ Thêm mẫu ca' }).click();
    await expect(groupCard.getByText(templateName)).toBeVisible();
    await adminContext.close();

    // --- setup: the sale who will register (position → KINH_DOANH) ---
    await createStaffViaAdminUi(browser, { facilityId, userId: saleUserId, fullName: saleName, position: 'Sale' });

    // --- sale submits the registration ---
    const firstRegId = await submitRegistration(browser);

    // --- director (GĐKD) rejects via form deep-link (P3-07 + phase 04 cold-start) ---
    const gdContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const gdPage = await gdContext.newPage();
    await gdContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p3shift-gd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    // Cold-start form by UUID (share/HITL path) — not list expand.
    await gdPage.goto(`/hr/shifts/${firstRegId}`);
    await expect(gdPage).toHaveURL(new RegExp(`/hr/shifts/${firstRegId}$`));
    await expect(
      gdPage.getByRole('heading', { name: new RegExp(`Work Schedule / ${saleName}`) }),
    ).toBeVisible({ timeout: 15_000 });
    await gdPage.getByRole('button', { name: 'Từ chối' }).click();
    const rejectDialog = gdPage.getByRole('dialog');
    await rejectDialog.getByRole('textbox').fill('Trùng ca với NV khác — E2E');
    await rejectDialog.getByRole('button', { name: 'Từ chối' }).click();
    await expect(gdPage.getByText(/Đã từ chối|rejected/i).first()).toBeVisible({ timeout: 15_000 });

    // --- sale resubmits (only possible now the previous one is rejected) ---
    const secondRegId = await submitRegistration(browser);

    // --- director approves via /go deep-link (P3-04 + agent HITL path) ---
    await gdPage.goto(`/go/shiftRegistration/${secondRegId}`);
    await expect(gdPage).toHaveURL(new RegExp(`/hr/shifts/${secondRegId}$`), { timeout: 15_000 });
    await expect(
      gdPage.getByRole('heading', { name: new RegExp(`Work Schedule / ${saleName}`) }),
    ).toBeVisible({ timeout: 15_000 });
    // exact: true — nav has "Duyệt KPI" which substring-matches name 'Duyệt'.
    await gdPage.getByRole('button', { name: 'Duyệt', exact: true }).click();
    // "Duyệt" opens a ConfirmDialog whose own confirm is also labelled "Duyệt".
    const approveDialog = gdPage.getByRole('alertdialog');
    await approveDialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
    // Flash banner only — statusbar always lists the label "Đã duyệt" as a step.
    await expect(gdPage.getByText('Đã duyệt (approved).')).toBeVisible({ timeout: 15_000 });
    await gdContext.close();

    // ── business invariant (read AFTER approve, BEFORE the sale cancels) ──
    // The pending queue emptying only proves the reg LEFT 'submitted' — a reject
    // clears it too, so it does NOT prove the approve landed on 'approved'. No
    // director-facing read returns an approved reg (pendingForApproval is
    // submitted-only), so the OWNER reads it back. shift.myRegistrations is
    // self-scoped (resolves the AppUser from ctx.subject.userId), so this client
    // MUST reuse saleUserId — the exact id that minted the sale's cookie above
    // and that createStaffViaAdminUi seeded as an AppUser row. This run's sale
    // has one rejected reg + one resubmitted reg; exactly that resubmitted one
    // must now read back as 'approved'. This must run before the cancel step
    // below, which would flip it to 'cancelled'.
    const saleReadClient = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: saleUserId,
      roles: ['sale'],
      facilityId,
    });
    const myRegs = await saleReadClient.shift.myRegistrations.query();
    assertBusinessInvariant(
      'đăng ký ca sau duyệt = đúng 1 bản ghi approved',
      myRegs.filter((r) => r.status === 'approved').length,
      1,
    );

    // --- sale cancels the approved registration on form (P3-03 + form depth) ---
    const saleContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const salePage = await saleContext.newPage();
    await saleContext.addCookies(cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId })));
    await salePage.goto(`/hr/shifts/${secondRegId}`);
    await expect(
      salePage.getByRole('heading', { name: new RegExp(`Work Schedule / ${saleName}`) }),
    ).toBeVisible({ timeout: 15_000 });
    await salePage.getByRole('button', { name: 'Hủy phiếu' }).click();
    const cancelDialog = salePage.getByRole('alertdialog');
    await expect(cancelDialog).toBeVisible();
    await cancelDialog.getByRole('button', { name: 'Hủy ca' }).click();
    await expect(salePage.getByText('Đã hủy (cancelled).')).toBeVisible({ timeout: 15_000 });

    await saleContext.close();
  });
});
