// P4-01 journey (vòng đời xuyên app) — the full star economy across both apps:
// a teacher grades the student's homework in the ERP (which mints the stars), a
// director publishes a gift, the STUDENT redeems it in the LMS
// (rewards.redeem — the student-gated half the ERP-side spec cannot reach), and
// the director approves and delivers the redemption back in the ERP.
//
// The balance proof never scrapes numbers. The gift costs 3 stars and grading
// awards 5, so the card's own button renders "Đổi quà" (affordable) before the
// redeem and flips to "Chưa đủ sao" (2 < 3) after the deduction — the rendered
// affordability state IS the balance assertion, on the same card both times.
//
// Session note (decision D1, plan 260724-1212): login/activation is NOT the
// business under test here — it has its own proven journey (P1-04) — so the
// student session is injected via mintLmsSession and the provisioned account's
// must-change-password flag is cleared to match (clearMustChangePassword).

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import {
  cleanupExercises,
  clearMustChangePassword,
  findEnrollmentByClassAndStudentName,
  findParentAccountIdByPhone,
  seedAppUser,
  seedClassBatch,
  seedPublishedExercise,
  seedSubmittedSubmission,
  sweepParentIdentity,
} from '../../src/db.js';
import { randomVnPhone } from '../../src/random-vn-phone.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { findInList } from '../../src/journey/find-in-list.js';
import { mintLmsSession } from '../../src/journey/mint-lms-session.js';
import { provisionStudentViaReceipt } from '../../src/journey/provision-student-via-receipt.js';
import { createE2eLmsStudentClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P4-01 journey (xuyên app) — chấm bài sinh sao → học sinh đổi quà LMS → GĐ duyệt & giao', () => {
  test.setTimeout(180_000);

  const runId = randomUUID().slice(0, 8);
  const teacherUserId = `e2e-p401-gv-${runId}`;
  const studentName = `E2E P401 HS ${runId}`;
  const parentPhone = randomVnPhone();
  const giftName = `E2E P401 Quà ${runId}`;
  let exerciseId = '';

  test.beforeAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });
  test.afterAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
    // The curriculum exercise is global, not facility-scoped — reclaim it.
    if (exerciseId) await cleanupExercises(exerciseId);
  });

  test('stars earned by grading are spent in the LMS and the redemption is delivered in the ERP', async ({ browser }) => {
    // --- setup: teacher-owned class, and a parent-linked student inside it
    // created through the real receipt chain (the only path that provisions a
    // StudentAccount the LMS session can represent) ---
    const teacher = await seedAppUser({ facilityId, userId: teacherUserId, roles: ['giao_vien'] });
    const batch = await seedClassBatch({ facilityId, teacherAppUserId: teacher.id });
    await provisionStudentViaReceipt(browser, {
      facilityId,
      classCode: batch.code,
      studentName,
      parentPhone,
      runId,
    });
    const enrollment = await findEnrollmentByClassAndStudentName({
      facilityId,
      classBatchId: batch.classBatchId,
      studentName,
    });
    expect(enrollment, 'provisioning should have enrolled the student').not.toBeNull();
    const studentId = enrollment!.studentId;

    // A submitted homework worth 5 stars, waiting in the teacher's queue.
    const exercise = await seedPublishedExercise({ starReward: 5 });
    exerciseId = exercise.exerciseId;
    await seedSubmittedSubmission({
      facilityId,
      studentId,
      exerciseId,
      classBatchId: batch.classBatchId,
    });

    // --- ERP, teacher: grade the submission — this is what MINTS the stars ---
    const teacherContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const teacherPage = await teacherContext.newPage();
    await teacherContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: teacherUserId, roles: ['giao_vien'], facilityId })),
    );
    await teacherPage.goto('/cockpit');
    await menuNav(teacherPage, 'Giảng dạy', 'Chấm bài', { role: 'giao_vien' });
    // The queue identifies each submission by `studentFullName` when set
    // (grading.tsx: `item.studentFullName ?? \`HS: ${prefix}\``) — the "HS:
    // <id prefix>" form is only the fallback for a nameless student, which
    // this seeded one (provisioned via a real receipt, real name) is not.
    const queueRow = teacherPage.getByText(studentName);
    await expect(queueRow).toBeVisible();
    await queueRow.click();
    // Whole-number grade: submission.grade now rejects fractional scores (Int
    // column), so this journey grades an integer — the star mint depends on the
    // grade landing, not on the score value.
    await teacherPage.getByRole('spinbutton', { name: /Điểm/ }).fill('8');
    await teacherPage.locator('main.console-main').getByRole('button', { name: 'Chấm bài' }).click();
    await expect(queueRow).toHaveCount(0);
    await teacherContext.close();

    // --- ERP, director: publish the gift the student will redeem (3 stars) ---
    const gdContext = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const gdPage = await gdContext.newPage();
    await gdContext.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: `e2e-p401-gd-${runId}`, roles: ['giam_doc_kinh_doanh'], facilityId })),
    );
    await gdPage.goto('/cockpit');
    await menuNav(gdPage, 'Gắn kết', 'Quà tặng', { role: 'giam_doc_kinh_doanh' });
    await gdPage.getByRole('button', { name: 'Thêm phần thưởng' }).click();
    await gdPage.getByLabel('Tên phần thưởng').fill(giftName);
    // NumberInput renders a spinbutton, not a labelled text input.
    await gdPage.getByRole('spinbutton', { name: 'Số sao cần' }).fill('3');
    await gdPage.getByRole('button', { name: 'Tạo', exact: true }).click();
    await expect(await findInList(gdPage, (text) => text.includes(giftName))).toBeVisible();

    // --- LMS, student: redeem it. Session injected per D1; the account is
    // marked activated to match (see file header). ---
    await clearMustChangePassword(studentId);
    const parentAccountId = await findParentAccountIdByPhone(parentPhone);
    expect(parentAccountId, 'provisioning should have created the ParentAccount').not.toBeNull();
    const studentContext = await browser.newContext(); // LMS origin (:4174)
    await mintLmsSession(studentContext, { kind: 'student', parentAccountId: parentAccountId!, studentId });
    const studentPage = await studentContext.newPage();
    await studentPage.goto('/student/gifts');

    // The card's button reading "Đổi quà" (not "Chưa đủ sao") is the rendered
    // proof the graded 5 stars arrived: affordability = balance ≥ 3.
    const giftCard = studentPage
      .locator('div')
      .filter({ hasText: giftName })
      .filter({ has: studentPage.getByRole('button', { name: /Đổi quà|Chưa đủ sao/ }) })
      .last();
    await expect(giftCard.getByRole('button', { name: 'Đổi quà' })).toBeVisible();
    await Promise.all([
      studentPage.waitForResponse((r) => r.url().includes('rewards.redeem') && r.status() === 200),
      giftCard.getByRole('button', { name: 'Đổi quà' }).click(),
    ]);
    await expect(
      studentPage.getByText('Đổi quà thành công! Nhân viên sẽ xác nhận và giao quà cho bạn.'),
    ).toBeVisible();
    // Deduction proof on the SAME card: 5 − 3 = 2 < 3, so it is no longer
    // affordable and its button flips.
    await expect(giftCard.getByRole('button', { name: 'Chưa đủ sao' })).toBeVisible();
    await studentContext.close();

    // --- ERP, director: the redemption reaches the staff queue; open the form
    // (list is index-only after form-depth) and approve then deliver it ---
    await menuNav(gdPage, 'Gắn kết', 'Đổi thưởng', { role: 'giam_doc_kinh_doanh' });
    const pendingRow = await findInList(gdPage, (text) => text.includes(giftName));
    // Form-depth: list is index-only → Mở phiếu → UUID form, then ConfirmDialog.
    await pendingRow.getByRole('button', { name: 'Mở phiếu' }).click();
    await expect(gdPage).toHaveURL(/\/admin\/engagement\/rewards\/[0-9a-f-]{36}/i);

    await gdPage.getByRole('button', { name: 'Duyệt', exact: true }).click();
    const approveDialog = gdPage.getByRole('alertdialog');
    await expect(approveDialog).toBeVisible();
    await approveDialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(gdPage.getByText(/Đã duyệt yêu cầu đổi quà/)).toBeVisible();
    await expect(gdPage.getByText('Đã duyệt').first()).toBeVisible();

    await gdPage.getByRole('button', { name: 'Giao quà', exact: true }).click();
    const deliverDialog = gdPage.getByRole('alertdialog');
    await expect(deliverDialog).toBeVisible();
    await deliverDialog.getByRole('button', { name: 'Giao quà', exact: true }).click();
    await expect(gdPage.getByText(/Đã giao quà/)).toBeVisible();
    await expect(gdPage.getByText('Đã giao').first()).toBeVisible();
    // Delivered is terminal — no further form HITL remains.
    await expect(gdPage.getByRole('button', { name: 'Duyệt', exact: true })).toHaveCount(0);
    await expect(gdPage.getByRole('button', { name: 'Giao quà', exact: true })).toHaveCount(0);
    await expect(gdPage.getByRole('button', { name: 'Từ chối', exact: true })).toHaveCount(0);

    // ── business invariant ──
    // The card's "Đổi quà" → "Chưa đủ sao" flip proves the balance crossed
    // below the gift's cost, but not the exact remaining number. Read the real
    // balance back from the student's own LMS session: `gift.listForStudent`
    // returns `starBalance` = SUM(StarTransaction.amount) for this student.
    // Grading minted 5 stars (seedPublishedExercise starReward: 5) and the
    // redeem spent the gift's 3, so the durable balance must be exactly 5 − 3 =
    // 2. Delivery is a reward status transition and does not touch
    // StarTransaction, so reading here (post-deliver) still yields 2. Uses the
    // same in-scope `parentAccountId` + `studentId` the UI session used — this
    // is the exact number the affordability UI only asserted a bound on.
    const studentClient = createE2eLmsStudentClient(process.env.E2E_BASE_URL!, {
      parentAccountId: parentAccountId!,
      studentId,
    });
    const { starBalance } = await studentClient.gift.listForStudent.query();
    assertBusinessInvariant('số dư sao sau đổi quà = sao kiếm được − giá quà', starBalance, 2);

    await gdContext.close();
  });
});
