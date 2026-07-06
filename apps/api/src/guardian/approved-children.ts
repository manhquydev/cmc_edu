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

import type { PrismaClient } from '@cmc/db';

export interface ApprovedChild {
  studentId: string;
  fullName: string;
}

/**
 * Returns the students a parent may access via the LMS right now: an
 * approved `Guardian` link AND the student is not `blocked_lms` (docs/19 §2
 * — a blocked lifecycle is excluded from LMS reads entirely, not merely
 * gated at the UI).
 */
export async function getApprovedChildren(
  db: PrismaClient,
  parentAccountId: string,
): Promise<ApprovedChild[]> {
  const guardians = await db.guardian.findMany({
    where: {
      parentAccountId,
      student: { lifecycle: { not: 'blocked_lms' } },
    },
    select: { student: { select: { id: true, fullName: true } } },
  });

  return guardians.map((g) => ({ studentId: g.student.id, fullName: g.student.fullName }));
}
