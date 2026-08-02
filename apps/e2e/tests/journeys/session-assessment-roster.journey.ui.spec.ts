// F2 regression journey — session roster on "Nhận xét buổi học"
// (/teaching/session-assessment).
//
// One of the 3 flows that were dead for 16 days (docs/codebase-summary.md).
// The roster this screen shows comes from `attendance.listBySession` filtered
// to `status === 'present'` client-side (session-assessment.tsx) — gated by
// `attendance.mark` (apps/api/src/attendance/router.ts:259), the SAME key
// that gates writing attendance. `classBatch.listStudents` (`classRoster.read`)
// is used on this screen only for a name lookup, never as the roster source —
// this distinction is the actual incident this journey exists to catch
// (a prior draft of this plan targeted the wrong gate).
//
// Two PO-approved seed exceptions (2026-07-24, same phase-04 callout block) —
// both confirmed by exhaustive grep to have no real admin UI write path:
//   1. Course+ClassBatch (`seedClassBatch`) — no screen anywhere creates one.
//   2. The attendance WRITE (`seedPresentAttendance`) — `/teaching/attendance`
//      requires `?session=<id>` and nothing in the admin app links there with
//      a real session id (`attendance.markAll`/`listBySession` have exactly
//      one production consumer: that same page).
// Every other step below — staff/teacher provisioning, receipt create,
// receipt approve, and the roster READ this journey actually proves — goes
// through real UI.
//
// Deviation from the phase brief worth recording: the brief describes a
// separate "sale/GĐKD `enrollment.enroll`" step before receipt approval.
// Reading `apps/api/src/enrollment/activate-enrollment.ts` and
// `apps/api/src/provisioning/provision-from-receipt.ts` shows that mutation
// is NOT part of the brand-new-student path at all — `enrollment.enroll`
// requires an EXISTING `Student.id` (there is no `student.create` mutation
// anywhere; the only way a Student ever comes into existence is
// `findOrCreateStudent` inside `provisionFromReceipt`, itself only reachable
// from `finance.receiptApprove`). For a brand-new student, one approved
// receipt alone creates the Student AND activates the Enrollment
// (`activateEnrollmentForReceipt`'s own doc comment: "If no reserved
// enrollment exists for that student+class, create it as active during
// provisioning") — no separate enroll click exists or is needed. `Xếp lớp`
// (class-placement.tsx) is the real screen for a DIFFERENT scenario (an
// already-existing student joining another class), which this journey does
// not need to prove the roster-read regression. Dropping that step does not
// weaken the regression coverage: the incident was a read-permission bug on
// this screen, not on the enrollment-creation mechanism.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { mintStaffCookie } from '../../src/session-injection.js';
import {
  seedClassBatch,
  seedPresentAttendance,
  findEnrollmentByClassAndStudentName,
  findAppUserByUserId,
} from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { createStaffViaAdminUi } from '../../src/journey/create-staff-via-admin-ui.js';
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

test.describe('F2 journey — session roster (Nhận xét buổi học)', () => {
  // ui-chromium's baseURL defaults to the lms preview (:4174) — admin lives on
  // :4173 and every relative navigation/cookie domain below must target it.
  test.use({ baseURL: 'http://localhost:4173' });

  test('a real approved receipt activates the enrollment, attendance is recorded for the seeded session, and the assigned teacher sees a non-empty present roster', async ({
    browser,
  }) => {
    // Teacher identity: created via the real `/admin/users` super_admin UI
    // (`createStaffViaAdminUi`, same fix as F4's payroll-roster journey) —
    // `user.create` IS reachable in-app, just super_admin-gated
    // (nav-registry.ts). The roles modal assigns 'Giáo viên' for a
    // realistically-provisioned teacher account, though it is NOT what
    // actually grants this journey's permissions: every gate exercised below
    // (`requirePermission('attendance', 'mark')`,
    // `assertTeacherOwnsClass` — apps/api/src/attendance/assert-teacher-owns-class.ts)
    // reads `ctx.subject.roles` straight off the SIGNED COOKIE claims
    // (apps/api/src/context.ts: `subject: { userId: staffClaims.userId, roles:
    // staffClaims.roles }`), never the DB `AppUser.roles` column.
    // `assertTeacherOwnsClass` only needs the AppUser ROW to exist (matched by
    // `userId`) and its `id` to equal the ClassBatch's `teacherAppUserId` —
    // confirmed by reading both files before deciding, same as F4's own
    // "skip the roles modal" call for its (different) screen.
    const teacherUserId = `e2e-f2-teacher-${randomUUID().slice(0, 8)}`;
    await createStaffViaAdminUi(browser, {
      facilityId,
      userId: teacherUserId,
      fullName: 'E2E F2 Teacher',
      position: 'giao_vien',
      roleLabels: ['Giáo viên'],
    });
    // `user.create`'s response isn't observable from Playwright — read the
    // real `id` back (never a smuggled id: keyed on the exact `userId` this
    // journey's own admin-UI form just typed) for `seedClassBatch`'s
    // `teacherAppUserId` FK below.
    const teacher = await findAppUserByUserId({ facilityId, userId: teacherUserId });
    if (!teacher) {
      throw new Error(
        `F2 setup: no AppUser found for userId "${teacherUserId}" after createStaffViaAdminUi — ` +
          'creation did not persist as expected.',
      );
    }

    // Set directly rather than via a UI-driven `classBatch.assignTeacher`
    // step: the ClassBatch itself is already a seeded exception (extension 1
    // above), and `resolveTeacher`'s own validation (class-batch-router.ts)
    // is identical either way — this just avoids one more real-UI step that
    // adds no additional regression coverage over the roster-read assertion
    // this journey is actually proving.
    const seeded = await seedClassBatch({ facilityId, teacherAppUserId: teacher.id });

    const studentName = `E2E F2 Student ${randomUUID().slice(0, 8)}`;
    const parentPhone = randomVnPhone();

    // --- sale: real receipt for a brand-new student in the seeded class ---
    const saleContext = await browser.newContext();
    const salePage = await saleContext.newPage();
    const saleCookie = mintStaffCookie({
      userId: `e2e-f2-sale-${randomUUID().slice(0, 8)}`,
      roles: ['sale'],
      facilityId,
    });
    await saleContext.addCookies(cookiePair(STAFF_COOKIE_NAME, saleCookie));
    await salePage.goto('/cockpit');

    await menuNav(salePage, 'Tài chính & Điều hành', 'Xếp lớp', { role: 'sale' });
    await salePage.getByText('tạo phiếu thu mới').click();
    await expect(salePage).toHaveURL(/\/finance\/new/);

    await salePage.getByLabel('Họ tên học viên').fill(studentName);
    await salePage.getByLabel('SĐT phụ huynh').fill(parentPhone);
    // Required by receipt-create.tsx's validate() — the parent's LMS OTP
    // login credential, without it the real submit stays client-side blocked.
    await salePage.getByLabel('Email phụ huynh').fill(`e2e-f2-parent-${randomUUID().slice(0, 8)}@e2e.cmc`);
    await salePage.getByRole('button', { name: /^Lớp học/ }).click();
    await salePage.getByRole('option', { name: new RegExp(seeded.code) }).click();
    // NumberInput renders a native `min={1} step={100000}` spinbutton — the
    // browser's HTML5 step-mismatch constraint silently blocks submission for
    // a value that isn't `1 + k*100000` (see finance-receipt.journey.ui.spec.ts
    // for the full diagnosis). 5_000_001 satisfies it.
    await salePage.getByRole('spinbutton', { name: /^Học phí/ }).fill('5000001');

    await salePage.getByRole('button', { name: 'Tạo phiếu thu' }).click();
    await expect(salePage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);
    await saleContext.close();

    // --- GĐKD: find by displayed student name, approve -> provisioning
    // creates the Student AND activates the Enrollment atomically ---
    const approverContext = await browser.newContext();
    const approverPage = await approverContext.newPage();
    const approverCookie = mintStaffCookie({
      userId: `e2e-f2-gdkd-${randomUUID().slice(0, 8)}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    await approverContext.addCookies(cookiePair(STAFF_COOKIE_NAME, approverCookie));
    await approverPage.goto('/cockpit');

    await menuNav(approverPage, 'Tài chính & Điều hành', 'Phiếu thu', { role: 'giam_doc_kinh_doanh' });
    const row = await findInList(approverPage, (text) => text.includes(studentName));
    await row.click();
    await expect(approverPage).toHaveURL(/\/finance\/[0-9a-f-]{36}$/);

    await approverPage.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    const dialog = approverPage.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Duyệt & Kích hoạt' }).click();
    await expect(
      approverPage.getByText('Phiếu đã được duyệt — tài khoản LMS đã tạo và email thông báo đã gửi'),
    ).toBeVisible();
    await approverContext.close();

    // --- attendance seed exception: mark the now-active enrollment present
    // for the seeded session (see file header, extension 2). The enrollment/
    // student ids are recovered by a DB read keyed on the studentName a real
    // role's UI form already typed — never an id smuggled across contexts. ---
    const enrollment = await findEnrollmentByClassAndStudentName({
      facilityId,
      classBatchId: seeded.classBatchId,
      studentName,
    });
    if (!enrollment) {
      throw new Error(
        `F2 setup: no Enrollment found for student "${studentName}" in class ${seeded.code} after receipt approval — provisioning did not activate as expected.`,
      );
    }
    const sessionId = seeded.sessionIds[0]!;
    await seedPresentAttendance({
      facilityId,
      classSessionId: sessionId,
      enrollmentId: enrollment.enrollmentId,
      studentId: enrollment.studentId,
    });

    // --- teacher (owns the class via seeded teacherAppUserId): real UI
    // roster view — this is the actual regression assertion ---
    const teacherContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();
    const teacherCookie = mintStaffCookie({ userId: teacherUserId, roles: ['giao_vien'], facilityId });
    await teacherContext.addCookies(cookiePair(STAFF_COOKIE_NAME, teacherCookie));
    await teacherPage.goto('/cockpit');

    await menuNav(teacherPage, 'Giảng dạy', 'Nhận xét buổi học', { role: 'giao_vien' });
    await expect(teacherPage).toHaveURL(/\/teaching\/session-assessment/);

    await teacherPage.getByRole('button', { name: 'Chọn lớp học' }).click();
    await teacherPage.getByRole('option', { name: new RegExp(seeded.code) }).click();

    await teacherPage.getByRole('combobox', { name: 'Chọn buổi học' }).click();
    // `classSession.list` orders by `sessionDate asc` (class-session-router.ts)
    // — the same ascending order `seedClassBatch` created sessions in — so the
    // first option is guaranteed to be `seeded.sessionIds[0]`, the exact
    // session `seedPresentAttendance` above wrote against.
    await teacherPage.getByRole('option').first().click();

    // Non-empty per requirement — asserted in this order deliberately: the
    // present student's name is the POSITIVE signal that actually waits for
    // `attendance.listBySession` to settle (Playwright retries `toBeVisible`
    // up to its timeout). Checking the empty-state banner's ABSENCE first
    // would trivially pass before the query has even resolved (element
    // legitimately doesn't exist yet == "not visible"), which is exactly the
    // same false-negative class `menuNav.assertEntryAbsent`'s own settled-wait
    // comment warns about — so that check only means something once we
    // already know real data loaded.
    await expect(teacherPage.getByText(studentName)).toBeVisible();
    await expect(teacherPage.getByText('Chưa có học sinh có mặt', { exact: true })).toHaveCount(0);

    await teacherContext.close();
  });
});
