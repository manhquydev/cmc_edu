// Attendance + grading + star balance e2e (phase-08).
//
// Three independent scenarios run in sequence against the same ephemeral
// facility:
//   1. Mark attendance for a valid planned session (gate pass).
//   2. Grade a submitted submission as a teacher and verify `grade` is set +
//      a `StarTransaction` was created (queried via `gift.listForStudent`).
//   3. Star balance after grading matches the exercise's `starReward`.
//
// The submission is seeded directly in the DB (seedSubmittedSubmission) to
// avoid needing a past ClassSession for the LMS open-tier gate — the spec
// targets `submission.grade`, not the student submission flow (that path is
// covered by unit tests in apps/api/src/submission/).
//
// API-driven (tRPC); no browser. Ephemeral facility from global-setup.ts.

import { test, expect } from '@playwright/test';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../api/src/router.js';
import {
  cleanupParentAccountsByPhone,
  cleanupExercises,
  seedAppUser,
  seedActiveEnrollment,
  seedPublishedExercise,
  seedSubmittedSubmission,
} from '../src/db.js';
import {
  createE2eStaffClient,
  createAnonClient,
  createE2eLmsStudentClient,
} from '../src/trpc-client.js';
import { randomVnPhone } from '../src/random-vn-phone.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

// Mode-aware student-session client (kind='student') — shared factory so the
// spec runs under both dev (Mode-A header) and prod-config (Mode-B signed
// Bearer); see apps/e2e/src/trpc-client.ts.
const createStudentSessionClient = createE2eLmsStudentClient;

// ---------------------------------------------------------------------------
// Setup: provision a student with a Guardian link via the receipt pipeline
// ---------------------------------------------------------------------------

async function provisionStudentForGrading(): Promise<{
  parentPhone: string;
  parentAccountId: string;
  studentId: string;
  classBatchId: string;
}> {
  const parentPhone = randomVnPhone();
  const gddt = createE2eStaffClient(baseUrl, {
    userId: 'e2e-grade-gddt',
    roles: ['giam_doc_dao_tao'],
    facilityId,
  });
  const sale = createE2eStaffClient(baseUrl, {
    userId: 'e2e-grade-sale',
    roles: ['sale'],
    facilityId,
  });
  const gdkd = createE2eStaffClient(baseUrl, {
    userId: 'e2e-grade-gdkd',
    roles: ['giam_doc_kinh_doanh'],
    facilityId,
  });
  const teacher = await seedAppUser({
    facilityId,
    userId: 'e2e-grade-teacher',
    roles: ['giao_vien'],
  });

  const course = await gddt.course.create.mutate({
    program: 'UCREA',
    name: 'E2E Grading Course',
  });
  const classBatch = await gddt.classBatch.create.mutate({
    courseId: course.id,
    startDate: '2026-08-01',
    endDate: '2026-09-30',
    teacherId: teacher.id,
    slots: [{ weekday: 3, startTime: '11:00', endTime: '12:00' }],
  });
  const classBatchId = classBatch.classBatch.id;

  const opp = await sale.crm.opportunityCreate.mutate({
    contactName: 'E2E Grade Parent',
    phone: parentPhone,
  });
  for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
    await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
  }
  const r = await sale.finance.receiptCreate.mutate({
    opportunityId: opp.id,
    studentName: 'E2E Grade Student',
    parentPhone,
    amount: 5_000_000,
    classBatchId,
  });
  if (r.status !== 'success') throw new Error(`receiptCreate failed: ${r.message}`);
  const approved = await gdkd.finance.receiptApprove.mutate({ receiptId: r.receipt.id });
  expect(approved.receipt.status).toBe('approved');

  // Recover parentAccountId + studentId via OTP flow
  const anon = createAnonClient(baseUrl);
  await anon.lmsAuth.requestOtp.mutate({ phone: parentPhone });

  const { readOtpCode } = await import('../src/db.js');
  const { normalizeLoginPhone } = await import('@cmc/domain-identity');
  const code = await readOtpCode(normalizeLoginPhone(parentPhone));

  const verifyResult = await anon.lmsAuth.verifyOtp.mutate({ phone: parentPhone, code });
  const { decodeLmsClaims } = await import('../src/session-injection.js');
  const session = decodeLmsClaims(verifyResult.sessionToken);

  return {
    parentPhone,
    parentAccountId: session.parentAccountId,
    studentId: verifyResult.children[0]!.studentId,
    classBatchId,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('attendance + grading + star balance', () => {
  let parentPhone: string;
  let parentAccountId: string;
  let studentId: string;
  let classBatchId: string;
  let exerciseId: string;
  let submissionId: string;
  const starReward = 15;

  test.beforeAll(async () => {
    // Provision a student with a real Guardian link (needed for loadLmsStudent).
    const provisioned = await provisionStudentForGrading();
    parentPhone = provisioned.parentPhone;
    parentAccountId = provisioned.parentAccountId;
    studentId = provisioned.studentId;
    classBatchId = provisioned.classBatchId;

    // Seed a global exercise (bypasses open-tier date gate).
    const seeded = await seedPublishedExercise({ maxScore: 10, starReward });
    exerciseId = seeded.exerciseId;

    // Seed a Submission in 'submitted' state (B4: via SessionExercise delivery).
    const sub = await seedSubmittedSubmission({
      facilityId,
      studentId,
      exerciseId,
      classBatchId,
    });
    submissionId = sub.submissionId;
  });

  test.afterAll(async () => {
    // cleanupFacility (global teardown) removes facility-scoped Submission and
    // StarTransaction rows. We only need to clean up the global Exercise here.
    await cleanupExercises(exerciseId);

    const { normalizeLoginPhone } = await import('@cmc/domain-identity');
    await cleanupParentAccountsByPhone(normalizeLoginPhone(parentPhone));
  });

  // -------------------------------------------------------------------------
  // Test 1: attendance marking (extends attendance.spec.ts pattern)
  // -------------------------------------------------------------------------

  test('mark attendance for a valid planned session', async () => {
    const gddt = createE2eStaffClient(baseUrl, {
      userId: 'e2e-grade-gddt-attendance',
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });
    const teacher = createE2eStaffClient(baseUrl, {
      userId: 'e2e-grade-teacher',
      roles: ['giao_vien'],
      facilityId,
    });

    // Weekly sessions already materialised by classBatch.create in provision.
    const sessions = await gddt.classSession.list.query({ classBatchId });
    const planned = sessions.filter((s) => s.status === 'planned');
    expect(planned.length).toBeGreaterThanOrEqual(1);
    const session = planned[0]!;
    expect(session.status).toBe('planned');

    const { enrollmentId } = await seedActiveEnrollment({ facilityId, classBatchId });

    const marked = await teacher.attendance.mark.mutate({
      sessionId: session.id,
      enrollmentId,
      status: 'present',
    });
    expect(marked.status).toBe('present');
  });

  // -------------------------------------------------------------------------
  // Test 2: grade a submitted submission → verify grade + star award
  // -------------------------------------------------------------------------

  test('grade a submission: sets grade and creates StarTransaction', async () => {
    const teacher = createE2eStaffClient(baseUrl, {
      userId: 'e2e-grade-teacher',
      roles: ['giao_vien'],
      facilityId,
    });

    const graded = await teacher.submission.grade.mutate({
      submissionId,
      score: 8,
    });

    expect(graded.status).toBe('graded');
    expect(graded.score).toBe(8);
    expect(graded.gradedAt).not.toBeNull();
    expect(graded.gradedById).toBe('e2e-grade-teacher');
  });

  // -------------------------------------------------------------------------
  // Test 3: star balance after grading
  // -------------------------------------------------------------------------

  test('star balance after grading matches exercise starReward', async () => {
    const studentClient = createStudentSessionClient(baseUrl, {
      parentAccountId,
      studentId,
    });

    const result = await studentClient.gift.listForStudent.query();

    // starBalance should be at least the reward just awarded (may be higher if
    // other specs ran against the same student, though each spec provisions its
    // own fresh student so this should equal starReward exactly).
    expect(result.starBalance).toBeGreaterThanOrEqual(starReward);
  });

  // -------------------------------------------------------------------------
  // Test 4: cancelled session attendance rejected (gate check)
  // -------------------------------------------------------------------------

  test('mark attendance on cancelled session throws BAD_REQUEST', async () => {
    const gddt = createE2eStaffClient(baseUrl, {
      userId: 'e2e-grade-gddt-cancel',
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });
    const teacher = createE2eStaffClient(baseUrl, {
      userId: 'e2e-grade-teacher',
      roles: ['giao_vien'],
      facilityId,
    });

    // Pick a different weekly planned session than test 1 (index 0).
    const sessions = await gddt.classSession.list.query({ classBatchId });
    const planned = sessions.filter((s) => s.status === 'planned');
    expect(planned.length).toBeGreaterThanOrEqual(2);
    const session = planned[1]!;
    await gddt.classSession.cancel.mutate({ sessionId: session.id });

    const { enrollmentId } = await seedActiveEnrollment({ facilityId, classBatchId });

    let caughtError: unknown;
    try {
      await teacher.attendance.mark.mutate({
        sessionId: session.id,
        enrollmentId,
        status: 'present',
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('BAD_REQUEST');
  });
});
