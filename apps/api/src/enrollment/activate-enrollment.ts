// Internal helper: flips a student's Enrollment for a class into `active`,
// driven exclusively by `finance.receiptApprove` provisioning (ADR-A,
// docs/24 WF-P1-05). This is NOT exported as a tRPC procedure — there is no
// client-facing mutation that sets `active` directly; `active` only ever
// results from an approved Receipt.

import { withFacility, type Prisma, type PrismaClient } from '@cmc/db';

export interface ActivateEnrollmentParams {
  facilityId: string;
  studentId: string;
  classBatchId: string;
}

/** Duck-types a Prisma `P2002` (unique constraint violation) — same check as
 * ../provisioning/provision-from-receipt.ts's P2002 recovery paths, duplicated
 * locally (not imported) to avoid a circular import: that module already
 * imports FROM this one. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
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
 * `Enrollment` is RLS-protected (ADR 0042) — the existence-check + create/update
 * runs in one `withFacility` transaction. A concurrent replay of the SAME
 * (facilityId, studentId, classBatchId) with no existing `reserved`/`active`
 * row races on the `enrollment_active_reserved_unique` partial index: both
 * transactions see no `openRow` and both attempt `create()`, so the loser
 * gets a `P2002` — caught here and resolved by refetching in a FRESH
 * transaction (Postgres aborts the whole transaction on its first error, same
 * constraint documented in ../provisioning/provision-from-receipt.ts), rather
 * than letting the error propagate and strand the caller with no Enrollment.
 */
export async function activateEnrollmentForReceipt(
  db: PrismaClient,
  params: ActivateEnrollmentParams,
) {
  function findOpenRow(tx: Prisma.TransactionClient) {
    return tx.enrollment.findFirst({
      where: {
        facilityId: params.facilityId,
        studentId: params.studentId,
        classBatchId: params.classBatchId,
        status: { in: ['reserved', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  try {
    return await withFacility(db, params.facilityId, async (tx) => {
      const openRow = await findOpenRow(tx);

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
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    const refetched = await withFacility(db, params.facilityId, findOpenRow);
    if (!refetched) throw error;
    return refetched;
  }
}
