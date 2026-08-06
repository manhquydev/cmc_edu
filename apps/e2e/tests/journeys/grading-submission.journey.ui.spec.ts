// P2-06 journey — Chấm bài & cộng sao: a teacher grades a student's submission
// through the real UI, and the graded work leaves the ungraded queue.
//
// What this proves and what it does not: the grading screen shows only the
// ungraded ('submitted') queue and has no view of graded work, and its "⭐ +1
// sao" banner is transient — the grade triggers a refetch that drops the now-
// graded submission from the queue and unmounts the detail pane with it. So the
// stable, UI-observable outcome is the queue transition: the submission is in
// the queue, the teacher grades it, and it is gone. The star-award rule itself
// (awarded once, on the submitted→graded transition, never on a re-grade) is
// covered server-side in attendance-grading.spec.ts; this journey proves the
// teacher's real grading path.
//
// Seeded prerequisites (all inert inputs to the grading act, not the act
// itself): a teacher, a class that teacher owns, a student enrolled in it, a
// published exercise, and a submission in 'submitted' state. The teacher's
// session shares the seeded teacher's userId so the server's per-submission
// ownership filter (assertTeacherOwnsStudentClass in listForGrading) lets this
// teacher see the submission. Grading itself is done entirely through the UI.

import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

import { mintStaffCookie } from '../../src/session-injection.js';
import {
  seedAppUser,
  seedClassBatch,
  seedActiveEnrollment,
  seedPublishedExercise,
  seedSubmittedSubmission,
  cleanupExercises,
} from '../../src/db.js';
import { menuNav } from '../../src/journey/menu-nav.js';
import { createE2eStaffClient } from '../../src/trpc-client.js';
import { assertBusinessInvariant } from '../../src/journey/assert-business.js';
import { STAFF_COOKIE_NAME } from '../../../api/src/auth/staff-session.js';

const facilityId = process.env.E2E_FACILITY_ID!;

function cookiePair(name: string, value: string) {
  return [
    { name, value, domain: '127.0.0.1', path: '/' },
    { name, value, domain: 'localhost', path: '/' },
  ];
}

test.describe('P2-06 journey — chấm bài (GV chấm bài nộp, bài rời hàng đợi)', () => {
  const runId = randomUUID().slice(0, 8);
  const teacherUserId = `e2e-p206-teacher-${runId}`;
  const studentName = `E2E P2-06 Student ${runId}`;
  let exerciseId = '';

  test.beforeAll(async () => {
    // A teacher, and a class that teacher owns.
    const teacher = await seedAppUser({ facilityId, userId: teacherUserId, roles: ['giao_vien'] });
    const batch = await seedClassBatch({ facilityId, teacherAppUserId: teacher.id });
    // A student enrolled in that class — this is what makes the submission
    // visible to the teacher (ownership is resolved through the student's class).
    const enrollment = await seedActiveEnrollment({
      facilityId,
      classBatchId: batch.classBatchId,
      studentName,
    });
    // A published exercise and a submission waiting to be graded.
    const exercise = await seedPublishedExercise();
    exerciseId = exercise.exerciseId;
    await seedSubmittedSubmission({ facilityId, studentId: enrollment.studentId, exerciseId });
  });

  test.afterAll(async () => {
    // The global exercise is not facility-scoped, so the facility teardown does
    // not remove it — clean it up explicitly.
    if (exerciseId) await cleanupExercises(exerciseId);
  });

  test('a teacher grades an ungraded submission and it leaves the queue', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://localhost:4173' });
    const page = await context.newPage();
    // Same userId as the seeded teacher, so the ownership filter lets this
    // session see the submission.
    await context.addCookies(
      cookiePair(STAFF_COOKIE_NAME, mintStaffCookie({ userId: teacherUserId, roles: ['giao_vien'], facilityId })),
    );
    await page.goto('/cockpit');

    await menuNav(page, 'Giảng dạy', 'Chấm bài', { role: 'giao_vien' });
    await expect(page).toHaveURL(/\/teaching\/grading/);

    // The list identifies each submission by the student's full name when one
    // is set (grading.tsx: `item.studentFullName ?? \`HS: ${prefix}\``) — the
    // "HS: <id prefix>" form is only the fallback for a nameless student,
    // which this seeded one is not. It is present before grading — this is
    // the falsifiable pre-condition.
    const queueRow = page.getByText(studentName);
    await expect(queueRow).toBeVisible();
    await queueRow.click();

    const scoreInput = page.getByRole('spinbutton', { name: /Điểm/ });
    await expect(scoreInput).toBeVisible();
    await scoreInput.fill('8');
    // "Chấm bài" is also the side-nav entry for this screen — scope to content.
    await page.locator('main.o-main').getByRole('button', { name: 'Chấm bài' }).click();

    // Falsification of the grade: once graded, the submission leaves the
    // ungraded queue. If the grade had not taken effect the row would remain.
    await expect(queueRow).toHaveCount(0);

    // ── business invariant ──
    // The queue transition proves the submission was graded, but says nothing
    // about WHICH score was stored — a grade of 0 would drop the row just the
    // same. The grading screen has no view of graded work, so read it back with
    // the SAME teacher role (which holds `submission.grade` and passes the
    // per-submission ownership filter, assertTeacherOwnsStudentClass): the
    // `status: 'graded'` queue (the enum accepts it, listForGradingInput) now
    // returns this student's row. Matching by studentFullName (the display name
    // toSubmissionDto joins for the grading queue) isolates it; asserting
    // `.score === 8` proves the typed number persisted intact (score is an Int
    // column and the `grade` input now rejects fractional scores), and
    // `.status === 'graded'` proves the submitted→graded transition. Turns P2-06 from
    // reachable-only into verified-correct. Read-path is the authorized query
    // under RLS facility scope, not a DB back-door.
    const teacherClient = createE2eStaffClient(process.env.E2E_BASE_URL!, {
      userId: teacherUserId,
      roles: ['giao_vien'],
      facilityId,
    });
    const { items } = await teacherClient.submission.listForGrading.query({
      exerciseId,
      status: 'graded',
    });
    const graded = items.find((s) => s.studentFullName === studentName);
    expect(graded, `graded submission for "${studentName}" phải đọc lại được ở hàng đợi đã chấm`).toBeTruthy();
    assertBusinessInvariant('bài đã chấm lưu đúng điểm đã nhập', graded!.score, 8);
    assertBusinessInvariant('bài đã chấm chuyển trạng thái graded', graded!.status, 'graded');

    await context.close();
  });
});
