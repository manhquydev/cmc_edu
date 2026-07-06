// Integration-test helpers for procedures that hit the real dev Postgres.
//
// Every test seeds its own throwaway `Facility` (RLS boundary) in
// `beforeEach` and tears it down in `afterEach` via `cleanupFacility` —
// deletion order follows the FK graph (children before parents). System-wide
// identity rows (`ParentAccount`, unique by `phone`) are not facility-scoped
// (TL10 §4 invariant #3) and must be cleaned up separately by phone.
//
// `testDb()` connects as the same unprivileged `cmc_app` role the app uses
// (via `createPrismaClient()`), so Postgres RLS (ADR 0042) applies to it too.
// Test setup/teardown and out-of-band DB-truth assertions are not simulating
// one facility's session — they need `testDbBypass()` (sets `app.bypass_rls`)
// to see across facilities, same escape hatch a super_admin/director read uses.

import { createPrismaClient, PrismaClient, withFacility, type Prisma } from '@cmc/db';
import type { Role } from '@cmc/auth';
import type { Context } from '../trpc.js';

let dbSingleton: PrismaClient | undefined;

/** Shared Prisma client for integration tests (lazy — no connection until used). */
export function testDb(): PrismaClient {
  dbSingleton ??= createPrismaClient();
  return dbSingleton;
}

/**
 * Bypass-scoped access for test arrangement/assertions against
 * RLS-protected tables (Contact, Opportunity, Receipt, RefundRecord, Student,
 * Enrollment) — out-of-band DB-truth verification, not a simulated facility
 * session, so it uses the same audited bypass a real cross-facility read does.
 */
export function testDbBypass<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return withFacility(testDb(), null, fn, { bypass: true });
}

/** Seeds a throwaway Facility for one test's RLS scope. */
export async function createTestFacility(name: string): Promise<{ id: string }> {
  return testDb().facility.create({ data: { name } });
}

/** Deletes every row scoped to `facilityId`, then the Facility itself. */
export async function cleanupFacility(facilityId: string): Promise<void> {
  const db = testDb();
  // Guardian has FK constraints on both Student and ParentAccount — it must
  // be deleted before Student (below) and before `cleanupParentAccountsByPhone`
  // runs (called separately, after this function returns). Guardian itself
  // carries no RLS policy, so no bypass is needed for this delete.
  await db.guardian.deleteMany({ where: { facilityId } });
  await db.guardianLinkRequest.deleteMany({ where: { facilityId } });
  await testDbBypass(async (tx) => {
    // `studentAccount` has no facilityId of its own — the relational filter
    // joins through `student` (RLS-protected), so this delete also needs the
    // bypass GUC even though StudentAccount itself carries no RLS policy. It
    // also has an FK to Student, so it must run before `student.deleteMany`.
    await tx.studentAccount.deleteMany({ where: { student: { facilityId } } });
    await tx.refundRecord.deleteMany({ where: { facilityId } });
    await tx.enrollment.deleteMany({ where: { facilityId } });
    await tx.student.deleteMany({ where: { facilityId } });
    await tx.receipt.deleteMany({ where: { facilityId } });
    await tx.opportunity.deleteMany({ where: { facilityId } });
    await tx.contact.deleteMany({ where: { facilityId } });
  });
  await db.receiptCodeCounter.deleteMany({ where: { facilityId } });
  await db.facility.deleteMany({ where: { id: facilityId } });
}

/** Deletes ParentAccount rows created by a test (system-wide, not facility-scoped). */
export async function cleanupParentAccountsByPhone(...phones: string[]): Promise<void> {
  if (phones.length === 0) return;
  await testDb().parentAccount.deleteMany({ where: { phone: { in: phones } } });
}

/** Deletes LoginOtp rows created by a test (system-wide, phone-scoped like ParentAccount). */
export async function cleanupLoginOtpsByPhone(...phones: string[]): Promise<void> {
  if (phones.length === 0) return;
  await testDb().loginOtp.deleteMany({ where: { phone: { in: phones } } });
}

export interface TestStaffContextOptions {
  facilityId: string;
  userId: string;
  roles: Role[];
}

/** Hand-builds a staff `Context` (dev session shape) against the real DB. */
export function buildStaffContext(opts: TestStaffContextOptions): Context {
  return {
    subject: { userId: opts.userId, roles: opts.roles },
    facilityId: opts.facilityId,
    lmsSubject: null,
    db: testDb(),
    ip: null,
  };
}

export interface TestLmsContextOptions {
  parentAccountId: string;
  studentId?: string;
}

/** Hand-builds an LMS (parent/student) `Context` against the real DB. */
export function buildLmsContext(opts: TestLmsContextOptions): Context {
  return {
    subject: null,
    facilityId: null,
    lmsSubject: { parentAccountId: opts.parentAccountId, studentId: opts.studentId },
    db: testDb(),
    ip: null,
  };
}

/** Seeds a throwaway ParentAccount for a test (system-wide, unique by phone —
 * pass an already-normalized `84xxxxxxxxx` phone). */
export async function seedParentAccount(phone: string): Promise<{ id: string; phone: string }> {
  return testDb().parentAccount.create({ data: { phone } });
}

export interface SeedGuardianLinkOptions {
  facilityId: string;
  parentAccountId: string;
  studentId: string;
  status?: 'pending' | 'approved' | 'rejected';
  relation?: 'father' | 'mother' | 'guardian';
}

/**
 * Seeds a `GuardianLinkRequest` for a test, and — when `status: 'approved'`
 * — the corresponding `Guardian` row too (mirroring what `guardian.approveLink`
 * does), so tests can set up an already-approved link without exercising the
 * mutation itself.
 */
export async function seedGuardianLink(
  opts: SeedGuardianLinkOptions,
): Promise<{ id: string; status: string }> {
  const status = opts.status ?? 'pending';
  const request = await testDb().guardianLinkRequest.create({
    data: {
      facilityId: opts.facilityId,
      parentAccountId: opts.parentAccountId,
      studentRef: opts.studentId,
      status,
    },
  });
  if (status === 'approved') {
    await testDb().guardian.create({
      data: {
        facilityId: opts.facilityId,
        parentAccountId: opts.parentAccountId,
        studentId: opts.studentId,
        relation: opts.relation ?? 'mother',
      },
    });
  }
  return request;
}
