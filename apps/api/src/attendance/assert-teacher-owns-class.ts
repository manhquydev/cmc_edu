// Teacher class-scoping (scenario audit H1+H2, 2026-07-15): shared ownership
// gate extracted from `attendance.listBySession`'s inline check (the only
// place this pattern existed before) — director roles bypass, non-teacher
// roles have nothing to scope, a teacher may only act on the ClassBatch they
// are assigned to via `ClassBatch.teacherAppUserId`.
//
// Two hardening changes vs. the original inline version:
//   1. FAIL-CLOSED when the caller's AppUser profile cannot be resolved
//      (the old code let the caller through "to avoid breaking tests" — a
//      real gap, not a real product requirement: every real staff session
//      already requires an AppUser row, same as `checkin.punch`).
//   2. A class with NO assigned teacher (`teacherAppUserId = null`) is
//      blocked for teacher-only callers (PO decision) — only a director may
//      act on it until it is assigned.

import type { AuthSubject } from '@cmc/auth';
import type { Prisma, PrismaClient } from '@cmc/db';
import { TRPCError } from '@trpc/server';
import { forbidden } from '../errors.js';

const DIRECTOR_ROLES = ['super_admin', 'giam_doc_dao_tao', 'giam_doc_kinh_doanh'];

/**
 * Throws FORBIDDEN unless `subject` may act on `classBatchId`:
 * - Director roles (super_admin/GĐĐT/GĐKD): always allowed (broad access).
 * - Non-teacher, non-director roles: nothing to scope — allowed (this gate
 *   only restricts `giao_vien`).
 * - `giao_vien`: allowed ONLY when their own AppUser row is
 *   `ClassBatch.teacherAppUserId` for this class.
 */
export async function assertTeacherOwnsClass(
  db: PrismaClient | Prisma.TransactionClient,
  facilityId: string,
  subject: AuthSubject | null,
  classBatchId: string,
): Promise<void> {
  const roles = subject?.roles ?? [];
  if (roles.some((r) => DIRECTOR_ROLES.includes(r))) return;
  if (!roles.includes('giao_vien')) return;

  const appUser = await db.appUser.findFirst({
    where: { userId: subject!.userId, facilityId },
    select: { id: true },
  });
  if (!appUser) {
    throw forbidden('Teacher profile not found in this facility.');
  }

  const batch = await db.classBatch.findFirst({
    where: { id: classBatchId, facilityId },
    select: { teacherAppUserId: true },
  });
  if (!batch?.teacherAppUserId) {
    throw forbidden('Class has no assigned teacher; only a director can act on it.');
  }
  if (batch.teacherAppUserId !== appUser.id) {
    throw forbidden('Teachers may only act on their own classes.');
  }
}

/**
 * Convenience wrapper for callers that only have a (possibly null)
 * `classSessionId` on hand — resolves it to a `classBatchId` and delegates to
 * `assertTeacherOwnsClass`. A null/unresolvable session means no class
 * context to scope against, so the check is skipped (e.g. a period-based
 * `QualitativeAssessment` with no linked session).
 */
export async function assertTeacherOwnsSessionClass(
  db: PrismaClient | Prisma.TransactionClient,
  facilityId: string,
  subject: AuthSubject | null,
  classSessionId: string | null,
): Promise<void> {
  if (!classSessionId) return;
  const session = await db.classSession.findFirst({
    where: { id: classSessionId, facilityId },
    select: { classBatchId: true },
  });
  if (!session) return;
  await assertTeacherOwnsClass(db, facilityId, subject, session.classBatchId);
}

/**
 * Post-implementation hardening (scenario audit round 2): convenience wrapper
 * for callers that only have a `studentId` on hand (`Submission` carries no
 * `classBatchId` of its own — `Exercise` is curriculum-unit-based, not
 * class-based). Resolves scope via the student's ACTIVE enrollment(s): a
 * teacher-only caller may act when they own AT LEAST ONE of the student's
 * active classes; no active enrollment at all means nothing to scope against
 * (allowed — same precedent as `assertTeacherOwnsSessionClass`'s
 * null-session case). Originally inlined in `submission.grade` only; shared
 * here so `saveTeacherAnnotation` and `listForGrading` apply the identical
 * rule instead of drifting.
 */
export async function assertTeacherOwnsStudentClass(
  db: Prisma.TransactionClient,
  facilityId: string,
  subject: AuthSubject | null,
  studentId: string,
): Promise<void> {
  const roles = subject?.roles ?? [];
  if (roles.some((r) => DIRECTOR_ROLES.includes(r))) return;
  if (!roles.includes('giao_vien')) return;

  const activeEnrollments = await db.enrollment.findMany({
    where: { facilityId, studentId, status: 'active' },
    select: { classBatchId: true },
  });
  if (activeEnrollments.length === 0) return;

  const checks = await Promise.allSettled(
    activeEnrollments.map((e) => assertTeacherOwnsClass(db, facilityId, subject, e.classBatchId)),
  );
  if (checks.some((r) => r.status === 'fulfilled')) return;

  // Post-implementation hardening: a genuine non-FORBIDDEN failure (DB error,
  // RLS blip) inside one of the per-enrollment checks must propagate, not be
  // silently reinterpreted as "not your class" — only report FORBIDDEN when
  // every rejection actually was one.
  const unexpected = checks.find(
    (r): r is PromiseRejectedResult =>
      r.status === 'rejected' && !(r.reason instanceof TRPCError && r.reason.code === 'FORBIDDEN'),
  );
  if (unexpected) throw unexpected.reason;

  throw forbidden('Teachers may only act on submissions for students in their own classes.');
}
