// P4-05 journey — the after-sale case lifecycle. A GĐKD creates a care case for
// a student (afterSale.create → "Mở"), takes it up (afterSale.advance → "Đang
// xử lý"), resolves it with an outcome (afterSale.resolve → "Đã giải quyết"),
// then closes it (afterSale.close → "Đã đóng"). Each server-guarded transition
// only fires from the correct prior status, so the linear walk is real. Since the
// Phase 5 URL contract, create-success lands on the canonical case form
// (links.afterSaleCase(id)); that form is the evidence surface throughout.
//
// The student is a seeded precondition (there is no student.create UI; the create
// dialog's picker only searches student.lookup by name), not the behavior under
// test — every case transition is driven through the real admin UI.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { seedStudent } from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P4-05 journey — chăm sóc sau bán: tạo → tiếp nhận → giải quyết → đóng', () => {
  test.use({ baseURL: 'http://localhost:4173' });
  test.setTimeout(120_000);

  const runId = randomUUID().slice(0, 8);
  const studentName = `E2E P4-05 HV ${runId}`;

  test('a director walks an after-sale case from open through to closed', async ({ browser }) => {
    // --- precondition: a student the create picker can find by name ---
    await seedStudent({ facilityId, studentName });

    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p405-gd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    await page.goto('/cockpit');
    await menuNav(page, 'Tài chính & Điều hành', 'Sau bán', { role: 'giam_doc_kinh_doanh' });
    await expect(page).toHaveURL(/\/crm\/aftersale/);

    // --- create the case (opens as "Mở") ---
    await page.getByRole('button', { name: 'Tạo case' }).click();
    const createDialog = page.getByRole('dialog');
    await createDialog.getByLabel('Học viên').fill(studentName);
    await createDialog.getByText(studentName, { exact: true }).click();
    await createDialog.getByLabel('Mô tả').fill('PH phản ánh chất lượng lớp — E2E');
    await createDialog.getByRole('button', { name: 'Tạo' }).click();
    await expect(createDialog).toHaveCount(0);

    // Phase 5 contract: create-success navigates to the canonical case form
    // (links.afterSaleCase(created.id)) — the case opens there as "Mở".
    await expect(page).toHaveURL(/\/crm\/aftersale\/[0-9a-f-]{36}/i);
    await expect(page.getByText('Mở', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });

    // --- take it up (advance → "Đang xử lý") on form ---
    // exact:true — WorkflowStatusbar step labels also include these substrings.
    await page.getByRole('button', { name: 'Tiếp nhận', exact: true }).click();
    await expect(page.getByText('Đã tiếp nhận', { exact: false })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Tiếp nhận', exact: true })).toHaveCount(0);

    // --- resolve it with an outcome (→ "Đã giải quyết") ---
    await page.getByRole('button', { name: 'Giải quyết', exact: true }).click();
    const resolveDialog = page.getByRole('dialog');
    await resolveDialog.getByLabel(/Kết quả xử lý/).fill('Đã gặp PH, đổi lớp phù hợp — E2E');
    await resolveDialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Đóng', exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // --- close it (→ "Đã đóng") ---
    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Đóng', exact: true })).toHaveCount(0, {
      timeout: 15_000,
    });

    // --- back to the list: the closed case row is the durable evidence ---
    await page.getByRole('button', { name: 'Về danh sách' }).click();
    await expect(page).toHaveURL(/\/crm\/aftersale$/);
    const row = page.getByRole('row', { name: new RegExp(studentName) });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText('Đã đóng', { exact: true })).toBeVisible();

    await context.close();
  });
});
