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
import { maybeCreateFlag } from './reconcile-finance-flags.js';

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
  /** H3 post-implementation hardening: passed through to `provisionFromReceipt`
   * so a replayed orphan-recovery never bypasses the caller's original
   * new-vs-existing-child confirmation. */
  confirmNewStudent: boolean;
  /** Plan 3: package unit count for grantUnitsFromReceipt (null → default env). */
  unitCount: number | null;
}

export type ReconcileOutcome =
  | { receiptId: string; status: 'recovered'; result: ProvisionResult }
  | { receiptId: string; status: 'failed'; error: string };

/**
 * Finds every approved Receipt whose provisioning chain is incomplete —
 * missing the resolved Student, the Guardian link, an active Enrollment for
 * its own classBatchId, the StudentAccount, or (Plan 3) a unit range when the
 * receipt is not break-glass (`unitCount = 0`) — and replays
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
            r."confirmNewStudent",
            r."unitCount",
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
          resolved."studentId",
          resolved."confirmNewStudent",
          resolved."unitCount"
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
           -- Plan 3: identity chain complete but unit range never granted
           -- (soft-swallow bug, crash after activate, grant failure before rethrow fix).
           -- unitCount = 0 is intentional break-glass (no range expected).
           OR (
                resolved."classBatchId" IS NOT NULL
                AND (resolved."unitCount" IS NULL OR resolved."unitCount" <> 0)
                AND resolved."resolvedStudentId" IS NOT NULL
                AND EXISTS (
                  SELECT 1 FROM "Enrollment" e
                  WHERE e."studentId" = resolved."resolvedStudentId"
                    AND e."classBatchId" = resolved."classBatchId"
                    AND e."status" = 'active'
                )
                AND NOT EXISTS (
                  SELECT 1 FROM "EnrollmentUnitRange" eur
                  WHERE eur."sourceReceiptId" = resolved."receiptId"
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
        confirmNewStudent: receipt.confirmNewStudent,
        unitCount: receipt.unitCount,
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

interface CancelledButProvisionedRow {
  receiptId: string;
  facilityId: string;
  enrollmentId: string;
}

export interface ReconcileCancelledOutcome {
  receiptId: string;
  /** The stray active Enrollment that was withdrawn (active-enrollment scan),
   * or `null` for the partial-provisioning scan where no enrollment exists. */
  enrollmentId: string | null;
  flagCreated: boolean;
  /** Which scan produced this outcome. */
  kind: 'cancelled_receipt_active_enrollment' | 'cancelled_receipt_partial_provisioning';
}

interface PartialProvisionedRow {
  receiptId: string;
  facilityId: string;
  studentId: string;
}

/**
 * C1 remediation, layer 2 (scenario audit, 2026-07-15): finds `cancelled`
 * Receipts that still have an ACTIVE Enrollment for their own
 * `classBatchId` — the state left behind if a `receiptCancel` won the race
 * against provisioning's enrollment step BEFORE the `FOR UPDATE` guard in
 * `activate-enrollment.ts` was added (or any other path that produced this
 * inconsistency). Layer 1 (the guard) is the primary defense; this is a
 * cleanup net for anything that slipped through before the fix, or from a
 * gap this reconciliation hasn't anticipated — it does NOT touch
 * StudentAccount/login (PO decision: a cancelled receipt withdraws the
 * class seat but keeps LMS access so the family can review history, same as
 * every other cancel path — see `finance/router.ts`'s `runCancelTransaction`).
 *
 * Withdraws the stray Enrollment and raises a `ReconciliationFlag` (kind
 * `cancelled_receipt_active_enrollment`) for staff visibility — same dedup
 * mechanism as `reconcile-finance-flags.ts`'s rules, so re-running this scan
 * never raises a duplicate flag for the same receipt.
 *
 * Runs with the RLS bypass GUC (ADR 0042): a system/background job scanning
 * across every facility, same posture as `reconcileOrphanedReceipts` above.
 */
export async function reconcileCancelledButProvisioned(db: PrismaClient): Promise<ReconcileCancelledOutcome[]> {
  const rows = await withFacility(
    db,
    null,
    (tx) =>
      tx.$queryRaw<CancelledButProvisionedRow[]>`
        WITH resolved AS (
          SELECT
            r."id" AS "receiptId",
            r."facilityId",
            r."classBatchId",
            COALESCE(s_new."id", s_renewal."id") AS "resolvedStudentId",
            COALESCE(s_new."createdByReceiptId", s_renewal."createdByReceiptId") AS "resolvedCreatedByReceiptId"
          FROM "Receipt" r
          LEFT JOIN "Student" s_new ON s_new."createdByReceiptId" = r."id"
          LEFT JOIN "Student" s_renewal ON s_renewal."id" = r."studentId"
          WHERE r."status" = 'cancelled'
        )
        SELECT resolved."receiptId" AS "receiptId", resolved."facilityId", e."id" AS "enrollmentId"
        FROM resolved
        JOIN "Enrollment" e
          ON e."studentId" = resolved."resolvedStudentId"
         AND e."classBatchId" = resolved."classBatchId"
         AND e."status" = 'active'
        WHERE resolved."resolvedStudentId" IS NOT NULL
          AND resolved."classBatchId" IS NOT NULL
          -- M9 (same invariant as finance/router.ts runCancelTransaction):
          -- do not withdraw a seat another still-approved receipt legitimately
          -- paid for (e.g. a duplicate/renewal receipt for the same student+class).
          AND NOT EXISTS (
                SELECT 1 FROM "Receipt" other
                WHERE other."facilityId" = resolved."facilityId"
                  AND other."classBatchId" = resolved."classBatchId"
                  AND other."status" = 'approved'
                  AND other."id" <> resolved."receiptId"
                  AND (
                        other."studentId" = resolved."resolvedStudentId"
                        OR other."id" = resolved."resolvedCreatedByReceiptId"
                      )
              )
      `,
    { bypass: true },
  );

  const outcomes: ReconcileCancelledOutcome[] = [];
  for (const row of rows) {
    await withFacility(db, null, (tx) =>
      tx.enrollment.update({ where: { id: row.enrollmentId }, data: { status: 'withdrawn' } }),
      { bypass: true },
    );
    const flagCreated = await withFacility(
      db,
      null,
      (tx) =>
        maybeCreateFlag(tx, {
          facilityId: row.facilityId,
          receiptId: row.receiptId,
          kind: 'cancelled_receipt_active_enrollment',
          detail: { enrollmentId: row.enrollmentId },
          deepLink: `/finance/receipts/${row.receiptId}?flag=cancelled_receipt_active_enrollment`,
        }),
      { bypass: true },
    );
    await db.auditLog.create({
      data: {
        actor: 'system',
        action: 'worker.reconcileCancelledButProvisioned.withdrawn',
        entity: 'Receipt',
        entityId: row.receiptId,
        data: { enrollmentId: row.enrollmentId },
      },
    });
    outcomes.push({
      receiptId: row.receiptId,
      enrollmentId: row.enrollmentId,
      flagCreated,
      kind: 'cancelled_receipt_active_enrollment',
    });
  }

  // ---------------------------------------------------------------------------
  // Second scan (phase-01): partial provisioning left by a cancel that won the
  // race BEFORE the enrollment step ran. State: a `cancelled` receipt whose
  // Student was provisioned (via `createdByReceiptId`) but NO Enrollment row of
  // ANY status exists for that (student, classBatch) — so the child has money
  // taken, a login/guardian, but never got a seat, and the active-enrollment
  // scan above (which inner-joins an ACTIVE enrollment) can never see it.
  //
  // Discriminator is "no Enrollment row at all", NOT "no active enrollment": a
  // WITHDRAWN row means provisioning completed and the seat was later withdrawn
  // on a normal cancel — a clean cancel, not a partial state, and must not be
  // flagged. Flag ONLY (no auto-withdraw): void-vs-cancel semantics keep the
  // Student active for staff decision (same posture as the scan above).
  //
  // Deliberately keyed on `createdByReceiptId` (new-student receipts) only, NOT
  // COALESCE'd with the renewal `studentId` link the active-enrollment scan
  // uses. A renewal reuses an already-fully-provisioned student; a renewal
  // cancelled before its enrollment step leaves that pre-existing student's
  // original access intact and simply grants no NEW seat — the correct
  // cancelled-renewal outcome, not a stranded child. Only a NEW-student receipt
  // can strand a child (money taken, child created, no class), which is exactly
  // the harmful partial state this scan targets.
  const partials = await withFacility(
    db,
    null,
    (tx) =>
      tx.$queryRaw<PartialProvisionedRow[]>`
        SELECT r."id" AS "receiptId", r."facilityId", s."id" AS "studentId"
        FROM "Receipt" r
        JOIN "Student" s ON s."createdByReceiptId" = r."id"
        WHERE r."status" = 'cancelled'
          AND r."classBatchId" IS NOT NULL
          AND NOT EXISTS (
                SELECT 1 FROM "Enrollment" e
                WHERE e."studentId" = s."id"
                  AND e."classBatchId" = r."classBatchId"
              )
      `,
    { bypass: true },
  );

  for (const row of partials) {
    const flagCreated = await withFacility(
      db,
      null,
      (tx) =>
        maybeCreateFlag(tx, {
          facilityId: row.facilityId,
          receiptId: row.receiptId,
          kind: 'cancelled_receipt_partial_provisioning',
          detail: { studentId: row.studentId },
          deepLink: `/finance/receipts/${row.receiptId}?flag=cancelled_receipt_partial_provisioning`,
        }),
      { bypass: true },
    );
    await db.auditLog.create({
      data: {
        actor: 'system',
        action: 'worker.reconcileCancelledButProvisioned.partialFlagged',
        entity: 'Receipt',
        entityId: row.receiptId,
        data: { studentId: row.studentId },
      },
    });
    outcomes.push({
      receiptId: row.receiptId,
      enrollmentId: null,
      flagCreated,
      kind: 'cancelled_receipt_partial_provisioning',
    });
  }

  return outcomes;
}
