// P2-08 journey (teacher half) — Gửi ảnh & tóm tắt buổi cho PH: a teacher picks
// a class they own and one of its sessions, writes a summary, uploads a photo,
// and publishes the evidence to parents. The parent-view half (/parent/evidence,
// listForChild, photo consent) belongs to the cross-app LMS phase and is not
// covered here — the manifest note records the split.
//
// Ownership: the class/session lists are only facility-scoped, but the
// ownership gate is load-bearing at sessionEvidence.upsert
// (assertTeacherOwnsClass matches subject.userId → ClassBatch.teacherAppUserId).
// The class is seeded with this teacher as owner and the session shares the
// teacher's userId, so "Lưu tóm tắt" succeeds; a non-owner would have upsert
// throw FORBIDDEN, leaving no evidence id and the file input never rendering.
// The photo upload is real (setInputFiles → POST /upload/session-photo, which
// requires an image content-type; blob storage is local disk in this env).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import { seedAppUser, seedClassBatch } from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

// A real 1x1 PNG — the upload route requires image/png|jpeg|webp; a non-image
// body is rejected. It does not parse the pixels, so 1x1 is enough.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P2-08 journey (nửa GV) — gửi ảnh & tóm tắt buổi, công bố cho phụ huynh', () => {
  const runId = randomUUID().slice(0, 8);
  const teacherUserId = `e2e-p208-teacher-${runId}`;
  let classCode = '';

  test.beforeAll(async () => {
    const teacher = await seedAppUser({ facilityId, userId: teacherUserId, roles: ['giao_vien'] });
    const batch = await seedClassBatch({ facilityId, teacherAppUserId: teacher.id });
    classCode = batch.code;
  });

  test('a teacher writes a summary, attaches a photo, and publishes the evidence', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: teacherUserId, roles: ['giao_vien'], facilityId })),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Giảng dạy', 'Nhật ký buổi học', { role: 'giao_vien' });
    await expect(page).toHaveURL(/\/teaching\/session-evidence/);

    // 1. Pick the class (searchable Selector renders as a button) by its code.
    await page.getByRole('button', { name: /Chọn lớp học/ }).click();
    await page.getByRole('option', { name: new RegExp(classCode) }).click();

    // 2. Pick a session (non-search Selector renders as a combobox). Only this
    //    freshly-seeded class's sessions are listed, so the first is ours.
    await page.getByRole('combobox', { name: /Chọn buổi học/ }).click();
    await page.getByRole('option').first().click();

    // 3. Summary, then save — this creates the evidence the photo attaches to.
    await page.getByRole('textbox', { name: /Tóm tắt buổi học/ }).fill(`Buổi học E2E ${runId} — tổng kết.`);
    await page.getByRole('button', { name: 'Lưu tóm tắt' }).click();

    // 4. Attach a photo through the hidden file input, and wait for it to land
    //    — the "Ảnh đã upload (1)" counter proves the async upload + addPhoto
    //    completed, so the photo half of the flow is genuinely exercised.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'p208.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText('Ảnh đã upload (1)')).toBeVisible();

    // 5. Publish to parents. The success state is the "Đã công bố" badge, which
    //    is the living proof — it appears only after a real publish.
    await expect(page.getByRole('button', { name: 'Công bố cho phụ huynh' })).toBeVisible();
    await page.getByRole('button', { name: 'Công bố cho phụ huynh' }).click();
    // "Đã công bố" renders both as a status line and a badge — either confirms
    // the publish; assert one and that the publish button is gone.
    await expect(page.getByText('Đã công bố').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Công bố cho phụ huynh' })).toHaveCount(0);

    await context.close();
  });
});
