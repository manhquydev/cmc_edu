// Kind-isolation e2e (phase-08).
//
// Tests that the LMS session `kind` discriminator enforces:
//   - Student sessions cannot call parent-only procedures (resetChildPassword).
//   - Student sessions cannot access sibling data (sessionEvidence.listForChild
//     with a different studentId → FORBIDDEN).
//   - Parent sessions cannot call student-only procedures (submission.saveDraft).
//
// `x-dev-lms-user` header shape: `{ parentAccountId, studentId?, kind }`.
// `createLmsClient` omits `kind` so it defaults to 'parent' on the server.
// Tests that need kind='student' build the header manually via `createTRPCClient`
// with a custom `httpBatchLink` — same API surface, different header content.

import { test, expect } from '@playwright/test';
import { TRPCClientError } from '@trpc/client';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../api/src/router.js';
import { cleanupParentAccountsByPhone, seedActiveEnrollment } from '../src/db.js';
import { createStaffClient } from '../src/trpc-client.js';
import { randomVnPhone } from '../src/random-vn-phone.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

// ---------------------------------------------------------------------------
// Client factory — explicit kind field in header
// ---------------------------------------------------------------------------

function createStudentSessionClient(
  url: string,
  opts: { parentAccountId: string; studentId: string },
) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        headers: () => ({
          'x-dev-lms-user': JSON.stringify({
            parentAccountId: opts.parentAccountId,
            studentId: opts.studentId,
            kind: 'student',
          }),
        }),
      }),
    ],
  });
}

function createParentSessionClient(url: string, opts: { parentAccountId: string }) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        headers: () => ({
          'x-dev-lms-user': JSON.stringify({
            parentAccountId: opts.parentAccountId,
            kind: 'parent',
          }),
        }),
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Setup: provision a parent + two students so sibling isolation can be tested
// ---------------------------------------------------------------------------

async function setupParentWithStudents() {
  const parentPhone = randomVnPhone();
  const gddt = createStaffClient(baseUrl, {
    userId: 'e2e-kind-gddt',
    roles: ['giam_doc_dao_tao'],
    facilityId,
  });
  const sale = createStaffClient(baseUrl, {
    userId: 'e2e-kind-sale',
    roles: ['sale'],
    facilityId,
  });
  const gdkd = createStaffClient(baseUrl, {
    userId: 'e2e-kind-gdkd',
    roles: ['giam_doc_kinh_doanh'],
    facilityId,
  });

  const course = await gddt.course.create.mutate({
    program: 'UCREA',
    name: 'E2E Kind Isolation Course',
  });
  const classBatch = await gddt.classBatch.create.mutate({
    courseId: course.id,
    startDate: '2026-08-01',
    endDate: '2026-08-01',
    slots: [{ weekday: 2, startTime: '09:00', endTime: '10:00' }],
  });
  const classBatchId = classBatch.classBatch.id;

  // Provision first student (receipt pipeline)
  const opp = await sale.crm.opportunityCreate.mutate({
    contactName: 'Kind Isolation Parent',
    phone: parentPhone,
  });
  for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
    await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
  }
  const r1 = await sale.finance.receiptCreate.mutate({
    opportunityId: opp.id,
    studentName: 'Kind Child A',
    parentPhone,
    amount: 5_000_000,
    classBatchId,
  });
  if (r1.status !== 'success') throw new Error(`receiptCreate failed: ${r1.message}`);
  const approved = await gdkd.finance.receiptApprove.mutate({ receiptId: r1.receipt.id });
  expect(approved.receipt.status).toBe('approved');

  // Seed a second student directly (no separate receipt needed for isolation test)
  const { studentId: studentBId } = await seedActiveEnrollment({
    facilityId,
    classBatchId,
    studentName: 'Kind Child B',
  });

  // Recover parentAccountId + studentA ID via OTP flow
  const { readOtpCode } = await import('../src/db.js');
  const { normalizeLoginPhone } = await import('@cmc/domain-identity');
  const { createAnonClient } = await import('../src/trpc-client.js');

  const anon = createAnonClient(baseUrl);
  await anon.lmsAuth.requestOtp.mutate({ phone: parentPhone });
  const code = await readOtpCode(normalizeLoginPhone(parentPhone));
  const verifyResult = await anon.lmsAuth.verifyOtp.mutate({ phone: parentPhone, code });

  const session = JSON.parse(
    Buffer.from(verifyResult.sessionToken, 'base64url').toString('utf8'),
  ) as { parentAccountId: string };
  const parentAccountId = session.parentAccountId;
  const studentAId = verifyResult.children[0]!.studentId;

  return { parentPhone, parentAccountId, studentAId, studentBId, classBatchId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('LMS kind isolation — student vs parent session gates', () => {
  let parentPhone: string;
  let parentAccountId: string;
  let studentAId: string;
  let studentBId: string;

  test.beforeAll(async () => {
    const result = await setupParentWithStudents();
    parentPhone = result.parentPhone;
    parentAccountId = result.parentAccountId;
    studentAId = result.studentAId;
    studentBId = result.studentBId;
  });

  test.afterAll(async () => {
    const { normalizeLoginPhone } = await import('@cmc/domain-identity');
    await cleanupParentAccountsByPhone(normalizeLoginPhone(parentPhone));
  });

  test('student session cannot call resetChildPassword → FORBIDDEN', async () => {
    const studentClient = createStudentSessionClient(baseUrl, {
      parentAccountId,
      studentId: studentAId,
    });

    let caughtError: unknown;
    try {
      await studentClient.lmsAuth.resetChildPassword.mutate({
        studentId: studentAId,
        newPassword: 'NewPassword123',
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');
  });

  test('student session calling sessionEvidence.listForChild with sibling studentId → FORBIDDEN', async () => {
    // Student A's session tries to access Student B's evidence — sibling isolation gate.
    const studentAClient = createStudentSessionClient(baseUrl, {
      parentAccountId,
      studentId: studentAId,
    });

    let caughtError: unknown;
    try {
      await studentAClient.sessionEvidence.listForChild.query({ studentId: studentBId });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');
  });

  test('parent session calling submission.saveDraft → FORBIDDEN (student-only)', async () => {
    // submission.saveDraft calls requireLmsStudent which rejects kind='parent'.
    const parentClient = createParentSessionClient(baseUrl, { parentAccountId });

    let caughtError: unknown;
    try {
      await parentClient.submission.saveDraft.mutate({
        exerciseId: '00000000-0000-0000-0000-000000000001', // non-existent, gate rejects first
        annotationLayer: {},
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');
  });
});
