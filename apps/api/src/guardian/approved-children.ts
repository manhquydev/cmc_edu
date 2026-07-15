// Shared child-data access gate (docs/08 §7): an APPROVED `Guardian` row is
// the ONLY thing that grants a parent read access to a student's data.
// `Guardian` rows are created exclusively by `guardian.approveLink` (see
// ./router.ts) — a pending or rejected `GuardianLinkRequest` never produces
// one — so "does an approved Guardian row exist" already implies "approved".
//
// Both the LMS login response (profile picker, ../lms-auth/router.ts) and
// `enrollment.mine` (../enrollment/router.ts) filter through this single
// helper so the child-data boundary is enforced in exactly one place, not
// re-implemented per call site.

import { withFacility, type PrismaClient } from '@cmc/db';

export interface ApprovedChild {
  studentId: string;
  fullName: string;
}

/**
 * Returns the students a parent may access via the LMS right now: an
 * approved `Guardian` link AND the student's `lifecycle` is neither
 * `blocked_lms` (docs/19 §2 — a blocked lifecycle is excluded from LMS reads
 * entirely, not merely gated at the UI) nor `withdrawn` (void/xoá hẳn).
 *
 * K9 reversal (scenario audit, PO decision round 3, 2026-07-15): a REGULAR
 * cancel (`finance.receiptCancel` withdraws the Enrollment it rolled back,
 * `Student.lifecycle` stays `active`) no longer hides the child — the parent
 * already has a valid Guardian link and may view their child's history. The
 * gate is now purely `Student.lifecycle`, not enrollment status: to actually
 * remove a child from a parent's view, void the student (set
 * `lifecycle=withdrawn`), not a regular cancel.
 *
 * Runs with the RLS bypass GUC (ADR 0042): `Guardian` carries no RLS policy,
 * but this query joins into `Student` (RLS-protected) across potentially
 * many facilities — a parent's children may be enrolled at different
 * branches. The real access boundary is `parentAccountId` ownership (an
 * approved Guardian row), not facility membership.
 */
export async function getApprovedChildren(
  db: PrismaClient,
  parentAccountId: string,
): Promise<ApprovedChild[]> {
  const guardians = await withFacility(
    db,
    null,
    (tx) =>
      tx.guardian.findMany({
        where: {
          parentAccountId,
          student: { lifecycle: { notIn: ['blocked_lms', 'withdrawn'] } },
        },
        select: { student: { select: { id: true, fullName: true } } },
      }),
    { bypass: true },
  );

  return guardians.map((g) => ({ studentId: g.student.id, fullName: g.student.fullName }));
}

export interface AuditChildDataAccessOptions {
  parentAccountId: string;
  studentIds: string[];
  /** Which call site disclosed the data (e.g. `'enrollment.mine'`), recorded
   * in `AuditLog.data` for traceability. */
  via: string;
  /** Whether the data was accessed by a parent session or a student session
   * (C1/phase-01b). Defaults to 'parent' when omitted (legacy call sites). */
  actorKind?: 'parent' | 'student';
}

/**
 * M3 remediation (docs/08 §7 "Nhật ký truy cập dữ liệu trẻ"): records one
 * `AuditLog` row per student whose data was actually disclosed to a parent —
 * `enrollment.mine` and a successful `lmsAuth.verifyOtp` both call this after
 * resolving the approved-children set, so every real child-data read is
 * traceable to a parentAccountId/time/student. A no-op when `studentIds` is
 * empty (nothing was disclosed, e.g. no approved Guardian link yet) — an
 * empty read is not a data access worth auditing.
 */
export async function auditChildDataAccess(
  db: PrismaClient,
  opts: AuditChildDataAccessOptions,
): Promise<void> {
  if (opts.studentIds.length === 0) return;

  await db.auditLog.createMany({
    data: opts.studentIds.map((studentId) => ({
      actor: opts.parentAccountId,
      action: 'guardian.childDataRead',
      entity: 'Student',
      entityId: studentId,
      data: { via: opts.via, actorKind: opts.actorKind ?? 'parent' },
    })),
  });
}
