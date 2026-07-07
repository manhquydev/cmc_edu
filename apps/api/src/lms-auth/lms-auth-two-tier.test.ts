// Integration tests for LMS two-tier auth (C1/phase-01b).
//
// BLOCKED: these tests require a live Postgres database and the full tRPC
// caller stack. They are skipped here to keep `pnpm test` green in CI without
// a DB — run them against a local dev DB with:
//   pnpm -F @cmc/api test -- src/lms-auth/lms-auth-two-tier.test.ts
// after seeding the required ParentAccount / StudentAccount fixtures.
//
// Each test describes the adversarial scenario it guards against so reviewers
// can reason about coverage without running the suite.

import { describe, it } from 'vitest';

describe.skip('lms-auth two-tier adversarial integration (BLOCKED: needs DB)', () => {
  // -------------------------------------------------------------------------
  // Kind gate — parent endpoints reject student sessions
  // -------------------------------------------------------------------------

  it('kind=student cannot call guardian.setPhotoConsent → FORBIDDEN', async () => {
    // Setup: create a StudentAccount with a valid student session token (kind=student).
    // Call setPhotoConsent with that token.
    // Expected: TRPCError code FORBIDDEN, message includes 'parent session'.
  });

  it('kind=student cannot call enrollment.mine → FORBIDDEN', async () => {
    // Setup: student session token.
    // Call enrollment.mine.
    // Expected: FORBIDDEN.
  });

  // -------------------------------------------------------------------------
  // Sibling scope gate — students cannot access sibling data
  // -------------------------------------------------------------------------

  it('kind=student with wrong studentId cannot call assessment.listForChild → FORBIDDEN', async () => {
    // Setup: parent with two students A and B; student A has a session token.
    // Student A calls listForChild({ studentId: B.id }).
    // Expected: FORBIDDEN, message includes 'own records'.
  });

  it('kind=student with wrong studentId cannot call sessionEvidence.listForChild → FORBIDDEN', async () => {
    // Same pattern as assessment.listForChild above.
  });

  it('kind=student with wrong studentId cannot call reportCard.getForChild → FORBIDDEN', async () => {
    // Same pattern.
  });

  // -------------------------------------------------------------------------
  // Student login — lockout and no-leak
  // -------------------------------------------------------------------------

  it('loginStudent: wrong password MAX_STUDENT_LOGIN_ATTEMPTS times triggers lockout', async () => {
    // Setup: provision a StudentAccount (passwordHash set, mustChangePassword=true).
    // Call loginStudent with wrong password 5 times.
    // After the 5th failure, loginLockedUntil should be set in the future.
    // A 6th call with the CORRECT password still returns GENERIC_STUDENT_LOGIN_FAILURE
    // (lockout is not bypassed by a correct password when locked).
  });

  it('loginStudent: success on new account → mustChangePassword=true', async () => {
    // Provision a fresh StudentAccount (default password set by provisioning).
    // Call loginStudent with the default password.
    // Expected: sessionToken returned, mustChangePassword=true.
  });

  it('loginStudent no-leak: wrong phone returns same error as wrong password', async () => {
    // Call loginStudent with a phone that has no ParentAccount.
    // Call loginStudent with a valid phone but wrong password.
    // Both must throw badRequest with GENERIC_STUDENT_LOGIN_FAILURE.
    // Neither leaks whether the phone/account exists.
  });

  // -------------------------------------------------------------------------
  // Parent resets child password
  // -------------------------------------------------------------------------

  it('resetChildPassword by parent only affects the target StudentAccount, not siblings', async () => {
    // Setup: parent with two students A and B, both with StudentAccounts.
    // Parent calls resetChildPassword({ studentId: A.id, newPassword: 'NewPass1!' }).
    // A.passwordHash changes, B.passwordHash is unchanged.
    // Student A can log in with 'NewPass1!'; student B still uses old password.
  });

  it('resetChildPassword: non-approved studentId returns FORBIDDEN', async () => {
    // Setup: parent P1 with student A; parent P2 with student B.
    // P1 calls resetChildPassword({ studentId: B.id, newPassword: 'X' }).
    // Expected: FORBIDDEN (B not in P1's approved children).
  });

  it('resetChildPassword: kind=student session returns FORBIDDEN', async () => {
    // Student session calls resetChildPassword.
    // Expected: FORBIDDEN, message includes 'parent session'.
  });

  // -------------------------------------------------------------------------
  // Email OTP flow
  // -------------------------------------------------------------------------

  it('verifyOtpEmail success → sessionToken decodes to kind=parent', async () => {
    // Provision a ParentAccount with email.
    // Request email OTP, verify with correct code.
    // Decode the returned sessionToken (base64url JSON).
    // Expected: { parentAccountId, kind: 'parent' }.
  });

  it('verifyOtpEmail: no ParentAccount with that email → same generic error as wrong code', async () => {
    // Request OTP for unknown email, verify with any 6-digit code.
    // Expected: GENERIC_VERIFY_FAILURE (no leak).
  });
});
