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
import { createPrismaClient, withFacility, PrismaClient } from '@cmc/db';
import { ictToUtc } from '@cmc/domain-time';
import type { Role } from '@cmc/auth';
import { randomVnPhone } from './random-vn-phone.js';
import { assertNotProdDatabase } from './assert-not-prod.js';

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
    privilegedDbSingleton = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    });
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
  const separatorIndex = otp.codeHash.indexOf(':');
  if (separatorIndex < 0) {
    throw new Error(`Malformed LoginOtp.codeHash for phone ${phone}.`);
  }
  const salt = otp.codeHash.slice(0, separatorIndex);
  const digest = otp.codeHash.slice(separatorIndex + 1);

  for (let i = 0; i < OTP_CODE_SPACE; i += 1) {
    const candidate = String(i).padStart(6, '0');
    const candidateDigest = createHash('sha256').update(salt + candidate).digest('hex');
    if (candidateDigest === digest) {
      return candidate;
    }
  }
  throw new Error(`Could not recover the OTP code for phone ${phone} (brute-force exhausted).`);
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

// ---------------------------------------------------------------------------
// Phase-08: exercise + submission seeding helpers
// ---------------------------------------------------------------------------

/** Seeds a global CurriculumUnit + published Exercise. Both are facility-
 * agnostic (no facilityId). Clean up with `cleanupExercises(exerciseId)`. */
export async function seedPublishedExercise(opts?: {
  maxScore?: number;
  starReward?: number;
}): Promise<{ unitId: string; exerciseId: string }> {
  const db = getDb();
  const unit = await db.curriculumUnit.create({
    data: {
      program: 'UCREA',
      level: 1,
      monthIndex: 1,
      unitType: 'LESSON',
      title: `E2E Unit ${randomUUID().slice(0, 8)}`,
    },
  });
  const exercise = await db.exercise.create({
    data: {
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'e2e/test.pdf',
      maxScore: opts?.maxScore ?? 10,
      starReward: opts?.starReward ?? 5,
      status: 'published',
      createdById: 'e2e-seed',
    },
  });
  return { unitId: unit.id, exerciseId: exercise.id };
}

/** Seeds a Submission in 'submitted' state directly in the DB (bypassing the
 * LMS open-tier gate) — use when the spec targets `submission.grade` rather
 * than the student submission flow. */
export async function seedSubmittedSubmission(opts: {
  facilityId: string;
  studentId: string;
  exerciseId: string;
}): Promise<{ submissionId: string }> {
  return withFacility(
    getDb(),
    null,
    async (tx) => {
      const submission = await tx.submission.create({
        data: {
          facilityId: opts.facilityId,
          studentId: opts.studentId,
          exerciseId: opts.exerciseId,
          annotationLayer: {},
          status: 'submitted',
          submittedAt: new Date(),
          version: 1,
        },
      });
      return { submissionId: submission.id };
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
  const exercises = await db.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, curriculumUnitId: true },
  });
  // Submissions FK-reference these exercises. This runs in a spec's afterAll,
  // which fires before the global teardown's cleanupFacility — so the rows are
  // still present here and must be cleared first or the Exercise delete trips
  // Submission_exerciseId_fkey.
  await db.submission.deleteMany({ where: { exerciseId: { in: exerciseIds } } });
  await db.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  const unitIds = [...new Set(exercises.map((e) => e.curriculumUnitId))];
  if (unitIds.length > 0) {
    await db.curriculumUnit.deleteMany({ where: { id: { in: unitIds } } });
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
