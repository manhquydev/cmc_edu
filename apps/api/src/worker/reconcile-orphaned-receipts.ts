// Worker drain function — K2 remediation (ADR 0041 "no orphan / money
// integrity"). `finance.receiptApprove` commits the money transaction
// (Receipt -> approved, Opportunity -> O5) and then runs `provisionFromReceipt`
// in a SEPARATE try/catch (see apps/api/src/finance/router.ts). Two failure
// shapes leave money collected with an INCOMPLETE provisioning chain
// (ParentAccount -> Student -> Guardian -> Enrollment -> StudentAccount, each
// step committed independently — see provision-from-receipt.ts):
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
// R1 remediation (deep-review adversarial verification): a crash/error can
// also land AFTER the Student commit but BEFORE Guardian/Enrollment/
// StudentAccount — that leaves money taken, a Student row, but NO Guardian
// (parent sees an empty child list forever), NO active Enrollment, and NO
// LMS login. The original query only searched for "no Student at all", so a
// partially-provisioned receipt like this was silently excluded from
// reconciliation forever. This function now selects every approved receipt
// whose provisioning is incomplete by ANY step: missing the resolved Student
// itself, OR missing the Guardian link, OR missing an active Enrollment for
// its own `classBatchId`, OR missing the StudentAccount. Replaying
// `provisionFromReceipt` for any of these converges safely (idempotent
// find-or-create every step, ADR 0041) regardless of how much already ran.
//
// A receipt permanently missing `classBatchId` (so `activateEnrollmentForReceipt`
// can never run) will keep failing on every drain cycle — a known, accepted
// gap (R4, deep-review LOW, left unfixed on purpose: cheap backoff was judged
// not worth the complexity here, see the audit marker this records instead).

import { withFacility, type PrismaClient } from '@cmc/db';
import { provisionFromReceipt, type ProvisionResult } from '../provisioning/provision-from-receipt.js';

interface OrphanReceiptRow {
  id: string;
  facilityId: string;
  parentPhone: string;
  studentName: string;
  classBatchId: string | null;
  /** The RECEIPT's own `studentId` column (not the resolved student) — null
   * for a new-kind receipt, set for a renewal. Passed straight through to
   * `provisionFromReceipt`, which uses it to decide reuse vs.
   * `createdByReceiptId` lookup (see findOrCreateStudent). */
  studentId: string | null;
}

export type ReconcileOutcome =
  | { receiptId: string; status: 'recovered'; result: ProvisionResult }
  | { receiptId: string; status: 'failed'; error: string };

/**
 * Finds every approved Receipt whose provisioning chain is incomplete —
 * missing the resolved Student, the Guardian link, an active Enrollment for
 * its own classBatchId, or the StudentAccount — and replays
 * `provisionFromReceipt` for it. One receipt's failure (e.g. still missing
 * `classBatchId`) does not abort the batch — it is left for the next drain
 * cycle, recorded via the existing `provisioning.retry_pending` audit marker
 * (thrown from inside `provisionFromReceipt`/its caller convention), plus a
 * `worker.reconcileOrphanedReceipts.failed` marker here.
 *
 * The resolved student is `Student.createdByReceiptId = r.id` (new-kind
 * receipts) OR `Student.id = r.studentId` (renewal receipts, H3 reuse) —
 * `COALESCE`d in the CTE below since a receipt is exactly one kind, never
 * both. Guardian/StudentAccount existence is checked by resolved studentId
 * alone (not also matched to the paying parent) — deliberately permissive:
 * the goal is "does this student have ANY functioning login/guardian path
 * yet", not re-verifying which specific parent it is, and any gap re-runs
 * `provisionFromReceipt` which is idempotent regardless.
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
        WITH resolved AS (
          SELECT
            r."id" AS "receiptId",
            r."facilityId",
            r."parentPhone",
            r."studentName",
            r."classBatchId",
            r."studentId",
            COALESCE(s_new."id", s_renewal."id") AS "resolvedStudentId"
          FROM "Receipt" r
          LEFT JOIN "Student" s_new ON s_new."createdByReceiptId" = r."id"
          LEFT JOIN "Student" s_renewal ON s_renewal."id" = r."studentId"
          WHERE r."status" = 'approved'
        )
        SELECT
          resolved."receiptId" AS "id",
          resolved."facilityId",
          resolved."parentPhone",
          resolved."studentName",
          resolved."classBatchId",
          resolved."studentId"
        FROM resolved
        WHERE resolved."resolvedStudentId" IS NULL
           OR NOT EXISTS (
                SELECT 1 FROM "Guardian" g WHERE g."studentId" = resolved."resolvedStudentId"
              )
           OR NOT EXISTS (
                SELECT 1 FROM "StudentAccount" sa WHERE sa."studentId" = resolved."resolvedStudentId"
              )
           OR (
                resolved."classBatchId" IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1 FROM "Enrollment" e
                  WHERE e."studentId" = resolved."resolvedStudentId"
                    AND e."classBatchId" = resolved."classBatchId"
                    AND e."status" = 'active'
                )
              )
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
