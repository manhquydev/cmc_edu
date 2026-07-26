// ADM-01 journey — Quản trị cơ sở: a super admin creates a facility and edits
// its name. Covers the three declared procedures: facility.create (the dialog),
// facility.list (the row appearing), facility.update (the edit dialog). There is
// no facility.delete procedure, so the created facility is cleaned up directly
// on the privileged connection in afterAll rather than left as residue.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { deleteFacilityByCode } from '../../src/db.js';
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

test.describe('ADM-01 journey — quản trị cơ sở (tạo + sửa tên)', () => {
  test.use({ baseURL: 'http://localhost:4173' });

  const runId = randomUUID().slice(0, 8);
  const facilityCode = `E2E-ADM01-${runId.toUpperCase()}`;
  const facilityName = `E2E ADM-01 Cơ sở ${runId}`;
  const editedName = `E2E ADM-01 Cơ sở ${runId} (đã sửa)`;

  test.afterAll(async () => {
    // No facility.delete procedure exists; reclaim the created facility directly.
    await deleteFacilityByCode(facilityCode);
  });

  test('a super admin creates a facility and edits its name', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-adm01-sa-${runId}`, roles: ['super_admin'], facilityId })),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Quản trị', 'Cơ sở', { role: 'super_admin' });
    await expect(page).toHaveURL(/\/admin\/facilities/);

    // --- create the facility ---
    await page.getByRole('button', { name: 'Thêm cơ sở' }).click();
    const createDialog = page.locator('dialog').filter({ hasText: 'Thêm cơ sở' });
    await createDialog.getByLabel('Tên cơ sở').fill(facilityName);
    await createDialog.getByLabel('Mã cơ sở').fill(facilityCode);
    await createDialog.getByRole('button', { name: 'Tạo' }).click();

    // The new facility appears in the list (facility.list).
    const row = await findInList(page, (text) => text.includes(facilityCode));
    await expect(row.getByText(facilityName, { exact: true })).toBeVisible();

    // --- edit its name (clicking the row opens the edit modal) ---
    await row.click();
    const editDialog = page.locator('dialog').filter({ hasText: `Sửa tên — ${facilityCode}` });
    await editDialog.getByLabel('Tên cơ sở').fill(editedName);
    await editDialog.getByRole('button', { name: 'Lưu' }).click();

    // The row now shows the edited name — the write persisted.
    const editedRow = await findInList(page, (text) => text.includes(facilityCode));
    await expect(editedRow.getByText(editedName, { exact: true })).toBeVisible();

    await context.close();
  });
});
