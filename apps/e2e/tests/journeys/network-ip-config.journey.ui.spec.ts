// ADM-03 journey — Cấu hình mạng chấm công (IP): a super admin adds an
// attendance IP range, self-detects the current IP, edits the range, and
// deletes it. Covers all five declared procedures (create / detectMyIp / list /
// update / delete) through the real UI.
//
// It deliberately never clicks "Bật" (activate): an ACTIVE range makes
// checkInOut.punch treat a caller off that network as offsite, which would break
// the punch journey (P3-01) if they share the facility. A new range is created
// inactive, edited and deleted while still inactive, so it never affects punch.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('ADM-03 journey — cấu hình IP mạng chấm công (thêm → sửa → xoá)', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  // A CIDR unique per run (two octets derived from runId) so this run finds its
  // own row regardless of what other runs left on the shared facility.
  const octetA = parseInt(runId.slice(0, 2), 16);
  const octetB = parseInt(runId.slice(2, 4), 16);
  const cidr = `10.${octetA}.${octetB}.0/24`;
  const label = `E2E ADM-03 ${runId}`;
  const editedLabel = `E2E ADM-03 ${runId} (đã sửa)`;

  test('a super admin adds, edits, and deletes an attendance IP range', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-adm03-sa-${runId}`, roles: ['super_admin'], facilityId })),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Quản trị', 'IP mạng', { role: 'super_admin' });
    await expect(page).toHaveURL(/\/admin\/network-ip/);

    // --- create: open the dialog, self-detect, then enter this run's range ---
    await page.getByRole('button', { name: 'Thêm dải mạng' }).click();
    const createDialog = page.locator('dialog').filter({ hasText: 'Thêm dải mạng' });

    // detectMyIp — clicking fires the query; on localhost the caller IP resolves
    // (127.0.0.1/::1), so it fills the CIDR field. Waiting for the field to be
    // non-empty confirms the detect settled before we overwrite it, so a late
    // detect response can't clobber our own CIDR.
    const cidrInput = createDialog.getByLabel('CIDR');
    await createDialog.getByRole('button', { name: /Lấy IP hiện tại/ }).click();
    await expect(cidrInput).not.toHaveValue('');

    await cidrInput.fill(cidr);
    await createDialog.getByLabel('Nhãn').fill(label);
    await createDialog.getByRole('button', { name: 'Tạo' }).click();

    // The new range appears, inactive. Never activate it.
    const row = page.getByRole('row', { name: new RegExp(cidr.replace(/[.]/g, '\\.')) });
    await expect(row).toBeVisible();
    await expect(row.getByText('Đang tắt')).toBeVisible();
    await expect(row.getByText(label, { exact: true })).toBeVisible();

    // --- edit: change the label, save ---
    await row.getByRole('button', { name: 'Sửa' }).click();
    const editDialog = page.locator('dialog').filter({ hasText: 'Sửa dải mạng' });
    await editDialog.getByLabel('Nhãn').fill(editedLabel);
    await editDialog.getByRole('button', { name: 'Lưu' }).click();
    await expect(row.getByText(editedLabel, { exact: true })).toBeVisible();

    // --- delete: confirm, then the row is gone (living falsification) ---
    // The delete confirmation is a ConfirmDialog (role=alertdialog), confirm
    // label "Xác nhận" — not the native <dialog> the create/edit forms use.
    await row.getByRole('button', { name: 'Xoá' }).click();
    const deleteDialog = page.getByRole('alertdialog');
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Xác nhận' }).click();
    await expect(page.getByRole('row', { name: new RegExp(cidr.replace(/[.]/g, '\\.')) })).toHaveCount(0);

    await context.close();
  });
});
