// LMS 2-tier auth e2e (phase-08).
//
// Tests the student password login flow, lockout, kind gate (student session
// may not call parent-only procedures), and the test-seam OTP path.
//
// All tests are API-driven (tRPC client, not browser). The ephemeral facility +
// server are bootstrapped by global-setup.ts. Each test creates its own data
// and the afterAll cleans up via cleanupParentAccountsByPhone.

import { test, expect } from '@playwright/test';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../api/src/router.js';
import { cleanupParentAccountsByPhone } from '../src/db.js';
import { randomVnPhone } from '../src/random-vn-phone.js';
import { createAnonClient, createE2eStaffClient } from '../src/trpc-client.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hashes a password the same way provisioning does (PBKDF2, Cmc2026@ default). */
async function hashDefaultPassword(): Promise<string> {
  // Import lazily — only available in server context via the api package.
  // In e2e we need to seed a StudentAccount with a known password hash. We
  // call the API provisioning path: receiptCreate + receiptApprove set
  // mustChangePassword=true with hash of Cmc2026@. This helper sets up the
  // full provisioning pipeline and returns the parent + student IDs.
  throw new Error('Use seedStudentViaProvisioning instead');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void hashDefaultPassword; // suppress lint — intentionally not called

/** Seeds a ParentAccount + StudentAccount (via full provisioning pipeline)
 * and returns useful IDs. `mustChangePassword` will be `true` because
 * provisioning uses the default Cmc2026@ password. */
async function seedStudentViaProvisioning(opts: {
  parentPhone: string;
  studentName: string;
}): Promise<{ parentAccountId: string; studentId: string }> {
  const gddt = createE2eStaffClient(baseUrl, {
    userId: 'e2e-lmsauth-gddt',
    roles: ['giam_doc_dao_tao'],
    facilityId,
  });
  const sale = createE2eStaffClient(baseUrl, {
    userId: 'e2e-lmsauth-sale',
    roles: ['sale'],
    facilityId,
  });
  const gdkd = createE2eStaffClient(baseUrl, {
    userId: 'e2e-lmsauth-gdkd',
    roles: ['giam_doc_kinh_doanh'],
    facilityId,
  });

  const course = await gddt.course.create.mutate({
    program: 'UCREA',
    name: `LmsAuth Course ${opts.parentPhone}`,
  });
  const classBatch = await gddt.classBatch.create.mutate({
    courseId: course.id,
    startDate: '2026-08-01',
    endDate: '2026-08-01',
    slots: [{ weekday: 6, startTime: '10:00', endTime: '11:00' }],
  });

  const opp = await sale.crm.opportunityCreate.mutate({
    contactName: opts.studentName + ' parent',
    phone: opts.parentPhone,
  });
  for (const toStage of ['O2_CONTACTED', 'O3_TEST_SCHEDULED', 'O4_TESTED'] as const) {
    await sale.crm.opportunityAdvance.mutate({ opportunityId: opp.id, toStage });
  }

  const receiptResult = await sale.finance.receiptCreate.mutate({
    opportunityId: opp.id,
    studentName: opts.studentName,
    parentPhone: opts.parentPhone,
    amount: 5_000_000,
    classBatchId: classBatch.classBatch.id,
  });
  if (receiptResult.status !== 'success') {
    throw new Error(`receiptCreate failed: ${receiptResult.message}`);
  }

  const approved = await gdkd.finance.receiptApprove.mutate({
    receiptId: receiptResult.receipt.id,
  });
  // provisioning creates ParentAccount + StudentAccount
  expect(approved.receipt.status).toBe('approved');

  // The provisioning flow creates these; we don't get the IDs directly from
  // the approve result, so we recover them via the anon LMS flow.
  const anon = createAnonClient(baseUrl);
  const otpReq = await anon.lmsAuth.requestOtp.mutate({ phone: opts.parentPhone });
  expect(otpReq.ok).toBe(true);

  // Use direct DB OTP recovery (the same brute-force helper enrollment.spec.ts uses).
  const { readOtpCode } = await import('../src/db.js');
  const { normalizeLoginPhone } = await import('@cmc/domain-identity');
  const code = await readOtpCode(normalizeLoginPhone(opts.parentPhone));

  const verifyResult = await anon.lmsAuth.verifyOtp.mutate({
    phone: opts.parentPhone,
    code,
  });
  expect(verifyResult.children).toHaveLength(1);
  const child = verifyResult.children[0]!;

  // Decode parentAccountId from the signed session token's claims payload.
  const { decodeLmsClaims } = await import('../src/session-injection.js');
  const session = decodeLmsClaims(verifyResult.sessionToken);

  return { parentAccountId: session.parentAccountId, studentId: child.studentId };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('lmsAuth — 2-tier student login + kind gate', () => {
  const parentPhone = randomVnPhone();

  test.afterAll(async () => {
    const { normalizeLoginPhone } = await import('@cmc/domain-identity');
    await cleanupParentAccountsByPhone(normalizeLoginPhone(parentPhone));
  });

  test('loginStudent success: returns sessionToken + mustChangePassword=true', async () => {
    const { studentId } = await seedStudentViaProvisioning({
      parentPhone,
      studentName: 'E2E LmsAuth Student',
    });
    expect(studentId).toBeTruthy();

    const anon = createAnonClient(baseUrl);
    const result = await anon.lmsAuth.loginStudent.mutate({
      phone: parentPhone,
      password: 'Cmc2026@',
    });

    expect(result.sessionToken).toBeTruthy();
    expect(result.mustChangePassword).toBe(true);
    expect(result.studentId).toBe(studentId);
  });

  test('loginStudent wrong password: throws "Invalid credentials." (no-leak)', async () => {
    const anon = createAnonClient(baseUrl);
    let caughtError: unknown;
    try {
      await anon.lmsAuth.loginStudent.mutate({
        phone: parentPhone,
        password: 'WrongPassword999',
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    const trpcErr = caughtError as TRPCClientError<AppRouter>;
    expect(trpcErr.data?.code).toBe('BAD_REQUEST');
    expect(trpcErr.message).toBe('Invalid credentials.');
  });

  test('loginStudent lockout: 5 wrong attempts locks account, correct password still fails', async () => {
    const anon = createAnonClient(baseUrl);

    // 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      try {
        await anon.lmsAuth.loginStudent.mutate({
          phone: parentPhone,
          password: `WrongLockout${i}`,
        });
      } catch {
        // expected
      }
    }

    // 6th attempt with CORRECT password — must still fail (locked)
    let caughtError: unknown;
    try {
      await anon.lmsAuth.loginStudent.mutate({
        phone: parentPhone,
        password: 'Cmc2026@',
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    const trpcErr = caughtError as TRPCClientError<AppRouter>;
    expect(trpcErr.data?.code).toBe('BAD_REQUEST');
    expect(trpcErr.message).toBe('Invalid credentials.');
  });

  test('resetChildPassword kind gate: student session → FORBIDDEN', async () => {
    const { parentAccountId, studentId } = await seedStudentViaProvisioning({
      parentPhone: randomVnPhone(), // fresh phone to avoid lockout state
      studentName: 'E2E KindGate Student',
    });

    // Mint a signed student-kind session (mode B) — the dev-header fallback
    // defaults kind to 'parent', which would slip past the gate under test.
    const { mintStudentToken } = await import('../src/session-injection.js');
    const { createSignedLmsClient } = await import('../src/trpc-client.js');
    const studentSession = createSignedLmsClient(
      baseUrl,
      mintStudentToken(parentAccountId, studentId),
    );

    let caughtError: unknown;
    try {
      await studentSession.lmsAuth.resetChildPassword.mutate({
        studentId,
        newPassword: 'NewPassword123',
      });
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');
  });

  test('requestOtpEmail test seam: returns _testSeamCode when TEST_OTP_SEAM=1', async () => {
    if (!process.env.TEST_OTP_SEAM) {
      test.skip(true, 'TEST_OTP_SEAM not set — seam not available in this run');
      return;
    }

    const anon = createAnonClient(baseUrl);
    const result = await anon.lmsAuth.requestOtpEmail.mutate({
      email: `e2e-seam-${Date.now()}@example.com`,
    });

    expect(result.ok).toBe(true);
    expect(result._testSeamCode).toBeTruthy();
    expect(typeof result._testSeamCode).toBe('string');
    expect((result._testSeamCode as string).length).toBe(6);
  });
});
