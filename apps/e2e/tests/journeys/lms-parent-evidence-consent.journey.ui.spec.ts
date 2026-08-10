// P2-08 journey (nửa phụ huynh) — the cross-app half the teacher-side spec
// deliberately left out: a teacher publishes session evidence in the ERP, and the
// PARENT sees it in the LMS at /parent/evidence/:studentId
// (sessionEvidence.listForChild), with the photo-consent gate
// (guardian.setPhotoConsent) enforced in between.
//
// The consent negative is asserted FIRST, before any positive: with consent off,
// the published summary must be readable while the photos stay withheld. Only
// then does the parent switch consent on and the photos appear. Written this way
// round on purpose — a consent gate that never blocks anything would otherwise
// hide behind a passing "photos are visible" assertion.
//
// Data crosses the apps the way it does in production: the class, its session and
// the evidence are created by real staff in the ERP, and the parent/student
// identities come from the real receipt money chain, so nothing is handed between
// contexts except what a real parent would already have — their own session.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import {
  findEnrollmentByClassAndStudentName,
  findParentAccountIdByPhone,
  seedAppUser,
  seedClassBatch,
  sweepParentIdentity,
} from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { mintLmsSession } from '../../src/journey/mint-lms-session.js';
import { provisionStudentViaReceipt } from '../../src/journey/provision-student-via-receipt.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

// 1x1 PNG — the smallest upload that still exercises the real photo pipeline.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P2-08 journey (nửa PH) — GV công bố ảnh buổi học → phụ huynh xem, qua cổng đồng ý ảnh', () => {
  test.setTimeout(180_000);

  const runId = randomUUID().slice(0, 8);
  const teacherUserId = `e2e-p208p-gv-${runId}`;
  const studentName = `E2E P208P HS ${runId}`;
  const parentPhone = randomVnPhone();
  const summaryText = `Buổi học E2E ${runId} — tóm tắt gửi phụ huynh.`;

  // ParentAccount is keyed by phone and is not facility-scoped, so it outlives
  // this run's facility teardown. Sweep both sides.
  test.beforeAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });
  test.afterAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });

  test('a parent reads the published session summary, and photos appear only once consent is on', async ({ browser }) => {
    // --- setup: a teacher, their class, and a parent-linked student inside it ---
    const teacher = await seedAppUser({ facilityId, userId: teacherUserId, roles: ['giao_vien'] });
    const batch = await seedClassBatch({ facilityId, teacherAppUserId: teacher.id });
    await provisionStudentViaReceipt(browser, {
      facilityId,
      classCode: batch.code,
      studentName,
      parentPhone,
      runId,
    });

    // --- ERP: the teacher writes the summary, attaches a photo and publishes ---
    const teacherContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const teacherPage = await teacherContext.newPage();
    await teacherContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: teacherUserId, roles: ['giao_vien'], facilityId })),
    );
    await teacherPage.goto('/cockpit');
    await menuNav(teacherPage, 'Giảng dạy', 'Nhật ký buổi học', { role: 'giao_vien' });

    await teacherPage.getByRole('combobox', { name: /Chọn lớp học/ }).click();
    await teacherPage.getByRole('option', { name: new RegExp(batch.code) }).click();
    await teacherPage.getByRole('combobox', { name: /Chọn buổi học/ }).click();
    await teacherPage.getByRole('option').first().click();

    await teacherPage.getByRole('textbox', { name: /Tóm tắt buổi học/ }).fill(summaryText);
    await teacherPage.getByRole('button', { name: 'Lưu tóm tắt' }).click();
    await teacherPage.locator('input[type="file"]').setInputFiles({
      name: 'buoi-hoc.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(teacherPage.getByText('Ảnh đã upload (1)')).toBeVisible();
    // Publish now goes through a confirm dialog ("Công bố nhật ký cho phụ
    // huynh?"); the real publish only runs when its own "Công bố" is clicked.
    await teacherPage.getByRole('button', { name: 'Công bố cho phụ huynh' }).click();
    await teacherPage
      .getByRole('alertdialog', { name: 'Công bố nhật ký cho phụ huynh?' })
      .getByRole('button', { name: 'Công bố' })
      .click();
    await expect(teacherPage.getByText('Đã công bố').first()).toBeVisible();
    await teacherContext.close();

    // --- LMS: the parent opens their own child's evidence page ---
    const enrollment = await findEnrollmentByClassAndStudentName({
      facilityId,
      classBatchId: batch.classBatchId,
      studentName,
    });
    expect(enrollment, 'provisioning should have enrolled the student').not.toBeNull();
    const parentAccountId = await findParentAccountIdByPhone(parentPhone);
    expect(parentAccountId, 'provisioning should have created the ParentAccount').not.toBeNull();

    // LMS runs on :4174; this context is deliberately left on the suite default.
    const parentContext = await browser.newContext();
    await mintLmsSession(parentContext, { kind: 'parent', parentAccountId: parentAccountId! });
    const parentPage = await parentContext.newPage();
    await parentPage.goto(`/parent/evidence/${enrollment!.studentId}`);

    // --- NEGATIVE FIRST: consent is off, so the summary crosses but photos do not ---
    await expect(parentPage.getByText(summaryText)).toBeVisible();
    await expect(parentPage.getByRole('img', { name: 'Ảnh buổi học' })).toHaveCount(0);

    // --- the parent turns consent on, from the screen's own shortcut ---
    await parentPage.getByRole('button', { name: /Quản lý đồng ý ảnh/ }).click();
    await expect(parentPage).toHaveURL(/\/parent\/consent\//);
    await Promise.all([
      parentPage.waitForResponse((r) => r.url().includes('guardian.setPhotoConsent') && r.status() === 200),
      parentPage.getByRole('button', { name: 'Bật đồng ý chia sẻ ảnh' }).click(),
    ]);

    // --- POSITIVE: the same page now serves the photo ---
    await parentPage.goto(`/parent/evidence/${enrollment!.studentId}`);
    await expect(parentPage.getByText(summaryText)).toBeVisible();
    await expect(parentPage.getByRole('img', { name: 'Ảnh buổi học' }).first()).toBeVisible();

    await parentContext.close();
  });
});
