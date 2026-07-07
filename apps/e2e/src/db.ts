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

let dbSingleton: PrismaClient | undefined;

export function getDb(): PrismaClient {
  dbSingleton ??= createPrismaClient();
  return dbSingleton;
}

let privilegedDbSingleton: PrismaClient | undefined;

function getPrivilegedDb(): PrismaClient {
  privilegedDbSingleton ??= new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });
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

  // Append-only ledger — no DELETE grant for cmc_app (ADR 0042 hardening).
  await getPrivilegedDb().attendance.deleteMany({ where: { facilityId } });

  await db.guardian.deleteMany({ where: { facilityId } });
  await db.guardianLinkRequest.deleteMany({ where: { facilityId } });

  await withFacility(
    db,
    null,
    async (tx) => {
      // Phase-08 additions: Submission-derived tables before Submission, then
      // StarTransaction/FinalGrade before Enrollment/Student.
      await tx.finalGrade.deleteMany({ where: { facilityId } });
      await tx.starTransaction.deleteMany({ where: { facilityId } });
      await tx.submission.deleteMany({ where: { facilityId } });
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

  await db.receiptCodeCounter.deleteMany({ where: { facilityId } });
  await db.facility.deleteMany({ where: { id: facilityId } });
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
  const db = getDb();
  const exercises = await db.exercise.findMany({
    where: { id: { in: exerciseIds } },
    select: { id: true, curriculumUnitId: true },
  });
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
