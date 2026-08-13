// P1-01 journey — Quản lý phễu tuyển sinh, the loss path: a sale creates a lead
// on the CRM board, opens it, and marks it lost with a reason. This is the part
// of P1-01 the existing crm-receipt journey never touches — that one drafts an
// opportunity and advances it toward enrollment, then leaves the board. Here the
// opportunity is opened on its own detail screen (opportunityGet) and closed as
// lost (opportunityMarkLost), which are distinct procedures and a distinct
// outcome (a funnel exit, not an enrollment).
//
// Scope note: P1-01 also names assign (assignableStaff + opportunityAssign). The
// assign control renders only for a manager (opportunity-detail gates it on
// isManager = giam_doc_kinh_doanh) and needs a real assignable staff row, so it
// is left to a follow-up; this spec proves the create → open → lost path. The
// manifest entry records the narrow coverage.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P1-01 journey — phễu tuyển sinh: tạo cơ hội rồi đánh dấu mất', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const leadName = `E2E P1-01 Lead ${runId}`;
  const leadPhone = randomVnPhone();

  test('a sale creates a lead, opens it, and closes it as lost', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p101-sale-${runId}`, roles: ['sale'], facilityId })),
    );
    await page.goto('/cockpit');

    // Reach the CRM board through the real menu, then open the create dialog.
    await menuNav(page, 'Tài chính & Điều hành', 'CRM', { role: 'sale' });
    await expect(page).toHaveURL(/\/crm/);

    await page.getByRole('button', { name: 'Thêm cơ hội' }).click();
    await page.getByLabel('Họ tên').fill(leadName);
    await page.getByLabel('Số điện thoại').fill(leadPhone);
    await page.getByRole('button', { name: 'Tạo' }).click();

    // The new lead appears as a card on the board; opening it is opportunityGet.
    // Click the contact *name* (not the card shell): card center often hits the
    // "Đánh dấu mất" button which stopPropagates and never navigates to detail.
    // Unique leadName avoids multi-match from leftover board fixtures.
    const nameOnBoard = page.getByText(leadName, { exact: true });
    await expect(nameOnBoard).toBeVisible();
    await nameOnBoard.click();
    await expect(page).toHaveURL(/\/crm\/opportunities\/[0-9a-f-]{36}/);

    // Detail page: EntityHeader title + single mark-lost action (not the board).
    await expect(page.getByRole('heading', { name: leadName })).toBeVisible();
    const markLostButton = page.getByRole('button', { name: 'Đánh dấu mất' });
    await expect(markLostButton).toHaveCount(1);
    await markLostButton.click();

    // The reason field is an Astryx Selector rendered as a combobox; "Xác nhận"
    // stays disabled until a reason is chosen.
    await page.getByRole('combobox', { name: /Lý do mất/ }).click();
    await page.getByRole('option', { name: 'Không phản hồi' }).click();
    await page.getByRole('button', { name: 'Xác nhận' }).click();
    // The dialog closes on success.
    await expect(page.getByRole('combobox', { name: /Lý do mất/ })).toHaveCount(0);

    // Fail-if-reverted gate for detail invalidation: mark-lost must refresh opportunityGet without a page reload.
    // Falsification of the close: once lost, the opportunity offers "reopen" and
    // no longer offers "mark lost" — the state actually changed in the database.
    await expect(page.getByRole('button', { name: 'Mở lại cơ hội' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đánh dấu mất' })).toHaveCount(0);

    await context.close();
  });
});
