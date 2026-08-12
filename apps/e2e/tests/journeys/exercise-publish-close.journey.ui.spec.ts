// P2-04 journey — Cung cấp bài tập PDF: a training director authors an exercise
// (picks a curriculum unit, a type, uploads the PDF), then publishes it and
// closes it — the full draft → published → closed lifecycle through the real UI.
//
// The upload is a real one: setInputFiles drives the hidden file input, whose
// onChange POSTs the bytes to /upload/exercise-pdf (blob storage is local disk
// in this env, so it works without any cloud config). The curriculum unit is
// seeded with a unique title so this journey can find its own exercise row
// among any others on the screen — a unit is inert catalog data, not a
// mechanism this flow proves.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { seedCurriculumUnit, cleanupCurriculumUnits } from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

// A minimal, valid-enough PDF: the upload route checks only Content-Type and a
// non-empty body under the size cap — it does not parse PDF structure.
const MINIMAL_PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf8');

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P2-04 journey — cung cấp bài tập PDF (tạo → publish → đóng)', () => {
  const runId = randomUUID().slice(0, 8);
  const unitTitle = `E2E P2-04 Unit ${runId}`;
  let unitId = '';

  test.beforeAll(async () => {
    const seeded = await seedCurriculumUnit(unitTitle);
    unitId = seeded.unitId;
  });

  test.afterAll(async () => {
    // Removes the unit and the exercise the journey created against it.
    if (unitId) await cleanupCurriculumUnits(unitId);
  });

  test('a training director authors an exercise, publishes it, then closes it', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(
        STAFF_COOKIE_NAME,
        mintStaffCookie({ userId: `e2e-p204-gddt-${runId}`, roles: ['giam_doc_dao_tao'], facilityId }),
      ),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Giảng dạy', 'Bài tập', { role: 'giam_doc_dao_tao' });
    await expect(page).toHaveURL(/\/teaching\/exercises/);

    // --- author the exercise ---
    // Header action is "+ Tạo bài tập"; the dialog's submit is "Tạo bài tập".
    await page.getByRole('button', { name: '+ Tạo bài tập' }).click();

    // The searchable unit Selector renders as a button (the non-search type
    // Selector below is a combobox) — pick this run's own unit by its title.
    await page.getByRole('button', { name: /Đơn vị học/ }).click();
    await page.getByRole('option', { name: new RegExp(unitTitle) }).click();

    // Type selector.
    await page.getByRole('combobox', { name: /Loại bài tập/ }).click();
    await page.getByRole('option', { name: 'Bài tập về nhà' }).click();

    // Upload the PDF through the hidden file input — its onChange does the POST.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'p204.pdf',
      mimeType: 'application/pdf',
      buffer: MINIMAL_PDF,
    });
    await expect(page.getByText('PDF đã upload')).toBeVisible();

    // The dialog's create button (exact, to exclude the header "+ Tạo bài tập")
    // is enabled only once unit + type + pdf are set.
    await page.getByRole('button', { name: 'Tạo bài tập', exact: true }).click();

    // --- the new exercise appears as a draft row, found by its unit title ---
    const row = page.getByRole('row', { name: new RegExp(unitTitle) });
    await expect(row).toBeVisible();
    await expect(row.getByText('draft')).toBeVisible();

    // Form-depth: list is index-only → open the exercise form; Công bố / Đóng
    // live on the detail with ConfirmDialog. draft → published → closed is read
    // back off the form status badge, not assumed.
    await row.getByRole('button', { name: 'Mở phiếu' }).click();
    await expect(page).toHaveURL(/\/teaching\/exercises\/[0-9a-f-]{36}/i);

    await page.getByRole('button', { name: 'Công bố', exact: true }).click();
    await page
      .getByRole('alertdialog', { name: 'Công bố bài tập?' })
      .getByRole('button', { name: 'Công bố', exact: true })
      .click();
    await expect(page.getByText('Đã công bố').first()).toBeVisible();

    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await page
      .getByRole('alertdialog', { name: 'Đóng bài tập?' })
      .getByRole('button', { name: 'Đóng bài tập', exact: true })
      .click();
    await expect(page.getByText('Đã đóng').first()).toBeVisible();

    await context.close();
  });
});
