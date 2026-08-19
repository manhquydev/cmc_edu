// Internal helper: flips a student's Enrollment for a class into `active`,
// driven exclusively by `finance.receiptApprove` provisioning (ADR-A,
// docs/24 WF-P1-05). This is NOT exported as a tRPC procedure — there is no
// client-facing mutation that sets `active` directly; `active` only ever
// results from an approved Receipt.
import { withFacility, type Prisma, type PrismaClient } from '@cmc/db';
import { emitStudentRecordEvent } from '../student/record-event.js';

/**
 * C1 remediation (scenario audit, 2026-07-15): thrown when `Receipt.status`
 * is no longer `approved` at the moment this function is about to grant an
 * active Enrollment. Provisioning runs AFTER the money transaction commits
 * (ADR 0041), outside that transaction — if `finance.receiptCancel` wins a
 * race in that window, provisioning must not finish on the stale `approved`
 * snapshot it started with. The caller (`finance.receiptApprove`) catches
 * this specifically to record `provisioning: 'aborted'` (not
 * `retry_pending` — retrying is pointless once the receipt is cancelled).
 */
export class ReceiptNoLongerApprovedError extends Error {
  constructor(receiptId: string, actualStatus: string) {
    super(`Receipt ${receiptId} is "${actualStatus}", not "approved"; aborting enrollment activation.`);
    this.name = 'ReceiptNoLongerApprovedError';
  }
}

export interface ActivateEnrollmentParams {
  facilityId: string;
  studentId: string;
  classBatchId: string;
  /** The Receipt this activation is provisioning on behalf of. Locked with
   * `FOR UPDATE` and re-checked before granting the enrollment (see
   * `ReceiptNoLongerApprovedError`). */
  receiptId: string;
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
      // C1 guard: lock the Receipt row and re-check its status in the SAME
      // transaction as the enrollment write, immediately before granting
      // access. `receiptCancel`'s own atomic claim (`updateMany WHERE
      // status='approved'`) holds this same row lock, so the two calls
      // serialize instead of racing — whichever commits first, the other
      // observes the committed status, not a stale in-memory snapshot.
      const locked = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status" FROM "Receipt" WHERE "id" = ${params.receiptId} AND "facilityId" = ${params.facilityId} FOR UPDATE
      `;
      const receiptStatus = locked[0]?.status;
      if (receiptStatus !== 'approved') {
        throw new ReceiptNoLongerApprovedError(params.receiptId, receiptStatus ?? 'not found');
      }

      const openRow = await findOpenRow(tx);

      if (openRow) {
        if (openRow.status === 'reserved') {
          // Conditional transition: concurrent approved receipts may observe
          // the same reserved row, but only the transaction that changes it
          // from reserved to active owns the timeline event.
          const transition = await tx.enrollment.updateMany({
            where: { id: openRow.id, status: 'reserved' },
            data: { status: 'active' },
          });
          const activated = await findOpenRow(tx);
          if (!activated) throw new Error('Enrollment disappeared during activation.');
          if (transition.count === 1) {
            await emitStudentRecordEvent(tx, {
              facilityId: params.facilityId,
              studentId: params.studentId,
              actor: 'system',
              kind: 'enrollment_activated',
              enrollmentId: activated.id,
              classBatchId: params.classBatchId,
            });
          }
          return activated;
        }
        // Already active — idempotent replay records nothing (module-2 freeze).
        return openRow;
      }

      const created = await tx.enrollment.create({
        data: {
          facilityId: params.facilityId,
          studentId: params.studentId,
          classBatchId: params.classBatchId,
          status: 'active',
        },
      });
      await emitStudentRecordEvent(tx, {
        facilityId: params.facilityId,
        studentId: params.studentId,
        actor: 'system',
        kind: 'enrollment_activated',
        enrollmentId: created.id,
        classBatchId: params.classBatchId,
      });
      return created;
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    const refetched = await withFacility(db, params.facilityId, findOpenRow);
    if (!refetched) throw error;
    return refetched;
  }
}
