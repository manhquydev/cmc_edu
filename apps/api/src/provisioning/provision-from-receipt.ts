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

import type { PrismaClient } from '@cmc/db';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { activateEnrollmentForReceipt } from '../enrollment/activate-enrollment.js';

/** The subset of a committed, approved Receipt this function needs. */
export interface ReceiptForProvisioning {
  id: string;
  facilityId: string;
  parentPhone: string;
  studentName: string;
  classBatchId: string | null;
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

async function findOrCreateStudent(
  db: PrismaClient,
  receipt: ReceiptForProvisioning,
) {
  const existing = await db.student.findUnique({
    where: { createdByReceiptId: receipt.id },
  });
  if (existing) return existing;

  try {
    return await db.student.create({
      data: {
        facilityId: receipt.facilityId,
        fullName: receipt.studentName,
        createdByReceiptId: receipt.id,
      },
    });
  } catch (error) {
    // Concurrent replay of the same receipt (approve retry racing the outbox
    // worker) races on the unique `createdByReceiptId` — resolve by refetching,
    // same idempotency guarantee as the phone race above (ADR 0041).
    if (!isUniqueConstraintViolation(error)) throw error;
    const refetched = await db.student.findUnique({
      where: { createdByReceiptId: receipt.id },
    });
    if (!refetched) throw error;
    return refetched;
  }
}

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
