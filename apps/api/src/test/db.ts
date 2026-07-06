// Integration-test helpers for procedures that hit the real dev Postgres.
//
// Every test seeds its own throwaway `Facility` (RLS boundary) in
// `beforeEach` and tears it down in `afterEach` via `cleanupFacility` —
// deletion order follows the FK graph (children before parents). System-wide
// identity rows (`ParentAccount`, unique by `phone`) are not facility-scoped
// (TL10 §4 invariant #3) and must be cleaned up separately by phone.

import { PrismaClient } from '@cmc/db';
import type { Role } from '@cmc/auth';
import type { Context } from '../trpc.js';

let dbSingleton: PrismaClient | undefined;

/** Shared Prisma client for integration tests (lazy — no connection until used). */
export function testDb(): PrismaClient {
  dbSingleton ??= new PrismaClient();
  return dbSingleton;
}

/** Seeds a throwaway Facility for one test's RLS scope. */
export async function createTestFacility(name: string): Promise<{ id: string }> {
  return testDb().facility.create({ data: { name } });
}

/** Deletes every row scoped to `facilityId`, then the Facility itself. */
export async function cleanupFacility(facilityId: string): Promise<void> {
  const db = testDb();
  await db.refundRecord.deleteMany({ where: { receipt: { facilityId } } });
  await db.studentAccount.deleteMany({ where: { student: { facilityId } } });
  await db.guardian.deleteMany({ where: { facilityId } });
  await db.guardianLinkRequest.deleteMany({ where: { facilityId } });
  await db.enrollment.deleteMany({ where: { facilityId } });
  await db.student.deleteMany({ where: { facilityId } });
  await db.receipt.deleteMany({ where: { facilityId } });
  await db.opportunity.deleteMany({ where: { facilityId } });
  await db.contact.deleteMany({ where: { facilityId } });
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
