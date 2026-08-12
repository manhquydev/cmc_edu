// Direct-DB test seams for the e2e suite. Two things the tRPC API surface
// deliberately does not expose to any caller (staff or parent):
//   1. The plaintext OTP code (`LoginOtp.codeHash` stores a salted sha256,
//      never the code itself — apps/api/src/lms-auth/otp-hash.ts) — the e2e
//      parent-login flow recovers it by brute-forcing the 10^6 candidate
//      codes against the stored hash (cheap: sha256 x 1e6 is sub-second).
//   2. An "already-active" enrollment id (only `finance.receiptApprove`
//      provisioning ever flips `reserved` -> `active`, and does not return
//      the enrollment id) — the attendance spec seeds one directly, mirroring
//      the same `seedActiveEnrollment` pattern apps/api/src/test/db.ts already
//      uses for the attendance gate's own integration tests, since attendance
//      gate coverage (not enrollment provisioning) is what that spec targets.
//
// Connects via APP_DATABASE_URL (the unprivileged `cmc_app` role, ADR 0042)
// for everything except the two tables `cmc_app` has no DELETE grant on
// (Attendance, RefundRecord — append-only ledgers), which reuse the
// migration-owner `DATABASE_URL` connection for teardown only, same as
// apps/api/src/test/db.ts's `privilegedDb()`.

import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { createPrismaClient, createPrivilegedPrismaClient, withFacility, PrismaClient } from '@cmc/db';
import { addDaysToDateOnly, ictDateOnlyOf, ictToUtc, weekdayOf } from '@cmc/domain-time';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import type { Role } from '@cmc/auth';
import { randomVnPhone } from './random-vn-phone.js';
import { assertNotProdDatabase } from './assert-not-prod.js';
// Reused as a plain runtime import (not just types) — same cross-import
// pattern already established for apps/api/src elsewhere in this package
// (session-injection.ts's STAFF_COOKIE_NAME, trpc-client.ts's AppRouter):
// `planClassSessions` is the exact pure function `classBatch.create` uses to
// materialize ClassSession rows, so `seedClassBatch` below produces sessions
// identical in shape to what the real mutation would have created.
import { planClassSessions, type SlotForPlanning } from '../../api/src/class/generate-sessions.js';
import { relayEmailOutbox } from '../../api/src/worker/relay-email-outbox.js';
import { ConsoleEmailTransport } from '../../api/src/worker/email-transport.js';
import { runReconcileFinanceFlags } from '../../api/src/worker/reconcile-finance-flags.js';

let dbSingleton: PrismaClient | undefined;

export function getDb(): PrismaClient {
  dbSingleton ??= createPrismaClient();
  return dbSingleton;
}

let privilegedDbSingleton: PrismaClient | undefined;

/**
 * The connection every destructive teardown runs on — and, until now, the one
 * URL nothing checked. `global-setup` guards `APP_DATABASE_URL`, but these
 * deletes read `DATABASE_URL`: point that at the pilot database (a leftover
 * from a migration session is enough) and teardown deletes real children's
 * attendance, payslips and profiles while the guarded URL looks fine.
 *
 * Guarding here rather than at the call sites means every path into the
 * privileged connection is covered, including ones added later.
 */
function getPrivilegedDb(): PrismaClient {
  if (!privilegedDbSingleton) {
    assertNotProdDatabase(process.env.DATABASE_URL ?? '');
    // Prisma 7: `new PrismaClient({ datasources: ... })` no longer exists —
    // route through the shared privileged-role factory (DATABASE_URL only).
    privilegedDbSingleton = createPrivilegedPrismaClient();
  }
  return privilegedDbSingleton;
}

export async function disconnectDb(): Promise<void> {
  await Promise.all([
    dbSingleton?.$disconnect(),
    privilegedDbSingleton?.$disconnect(),
  ]);
  dbSingleton = undefined;
  privilegedDbSingleton = undefined;
}

const OTP_CODE_SPACE = 1_000_000;

/** Recovers the plaintext code behind a salted `codeHash` by walking the
 * 6-digit space. `subject` only labels the error messages. */
function recoverCodeFromHash(codeHash: string, subject: string): string {
  const separatorIndex = codeHash.indexOf(':');
  if (separatorIndex < 0) {
    throw new Error(`Malformed LoginOtp.codeHash for ${subject}.`);
  }
  const salt = codeHash.slice(0, separatorIndex);
  const digest = codeHash.slice(separatorIndex + 1);

  for (let i = 0; i < OTP_CODE_SPACE; i += 1) {
    const candidate = String(i).padStart(6, '0');
    const candidateDigest = createHash('sha256').update(salt + candidate).digest('hex');
    if (candidateDigest === digest) {
      return candidate;
    }
  }
  throw new Error(`Could not recover the OTP code for ${subject} (brute-force exhausted).`);
}

/** Recovers the plaintext 6-digit code for `phone`'s most recent pending
 * LoginOtp row (see file header) — throws if no pending row exists or the
 * hash cannot be matched (a real bug, not an expected test outcome). */
export async function readOtpCode(phone: string): Promise<string> {
  const otp = await getDb().loginOtp.findFirst({
    where: { phone, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) {
    throw new Error(`No pending LoginOtp row found for phone ${phone}.`);
  }
  return recoverCodeFromHash(otp.codeHash, `phone ${phone}`);
}

/** Recovers the 6-digit code a parent would have received by email.
 *
 * Reads the queued email FIRST, because that row is the real delivery artifact:
 * finding the code there proves the system actually enqueued a message, not
 * merely that it minted a code. `lmsAuth.requestOtpEmail` only enqueues when a
 * ParentAccount owns the address, so this doubles as proof the account exists.
 *
 * Falls back to recovering the code from the LoginOtp hash when the payload has
 * already been scrubbed — the outbox worker overwrites delivered OTP payloads
 * with `{kind:'otp', scrubbed:true}`, so a drain racing the read would
 * otherwise fail the spec for a reason that has nothing to do with the flow. */
export async function readOtpCodeByEmail(email: string): Promise<string> {
  const address = email.toLowerCase();
  const db = getDb();

  // Absence of an outbox row is meaningful and must not be papered over.
  // `lmsAuth.requestOtpEmail` ALWAYS mints the LoginOtp row (that is what keeps
  // its response identical whether or not the address exists), but it enqueues
  // an email only when a ParentAccount owns the address. So a code recovered
  // from the hash alone proves nothing about the account — falling straight
  // back to it would hand out a code that was never sent, and the spec would
  // then fail several steps later with an unrelated-looking error.
  const queued = await db.emailOutbox.findFirst({
    where: { to: address, payload: { path: ['kind'], equals: 'otp' } },
    orderBy: { createdAt: 'desc' },
  });
  if (!queued) {
    throw new Error(
      `No OTP email was queued for ${address}. lmsAuth.requestOtpEmail answers {ok:true} either ` +
        `way, so this almost always means no ParentAccount owns this address — check that the ` +
        `flow under test actually recorded it (e.g. the "Email phụ huynh" field on the receipt).`,
    );
  }

  const payload = queued.payload as { code?: unknown } | null;
  if (typeof payload?.code === 'string') {
    return payload.code;
  }

  // The row exists but its payload was scrubbed: the outbox worker overwrites
  // delivered OTP payloads with `{kind:'otp', scrubbed:true}`. The email WAS
  // enqueued, so recovering the code from the hash is legitimate here.
  const otp = await db.loginOtp.findFirst({
    where: { email: address, status: 'pending' },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) {
    throw new Error(
      `An OTP email was queued for ${address} but its payload is scrubbed and no pending ` +
        `LoginOtp row remains — the code has expired or was already consumed.`,
    );
  }
  return recoverCodeFromHash(otp.codeHash, `email ${address}`);
}

/** Clears anything a previous run left behind for this run's parent identity.
 *
 * Runs BEFORE the spec, not after, so a run that died halfway cannot poison the
 * next one. Three separate leftovers matter, and they are keyed differently:
 * OTP rate limiting counts LoginOtp rows per identifier (5 per 15 minutes), so
 * stale rows under either the email OR the phone can make a fresh login fail
 * for a reason the flow has nothing to do with; queued emails accumulate under
 * `to`; and provisioning finds-or-creates a ParentAccount by phone, so a
 * leftover account would be silently reused with the wrong email attached. */
export async function sweepParentIdentity(opts: { email?: string; phone?: string }): Promise<void> {
  const db = getDb();
  const email = opts.email?.toLowerCase();
  // Provisioning and OTP rows store the login-normalized phone (`0964…` →
  // `84964…`), so sweeping by the raw phone would silently miss the very rows
  // it exists to clear.
  const phone = opts.phone ? normalizeLoginPhone(opts.phone) : undefined;

  if (email) {
    await db.emailOutbox.deleteMany({ where: { to: email } });
    await db.loginOtp.deleteMany({ where: { email } });
  }
  if (phone) {
    await db.loginOtp.deleteMany({ where: { phone } });
    await cleanupParentAccountsByPhone(phone);
  }
  if (email) {
    // Provisioning reuses an account by phone, but the email column is unique:
    // an orphan holding this address would make the upsert throw P2002.
    const orphan = await db.parentAccount.findUnique({ where: { email } });
    if (orphan) {
      await db.studentAccount.deleteMany({ where: { parentAccountId: orphan.id } });
      await db.guardian.deleteMany({ where: { parentAccountId: orphan.id } });
      await db.guardianLinkRequest.deleteMany({ where: { parentAccountId: orphan.id } });
      await db.parentAccount.delete({ where: { id: orphan.id } });
    }
  }
}

export interface SeedActiveEnrollmentOptions {
  facilityId: string;
  classBatchId: string;
  studentName?: string;
}

/** Seeds a Student + an already-`active` Enrollment directly (bypassing the
 * `reserved` seat-hold + Receipt-driven activation path) — see file header. */
export async function seedActiveEnrollment(
  opts: SeedActiveEnrollmentOptions,
): Promise<{ enrollmentId: string; studentId: string }> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const student = await tx.student.create({
        data: {
          facilityId: opts.facilityId,
          fullName: opts.studentName ?? `E2E Student ${randomUUID().slice(0, 8)}`,
        },
      });
      const enrollment = await tx.enrollment.create({
        data: {
          facilityId: opts.facilityId,
          studentId: student.id,
          classBatchId: opts.classBatchId,
          status: 'active',
        },
      });
      return { enrollmentId: enrollment.id, studentId: student.id };
    },
    { bypass: true },
  );
}

/** Seeds a bare Student in the facility (no enrollment). There is no
 * `student.create` UI mutation — a student only ever comes into existence via
 * the receipt money-chain — so a flow that merely needs a student to EXIST as a
 * precondition (e.g. the parent-meeting picker searches `student.lookup` by
 * name) seeds one directly, the same way this suite seeds every other fixture
 * row. Facility-scoped, so `cleanupFacility` reclaims it. */
export async function seedStudent(
  opts: { facilityId: string; studentName?: string },
): Promise<{ studentId: string; studentName: string }> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const fullName = opts.studentName ?? `E2E Student ${randomUUID().slice(0, 8)}`;
      const student = await tx.student.create({
        data: { facilityId: opts.facilityId, fullName },
        select: { id: true },
      });
      return { studentId: student.id, studentName: fullName };
    },
    { bypass: true },
  );
}

/** Points one AppUser's `managerId` at another, by their auth `userId`s.
 *
 * `kpi.confirm` requires `scoreOwner.managerId === confirmUser.id` and only
 * `super_admin` bypasses it, so a faithful "direct manager confirms" journey has
 * to establish that link. `/admin/users` exposes no manager field (verified —
 * `user.create`/`user.update` accept `managerId`, the screen never sends it), so
 * there is no UI path to drive; the link is seeded directly, same justification
 * as `seedStudent`. Returns the manager's AppUser id. */
export async function seedManagerLink(opts: {
  facilityId: string;
  /** Auth userId of the report (the person whose KPI slip gets confirmed). */
  reportUserId: string;
  /** Auth userId of their manager. */
  managerUserId: string;
}): Promise<{ managerAppUserId: string }> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const manager = await tx.appUser.findFirst({
        where: { facilityId: opts.facilityId, userId: opts.managerUserId },
        select: { id: true },
      });
      if (!manager) {
        throw new Error(
          `seedManagerLink: no AppUser for managerUserId "${opts.managerUserId}" in facility ${opts.facilityId}. ` +
            `kpi.confirm resolves the confirming user through this row, so the manager must exist first.`,
        );
      }
      const updated = await tx.appUser.updateMany({
        where: { facilityId: opts.facilityId, userId: opts.reportUserId },
        data: { managerId: manager.id },
      });
      if (updated.count === 0) {
        throw new Error(
          `seedManagerLink: no AppUser for reportUserId "${opts.reportUserId}" in facility ${opts.facilityId}.`,
        );
      }
      return { managerAppUserId: manager.id };
    },
    { bypass: true },
  );
}

/** Clears `mustChangePassword` on a provisioned StudentAccount.
 *
 * `assertPasswordNotExpired` (apps/api/src/trpc.ts) blocks every student LMS
 * mutation while the flag is set, and receipt provisioning always sets it. The
 * activation flow that clears it for real (parent sets password → student
 * logs in) is a proven journey of its own
 * (lms-student-activation.journey.ui.spec.ts, P1-04) — and decision D1 of plan
 * 260724-1212 explicitly carves out that LMS journeys where login/activation is
 * NOT the business under test inject their session instead of re-driving it.
 * This helper is the data half of that carve-out: the injected student session
 * represents an already-activated account, so the flag is cleared to match. */
export async function clearMustChangePassword(studentId: string): Promise<void> {
  const updated = await getDb().studentAccount.updateMany({
    where: { studentId },
    data: { mustChangePassword: false },
  });
  if (updated.count === 0) {
    throw new Error(
      `clearMustChangePassword: no StudentAccount for studentId "${studentId}" — ` +
        'provisioning must run first (it is what creates the account).',
    );
  }
}

/** Deletes every row this e2e run's dedicated Facility could have created,
 * then the Facility itself — same FK-ordered teardown shape as
 * apps/api/src/test/db.ts's `cleanupFacility`, extended for phase-08 specs
 * that create Submissions/StarTransactions/FinalGrades. */
export async function cleanupFacility(facilityId: string): Promise<void> {
  const db = getDb();

  // Tables with no DELETE grant for cmc_app (append-only / in-place-only by
  // design — see the t2ii migration's grant rationale): teardown must run on
  // the privileged migration-role connection. FK order: FinalGrade/
  // StarTransaction/Submission before the Enrollment/Student deletes below.
  const privileged = getPrivilegedDb();
  await privileged.attendance.deleteMany({ where: { facilityId } });
  await privileged.finalGrade.deleteMany({ where: { facilityId } });
  await privileged.starTransaction.deleteMany({ where: { facilityId } });
  await privileged.submission.deleteMany({ where: { facilityId } });
  // B4 homework delivery: SessionExercise/ClassExerciseItem before ClassSession/Batch.
  await privileged.sessionExercise.deleteMany({ where: { facilityId } });
  await privileged.classExerciseItem.deleteMany({ where: { facilityId } });
  // phase-10: AfterSaleCase / ParentMeeting / TestAppointment now carry a
  // RESTRICT FK to Student (Reward already did) — delete them before the
  // student.deleteMany below, or that delete fails with a FK violation.
  // Privileged connection: append-like tables with no cmc_app DELETE grant,
  // same as the api-side teardown (apps/api/src/test/db.ts).
  await privileged.afterSaleCase.deleteMany({ where: { facilityId } });
  await privileged.parentMeeting.deleteMany({ where: { facilityId } });
  await privileged.testAppointment.deleteMany({ where: { facilityId } });
  await privileged.reward.deleteMany({ where: { facilityId } });
  await privileged.gift.deleteMany({ where: { facilityId } });
  // Append-only tables that were missing here entirely, which is why a run that
  // touched them leaked its whole facility: QualitativeAssessment holds a
  // required Student FK, so `student.deleteMany` below threw and teardown
  // aborted before deleting anything else. Order: photos before the evidence
  // row, evidence/assessments before the ClassSession and Student deletes,
  // refunds and reconciliation flags before Receipt.
  await privileged.sessionEvidencePhoto.deleteMany({ where: { facilityId } });
  await privileged.sessionEvidence.deleteMany({ where: { facilityId } });
  await privileged.qualitativeAssessment.deleteMany({ where: { facilityId } });
  await privileged.reconciliationFlag.deleteMany({ where: { facilityId } });
  await privileged.refundRecord.deleteMany({ where: { facilityId } });

  await db.guardian.deleteMany({ where: { facilityId } });
  await db.guardianLinkRequest.deleteMany({ where: { facilityId } });

  await withFacility(
    db,
    null,
    async (tx) => {
      await tx.studentAccount.deleteMany({ where: { student: { facilityId } } });
      await tx.enrollment.deleteMany({ where: { facilityId } });
      await tx.student.deleteMany({ where: { facilityId } });
      await tx.receipt.deleteMany({ where: { facilityId } });
      await tx.opportunity.deleteMany({ where: { facilityId } });
      await tx.contact.deleteMany({ where: { facilityId } });
      await tx.classSession.deleteMany({ where: { facilityId } });
      await tx.scheduleSlot.deleteMany({ where: { facilityId } });
      await tx.classBatch.deleteMany({ where: { facilityId } });
      await tx.course.deleteMany({ where: { facilityId } });
      await tx.room.deleteMany({ where: { facilityId } });
      await tx.classBatchCodeCounter.deleteMany({ where: { facilityId } });
    },
    { bypass: true },
  );

  // HR remediation phases 1-3 (P3-II): KpiScore/Payslip/CompensationPolicy/
  // SalaryTier/SalaryRate/Shift*/ManualAttendanceTicket/TimePunch/AppUser all
  // grant cmc_app only SELECT/INSERT/UPDATE (wave-A default-privilege
  // template, same as Attendance/RefundRecord above) — teardown runs on the
  // privileged migration-role connection, same FK order as
  // apps/api/src/test/db.ts's cleanupFacility. Must run AFTER the bypass
  // block above (Receipt.createdByAppUserId / ClassBatch.createdByAppUserId/
  // teacherAppUserId FK-reference AppUser) and BEFORE the Facility delete.
  await privileged.kpiScore.deleteMany({ where: { facilityId } });
  await privileged.payslip.deleteMany({ where: { facilityId } });
  await privileged.compensationPolicy.deleteMany({ where: { facilityId } });
  await privileged.salaryTier.deleteMany({ where: { facilityId } });
  await privileged.salaryRate.deleteMany({ where: { facilityId } });
  await privileged.shiftRegistrationEntry.deleteMany({ where: { facilityId } });
  await privileged.shiftRegistration.deleteMany({ where: { facilityId } });
  await privileged.shiftTemplate.deleteMany({ where: { facilityId } });
  await privileged.shiftGroup.deleteMany({ where: { facilityId } });
  await privileged.manualAttendanceTicket.deleteMany({ where: { facilityId } });
  await privileged.timePunch.deleteMany({ where: { facilityId } });
  await privileged.appUser.deleteMany({ where: { facilityId } });
  await privileged.facilityNetwork.deleteMany({ where: { facilityId } });
  await privileged.facilityGeofence.deleteMany({ where: { facilityId } });

  await db.receiptCodeCounter.deleteMany({ where: { facilityId } });
  await db.facility.deleteMany({ where: { id: facilityId } });

  await assertNoFacilityResidue(facilityId);
}

/**
 * Fails loudly when teardown left rows behind.
 *
 * Deliberately runs AFTER the Facility row is deleted: throwing first would
 * stop the delete, turning a soft leak (rows we can still find) into a
 * permanent one (a facility nothing cleans up), and every later run would be
 * both red and leaking.
 *
 * Only counts tables teardown is responsible for. Silence here is the whole
 * point — a missing `deleteMany` otherwise shows up much later as a foreign-key
 * error in an unrelated test.
 */
async function assertNoFacilityResidue(facilityId: string): Promise<void> {
  const privileged = getPrivilegedDb();
  const where = { where: { facilityId } };
  const counts = await Promise.all([
    ['QualitativeAssessment', privileged.qualitativeAssessment.count(where)],
    ['SessionEvidence', privileged.sessionEvidence.count(where)],
    ['SessionEvidencePhoto', privileged.sessionEvidencePhoto.count(where)],
    ['ReconciliationFlag', privileged.reconciliationFlag.count(where)],
    ['RefundRecord', privileged.refundRecord.count(where)],
    ['Enrollment', privileged.enrollment.count(where)],
    ['Student', privileged.student.count(where)],
    ['Receipt', privileged.receipt.count(where)],
    ['ClassSession', privileged.classSession.count(where)],
    ['ClassBatch', privileged.classBatch.count(where)],
    ['AppUser', privileged.appUser.count(where)],
    ['FacilityGeofence', privileged.facilityGeofence.count(where)],
    ['Facility', privileged.facility.count({ where: { id: facilityId } })],
  ].map(async ([table, pending]) => [table as string, await (pending as Promise<number>)] as const));

  const residue = counts.filter(([, n]) => n > 0);
  if (residue.length > 0) {
    throw new Error(
      `Teardown left rows behind for facility ${facilityId}: ` +
        residue.map(([table, n]) => `${table}=${n}`).join(', ') +
        '. A table is missing from cleanupFacility — add it rather than ignoring this.',
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 6: HR remediation e2e seed helpers (shift-lifecycle / kpi-lifecycle)
//
// AppUser, ShiftRegistration (approved, past-period), TimePunch, and Receipt
// (approvedAt backdated) all have write paths the tRPC surface deliberately
// keeps narrow (shift.submit rejects a past `fromDate`; receiptApprove always
// stamps `approvedAt: new Date()`) — these specs need past-period fixtures to
// exercise `kpi.refresh`'s formula and `kpi.submitSlip`'s day-3 guard without
// a mocked clock (docs/20, red-team #9: e2e must not claim boundary coverage,
// it only needs a period that is ALREADY past `submitSlipOpensAt`). Same
// `withFacility(..., { bypass: true })` pattern as `seedActiveEnrollment`
// above — every insert here mirrors the shape apps/api/src/test/db.ts's
// integration-test seeds already use for the same tables.
// ---------------------------------------------------------------------------

export interface SeedAppUserOptions {
  facilityId: string;
  userId: string;
  fullName?: string;
  position?: string;
  managerId?: string;
  /** AppUser.roles (DB truth used by target-categorization reads like
   * `kpi.list`/`kpi.bulkApprove`'s `resolveKpiTargetRole`) — separate from
   * the session roles a test passes to `createE2eStaffClient` (permission
   * checks read `ctx.subject.roles` from the dev-header, not this column). */
  roles?: Role[];
}

/** Seeds an AppUser row for e2e specs that write TimePunch/ShiftRegistration/
 * KpiScore/Payslip FKs (all require a real AppUser, not just a session
 * identity). `userId` MUST match the `DevStaffIdentity.userId` a spec later
 * passes to `createE2eStaffClient` for the same actor. */
export async function seedAppUser(opts: SeedAppUserOptions): Promise<{ id: string; employeeCode: string }> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const counter = await tx.employeeCodeCounter.update({
        where: { id: 1 },
        data: { next: { increment: 1 } },
      });
      const employeeCode = `E2E${String(counter.next - 1).padStart(4, '0')}`;
      return tx.appUser.create({
        data: {
          facilityId: opts.facilityId,
          userId: opts.userId,
          email: `${opts.userId}@e2e.cmc`,
          fullName: opts.fullName ?? opts.userId,
          position: opts.position ?? 'staff',
          managerId: opts.managerId ?? null,
          employeeCode,
          roles: opts.roles ?? [],
        },
        select: { id: true, employeeCode: true },
      });
    },
    { bypass: true },
  );
}

export interface SeedApprovedReceiptOptions {
  facilityId: string;
  /** AppUser.id — attribution FK `kpi.refresh`'s `collectSaleRevenue` reads
   * (NOT the legacy `createdById` userId scalar, R2 #2). */
  createdByAppUserId: string;
  netAmount: number;
  /** Backdated finance mutation stamp — the KPI period this receipt's
   * revenue should be attributed to. */
  approvedAt: Date;
  studentName?: string;
  parentPhone?: string;
}

/** Seeds an already-`approved` Receipt with a caller-chosen `approvedAt`
 * (bypassing `finance.receiptApprove`, which always stamps `now()`) — the
 * only way to put revenue into a PAST KPI period without mocking the clock. */
export async function seedApprovedReceipt(opts: SeedApprovedReceiptOptions): Promise<{ id: string }> {
  return withFacility(
    getDb(),
    null,
    (tx) =>
      tx.receipt.create({
        data: {
          facilityId: opts.facilityId,
          code: `E2E-RCP-${randomUUID().slice(0, 8).toUpperCase()}`,
          netAmount: opts.netAmount,
          status: 'approved',
          parentPhone: opts.parentPhone ?? randomVnPhone(),
          studentName: opts.studentName ?? 'E2E KPI Student',
          createdById: 'e2e-seed',
          createdByAppUserId: opts.createdByAppUserId,
          approvedAt: opts.approvedAt,
        },
        select: { id: true },
      }),
    { bypass: true },
  );
}

/** Reads back a Receipt's `approvedAt` (not exposed on `ReceiptDto` — see
 * apps/api/src/finance/router.ts's `toReceiptDto`) for the kpi-lifecycle
 * spec's DB-truth assertion that `finance.receiptApprove` stamps it. */
export async function getReceiptApprovedAt(receiptId: string): Promise<Date | null> {
  const receipt = await withFacility(
    getDb(),
    null,
    (tx) => tx.receipt.findUnique({ where: { id: receiptId }, select: { approvedAt: true } }),
    { bypass: true },
  );
  return receipt?.approvedAt ?? null;
}

export interface SeedApprovedShiftRegistrationOptions {
  facilityId: string;
  appUserId: string;
  shiftGroupId: string;
  shiftTemplateId: string;
  /** ICT `YYYY-MM-DD` dates, one ShiftRegistrationEntry per date, all
   * pointing at the same `shiftTemplateId`. */
  dates: string[];
}

/** Seeds an already-`approved` ShiftRegistration + entries directly
 * (bypassing `shift.submit`'s future-date guard) — `kpi.refresh`'s
 * `collectActualShifts` and `payslip.assemble` both need "công ca thực" data
 * anchored in a PAST period. */
export async function seedApprovedShiftRegistration(
  opts: SeedApprovedShiftRegistrationOptions,
): Promise<{ id: string }> {
  const sortedDates = [...opts.dates].sort();
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const registration = await tx.shiftRegistration.create({
        data: {
          facilityId: opts.facilityId,
          appUserId: opts.appUserId,
          shiftGroupId: opts.shiftGroupId,
          fromDate: ictToUtc(sortedDates[0]!, '00:00'),
          toDate: ictToUtc(sortedDates[sortedDates.length - 1]!, '00:00'),
          status: 'approved',
          selectionMode: 'SINGLE',
        },
      });
      await tx.shiftRegistrationEntry.createMany({
        data: opts.dates.map((date) => ({
          facilityId: opts.facilityId,
          shiftRegistrationId: registration.id,
          date: ictToUtc(date, '00:00'),
          shiftTemplateId: opts.shiftTemplateId,
        })),
      });
      return { id: registration.id };
    },
    { bypass: true },
  );
}

export interface SeedTimePunchPairOptions {
  facilityId: string;
  appUserId: string;
  /** ICT `YYYY-MM-DD`. */
  date: string;
  /** ICT `HH:mm` — punched exactly at the shift boundary so
   * `computeDayAttendance` (@cmc/domain-payroll, via
   * apps/api/src/attendance/resolve-day-credit.ts) computes zero late/early
   * penalty (full credit, `present: true`). */
  startTime: string;
  endTime: string;
}

/** Seeds one in+out TimePunch pair for a calendar day, exactly at the given
 * boundary times — the "đủ cặp midpoint" fixture `kpi.refresh`'s
 * `collectActualShifts` and `payslip.assemble` both need to credit a shift
 * with zero penalty. */
export async function seedTimePunchPair(opts: SeedTimePunchPairOptions): Promise<void> {
  await withFacility(
    getDb(),
    null,
    (tx) =>
      tx.timePunch.createMany({
        data: [
          {
            facilityId: opts.facilityId,
            appUserId: opts.appUserId,
            method: 'e2e-seed',
            punchAt: ictToUtc(opts.date, opts.startTime),
          },
          {
            facilityId: opts.facilityId,
            appUserId: opts.appUserId,
            method: 'e2e-seed',
            punchAt: ictToUtc(opts.date, opts.endTime),
          },
        ],
      }),
    { bypass: true },
  );
}

/** Seeds an active `FacilityNetwork` row so `checkInOut.punch` treats a
 * caller whose IP does not match `cidr` as offsite (ADR 0043) — without this,
 * a facility with zero rows is "open mode" (every punch counts as
 * within-network). Loopback (`127.0.0.1`/`::1`, what an e2e HTTP client hits)
 * deliberately does NOT match the default `cidr` below, so seeding this with
 * no arguments is enough to flip every subsequent punch in this facility to
 * offsite for the rest of the run. */
export async function seedFacilityNetwork(opts: {
  facilityId: string;
  cidr?: string;
  label?: string;
}): Promise<{ id: string }> {
  return withFacility(
    getDb(),
    null,
    (tx) =>
      tx.facilityNetwork.create({
        data: {
          facilityId: opts.facilityId,
          cidr: opts.cidr ?? '10.0.0.0/24',
          label: opts.label ?? 'E2E office WiFi (does not match loopback)',
          isActive: true,
        },
        select: { id: true },
      }),
    { bypass: true },
  );
}

/** Seeds a FacilityGeofence (FORCE RLS → must use withFacility bypass). */
export async function seedFacilityGeofence(opts: {
  facilityId: string;
  lat: number;
  lng: number;
  radiusM?: number;
  accuracyMaxM?: number;
  label?: string;
  isActive?: boolean;
}): Promise<{ id: string }> {
  return withFacility(
    getDb(),
    null,
    (tx) =>
      tx.facilityGeofence.create({
        data: {
          facilityId: opts.facilityId,
          lat: opts.lat,
          lng: opts.lng,
          radiusM: opts.radiusM ?? 200,
          accuracyMaxM: opts.accuracyMaxM ?? 200,
          label: opts.label ?? 'E2E geofence',
          isActive: opts.isActive ?? false,
        },
        select: { id: true },
      }),
    { bypass: true },
  );
}

/** Deletes geofences by label prefix via privileged connection. */
export async function deleteFacilityGeofencesByLabel(
  facilityId: string,
  labelPrefix: string,
): Promise<void> {
  await getPrivilegedDb().facilityGeofence.deleteMany({
    where: { facilityId, label: { startsWith: labelPrefix } },
  });
}

/** Deletes TimePunch + ManualAttendanceTicket for given AppUser ids (privileged). */
export async function deletePunchesAndTicketsForAppUsers(...appUserIds: string[]): Promise<void> {
  if (appUserIds.length === 0) return;
  const db = getPrivilegedDb();
  await db.manualAttendanceTicket.deleteMany({ where: { appUserId: { in: appUserIds } } });
  await db.timePunch.deleteMany({ where: { appUserId: { in: appUserIds } } });
}

/**
 * Full HR cascade for e2e staff created mid-suite: tickets, punches, shift
 * registrations/entries, then AppUser. Prevents the shared-facility users table
 * from filling past the first page (20 rows) and breaking later findInList specs.
 */
export async function deleteStaffHrCascadeForAppUsers(...appUserIds: string[]): Promise<void> {
  if (appUserIds.length === 0) return;
  const db = getPrivilegedDb();
  await db.manualAttendanceTicket.deleteMany({ where: { appUserId: { in: appUserIds } } });
  await db.timePunch.deleteMany({ where: { appUserId: { in: appUserIds } } });
  const regs = await db.shiftRegistration.findMany({
    where: { appUserId: { in: appUserIds } },
    select: { id: true },
  });
  if (regs.length > 0) {
    await db.shiftRegistrationEntry.deleteMany({
      where: { shiftRegistrationId: { in: regs.map((r) => r.id) } },
    });
    await db.shiftRegistration.deleteMany({ where: { id: { in: regs.map((r) => r.id) } } });
  }
  await db.appUser.deleteMany({ where: { id: { in: appUserIds } } });
}

// ---------------------------------------------------------------------------
// Phase-08: exercise + submission seeding helpers
// ---------------------------------------------------------------------------

/**
 * Ensure UCREA orderGlobal 1–4 exist (default receipt package grant size).
 * Idempotent; safe for CI migrate-only DBs that never ran prisma seed.
 * Does not delete or rewrite existing rows.
 */
export async function ensureUcreaCurriculumAxis(): Promise<void> {
  const db = getDb();
  const rows: Array<{
    program: 'UCREA';
    level: string;
    monthIndex: number;
    unitType: 'LESSON';
    title: string;
    orderGlobal: number;
  }> = [
    { program: 'UCREA', level: 'U2', monthIndex: 1, unitType: 'LESSON', title: 'E2E UCREA 1', orderGlobal: 1 },
    { program: 'UCREA', level: 'U2', monthIndex: 1, unitType: 'LESSON', title: 'E2E UCREA 2', orderGlobal: 2 },
    { program: 'UCREA', level: 'U2', monthIndex: 1, unitType: 'LESSON', title: 'E2E UCREA 3', orderGlobal: 3 },
    { program: 'UCREA', level: 'U2', monthIndex: 1, unitType: 'LESSON', title: 'E2E UCREA 4', orderGlobal: 4 },
  ];
  for (const row of rows) {
    const existing = await db.curriculumUnit.findUnique({
      where: {
        program_orderGlobal: { program: row.program, orderGlobal: row.orderGlobal },
      },
      select: { id: true },
    });
    if (!existing) {
      await db.curriculumUnit.create({ data: row });
    }
  }
}

/** Seeds one global CurriculumUnit and returns its id + title. Facility-agnostic
 * (no facilityId), so the facility teardown does not remove it — delete via
 * `cleanupCurriculumUnits`. Inert prerequisite data: a curriculum unit is a
 * catalog entry a teacher picks when authoring an exercise, not a mechanism any
 * flow proves. The unique title lets a journey find its own exercise row. */
export async function seedCurriculumUnit(title?: string): Promise<{ unitId: string; title: string }> {
  const unitTitle = title ?? `E2E Unit ${randomUUID().slice(0, 8)}`;
  const max = await getDb().curriculumUnit.aggregate({
    where: { program: 'UCREA' },
    _max: { orderGlobal: true },
  });
  const orderGlobal = (max._max.orderGlobal ?? 0) + 1;
  const unit = await getDb().curriculumUnit.create({
    data: {
      program: 'UCREA',
      level: 'U2',
      monthIndex: 1,
      unitType: 'LESSON',
      title: unitTitle,
      orderGlobal,
    },
  });
  return { unitId: unit.id, title: unitTitle };
}

/** Deletes only the CurriculumUnit rows the caller named.
 * Exercises no longer hang off units — tear those down with
 * `cleanupExerciseLibrary` / `cleanupExercises`. Uses the privileged
 * migration-role connection: `cmc_app` has no DELETE grant on CurriculumUnit.
 *
 * Does NOT delete ClassSession rows, which also FK-reference CurriculumUnit —
 * safe only because callers seed no session against these units. A future
 * caller that does must clear sessions first or this trips the session FK. */
export async function cleanupCurriculumUnits(...unitIds: string[]): Promise<void> {
  if (unitIds.length === 0) return;
  await getPrivilegedDb().curriculumUnit.deleteMany({ where: { id: { in: unitIds } } });
}

export async function seedExerciseFolder(name?: string): Promise<{ folderId: string; name: string }> {
  const folderName = name ?? `E2E folder ${randomUUID().slice(0, 8)}`;
  const folder = await getDb().exerciseFolder.create({
    data: { name: folderName, createdById: 'e2e-seed' },
    select: { id: true, name: true },
  });
  return { folderId: folder.id, name: folder.name };
}

/** Deletes exercises in the named folders (plus leftover delivery/item FKs),
 * then the folders. Privileged: no production delete path on these catalogs. */
export async function cleanupExerciseLibrary(...folderIds: string[]): Promise<void> {
  if (folderIds.length === 0) return;
  const db = getPrivilegedDb();
  const exercises = await db.exercise.findMany({
    where: { folderId: { in: folderIds } },
    select: { id: true },
  });
  const exerciseIds = exercises.map((e) => e.id);
  if (exerciseIds.length > 0) {
    const deliveries = await db.sessionExercise.findMany({
      where: { exerciseId: { in: exerciseIds } },
      select: { id: true },
    });
    const deliveryIds = deliveries.map((d) => d.id);
    if (deliveryIds.length > 0) {
      await db.submission.deleteMany({ where: { sessionExerciseId: { in: deliveryIds } } });
      await db.sessionExercise.deleteMany({ where: { id: { in: deliveryIds } } });
    }
    await db.classExerciseItem.deleteMany({ where: { exerciseId: { in: exerciseIds } } });
    await db.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  }
  await db.exerciseFolder.deleteMany({ where: { id: { in: folderIds } } });
}

/** Seeds a global CurriculumUnit + published Exercise. Both are facility-
 * agnostic (no facilityId). Clean up with `cleanupExercises(exerciseId)`. */
export async function seedPublishedExercise(opts?: {
  maxScore?: number;
  starReward?: number;
}): Promise<{ unitId: string; exerciseId: string }> {
  // orderGlobal required (LMS unit-range) — same sequence as seedCurriculumUnit.
  const { unitId } = await seedCurriculumUnit(
    `E2E Unit ${randomUUID().slice(0, 8)}`,
  );
  const folder = await getDb().exerciseFolder.create({
    data: { name: `E2E ${randomUUID().slice(0, 8)}`, createdById: 'e2e-seed' },
    select: { id: true },
  });
  const exercise = await getDb().exercise.create({
    data: {
      folderId: folder.id,
      orderInFolder: 1,
      title: `E2E homework ${randomUUID().slice(0, 8)}`,
      type: 'homework',
      basePdfRef: 'e2e/test.pdf',
      maxScore: opts?.maxScore ?? 10,
      starReward: opts?.starReward ?? 5,
      status: 'published',
      createdById: 'e2e-seed',
    },
  });
  return { unitId, exerciseId: exercise.id };
}

/**
 * Seeds a Submission in 'submitted' state for grading specs (bypasses LMS
 * open/delivery gates). B4: rows attach to **SessionExercise** (delivery),
 * not catalog Exercise — mirrors apps/api teacher-scoping / grade tests:
 * create a minimal ClassSession + SessionExercise for `exerciseId`, then the
 * Submission. Pass `sessionExerciseId` to reuse an existing delivery.
 */
export async function seedSubmittedSubmission(opts: {
  facilityId: string;
  studentId: string;
  exerciseId: string;
  /** Required when creating a new delivery (links the session to a class). */
  classBatchId: string;
  /** Optional existing SessionExercise id — skips session/delivery create. */
  sessionExerciseId?: string;
}): Promise<{ submissionId: string; sessionExerciseId: string }> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      let sessionExerciseId = opts.sessionExerciseId;
      if (!sessionExerciseId) {
        const past = new Date('2020-01-01T12:00:00.000Z');
        const session = await tx.classSession.create({
          data: {
            facilityId: opts.facilityId,
            classBatchId: opts.classBatchId,
            sessionDate: past,
            startTime: past,
            endTime: past,
            status: 'planned',
          },
        });
        const delivery = await tx.sessionExercise.create({
          data: {
            facilityId: opts.facilityId,
            classSessionId: session.id,
            exerciseId: opts.exerciseId,
            position: 1,
          },
        });
        sessionExerciseId = delivery.id;
      }
      const submission = await tx.submission.create({
        data: {
          facilityId: opts.facilityId,
          studentId: opts.studentId,
          sessionExerciseId,
          annotationLayer: {},
          status: 'submitted',
          submittedAt: new Date(),
          version: 1,
        },
      });
      return { submissionId: submission.id, sessionExerciseId };
    },
    { bypass: true },
  );
}

/** Deletes globally-scoped Exercise rows and their CurriculumUnits by
 * exercise ID. Call in afterAll after `cleanupFacility` (which removes
 * facility-scoped Submission rows that reference these exercises). */
export async function cleanupExercises(...exerciseIds: string[]): Promise<void> {
  if (exerciseIds.length === 0) return;
  // cmc_app has no DELETE grant on Exercise/CurriculumUnit — teardown runs on
  // the privileged migration-role connection, same as cleanupFacility's
  // append-only tables.
  const db = getPrivilegedDb();
  // Exercise library (2026-08-13): exercises hang off a folder, not a unit.
  // The seed helper makes one throwaway folder per exercise, so teardown drops
  // the folder too; the unit it also seeded is cleaned by `cleanupCurriculumUnits`.
  const exercises = await db.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, folderId: true },
  });
  // B4: Submission → SessionExercise → Exercise. Spec afterAll runs before
  // global cleanupFacility, so clear deliveries (and their submissions) first.
  const deliveries = await db.sessionExercise.findMany({
    where: { exerciseId: { in: exerciseIds } },
    select: { id: true },
  });
  const deliveryIds = deliveries.map((d) => d.id);
  if (deliveryIds.length > 0) {
    await db.submission.deleteMany({ where: { sessionExerciseId: { in: deliveryIds } } });
    await db.sessionExercise.deleteMany({ where: { id: { in: deliveryIds } } });
  }
  await db.classExerciseItem.deleteMany({ where: { exerciseId: { in: exerciseIds } } });
  await db.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  const folderIds = [...new Set(exercises.map((e) => e.folderId))];
  if (folderIds.length > 0) {
    await db.exerciseFolder.deleteMany({ where: { id: { in: folderIds } } });
  }
}

/** ParentAccount/LoginOtp are system-wide (phone-keyed, not facility-scoped)
 * — cleaned up separately by the phone(s) a spec generated. Runs BEFORE this
 * run's `cleanupFacility` (spec-level `afterAll` fires before the global
 * teardown), so the ParentAccount this deletes may still have a
 * `StudentAccount` row pointing at it (provisioning creates one) — that FK
 * must be cleared first or the ParentAccount delete violates it. */
export async function cleanupParentAccountsByPhone(...phones: string[]): Promise<void> {
  if (phones.length === 0) return;
  const db = getDb();
  const parentAccounts = await db.parentAccount.findMany({
    where: { phone: { in: phones } },
    select: { id: true },
  });
  const parentAccountIds = parentAccounts.map((p) => p.id);
  if (parentAccountIds.length > 0) {
    await db.studentAccount.deleteMany({ where: { parentAccountId: { in: parentAccountIds } } });
    await db.guardian.deleteMany({ where: { parentAccountId: { in: parentAccountIds } } });
    await db.guardianLinkRequest.deleteMany({ where: { parentAccountId: { in: parentAccountIds } } });
  }
  await db.loginOtp.deleteMany({ where: { phone: { in: phones } } });
  await db.parentAccount.deleteMany({ where: { phone: { in: phones } } });
}

// ---------------------------------------------------------------------------
// Phase 4 (journey infra): PO-approved seed exceptions (2026-07-24,
// plans/260723-1422-may-hoa-nghiem-thu-ba-tang/phase-04-journey-infra-hoi-quy.md).
//
// Two extensions to the Q5 "every role creates its own data through real UI"
// rule, same category/mechanism as F4's `seedAppUser` staff row above — both
// were confirmed by exhaustive grep to have NO real UI write path anywhere in
// apps/admin/src, so seeding is the only alternative to inventing app
// behavior that doesn't exist:
//
//   1. ClassBatch/Course creation (`seedClassBatch`) — every admin screen
//      that touches a ClassBatch (classes/index.tsx, class-detail.tsx,
//      finance/receipt-create.tsx, enrollment/class-placement.tsx,
//      teaching/session-assessment.tsx) only ever CONSUMES
//      `classBatch.list`/`course.list`; none of them creates one.
//   2. Attendance write (`seedPresentAttendance`) — `/teaching/attendance`
//      requires `?session=<id>` on the URL and has no session-picker of its
//      own, and nothing else in the admin app links to it with a real
//      session id (grep: `attendance.markAll`/`attendance.listBySession` have
//      exactly one production consumer, that same page).
//
// Both are kept to the NARROWEST possible seam: the actual regression each
// journey (F1/F2) exists to catch is a READ-permission bug on a real screen
// (session-assessment's roster, finance's receipt list/detail) — never the
// class-creation or attendance-write MECHANISM itself. Every step after the
// seed still goes through real UI exactly as Q5 requires.
// ---------------------------------------------------------------------------

export interface SeedClassBatchOptions {
  facilityId: string;
  program?: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE';
  courseName?: string;
  /** ICT `YYYY-MM-DD`. Defaults to today. */
  startDate?: string;
  /** ICT `YYYY-MM-DD`. Defaults to `startDate` + 7 days — together with the
   *  default single slot below (pinned to `startDate`'s own weekday) this
   *  guarantees >=1 generated ClassSession regardless of which day of the
   *  week the run happens to execute on. */
  endDate?: string;
  slotStartTime?: string;
  slotEndTime?: string;
  /** F2: set directly, replacing `classBatch.create`'s own optional
   *  `teacherId` input/UI-driven `assignTeacher` step —
   *  `assertTeacherOwnsClass` (apps/api/src/attendance/assert-teacher-owns-class.ts)
   *  reads this FK regardless of how it was written. Must be a real AppUser
   *  with role `giao_vien` (resolveTeacher's own validation) or the later
   *  UI-driven attendance/roster steps will 403. */
  teacherAppUserId?: string;
}

export interface SeedClassBatchResult {
  courseId: string;
  classBatchId: string;
  code: string;
  scheduleSlotId: string;
  sessionIds: string[];
}

/** Seeds a Course + ClassBatch + one ScheduleSlot + its generated
 *  ClassSession row(s) directly via Prisma — see the PO-approved-exceptions
 *  header above. Mirrors `classBatch.create`'s own session-generation shape
 *  (same `planClassSessions` call), so the seeded ClassSession rows match
 *  what the real mutation would produce. NOT a full mirror of every field:
 *  `code` is a random `E2E-CB-<uuid>` stub, not the real QĐ 0036
 *  `ClassBatchCodeCounter`-derived format (`nextClassBatchCode`) — harmless
 *  here since journeys only ever match `code` against a dropdown option by
 *  regex, never assert its format. */
export async function seedClassBatch(opts: SeedClassBatchOptions): Promise<SeedClassBatchResult> {
  const program = opts.program ?? 'UCREA';
  const startDate = opts.startDate ?? ictDateOnlyOf(new Date());
  const endDate = opts.endDate ?? addDaysToDateOnly(startDate, 7);
  const slot: SlotForPlanning = {
    weekday: weekdayOf(startDate),
    startTime: opts.slotStartTime ?? '08:00',
    endTime: opts.slotEndTime ?? '09:00',
  };

  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const course = await tx.course.create({
        data: {
          facilityId: opts.facilityId,
          program,
          name: opts.courseName ?? `E2E Course ${randomUUID().slice(0, 8)}`,
        },
      });

      const classBatch = await tx.classBatch.create({
        data: {
          facilityId: opts.facilityId,
          code: `E2E-CB-${randomUUID().slice(0, 8).toUpperCase()}`,
          courseId: course.id,
          program,
          startDate: ictToUtc(startDate, '00:00'),
          endDate: ictToUtc(endDate, '00:00'),
          teacherId: opts.teacherAppUserId ?? null,
          teacherAppUserId: opts.teacherAppUserId ?? null,
          createdById: 'e2e-seed',
        },
      });

      const scheduleSlot = await tx.scheduleSlot.create({
        data: {
          facilityId: opts.facilityId,
          classBatchId: classBatch.id,
          weekday: slot.weekday,
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });

      const planned = planClassSessions(startDate, endDate, [{ ...slot, id: scheduleSlot.id }]);
      if (planned.length === 0) {
        throw new Error(
          'seedClassBatch: planClassSessions produced zero ClassSession rows — startDate/endDate/slot mismatch.',
        );
      }
      // Individual creates (not `createMany`): the caller needs the real ids
      // back (`sessionIds`), which `createMany` never returns.
      const sessions = [];
      for (const p of planned) {
        sessions.push(
          await tx.classSession.create({
            data: {
              facilityId: opts.facilityId,
              classBatchId: classBatch.id,
              scheduleSlotId: p.scheduleSlotId ?? null,
              sessionDate: p.sessionDate,
              startTime: p.startTime,
              endTime: p.endTime,
            },
          }),
        );
      }

      return {
        courseId: course.id,
        classBatchId: classBatch.id,
        code: classBatch.code,
        scheduleSlotId: scheduleSlot.id,
        sessionIds: sessions.map((s) => s.id),
      };
    },
    { bypass: true },
  );
}

export interface SeedPresentAttendanceOptions {
  facilityId: string;
  classSessionId: string;
  enrollmentId: string;
  studentId: string;
}

/** Seeds one `present` Attendance row directly — see the PO-approved
 *  exceptions header above (extension 2). `enrollmentId`/`studentId` are
 *  expected to come from a DB read keyed on values a real role's UI action
 *  already produced (e.g. the unique studentName typed into a real
 *  `finance.receiptCreate` form), never from an id handed across a
 *  DIFFERENT role's browser context — this function itself runs in test
 *  orchestration code, not inside anyone's simulated session.
 *
 *  Not a full mirror of `attendance.mark`/`markAll`: this skips the AuditLog
 *  row and `recomputeFinalGrade` those mutations always also do. Harmless for
 *  every journey today (session-assessment's roster read depends on neither),
 *  but a future journey asserting something downstream of FinalGrade or the
 *  audit trail should not assume this helper produced one. */
export async function seedPresentAttendance(opts: SeedPresentAttendanceOptions): Promise<{ id: string }> {
  return withFacility(
    getDb(),
    null,
    (tx) =>
      tx.attendance.upsert({
        where: {
          classSessionId_enrollmentId: {
            classSessionId: opts.classSessionId,
            enrollmentId: opts.enrollmentId,
          },
        },
        create: {
          facilityId: opts.facilityId,
          classSessionId: opts.classSessionId,
          enrollmentId: opts.enrollmentId,
          studentId: opts.studentId,
          status: 'present',
          markedById: 'e2e-seed',
          markedAt: new Date(),
        },
        update: { status: 'present', markedById: 'e2e-seed', markedAt: new Date() },
        select: { id: true },
      }),
    { bypass: true },
  );
}

/** Read-only: `AppUser.id` for a given `userId` within a facility — recovers
 *  the id a real `/admin/users` super_admin UI action just created
 *  (`createStaffViaAdminUi`, apps/e2e/src/journey/create-staff-via-admin-ui.ts)
 *  so a caller that needs a foreign key (e.g. `seedClassBatch`'s
 *  `teacherAppUserId`) has something real to point at — the tRPC
 *  `user.create` mutation's response isn't observable from Playwright, only
 *  the `userId` the form was filled with is. Same "read back what a real UI
 *  action already produced" principle as `findEnrollmentByClassAndStudentName`
 *  below, just keyed by `userId` instead of a displayed name. */
export async function findAppUserByUserId(opts: {
  facilityId: string;
  userId: string;
}): Promise<{ id: string } | null> {
  return withFacility(
    getDb(),
    null,
    (tx) => tx.appUser.findFirst({ where: { facilityId: opts.facilityId, userId: opts.userId }, select: { id: true } }),
    { bypass: true },
  );
}

/** Read-only: the children linked to a parent, as `mintLmsSession` needs to
 *  populate a parent session's `children` cache (the real app fills it from the
 *  login response; an injected session has to read it from the DB).
 *
 *  Runs with a facility bypass: `Guardian`/`ParentAccount` are RLS-exempt (they
 *  predate any facility session, ADR 0042), but `Student` is facility-scoped, so
 *  the restricted app connection resolves the required `student` relation to
 *  null and Prisma throws. The bypass is why this lives in db.ts (which owns the
 *  privileged connection) rather than inline in the journey helper. */
export async function findGuardianChildren(
  parentAccountId: string,
): Promise<Array<{ studentId: string; fullName: string }>> {
  const guardians = await withFacility(
    getDb(),
    null,
    (tx) =>
      tx.guardian.findMany({
        where: { parentAccountId },
        select: { student: { select: { id: true, fullName: true } } },
      }),
    { bypass: true },
  );
  return guardians.map((g) => ({ studentId: g.student.id, fullName: g.student.fullName }));
}

/** Deletes a facility created directly by a journey (e.g. ADM-01), by its
 * unique code. There is no `facility.delete` procedure, and the global teardown
 * only reclaims this run's own E2E facility — so a facility a journey creates
 * would otherwise leak. A freshly created facility has no child rows, so a plain
 * delete on the privileged connection is safe. */
export async function deleteFacilityByCode(code: string): Promise<void> {
  await getPrivilegedDb().facility.deleteMany({ where: { code } });
}

/** Read-only: `ParentAccount.id` for a phone — recovers the account
 *  `finance.receiptApprove` provisioning created but never surfaces to
 *  Playwright, so a journey that injects a parent session (`mintLmsSession`)
 *  has a real id to mint against. Not facility-scoped: ParentAccount predates
 *  any facility session (same RLS exemption as Guardian, ADR 0042). */
export async function findParentAccountIdByPhone(phone: string): Promise<string | null> {
  // Provisioning stores the login-normalized form (`0964…` → `84964…`), so a
  // lookup with the raw phone a spec generated would always miss. Normalize
  // here, once, rather than at every call site.
  const account = await getDb().parentAccount.findUnique({
    where: { phone: normalizeLoginPhone(phone) },
    select: { id: true },
  });
  return account?.id ?? null;
}

/** Read-only: the single `active`/`reserved` Enrollment for a (classBatchId,
 *  studentId) pair — used to recover the enrollment/student ids
 *  `finance.receiptApprove` provisioning creates but never returns to the
 *  caller (`ReceiptApproveResult` carries no studentId/enrollmentId), so
 *  `seedPresentAttendance` above has something real to point at. Matches by
 *  the studentName a role's own UI action already typed, never by an id
 *  smuggled out of another context. */
export async function findEnrollmentByClassAndStudentName(opts: {
  facilityId: string;
  classBatchId: string;
  studentName: string;
}): Promise<{ enrollmentId: string; studentId: string } | null> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const student = await tx.student.findFirst({
        where: { facilityId: opts.facilityId, fullName: opts.studentName },
        orderBy: { createdAt: 'desc' },
      });
      if (!student) return null;
      const enrollment = await tx.enrollment.findFirst({
        where: { facilityId: opts.facilityId, classBatchId: opts.classBatchId, studentId: student.id },
        orderBy: { createdAt: 'desc' },
      });
      if (!enrollment) return null;
      return { enrollmentId: enrollment.id, studentId: student.id };
    },
    { bypass: true },
  );
}

/**
 * Drains the `EmailOutbox` once via the real `relayEmailOutbox` worker
 * function (apps/api/src/worker/relay-email-outbox.ts) — the standalone
 * worker process (apps/api/src/worker/index.ts) that normally runs this on
 * an interval is never started by `global-setup.ts` (only the tRPC api
 * server is), so nothing would otherwise transition a `pending` row to
 * `sent`. `ConsoleEmailTransport` for both transport keys matches the same
 * non-production default `apps/api/src/worker/index.ts` itself picks
 * whenever `NODE_ENV !== 'production'` (true for this whole e2e run) — no
 * real email provider is ever contacted, and no real mailbox is ever read
 * (same principle as scripts/ops-smoke.sh's mark 5: the assertion is the
 * outbox row's `status` column, never inbox content).
 */
export async function drainEmailOutboxOnce(): Promise<{ sent: number; failed: number; dead: number }> {
  const transport = { brevo: new ConsoleEmailTransport(), graph: new ConsoleEmailTransport() };
  const result = await relayEmailOutbox(getDb(), transport);
  return { sent: result.sent, failed: result.failed, dead: result.dead };
}

/** Runs the finance-reconciliation worker once, the same way `drainEmailOutboxOnce`
 *  runs the email relay: it invokes the real worker, not a stub. A journey that
 *  needs a ReconciliationFlag can create the anomaly through the UI and then call
 *  this to surface it, instead of seeding a flag row (which would prove nothing
 *  about the detection the flow exists to demonstrate). */
export async function runReconcileFinanceFlagsOnce(): Promise<{ facilityCount: number; flagsCreated: number }> {
  return runReconcileFinanceFlags(getDb());
}

/** Read-only: status of the (at most one, deduped by `receiptId`) EmailOutbox
 *  row a given receipt enqueued — mirrors the lookup
 *  `finance/router.ts#enqueueReceiptEmail` itself uses for its own dedup
 *  check. */
export async function getEmailOutboxStatusByReceiptId(receiptId: string): Promise<string | null> {
  const rows = await getDb().$queryRaw<{ status: string }[]>`
    SELECT "status" FROM "EmailOutbox" WHERE "payload"->>'receiptId' = ${receiptId} LIMIT 1
  `;
  return rows[0]?.status ?? null;
}

/** EmailOutbox carries no `facilityId` (system-wide, like ParentAccount) so
 *  `cleanupFacility` above cannot scope a delete to it — spec-local cleanup
 *  by `receiptId`, same pattern `apps/api/src/finance/approve.test.ts`
 *  already uses for its own EmailOutbox row. */
export async function deleteEmailOutboxByReceiptId(receiptId: string): Promise<void> {
  await getDb().$executeRaw`DELETE FROM "EmailOutbox" WHERE "payload"->>'receiptId' = ${receiptId}`;
}

// ---------------------------------------------------------------------------
// Phase 5 (journey P4-01, plans/260723-1422-may-hoa-nghiem-thu-ba-tang/
// phase-05-journey-10-luong-loi.md): one more seed exception, same
// category/mechanism as Phase 4's `seedClassBatch`/`seedPresentAttendance`
// above. Not a fresh per-instance PO sign-off — this is a technical finding
// (confirmed by exhaustive grep to have NO real admin UI write path),
// independently re-verified 2026-07-24 against the same pattern the user
// accepted that day for Phase 4's two exceptions (see the phase-04 doc's own
// 2026-07-24 correction note on that acceptance).
//
// `rewards.redeem` (the only mutation that ever creates a Reward row) is
// `lmsProcedure`-gated — `apps/api/src/rewards/reward-router.ts` — reachable
// only from the LMS student app's `/student/gifts`, which is `hoc_vien`/
// parent-mediated and explicitly out of scope for this admin-only phase (see
// this journey's own header). Grepped `apps/admin/src/pages/engagement`: the
// two screens that exist there (`rewards.tsx`, `gifts.tsx`) only ever CONSUME
// `rewards.list`/`gift.list` — neither writes a Reward. There is likewise no
// admin UI that creates a bare Student row outside receipt-approval
// provisioning (same finding as Phase 4's F2 comment) — irrelevant to a star
// redemption, so seeding a minimal Student directly (no Enrollment) is the
// narrowest fix rather than running an entire unrelated receipt-approval
// flow just to get a Student row to hang a Reward off of.
//
// Narrowed to the one seam Q5 cannot reach: the actual regression this
// journey exists to prove is the STAFF approve/deliver READ+WRITE path on
// `/admin/engagement/rewards` (real UI, driven by the journey itself) — never
// the redeem mechanism, which this seed intentionally bypasses.
// ---------------------------------------------------------------------------

export interface SeedPendingRewardOptions {
  facilityId: string;
  /** Name of a Gift a director's own real UI action already created
   *  (`gift.upsert` via `/admin/engagement/gifts`) — resolved by its
   *  DISPLAYED name, never a smuggled id, same principle as
   *  `findEnrollmentByClassAndStudentName` above. */
  giftName: string;
  studentName?: string;
}

export interface SeedPendingRewardResult {
  rewardId: string;
  studentId: string;
  giftId: string;
}

/**
 * Read-only: resolves a (ShiftGroup, ShiftTemplate) pair created via the real
 * `/admin/shift-config` UI (super_admin, `shift.createGroup`/`createTemplate`)
 * by their DISPLAYED names — same "never smuggle an id across a role/context
 * boundary" principle as `findEnrollmentByClassAndStudentName` above. Used by
 * the P3-02 journey (plans/260723-1422-may-hoa-nghiem-thu-ba-tang/
 * phase-05-journey-10-luong-loi.md) to feed `seedApprovedShiftRegistration`
 * below, which needs real ids for a foreign key `shift.submit`'s own
 * future-date-only guard makes impossible to register for TODAY via UI.
 */
export async function findShiftTemplateByNames(opts: {
  facilityId: string;
  groupName: string;
  templateName: string;
}): Promise<{ shiftGroupId: string; shiftTemplateId: string } | null> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const group = await tx.shiftGroup.findFirst({
        where: { facilityId: opts.facilityId, name: opts.groupName },
      });
      if (!group) return null;
      const template = await tx.shiftTemplate.findFirst({
        where: { facilityId: opts.facilityId, shiftGroupId: group.id, name: opts.templateName },
      });
      if (!template) return null;
      return { shiftGroupId: group.id, shiftTemplateId: template.id };
    },
    { bypass: true },
  );
}

/** Seeds a bare Student + a `pending` Reward against a Gift a real director
 *  session already created via `/admin/engagement/gifts` — see the
 *  PO-approved-exceptions header above. Every step after this (approve/
 *  deliver on `/admin/engagement/rewards`) still goes through real UI. */
export async function seedPendingReward(opts: SeedPendingRewardOptions): Promise<SeedPendingRewardResult> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const gift = await tx.gift.findFirst({
        where: { facilityId: opts.facilityId, name: opts.giftName },
        orderBy: { createdAt: 'desc' },
      });
      if (!gift) {
        throw new Error(
          `seedPendingReward: no Gift named "${opts.giftName}" found for facility ${opts.facilityId} — ` +
            'create it via the real /admin/engagement/gifts UI before calling this.',
        );
      }
      const student = await tx.student.create({
        data: {
          facilityId: opts.facilityId,
          fullName: opts.studentName ?? `E2E Reward Student ${randomUUID().slice(0, 8)}`,
        },
      });
      const reward = await tx.reward.create({
        data: { facilityId: opts.facilityId, studentId: student.id, giftId: gift.id, status: 'pending' },
      });
      return { rewardId: reward.id, studentId: student.id, giftId: gift.id };
    },
    { bypass: true },
  );
}
