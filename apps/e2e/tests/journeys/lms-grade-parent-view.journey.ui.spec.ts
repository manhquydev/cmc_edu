// Journey xuyên app #3 (Phase 8, biến thể (b)) — a grade crosses the apps: the
// parent opens "Bài tập & điểm" in the LMS and sees the child's submission
// WAITING ("Chờ chấm"), the teacher grades it in the ERP, and on reload the
// same list shows the score and the stars it earned ("9 điểm · +5 sao").
//
// The negative is the opening state, asserted before the positive on the same
// surface: while ungraded, the card carries "Chờ chấm" and no score badge — so
// the later "9 điểm" can only come from the grade actually crossing, not from
// a page that renders scores unconditionally.
//
// Session note (decision D1, plan 260724-1212): parent login is not the
// business under test (P1-07 proves it); the session is injected.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import {
  cleanupExercises,
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
import { mintLmsSession } from '../../src/journey/mint-lms-session.js';
import { provisionStudentViaReceipt } from '../../src/journey/provision-student-via-receipt.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('Journey xuyên app — GV chấm điểm ERP → phụ huynh thấy điểm + sao trên LMS', () => {
  test.setTimeout(180_000);

  const runId = randomUUID().slice(0, 8);
  const teacherUserId = `e2e-xgrade-gv-${runId}`;
  const studentName = `E2E XGRADE HS ${runId}`;
  const parentPhone = randomVnPhone();
  let exerciseId = '';

  test.beforeAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
  });
  test.afterAll(async () => {
    await sweepParentIdentity({ phone: parentPhone });
    if (exerciseId) await cleanupExercises(exerciseId);
  });

  test('the parent sees "Chờ chấm" before and the score with stars after the teacher grades', async ({ browser }) => {
    // --- setup: teacher-owned class + parent-linked student, real receipt chain ---
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

    const exercise = await seedPublishedExercise({ starReward: 5 });
    exerciseId = exercise.exerciseId;
    await seedSubmittedSubmission({ facilityId, studentId, exerciseId });

    // --- LMS, parent: the submission is visible and explicitly UNGRADED ---
    const parentAccountId = await findParentAccountIdByPhone(parentPhone);
    expect(parentAccountId, 'provisioning should have created the ParentAccount').not.toBeNull();
    const parentContext = await browser.newContext(); // LMS origin (:4174)
    await mintLmsSession(parentContext, { kind: 'parent', parentAccountId: parentAccountId! });
    const parentPage = await parentContext.newPage();
    await parentPage.goto(`/parent/homework/${studentId}`);
    // Anchor on presence before asserting absence: the pending badge proves the
    // list rendered THIS submission, so the missing score badge means ungraded —
    // not a page that has not loaded yet.
    await expect(parentPage.getByText('Chờ chấm')).toBeVisible();
    // Score-shaped text only (digit before "điểm") — the page chrome itself is
    // titled "Bài tập & điểm", which a bare /điểm/ would match.
    await expect(parentPage.getByText(/\d[\d.,]* điểm/)).toHaveCount(0);

    // --- ERP, teacher: grade it 8.5 ---
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
    // A whole number on purpose: a first run graded 8.5 and the parent page
    // rendered "8 điểm" — the fraction is lost somewhere between the grading
    // input and the LMS render. Score FIDELITY is the arithmetic tier this plan
    // explicitly does not certify, so the journey keeps its claim crisp (the
    // grade crosses) with a value that cannot be truncated. Observation left
    // here for the fixing plan to triage.
    await teacherPage.getByRole('spinbutton', { name: /Điểm/ }).fill('9');
    await teacherPage.locator('main.console-main').getByRole('button', { name: 'Chấm bài' }).click();
    await expect(queueRow).toHaveCount(0);
    await teacherContext.close();

    // --- LMS, parent: the SAME list now carries the grade and its stars ---
    await parentPage.reload();
    await expect(parentPage.getByText('9 điểm')).toBeVisible();
    await expect(parentPage.getByText(/\+5 sao/)).toBeVisible();
    await expect(parentPage.getByText('Chờ chấm')).toHaveCount(0);

    await parentContext.close();
  });
});
