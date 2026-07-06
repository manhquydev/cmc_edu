// Provisioning service — WF-P1-04 (ADR 0041). Called by `finance.receiptApprove`
// AFTER the money transaction has committed (approve + O5 advance are already
// durable). This function is deliberately NOT run inside that money
// transaction: a provisioning failure here must never roll back `netAmount`
// or the approved status (ADR 0041) — the caller wraps this call in its own
// try/catch and records a retry marker on failure instead.
//
// Every step is find-or-create, so replaying this function for the same
// receipt (outbox/agent retry) never creates duplicate rows (idempotent —
// WF-P1-04 acceptance: "replay không nhân đôi").
//
// RLS note (ADR 0042): this function deliberately does NOT wrap its entire
// body in one `withFacility()` transaction. Each find-or-create step here is
// independently committed (matching the original pre-RLS behavior where every
// call auto-committed on its own): a mid-provisioning failure (e.g. missing
// classBatchId, thrown AFTER ParentAccount/Student already exist) must leave
// that partial progress durable so a retry resumes instead of redoing
// everything — an idempotent.test.ts acceptance. Postgres also aborts an
// entire transaction on its first error, so a catch-and-refetch-on-P2002
// (below) MUST run in a fresh transaction, not the one that just failed.
// Only the two RLS-protected steps (Student, Enrollment) need `withFacility`;
// ParentAccount/StudentAccount carry no facilityId/RLS policy at all.

import { withFacility, type PrismaClient } from '@cmc/db';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { activateEnrollmentForReceipt } from '../enrollment/activate-enrollment.js';

/** The subset of a committed, approved Receipt this function needs. */
export interface ReceiptForProvisioning {
  id: string;
  facilityId: string;
  parentPhone: string;
  studentName: string;
  classBatchId: string | null;
  /**
   * H3 remediation: when set (a renewal receipt naming an existing child),
   * provisioning REUSES that Student instead of creating a new one — the
   * whole point being no duplicate child row for a renewal. Optional/nullable
   * so existing call sites building this object for a "new" receipt (no
   * renewal reuse) can omit it.
   */
  studentId?: string | null;
}

export interface ProvisionResult {
  parentAccountId: string;
  studentId: string;
  studentAccountId: string;
  enrollmentId: string;
}

/** Duck-types a Prisma `P2002` (unique constraint violation) without importing
 * `@prisma/client` value exports directly (kept out of this package's surface). */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/**
 * find-or-create a ParentAccount by normalized login phone. Races on a
 * brand-new phone (two children of the same new phone provisioned
 * concurrently) surface as a `P2002` unique-violation on `ParentAccount.phone`
 * — caught here and resolved by refetching, per ADR 0041 ("SAVEPOINT /
 * ON CONFLICT DO NOTHING + refetch") rather than letting the error propagate.
 * `ParentAccount` carries no `facilityId`/RLS policy — plain client calls.
 */
async function findOrCreateParentAccount(db: PrismaClient, rawPhone: string) {
  const phone = normalizeLoginPhone(rawPhone);

  const existing = await db.parentAccount.findUnique({ where: { phone } });
  if (existing) return existing;

  try {
    return await db.parentAccount.create({ data: { phone } });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const refetched = await db.parentAccount.findUnique({ where: { phone } });
    if (!refetched) throw error; // Unexpected: constraint fired but no row found.
    return refetched;
  }
}

/**
 * find-or-create the Student row (RLS-protected — `Student` carries
 * `facilityId`). The initial existence-check + create runs in one
 * `withFacility` transaction; on a `P2002` race, the refetch runs in a
 * SEPARATE fresh transaction, since Postgres aborts the entire transaction on
 * the first error and refuses further statements on it (error 25P02).
 */
async function findOrCreateStudent(db: PrismaClient, receipt: ReceiptForProvisioning) {
  if (receipt.studentId) {
    // H3 remediation (renewal reuse): the receipt already names the Student
    // to reuse — read-only, RLS-protected, no create. Deliberately not
    // wrapped in a try/catch P2002 recovery like the branch below: this path
    // never inserts, so there is no unique-constraint race to recover from.
    const studentId = receipt.studentId;
    const reused = await withFacility(db, receipt.facilityId, (tx) =>
      tx.student.findFirst({ where: { id: studentId, facilityId: receipt.facilityId } }),
    );
    if (!reused) {
      throw new Error(
        `Receipt ${receipt.id} names studentId ${studentId} for renewal reuse, but no such Student exists in facility ${receipt.facilityId}.`,
      );
    }
    return reused;
  }

  try {
    return await withFacility(db, receipt.facilityId, async (tx) => {
      const existing = await tx.student.findUnique({
        where: { createdByReceiptId: receipt.id },
      });
      if (existing) return existing;

      return tx.student.create({
        data: {
          facilityId: receipt.facilityId,
          fullName: receipt.studentName,
          createdByReceiptId: receipt.id,
        },
      });
    });
  } catch (error) {
    // Concurrent replay of the same receipt (approve retry racing the outbox
    // worker) races on the unique `createdByReceiptId` — resolve by refetching
    // in a fresh transaction, same idempotency guarantee as the phone race
    // above (ADR 0041).
    if (!isUniqueConstraintViolation(error)) throw error;
    const refetched = await withFacility(db, receipt.facilityId, (tx) =>
      tx.student.findUnique({ where: { createdByReceiptId: receipt.id } }),
    );
    if (!refetched) throw error;
    return refetched;
  }
}

/**
 * find-or-create the StudentAccount (LMS login link). `StudentAccount`
 * carries no `facilityId`/RLS policy — plain client calls.
 */
async function findOrCreateStudentAccount(
  db: PrismaClient,
  studentId: string,
  parentAccountId: string,
) {
  const existing = await db.studentAccount.findUnique({ where: { studentId } });
  if (existing) return existing;

  try {
    return await db.studentAccount.create({
      data: { studentId, parentAccountId },
    });
  } catch (error) {
    // Same idempotency race as the student/phone creates (ADR 0041).
    if (!isUniqueConstraintViolation(error)) throw error;
    const refetched = await db.studentAccount.findUnique({ where: { studentId } });
    if (!refetched) throw error;
    return refetched;
  }
}

/**
 * Idempotent provisioning: ParentAccount (find-or-create by phone) -> Student
 * (find-or-create by `createdByReceiptId`, so no orphan student is ever
 * created outside this path) -> Enrollment `active` -> StudentAccount (LMS
 * login link). Throws if `receipt.classBatchId` is missing — provisioning
 * cannot activate an enrollment without knowing which class, and the caller
 * (`finance.receiptApprove`) treats that as a provisioning failure that does
 * NOT roll back the money transaction.
 */
export async function provisionFromReceipt(
  db: PrismaClient,
  receipt: ReceiptForProvisioning,
): Promise<ProvisionResult> {
  const parentAccount = await findOrCreateParentAccount(db, receipt.parentPhone);
  const student = await findOrCreateStudent(db, receipt);

  if (!receipt.classBatchId) {
    throw new Error(
      `Receipt ${receipt.id} is missing classBatchId; cannot activate enrollment.`,
    );
  }

  const enrollment = await activateEnrollmentForReceipt(db, {
    facilityId: receipt.facilityId,
    studentId: student.id,
    classBatchId: receipt.classBatchId,
  });

  const studentAccount = await findOrCreateStudentAccount(
    db,
    student.id,
    parentAccount.id,
  );

  return {
    parentAccountId: parentAccount.id,
    studentId: student.id,
    studentAccountId: studentAccount.id,
    enrollmentId: enrollment.id,
  };
}
