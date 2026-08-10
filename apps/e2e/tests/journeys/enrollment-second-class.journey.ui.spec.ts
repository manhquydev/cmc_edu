// P1-05 journey — Kích hoạt ghi danh khi đóng phí (/admin/students,
// /admin/students/:id).
//
// Manifest cross-check (step 2 of phase-05-journey-10-luong-loi.md):
// flow-manifest.ts's P1-05 entry expects
// `enrollment.enroll, finance.receiptApprove, student.lookup` (among others)
// at `/admin/students` + `/admin/students/:id`. Deliberate scope choice
// (per this phase's own guidance): `enrollment.enroll` is exercised for real
// here — NOT as a side-effect of receipt-approval provisioning (that is F2's
// scenario, a brand-new student), but as `class-placement.tsx`'s OWN reason
// to exist: an ALREADY-ACTIVE student joining a SECOND class. Sequence:
//   1. A receipt-approval cycle (F1/F2 pattern) creates the student and
//      activates their first Enrollment — this is the only way a Student row
//      ever comes to exist (apps/api/src/provisioning/provision-from-receipt.ts,
//      same finding F2's header documents).
//   2. `sale` looks the now-existing student up by NAME (`student.lookup`,
//      the same key `/admin/students`'s own search uses) on `Xếp lớp`, and
//      places them into a SECOND seeded class via a real `enrollment.enroll`
//      click — the scenario `class-placement.tsx`'s own on-page banner
//      ("Màn hình này dành cho học viên đã có trong hệ thống") describes.
//
// Grep finding worth recording (2026-07-24): `enrollment.blockLms`,
// `student.resetPassword`, `student.get`, and `student.getManyByIds` — all
// named in this flow's manifest entry — have ZERO consumers anywhere under
// `apps/admin/src` (`grep -rn` on all four across the whole admin app).
// `student-detail.tsx` (`/admin/students/:id`) only ever calls
// `student.setLifecycle`, a procedure this manifest entry does not even
// list. This is a manifest/UI drift this journey does not attempt to paper
// over — it drives the 3 procedures + both routes that genuinely DO have a
// real UI path (`enrollment.enroll`, `finance.receiptApprove`,
// `student.lookup`, `/admin/students`, `/admin/students/:id`), which is a
// real, substantial intersection with the manifest's `expected` block (H2's
// bar), not full coverage of it.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { withFacility } from '@cmc/db';
import { mintStaffCookie } from '../../src/session-injection.js';
import { seedClassBatch, getDb } from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P1-05 journey — kích hoạt ghi danh, rồi xếp thêm lớp thứ hai', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('receipt approval activates the student, then sale looks them up by name and enrolls them into a second class', async ({
    browser,
  }) => {
    const classA = await seedClassBatch({ facilityId });
    const classB = await seedClassBatch({ facilityId });

    const studentName = `E2E P1-05 Student ${randomUUID().slice(0, 8)}`;
    const parentPhone = randomVnPhone();

    // --- sale: real receipt for a brand-new student in class A ---
    const saleContext1 = await browser.newContext();
    const salePage1 = await saleContext1.newPage();
    const saleUserId = `e2e-p105-sale-${randomUUID().slice(0, 8)}`;
    const saleCookie = mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId });
    await saleContext1.addCookies(cookiePair(STAFF_COOKIE_NAME, saleCookie));
    await salePage1.goto('/cockpit');

    await menuNav(salePage1, 'Tài chính & Điều hành', 'Xếp lớp', { role: 'sale' });
    await salePage1.getByText('tạo phiếu thu mới').click();
    await expect(salePage1).toHaveURL(/\/finance\/new/);

    await salePage1.getByLabel('Họ tên học viên').fill(studentName);
    await salePage1.getByLabel('SĐT phụ huynh').fill(parentPhone);
    // Required by receipt-create.tsx's validate() — the parent's LMS OTP
    // login credential, without it the real submit stays client-side blocked.
    await salePage1.getByLabel('Email phụ huynh').fill(`e2e-p105-parent-${randomUUID().slice(0, 8)}@e2e.cmc`);
    await salePage1.getByRole('combobox', { name: /^Lớp học/ }).click();
    await salePage1.getByRole('option', { name: new RegExp(classA.code) }).click();
    await salePage1.getByRole('spinbutton', { name: /^Học phí/ }).fill('5000001');
    await salePage1.getByRole('button', { name: 'Tạo phiếu thu' }).click();
    // `sale` lacks `finance.receiptGet` (packages/auth), so receipt-create.tsx's
    // own onSuccess does NOT navigate `sale` to `/finance/:id` — it stays on
    // `/finance/new` and shows the receipt's code in an in-place success
    // banner instead. The approver below finds this receipt by the displayed
    // student name, not by an id `sale` never observes.
    await expect(salePage1.getByText(/^Đã tạo phiếu thu /)).toBeVisible();
    await saleContext1.close();

    // --- GĐKD: approve -> provisioning creates the Student + activates
    // the first Enrollment (class A) ---
    const gdkdContext = await browser.newContext();
    const gdkdPage = await gdkdContext.newPage();
    const gdkdCookie = mintStaffCookie({
      userId: `e2e-p105-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await gdkdContext.addCookies(cookiePair(STAFF_COOKIE_NAME, gdkdCookie));
    await gdkdPage.goto('/cockpit');

    await menuNav(gdkdPage, 'Tài chính & Điều hành', 'Phiếu thu', { role: 'giam_doc_kinh_doanh' });
    const receiptRow = await findInList(gdkdPage, (text) => text.includes(studentName));
    await receiptRow.click();
    await expect(gdkdPage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
    await gdkdPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    const dialog = gdkdPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    await expect(
      gdkdPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
    ).toBeVisible();
    await gdkdContext.close();

    // --- sale: look the now-active student up by NAME on Xếp lớp, place
    // them into a SECOND class — the real, direct enrollment.enroll click ---
    const saleContext2 = await browser.newContext();
    const salePage2 = await saleContext2.newPage();
    const saleCookie2 = mintStaffCookie({ userId: saleUserId, roles: ['sale'], facilityId });
    await saleContext2.addCookies(cookiePair(STAFF_COOKIE_NAME, saleCookie2));
    await salePage2.goto('/cockpit');

    await menuNav(salePage2, 'Tài chính & Điều hành', 'Xếp lớp', { role: 'sale' });
    await salePage2.getByRole('button', { name: 'Tên học viên' }).click();
    await salePage2.getByLabel('Tên học viên').fill(studentName);
    await salePage2.getByRole('button', { name: 'Tìm', exact: true }).click();

    await expect(salePage2.getByText(studentName)).toBeVisible();
    await salePage2.getByText(studentName).click();

    await salePage2.getByRole('combobox', { name: /^Lớp học/ }).click();
    await salePage2.getByRole('option', { name: new RegExp(classB.code) }).click();
    // "Xác nhận xếp lớp" now opens a ConfirmDialog (UI-cohesion refactor) — the
    // real enrollment.enroll click only fires from the dialog's "Xếp lớp" button.
    await salePage2.getByRole('button', { name: 'Xác nhận xếp lớp' }).click();
    const enrollDialog = salePage2.getByRole('alertdialog');
    await expect(enrollDialog).toBeVisible();
    await enrollDialog.getByRole('button', { name: 'Xếp lớp', exact: true }).click();

    await expect(salePage2.getByText('Đã xếp lớp thành công')).toBeVisible();

    // --- back on /admin/students: real nav, real search, real detail route ---
    await menuNav(salePage2, 'Lớp & Học sinh', 'Học viên', { role: 'sale' });
    await expect(salePage2).toHaveURL(/\/admin\/students$/);

    // Students search is now a reactive FilterBar (label "Tìm kiếm"); student.lookup
    // fires on input once ≥2 chars — no submit button to click.
    await salePage2.getByLabel('Tìm kiếm').fill(studentName);

    const studentRow = await findInList(salePage2, (text) => text.includes(studentName));
    await studentRow.click();
    await expect(salePage2).toHaveURL(/\/admin\/students\/[0-9a-f-]{36}$/);
    await expect(salePage2.getByRole('heading', { name: studentName })).toBeVisible();

    await saleContext2.close();

    // ── business invariant ──
    // The green above proves the screens are reachable; it does not prove the
    // money-chain produced the right ENROLLMENT state. Two distinct writes ran:
    // receipt approval provisioning activated the class-A seat
    // (activate-enrollment.ts flips reserved→active — the only path to `active`),
    // and the direct enrollment.enroll click created the class-B seat as
    // `reserved`. Student.lifecycle defaults to `active` at creation, so it would
    // be tautological to check; the enrollment status flip is the real product of
    // approving the receipt. No staff read-proc returns enrollment status
    // (enrollment.mine is parent-only), so this reads the rows back directly with
    // an RLS bypass — the same getDb() seam the suite's other no-read-proc
    // readbacks use. This turns P1-05 from reachable-only into verified-correct.
    const enrollments = await withFacility(
      getDb(),
      null,
      (tx) =>
        tx.enrollment.findMany({
          where: { facilityId, student: { fullName: studentName } },
          select: { classBatchId: true, status: true },
        }),
      { bypass: true },
    );
    assertBusinessInvariant(
      'học viên có đúng 2 lượt ghi danh (lớp A đã đóng phí + lớp B xếp thêm)',
      enrollments.length,
      2,
    );
    const classAEnrollment = enrollments.find((e) => e.classBatchId === classA.classBatchId);
    assertBusinessInvariant(
      'ghi danh lớp A được kích hoạt khi duyệt phiếu thu (reserved→active)',
      classAEnrollment?.status,
      'active',
    );
    const classBEnrollment = enrollments.find((e) => e.classBatchId === classB.classBatchId);
    assertBusinessInvariant(
      'ghi danh lớp B (xếp thêm, chưa đóng phí) ở trạng thái reserved',
      classBEnrollment?.status,
      'reserved',
    );
  });
});
