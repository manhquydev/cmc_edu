// Worker drain function — K2 remediation (ADR 0041 "no orphan / money
// integrity"). `finance.receiptApprove` commits the money transaction
// (Receipt -> approved, Opportunity -> O5) and then runs `provisionFromReceipt`
// in a SEPARATE try/catch (see apps/api/src/finance/router.ts). Two failure
// shapes leave money collected with no Student ever created:
//
//   1. "retry_pending" case: provisioning throws, the catch block runs and
//      records a `provisioning.retry_pending` AuditLog marker, but there is
//      no worker/scheduler in the repo to ever retry it (the confirmed CRITICAL
//      finding this file fixes).
//   2. "crash, no marker" case: the process dies between the money commit and
//      the catch block (e.g. a hard process kill) — no marker is ever
//      written, so the retry_pending audit trail cannot be relied on as the
//      sole detection signal.
//
// Both shapes share one observable, data-level symptom: an `approved` Receipt
// that was meant to create a brand-new Student (`Receipt.studentId IS NULL` —
// a renewal receipt already names an existing Student, so it can never be
// "missing" one) with no `Student.createdByReceiptId` row. This function
// finds exactly that set and replays `provisionFromReceipt` for each — safe
// because provisioning is fully idempotent (find-or-create every step, ADR
// 0041) regardless of how much of it already ran before the failure.

import { withFacility, type PrismaClient } from '@cmc/db';
import { provisionFromReceipt, type ProvisionResult } from '../provisioning/provision-from-receipt.js';

interface OrphanReceiptRow {
  id: string;
  facilityId: string;
  parentPhone: string;
  studentName: string;
  classBatchId: string | null;
  studentId: string | null;
}

export type ReconcileOutcome =
  | { receiptId: string; status: 'recovered'; result: ProvisionResult }
  | { receiptId: string; status: 'failed'; error: string };

/**
 * Finds every approved, new-kind Receipt with no resolved Student and
 * replays `provisionFromReceipt` for it. One receipt's failure (e.g. still
 * missing `classBatchId`) does not abort the batch — it is left for the next
 * drain cycle, recorded via the existing `provisioning.retry_pending` audit
 * marker (thrown from inside `provisionFromReceipt`/its caller convention),
 * plus a `worker.reconcileOrphanedReceipts.failed` marker here.
 *
 * Runs with the RLS bypass GUC (ADR 0042): this is a system/background job
 * that must see orphans across every facility, not one tenant's scope.
 */
export async function reconcileOrphanedReceipts(db: PrismaClient): Promise<ReconcileOutcome[]> {
  const orphans = await withFacility(
    db,
    null,
    (tx) =>
      tx.$queryRaw<OrphanReceiptRow[]>`
        SELECT r."id", r."facilityId", r."parentPhone", r."studentName", r."classBatchId", r."studentId"
        FROM "Receipt" r
        LEFT JOIN "Student" s ON s."createdByReceiptId" = r."id"
        WHERE r."status" = 'approved'
          AND r."studentId" IS NULL
          AND s."id" IS NULL
      `,
    { bypass: true },
  );

  const outcomes: ReconcileOutcome[] = [];
  for (const receipt of orphans) {
    try {
      const result = await provisionFromReceipt(db, {
        id: receipt.id,
        facilityId: receipt.facilityId,
        parentPhone: receipt.parentPhone,
        studentName: receipt.studentName,
        classBatchId: receipt.classBatchId,
        studentId: receipt.studentId,
      });
      outcomes.push({ receiptId: receipt.id, status: 'recovered', result });
      await db.auditLog.create({
        data: {
          actor: 'system',
          action: 'worker.reconcileOrphanedReceipts.recovered',
          entity: 'Receipt',
          entityId: receipt.id,
          data: { studentId: result.studentId, guardianId: result.guardianId },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({ receiptId: receipt.id, status: 'failed', error: message });
      await db.auditLog.create({
        data: {
          actor: 'system',
          action: 'worker.reconcileOrphanedReceipts.failed',
          entity: 'Receipt',
          entityId: receipt.id,
          data: { error: message },
        },
      });
    }
  }
  return outcomes;
}
