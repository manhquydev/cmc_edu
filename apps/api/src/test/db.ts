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

import { randomUUID } from 'node:crypto';
import { createPrismaClient, PrismaClient, withFacility, type Prisma } from '@cmc/db';
import type { Role } from '@cmc/auth';
import type { Context } from '../trpc.js';

/** Real pilot DB name (docs/runbook-deploy.md). Fail-closed guard (gap-closure
 * 260710-0005 Phase 3, red-team F6): this test harness runs real INSERT/
 * DELETE against whatever `APP_DATABASE_URL` points at — never the real
 * pilot database. Mirrors the same check in apps/e2e/src/global-setup.ts. */
const FORBIDDEN_DATABASE_NAME = 'cmc_prod';

function assertNotProdDatabase(databaseUrl: string | undefined): void {
  if (!databaseUrl) return; // createPrismaClient() will fail its own way if unset.
  let dbName: string;
  try {
    dbName = new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    return; // Not our job to validate URL shape — createPrismaClient() will surface that error.
  }
  if (dbName === FORBIDDEN_DATABASE_NAME) {
    throw new Error(
      `apps/api integration tests refuse to run against database "${FORBIDDEN_DATABASE_NAME}" — this is ` +
        `the real pilot database, not a throwaway. Point APP_DATABASE_URL at a throwaway DB (e.g. ` +
        `"cmc_staging") before running \`pnpm test\`.`,
    );
  }
}

let dbSingleton: PrismaClient | undefined;

/** Shared Prisma client for integration tests (lazy — no connection until used). */
export function testDb(): PrismaClient {
  if (!dbSingleton) {
    assertNotProdDatabase(process.env['APP_DATABASE_URL']);
    dbSingleton = createPrismaClient();
  }
  return dbSingleton;
}

let privilegedDbSingleton: PrismaClient | undefined;

/**
 * K5 remediation: a SEPARATE connection using the migration/owner role
 * (`DATABASE_URL`, not `APP_DATABASE_URL`) — test-teardown-only. `RefundRecord`
 * and `AuditLog` have UPDATE/DELETE revoked from `cmc_app` (append-only
 * ledgers, see the `p1_remediation_wavea_privilege_hardening` migration), so
 * this test harness's own row cleanup for those two tables can no longer run
 * through the same connection the app uses — it must use the privileged role,
 * exactly like a real DBA doing manual data remediation would. Never use this
 * for a test's arrange/act/assert phases (it also bypasses RLS entirely, same
 * caveat as the migration role everywhere else in this codebase) — only for
 * teardown of the two now-restricted ledgers.
 */
function privilegedDb(): PrismaClient {
  privilegedDbSingleton ??= new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
  return privilegedDbSingleton;
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

/** Seeds a throwaway Facility for one test's RLS scope. `code` (P2-Foundation:
 * the class-code prefix, QĐ 0036) is auto-generated when omitted -- unique
 * per call, so parallel/serial test files never collide on it. */
export async function createTestFacility(name: string, code?: string): Promise<{ id: string; code: string }> {
  const facilityCode = code ?? `T${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  return testDb().facility.create({ data: { name, code: facilityCode } });
}

/** Deletes every row scoped to `facilityId`, then the Facility itself. */
export async function cleanupFacility(facilityId: string): Promise<void> {
  const db = testDb();
  // P5: ReconciliationFlag is append-only (no DELETE grant to cmc_app).
  // Delete before receipts (no FK, but deleting orphaned flags first is clean).
  await privilegedDb().reconciliationFlag.deleteMany({ where: { facilityId } });
  // P4: All new tables grant only SELECT/INSERT/UPDATE to cmc_app — use
  // privileged connection for teardown (same pattern as Attendance/StarTransaction).
  // FK order: AfterSaleCase, ParentMeeting, TestAppointment are independent;
  // Reward must precede Gift (FK Reward.giftId → Gift.id RESTRICT).
  await privilegedDb().afterSaleCase.deleteMany({ where: { facilityId } });
  await privilegedDb().parentMeeting.deleteMany({ where: { facilityId } });
  await privilegedDb().testAppointment.deleteMany({ where: { facilityId } });
  await privilegedDb().reward.deleteMany({ where: { facilityId } });
  await privilegedDb().gift.deleteMany({ where: { facilityId } });
  // P3-II: KpiScore and Payslip are append-like (cmc_app has no DELETE grant).
  // SalaryRate, ShiftRegistrationEntry, ShiftRegistration, ShiftTemplate,
  // ShiftGroup must be deleted before AppUser (FK RESTRICT chains).
  await privilegedDb().kpiScore.deleteMany({ where: { facilityId } });
  await privilegedDb().payslip.deleteMany({ where: { facilityId } });
  // HR remediation phase 1: CompensationPolicy/SalaryTier are also
  // append-like (no DELETE grant to cmc_app, same posture as Payslip/
  // KpiScore). SalaryRate.tierId is ON DELETE SET NULL, so SalaryTier can be
  // deleted in any order relative to SalaryRate below.
  await privilegedDb().compensationPolicy.deleteMany({ where: { facilityId } });
  await privilegedDb().salaryTier.deleteMany({ where: { facilityId } });
  await privilegedDb().salaryRate.deleteMany({ where: { facilityId } });
  await privilegedDb().shiftRegistrationEntry.deleteMany({ where: { facilityId } });
  await privilegedDb().shiftRegistration.deleteMany({ where: { facilityId } });
  await privilegedDb().shiftTemplate.deleteMany({ where: { facilityId } });
  await privilegedDb().shiftGroup.deleteMany({ where: { facilityId } });
  // P3-I: ManualAttendanceTicket / TimePunch are append-only (cmc_app has no
  // DELETE grant — same policy as Attendance/RefundRecord above). AppUser and
  // FacilityNetwork have RLS but the privileged connection bypasses that.
  // Delete order: ManualAttendanceTicket → TimePunch → AppUser (FK RESTRICT
  // chain), then FacilityNetwork (independent FK to Facility).
  await privilegedDb().manualAttendanceTicket.deleteMany({ where: { facilityId } });
  await privilegedDb().timePunch.deleteMany({ where: { facilityId } });
  await privilegedDb().appUser.deleteMany({ where: { facilityId } });
  await privilegedDb().facilityNetwork.deleteMany({ where: { facilityId } });
  // Guardian has FK constraints on both Student and ParentAccount — it must
  // be deleted before Student (below) and before `cleanupParentAccountsByPhone`
  // runs (called separately, after this function returns). Guardian itself
  // carries no RLS policy, so no bypass is needed for this delete.
  await db.guardian.deleteMany({ where: { facilityId } });
  await db.guardianLinkRequest.deleteMany({ where: { facilityId } });
  // K5: `cmc_app` no longer has DELETE on RefundRecord (append-only ledger) —
  // this teardown-only delete now runs via the privileged migration-role
  // connection instead (see `privilegedDb()` above).
  await privilegedDb().refundRecord.deleteMany({ where: { facilityId } });
  // T1: `cmc_app` has no DELETE grant on Attendance either (append-only-ish
  // write model, ../attendance/router.ts) — same privileged-connection
  // teardown as RefundRecord/AuditLog. Must run before the ClassSession/
  // Enrollment/Student deletes below (all RESTRICT FKs from Attendance).
  await privilegedDb().attendance.deleteMany({ where: { facilityId } });
  // T2-II: `cmc_app` has no DELETE grant on Submission/FinalGrade/
  // StarTransaction either (same wave-A least-privilege default new tables
  // get — see the T2-II migration). Must run before the Student/ClassBatch
  // deletes below (RESTRICT FKs from all three).
  await privilegedDb().submission.deleteMany({ where: { facilityId } });
  await privilegedDb().finalGrade.deleteMany({ where: { facilityId } });
  await privilegedDb().starTransaction.deleteMany({ where: { facilityId } });
  // T3: `cmc_app` has no DELETE grant on QualitativeAssessment, SessionEvidence,
  // or SessionEvidencePhoto (wave-A default-privilege template for new tables).
  // QualitativeAssessment has an FK to Student → must run before student delete.
  // SessionEvidencePhoto has an FK to SessionEvidence → delete first.
  // SessionEvidence has an FK to ClassSession → must run before classSession delete.
  await privilegedDb().qualitativeAssessment.deleteMany({ where: { facilityId } });
  await privilegedDb().sessionEvidencePhoto.deleteMany({ where: { facilityId } });
  await privilegedDb().sessionEvidence.deleteMany({ where: { facilityId } });
  await testDbBypass(async (tx) => {
    // `studentAccount` has no facilityId of its own — the relational filter
    // joins through `student` (RLS-protected), so this delete also needs the
    // bypass GUC even though StudentAccount itself carries no RLS policy. It
    // also has an FK to Student, so it must run before `student.deleteMany`.
    await tx.studentAccount.deleteMany({ where: { student: { facilityId } } });
    await tx.enrollment.deleteMany({ where: { facilityId } });
    await tx.student.deleteMany({ where: { facilityId } });
    await tx.receipt.deleteMany({ where: { facilityId } });
    await tx.opportunity.deleteMany({ where: { facilityId } });
    await tx.contact.deleteMany({ where: { facilityId } });
    // P2-Foundation: ClassSession/ScheduleSlot must be deleted before
    // ClassBatch (both carry a RESTRICT FK to it); ClassBatch before Course
    // (RESTRICT FK). `ClassBatchCodeCounter` carries a real (non-sentinel)
    // RLS policy — unlike `ReceiptCodeCounter` below — so its cleanup delete
    // needs the bypass GUC too, not a plain `db.*` call.
    await tx.classSession.deleteMany({ where: { facilityId } });
    await tx.scheduleSlot.deleteMany({ where: { facilityId } });
    await tx.classBatch.deleteMany({ where: { facilityId } });
    await tx.course.deleteMany({ where: { facilityId } });
    await tx.room.deleteMany({ where: { facilityId } });
    await tx.classBatchCodeCounter.deleteMany({ where: { facilityId } });
  });
  await db.receiptCodeCounter.deleteMany({ where: { facilityId } });
  await db.facility.deleteMany({ where: { id: facilityId } });
}

/**
 * Deletes ParentAccount rows created by a test (system-wide, not facility-scoped).
 *
 * Defensively deletes any `StudentAccount` rows referencing these ParentAccounts
 * first. Normally `cleanupFacility` handles StudentAccount cleanup, but if a
 * test run was interrupted (crash, SIGTERM) before afterEach ran, orphaned
 * StudentAccount rows would block the ParentAccount delete with a FK violation
 * on `StudentAccount_parentAccountId_fkey`. The privileged role is required
 * because cmc_app has no DELETE grant on StudentAccount when it is reached via
 * its parentAccountId FK outside a facility-scoped transaction.
 */
export async function cleanupParentAccountsByPhone(...phones: string[]): Promise<void> {
  if (phones.length === 0) return;
  const parents = await testDb().parentAccount.findMany({
    where: { phone: { in: phones } },
    select: { id: true },
  });
  if (parents.length > 0) {
    const parentIds = parents.map((p) => p.id);
    // Guardian has FK Guardian.parentAccountId → ParentAccount (RESTRICT). Delete
    // Guardian rows first so the ParentAccount delete below does not violate the
    // constraint. Guardian carries no RLS policy, so testDb() works here.
    // (cleanupFacility normally handles this, but if a previous test run crashed
    // before its afterEach completed, orphaned Guardian rows survive and block
    // this delete — this defensive call ensures we clean them up regardless.)
    await testDb().guardian.deleteMany({ where: { parentAccountId: { in: parentIds } } });
    await privilegedDb().studentAccount.deleteMany({ where: { parentAccountId: { in: parentIds } } });
  }
  await testDb().parentAccount.deleteMany({ where: { phone: { in: phones } } });
}

/** Deletes LoginOtp rows created by a test (system-wide, phone-scoped like ParentAccount). */
export async function cleanupLoginOtpsByPhone(...phones: string[]): Promise<void> {
  if (phones.length === 0) return;
  await testDb().loginOtp.deleteMany({ where: { phone: { in: phones } } });
}

export interface SeedAppUserOptions {
  facilityId: string;
  userId: string;
  fullName?: string;
  position?: string;
  managerId?: string;
}

/**
 * P3-I: seeds an AppUser row for test procedures that write TimePunch /
 * ManualAttendanceTicket FKs. Uses `testDbBypass` so the global
 * EmployeeCodeCounter (no RLS) and the RLS-gated AppUser table are both
 * accessible in one transaction.
 */
export async function seedAppUser(
  opts: SeedAppUserOptions,
): Promise<{ id: string; employeeCode: string }> {
  return testDbBypass(async (tx) => {
    const counter = await tx.employeeCodeCounter.update({
      where: { id: 1 },
      data: { next: { increment: 1 } },
    });
    const employeeCode = `CMC${String(counter.next - 1).padStart(4, '0')}`;
    return tx.appUser.create({
      data: {
        facilityId: opts.facilityId,
        userId: opts.userId,
        email: `${opts.userId}@test.cmc`,
        fullName: opts.fullName ?? opts.userId,
        position: opts.position ?? 'staff',
        managerId: opts.managerId ?? null,
        employeeCode,
      },
    });
  });
}

/**
 * P3-I: seeds a FacilityNetwork row (active CIDR range) for checkin tests
 * that exercise the IP-gate path. Uses the plain `testDb()` connection —
 * FacilityNetwork has RLS (facility-scoped), so this must be called inside a
 * `withFacility` context, OR use `testDbBypass` if called outside one.
 */
export async function seedFacilityNetwork(
  facilityId: string,
  cidr: string,
  label = 'test-net',
): Promise<{ id: string }> {
  return testDbBypass(async (tx) =>
    tx.facilityNetwork.create({ data: { facilityId, cidr, label, isActive: true } }),
  );
}

export interface TestStaffContextOptions {
  facilityId: string;
  userId: string;
  roles: Role[];
  /** Caller IP to inject into the context (default: null). Used by P3-I
   *  checkin tests that exercise the FacilityNetwork IP-gate path. */
  ip?: string | null;
}

/** Hand-builds a staff `Context` (dev session shape) against the real DB. */
export function buildStaffContext(opts: TestStaffContextOptions): Context {
  return {
    subject: { userId: opts.userId, roles: opts.roles },
    facilityId: opts.facilityId,
    lmsSubject: null,
    db: testDb(),
    ip: opts.ip ?? null,
  };
}

export interface TestLmsContextOptions {
  parentAccountId: string;
  studentId?: string;
  /** C1/phase-01b: session kind. Defaults to 'parent' so existing tests that
   * don't pass kind continue to work as parent sessions. */
  kind?: 'parent' | 'student';
}

/** Hand-builds an LMS (parent/student) `Context` against the real DB. */
export function buildLmsContext(opts: TestLmsContextOptions): Context {
  return {
    subject: null,
    facilityId: null,
    lmsSubject: {
      parentAccountId: opts.parentAccountId,
      studentId: opts.studentId,
      kind: opts.kind ?? 'parent',
    },
    db: testDb(),
    ip: null,
  };
}

/** Seeds a throwaway ParentAccount for a test (system-wide, unique by phone —
 * pass an already-normalized `84xxxxxxxxx` phone). */
export async function seedParentAccount(phone: string): Promise<{ id: string; phone: string }> {
  return testDb().parentAccount.create({ data: { phone } });
}

/**
 * P4: Seeds a StudentAccount for a test student — required for the
 * `rewards.redeem` SELECT FOR UPDATE serialization lock to have a row to lock.
 * In production, StudentAccount is created by `finance.receiptApprove`; in
 * tests that don't exercise the full provisioning flow, seed it directly.
 */
export async function seedStudentAccount(
  studentId: string,
  parentAccountId: string,
): Promise<{ id: string }> {
  return testDbBypass((tx) =>
    tx.studentAccount.create({
      data: { studentId, parentAccountId },
      select: { id: true },
    }),
  );
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

/**
 * T2-II (F1 remediation): seeds an active Enrollment AND an approved Guardian
 * link in one call. `parentAccountId` MUST be a real `ParentAccount.id` (FK
 * constraint on Guardian). Use `seedParentAccount` first if you need to create
 * the account, or seed one in the test's `beforeEach` and pass its id here.
 *
 * This is the recommended helper for any T2-II test that calls an LMS
 * procedure that resolves a student (`loadLmsStudent`) — after the F1 fix
 * those procedures verify the parent→student Guardian link every time.
 */
export async function seedEnrolledStudentWithGuardian(opts: {
  facilityId: string;
  classBatchId: string;
  parentAccountId: string;
  studentName?: string;
}): Promise<{ id: string; studentId: string; classBatchId: string }> {
  const enrollment = await seedActiveEnrollment({
    facilityId: opts.facilityId,
    classBatchId: opts.classBatchId,
    studentName: opts.studentName,
  });
  await seedGuardianLink({
    facilityId: opts.facilityId,
    parentAccountId: opts.parentAccountId,
    studentId: enrollment.studentId,
    status: 'approved',
  });
  return enrollment;
}

export interface SeedClassBatchOptions {
  facilityId: string;
  program?: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE';
  /** Reuses an existing Course instead of creating one. */
  courseId?: string;
  /** `YYYY-MM-DD`, defaults to a fixed fixture range. */
  startDate?: string;
  endDate?: string;
}

/**
 * P2-Foundation: seeds a real Course + ClassBatch (with the same code-format/
 * atomic-counter shape `classBatch.create` uses) for tests that only need a
 * valid `classBatchId` to exercise the P1<->P2 seam (`finance.receiptCreate`/
 * `enrollment.enroll` now validate it points at a real, same-facility
 * ClassBatch) — not the full auto-session-generation flow, which
 * `class/generate-sessions.test.ts` covers via the real `classBatch.create`
 * procedure instead of this shortcut.
 */
export async function seedClassBatch(
  opts: SeedClassBatchOptions,
): Promise<{ id: string; code: string; courseId: string }> {
  const program = opts.program ?? 'UCREA';
  const startDate = opts.startDate ?? '2026-08-01';
  const endDate = opts.endDate ?? '2026-08-31';
  const year = Number(startDate.slice(0, 4));

  return testDbBypass(async (tx) => {
    const facility = await tx.facility.findUniqueOrThrow({ where: { id: opts.facilityId } });
    const course = opts.courseId
      ? await tx.course.findUniqueOrThrow({ where: { id: opts.courseId } })
      : await tx.course.create({
          data: {
            facilityId: opts.facilityId,
            program,
            name: `Seed Course ${randomUUID().slice(0, 8)}`,
          },
        });

    const counter = await tx.classBatchCodeCounter.upsert({
      where: { facilityId_program_year: { facilityId: opts.facilityId, program, year } },
      create: { facilityId: opts.facilityId, program, year, value: 1 },
      update: { value: { increment: 1 } },
    });
    const code = `${facility.code}-${program}-${year}-${String(counter.value).padStart(3, '0')}`;

    const classBatch = await tx.classBatch.create({
      data: {
        facilityId: opts.facilityId,
        code,
        courseId: course.id,
        program,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        createdById: 'test-seed',
      },
    });

    return { id: classBatch.id, code: classBatch.code, courseId: course.id };
  });
}

export interface SeedCurriculumUnitOptions {
  program?: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE';
  level?: number;
  monthIndex?: number;
  unitType?: 'LESSON' | 'REVIEW';
  title?: string;
}

/**
 * T2-I: `CurriculumUnit` is a GLOBAL table (no facilityId, no RLS — QĐ 0021),
 * so it is NOT covered by `cleanupFacility()`'s per-facility teardown; every
 * test that seeds one must delete it (and any `Exercise` rows pointing at it,
 * which RESTRICT-block the delete) itself, via `cleanupCurriculumUnits()`.
 */
export async function seedCurriculumUnit(
  opts: SeedCurriculumUnitOptions = {},
): Promise<{ id: string }> {
  return testDb().curriculumUnit.create({
    data: {
      program: opts.program ?? 'UCREA',
      level: opts.level ?? 1,
      monthIndex: opts.monthIndex ?? 1,
      unitType: opts.unitType ?? 'LESSON',
      title: opts.title ?? `Seed Unit ${randomUUID().slice(0, 8)}`,
    },
  });
}

/**
 * Deletes `Exercise` rows for each unit (RESTRICT FK), then the units
 * themselves — via the PRIVILEGED connection, like `Attendance`/`RefundRecord`
 * teardown above. Wave-A privilege hardening's default-privilege template
 * grants new tables only SELECT/INSERT for `cmc_app`; neither `CurriculumUnit`
 * nor `Exercise` has a production delete path (no `exercise.delete`
 * procedure), so this is teardown-only, same rationale as those two.
 */
export async function cleanupCurriculumUnits(...curriculumUnitIds: string[]): Promise<void> {
  if (curriculumUnitIds.length === 0) return;
  await privilegedDb().exercise.deleteMany({ where: { curriculumUnitId: { in: curriculumUnitIds } } });
  await privilegedDb().curriculumUnit.deleteMany({ where: { id: { in: curriculumUnitIds } } });
}

export interface SeedClassSessionOptions {
  facilityId: string;
  classBatchId: string;
  curriculumUnitId?: string | null;
  isMakeup?: boolean;
  status?: 'planned' | 'confirmed' | 'cancelled' | 'done';
  sessionDate?: Date;
  startTime?: Date;
  endTime?: Date;
}

/** T2-II (open-tier / grading tests): seeds a plain `ClassSession` directly
 * (bypasses generation), with the extra knobs (`curriculumUnitId`,
 * `isMakeup`, `endTime`) ADR 0038's Tier A/B gate reads. */
export async function seedClassSession(
  opts: SeedClassSessionOptions,
): Promise<{ id: string; classBatchId: string; curriculumUnitId: string | null; isMakeup: boolean; status: string }> {
  return testDbBypass((tx) =>
    tx.classSession.create({
      data: {
        facilityId: opts.facilityId,
        classBatchId: opts.classBatchId,
        sessionDate: opts.sessionDate ?? new Date('2026-08-03T00:00:00.000Z'),
        startTime: opts.startTime ?? new Date('2026-08-03T11:00:00.000Z'),
        endTime: opts.endTime ?? new Date('2026-08-03T12:30:00.000Z'),
        status: opts.status ?? 'planned',
        isMakeup: opts.isMakeup ?? false,
        curriculumUnitId: opts.curriculumUnitId ?? null,
      },
      select: { id: true, classBatchId: true, curriculumUnitId: true, isMakeup: true, status: true },
    }),
  );
}

export interface SeedActiveEnrollmentOptions {
  facilityId: string;
  classBatchId: string;
  studentName?: string;
}

/**
 * T1 (attendance gate tests): seeds a Student + an already-`active`
 * Enrollment directly (bypassing `enrollment.enroll`'s `reserved` seat-hold
 * and the Receipt-driven activation path, ADR-A) — attendance gate 3 only
 * needs a real active enrollment to exist, not the full P1 provisioning
 * flow already covered by ../enrollment/reserved-active.test.ts.
 */
export async function seedActiveEnrollment(
  opts: SeedActiveEnrollmentOptions,
): Promise<{ id: string; studentId: string; classBatchId: string }> {
  return testDbBypass(async (tx) => {
    const student = await tx.student.create({
      data: { facilityId: opts.facilityId, fullName: opts.studentName ?? `Seed Student ${randomUUID().slice(0, 8)}` },
    });
    const enrollment = await tx.enrollment.create({
      data: {
        facilityId: opts.facilityId,
        studentId: student.id,
        classBatchId: opts.classBatchId,
        status: 'active',
      },
    });
    return { id: enrollment.id, studentId: student.id, classBatchId: enrollment.classBatchId };
  });
}
