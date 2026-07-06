// Internal helper: flips a student's Enrollment for a class into `active`,
// driven exclusively by `finance.receiptApprove` provisioning (ADR-A,
// docs/24 WF-P1-05). This is NOT exported as a tRPC procedure — there is no
// client-facing mutation that sets `active` directly; `active` only ever
// results from an approved Receipt.

import { withFacility, type PrismaClient } from '@cmc/db';

export interface ActivateEnrollmentParams {
  facilityId: string;
  studentId: string;
  classBatchId: string;
}

/**
 * Idempotent: replaying with the same (facilityId, studentId, classBatchId)
 * never creates a duplicate Enrollment row.
 * - A `reserved`/`active` row exists (H2's partial unique index guarantees
 *   at most one) -> flip `reserved` to `active`, or leave an already-`active`
 *   row untouched.
 * - No `reserved`/`active` row exists -> create a fresh `active` row
 *   (WF-P1-04: "If no reserved enrollment exists for that student+class,
 *   create it as active during provisioning").
 *
 * M8 remediation: a prior version picked an arbitrary row via a plain
 * `findFirst` with no `orderBy`/status filter, so after a
 * withdraw -> re-pay cycle it could return the stale terminal
 * (`withdrawn`/`completed`) row untouched instead of activating a fresh seat.
 * This version only ever considers `reserved`/`active` rows as "the existing
 * enrollment" — a terminal row is never reused, matching H2's re-enrollment
 * policy (a new class run after withdrawal gets its own new Enrollment row).
 *
 * `Enrollment` is RLS-protected (ADR 0042) — the whole existence-check +
 * create/update runs in one `withFacility` transaction (safe here: no
 * catch-and-retry-after-error pattern, unlike the provisioning P2002 races in
 * ../provisioning/provision-from-receipt.ts).
 */
export async function activateEnrollmentForReceipt(
  db: PrismaClient,
  params: ActivateEnrollmentParams,
) {
  return withFacility(db, params.facilityId, async (tx) => {
    const openRow = await tx.enrollment.findFirst({
      where: {
        facilityId: params.facilityId,
        studentId: params.studentId,
        classBatchId: params.classBatchId,
        status: { in: ['reserved', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (openRow) {
      if (openRow.status === 'reserved') {
        return tx.enrollment.update({
          where: { id: openRow.id },
          data: { status: 'active' },
        });
      }
      return openRow;
    }

    return tx.enrollment.create({
      data: {
        facilityId: params.facilityId,
        studentId: params.studentId,
        classBatchId: params.classBatchId,
        status: 'active',
      },
    });
  });
}
