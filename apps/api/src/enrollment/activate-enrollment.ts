// Internal helper: flips a student's Enrollment for a class into `active`,
// driven exclusively by `finance.receiptApprove` provisioning (ADR-A,
// docs/24 WF-P1-05). This is NOT exported as a tRPC procedure — there is no
// client-facing mutation that sets `active` directly; `active` only ever
// results from an approved Receipt.

import type { PrismaClient } from '@cmc/db';

export interface ActivateEnrollmentParams {
  facilityId: string;
  studentId: string;
  classBatchId: string;
}

/**
 * Idempotent: replaying with the same (facilityId, studentId, classBatchId)
 * never creates a duplicate Enrollment row.
 * - No enrollment exists yet -> create one directly as `active` (WF-P1-04:
 *   "If no reserved enrollment exists for that student+class, create it as
 *   active during provisioning").
 * - A `reserved` enrollment exists -> flip it to `active`.
 * - Any other status (`active`/`completed`/`transferred`/`withdrawn`) is left
 *   untouched (already active, or a status this function must not override).
 */
export async function activateEnrollmentForReceipt(
  db: PrismaClient,
  params: ActivateEnrollmentParams,
) {
  const existing = await db.enrollment.findFirst({
    where: {
      facilityId: params.facilityId,
      studentId: params.studentId,
      classBatchId: params.classBatchId,
    },
  });

  if (!existing) {
    return db.enrollment.create({
      data: {
        facilityId: params.facilityId,
        studentId: params.studentId,
        classBatchId: params.classBatchId,
        status: 'active',
      },
    });
  }

  if (existing.status === 'reserved') {
    return db.enrollment.update({
      where: { id: existing.id },
      data: { status: 'active' },
    });
  }

  return existing;
}
