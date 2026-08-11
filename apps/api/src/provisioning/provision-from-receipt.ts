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
//
// C1 per-step cancel guard (phase-01): every self-committing step now re-reads
// `Receipt.status FOR SHARE` and aborts (`ReceiptNoLongerApprovedError`) if the
// receipt left `approved` after the money commit — see `assertReceiptStillApproved`
// below. Because that read is on the RLS-protected `Receipt` table, the Guardian
// and StudentAccount steps (which carry no facilityId themselves) now also run
// inside a `withFacility(receipt.facilityId)` transaction purely so the guard's
// read passes RLS and commits atomically with the step. ParentAccount is global
// with no per-row transaction context, so its guard runs immediately before it
// in the receipt's facility scope (a small, documented, harmless race window).

import { withFacility, type Prisma, type PrismaClient } from '@cmc/db';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import {
  activateEnrollmentForReceipt,
  ReceiptNoLongerApprovedError,
} from '../enrollment/activate-enrollment.js';
import { hashPassword } from '../lms-auth/password-hash.js';

/**
 * C1 per-step guard (phase-01 cancel-provisioning race): re-reads the Receipt's
 * status under `FOR SHARE` inside the caller's transaction and throws
 * `ReceiptNoLongerApprovedError` if it is no longer `approved`. Provisioning
 * runs AFTER the money transaction commits (ADR 0041), outside it — a
 * `receiptCancel` winning the post-commit race must stop provisioning from
 * durably creating any further row (ParentAccount / Student / Guardian /
 * StudentAccount). `FOR SHARE` (not `FOR UPDATE`) is sufficient: it still
 * blocks `receiptCancel`'s exclusive `UPDATE` claim, so the two serialize, but
 * concurrent provisioning steps do not needlessly block each other. The read
 * MUST run inside a `withFacility(receipt.facilityId)` transaction — `Receipt`
 * is RLS-protected, so a bare read with no facility GUC returns zero rows and
 * the guard would spuriously abort every time.
 */
async function assertReceiptStillApproved(
  tx: Prisma.TransactionClient,
  receiptId: string,
  facilityId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status" FROM "Receipt" WHERE "id" = ${receiptId} AND "facilityId" = ${facilityId} FOR SHARE
  `;
  const status = rows[0]?.status;
  if (status !== 'approved') {
    throw new ReceiptNoLongerApprovedError(receiptId, status ?? 'not found');
  }
}

/** The subset of a committed, approved Receipt this function needs. */
export interface ReceiptForProvisioning {
  id: string;
  facilityId: string;
  parentPhone: string;
  /** C1/phase-01b: optional parent email captured at receiptCreate time; when
   * present, provisioning upserts it onto ParentAccount to enable email-OTP
   * login (lmsAuth.requestOtpEmail). Omit for receipts created before phase-01b. */
  parentEmail?: string | null;
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
  /** Post-implementation hardening (H3): mirrors `Receipt.confirmNewStudent`
   * — when true, the caller already confirmed this is a genuinely different
   * child despite a phone match, so `findOrCreateStudent` must NOT reuse
   * another Student found for the same phone. Defaults to false (safe side:
   * prefer reuse over a duplicate) for call sites built before this field
   * existed. */
  confirmNewStudent?: boolean;
  /**
   * Plan 3: units purchased. null/undefined → LMS_DEFAULT_UNIT_COUNT_ON_RECEIPT;
   * 0 → break-glass (no range).
   */
  unitCount?: number | null;
}

export interface ProvisionResult {
  parentAccountId: string;
  studentId: string;
  studentAccountId: string;
  enrollmentId: string;
  /** K1 remediation: the Guardian row linking the paying parent to the
   * student, so the parent sees the child immediately (`getApprovedChildren`)
   * without waiting on a separate `guardian.requestLink`/`approveLink` round
   * trip. */
  guardianId: string;
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
 *
 * C1/phase-01b: when `email` is provided, upserts it onto the ParentAccount
 * after find-or-create so the parent can also log in via email-OTP. A
 * conflicting email on a DIFFERENT account is caught as a P2002 on the unique
 * `email` column — surfaced as a thrown error (the approver must correct the
 * email on the receipt before retrying provisioning).
 */
async function findOrCreateParentAccount(
  db: PrismaClient,
  rawPhone: string,
  email?: string | null,
) {
  const phone = normalizeLoginPhone(rawPhone);

  const existing = await db.parentAccount.findUnique({ where: { phone } });
  let account = existing;

  if (!account) {
    try {
      account = await db.parentAccount.create({ data: { phone } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;

      const refetched = await db.parentAccount.findUnique({ where: { phone } });
      if (!refetched) throw error; // Unexpected: constraint fired but no row found.
      account = refetched;
    }
  }

  // Upsert email when provided and not already set to the same value —
  // idempotent: replaying with the same email is a no-op.
  if (email && account.email !== email) {
    // P2002 on the unique email column means another ParentAccount already
    // owns this address — let the error propagate so the approver can correct it.
    account = await db.parentAccount.update({
      where: { id: account.id },
      data: { email },
    });
  }

  return account;
}

/**
 * find-or-create the Student row (RLS-protected — `Student` carries
 * `facilityId`). The initial existence-check + create runs in one
 * `withFacility` transaction; on a `P2002` race, the refetch runs in a
 * SEPARATE fresh transaction, since Postgres aborts the entire transaction on
 * the first error and refuses further statements on it (error 25P02).
 *
 * `parentAccountId` is the paying parent's ALREADY-resolved ParentAccount
 * (find-or-created by `provisionFromReceipt` before this call) — used for
 * the H3 dedup lock/reuse check below, keyed on the parent, not the raw phone
 * string (avoids re-normalizing it here).
 */
async function findOrCreateStudent(
  db: PrismaClient,
  receipt: ReceiptForProvisioning,
  parentAccountId: string,
) {
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
      // C1 per-step guard: abort before creating a Student if the receipt was
      // cancelled in the post-money-commit window. Shares this transaction, so
      // the status check and the create commit atomically.
      await assertReceiptStillApproved(tx, receipt.id, receipt.facilityId);

      const existing = await tx.student.findUnique({
        where: { createdByReceiptId: receipt.id },
      });
      if (existing) return existing;

      // Post-implementation hardening (H3): `finance.receiptCreate`'s
      // duplicate-student gate only sees PROVISIONED students (via Guardian,
      // which only exists post-approval) — two receipts for the same
      // brand-new phone, both submitted (and both left in `draft` for
      // hours/days — approve needs a different role) before either is
      // approved, both pass that gate as "new". The real fix has to live
      // here, at approve/provisioning time, where the full picture (every
      // sibling receipt's approval state) is finally available. Serialize
      // per (facility, parent) so two approvals racing close together can't
      // both pass the reuse check before either commits, then reuse an
      // existing Student already linked to this SAME paying parent in this
      // facility — UNLESS the caller already confirmed (`confirmNewStudent`)
      // this is a genuinely different child (e.g. siblings sharing a phone),
      // in which case reuse would silently and irreversibly merge two
      // distinct children's records — worse than the duplicate this fix
      // targets, so it must never override an explicit confirmation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${receipt.facilityId} || ${parentAccountId}))`;

      if (!receipt.confirmNewStudent) {
        const reusable = await tx.student.findFirst({
          where: { facilityId: receipt.facilityId, guardians: { some: { parentAccountId } } },
        });
        if (reusable) {
          // The lock only protects the DECISION made in this transaction — if
          // Guardian creation happened afterward, outside the lock, a second
          // concurrent approval could still race past this same reuse check
          // before the first one's Guardian row lands, and create a second
          // Student anyway. Create it here, still holding the lock.
          await findOrCreateGuardian(tx, receipt.facilityId, parentAccountId, reusable.id);
          return reusable;
        }
      }

      const created = await tx.student.create({
        data: {
          facilityId: receipt.facilityId,
          fullName: receipt.studentName,
          createdByReceiptId: receipt.id,
        },
      });
      await findOrCreateGuardian(tx, receipt.facilityId, parentAccountId, created.id);
      return created;
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
 * carries no `facilityId`/RLS policy of its own, but the C1 per-step guard's
 * `Receipt` read does need a facility GUC — so the guard + existence-check +
 * create run inside one `withFacility(receipt.facilityId)` transaction (the
 * transaction is harmless for the RLS-free StudentAccount write). On a `P2002`
 * concurrency race the refetch runs OUTSIDE that transaction (Postgres aborts a
 * transaction on its first error), same idempotency pattern as
 * `findOrCreateStudent` above.
 */
async function findOrCreateStudentAccount(
  db: PrismaClient,
  receipt: ReceiptForProvisioning,
  studentId: string,
  parentAccountId: string,
) {
  try {
    return await withFacility(db, receipt.facilityId, async (tx) => {
      // C1 per-step guard: abort before creating an LMS login for a receipt
      // cancelled in the post-money-commit window.
      await assertReceiptStillApproved(tx, receipt.id, receipt.facilityId);

      const existing = await tx.studentAccount.findUnique({ where: { studentId } });
      if (existing) return existing;

      // C1/phase-01b: set the default password on provisioning so the student
      // can log in immediately. `mustChangePassword: true` forces a password
      // change on first login. The default password literal is intentionally
      // kept here in provisioning only — never hardcoded in tests or business
      // logic.
      return tx.studentAccount.create({
        data: {
          studentId,
          parentAccountId,
          passwordHash: hashPassword('Cmc2026@'),
          mustChangePassword: true,
        },
      });
    });
  } catch (error) {
    // Guard aborts (ReceiptNoLongerApprovedError) are not P2002 — re-thrown here.
    // Same idempotency race as the student/phone creates (ADR 0041): refetch in
    // a fresh (non-aborted) connection scope.
    if (!isUniqueConstraintViolation(error)) throw error;
    const refetched = await db.studentAccount.findUnique({ where: { studentId } });
    if (!refetched) throw error;
    return refetched;
  }
}

/**
 * find-or-create the Guardian row linking the paying parent to the student
 * (K1 remediation, docs/08 §7 read gate: `getApprovedChildren` grants access
 * ONLY through an approved `Guardian` row). Before this fix, `Guardian` rows
 * were created exclusively by the staff-reviewed `guardian.approveLink` flow —
 * a parent who simply paid for their child's first receipt had no such row
 * and saw an empty children list forever. Provisioning now creates it
 * directly for the paying parent, using `guardian` (no stronger claim than
 * "the person who paid") as the default relation — a parent can still request
 * a stronger relation (father/mother) via `guardian.requestLink` for
 * additional children later, or staff can correct it out of band; there is no
 * schema-level "update relation" surface yet (out of scope for this fix).
 *
 * `Guardian` carries no RLS policy (schema.prisma) — plain client calls, same
 * as `guardian.approveLink`'s upsert. The `parentAccountId_studentId` unique
 * index makes this safe to replay (ADR 0041) and race-safe (P2002 recovery,
 * same pattern as every other find-or-create step in this file).
 */
async function findOrCreateGuardian(
  db: PrismaClient | Prisma.TransactionClient,
  facilityId: string,
  parentAccountId: string,
  studentId: string,
) {
  const existing = await db.guardian.findUnique({
    where: { parentAccountId_studentId: { parentAccountId, studentId } },
  });
  if (existing) return existing;

  try {
    return await db.guardian.create({
      data: { facilityId, parentAccountId, studentId, relation: 'guardian' },
    });
  } catch (error) {
    /* v8 ignore start -- same timing-fragile P2002 race category as the
     * other find-or-create catches in this file (vitest.config.ts's
     * provisioning branch-threshold comment): exercised by
     * guardian-provisioning.test.ts's concurrent-provision test, but whether
     * the race actually lands on THIS catch (vs. both calls' existence-check
     * seeing the already-committed row) is non-deterministic run to run. */
    if (!isUniqueConstraintViolation(error)) throw error;
    const refetched = await db.guardian.findUnique({
      where: { parentAccountId_studentId: { parentAccountId, studentId } },
    });
    if (!refetched) throw error;
    return refetched;
    /* v8 ignore stop */
  }
}

/**
 * Idempotent provisioning: ParentAccount (find-or-create by phone) -> Student
 * (find-or-create by `createdByReceiptId`, so no orphan student is ever
 * created outside this path) -> Guardian (find-or-create, K1 — the paying
 * parent sees the child immediately) -> Enrollment `active` -> StudentAccount
 * (LMS login link). Throws if `receipt.classBatchId` is missing —
 * provisioning cannot activate an enrollment without knowing which class, and
 * the caller (`finance.receiptApprove`) treats that as a provisioning failure
 * that does NOT roll back the money transaction.
 */
export async function provisionFromReceipt(
  db: PrismaClient,
  receipt: ReceiptForProvisioning,
): Promise<ProvisionResult> {
  // C1 per-step guard for the ParentAccount step. ParentAccount is a global
  // (non-facility-RLS) table, so its own find-or-create cannot host the
  // `FOR SHARE` Receipt read — guard immediately before it, in the receipt's
  // facility context. A tiny check-then-commit window remains here (documented,
  // accepted): a dangling ParentAccount is reusable-by-design (find-or-create
  // by phone) and harmless without child links.
  await withFacility(db, receipt.facilityId, (tx) =>
    assertReceiptStillApproved(tx, receipt.id, receipt.facilityId),
  );
  const parentAccount = await findOrCreateParentAccount(db, receipt.parentPhone, receipt.parentEmail);
  const student = await findOrCreateStudent(db, receipt, parentAccount.id);

  // C1 per-step guard for the standalone Guardian step. `findOrCreateStudent`
  // already created this Guardian inside its own guarded transaction on the
  // new-student path (so this call hits the existence early-return); only the
  // renewal path reaches the create here. The guard runs in its own short
  // transaction, then `findOrCreateGuardian` is called on the BASE client so
  // its own P2002 recovery refetch runs on a live (non-aborted) connection —
  // wrapping the create in the guard's transaction would leave that refetch
  // running on an already-aborted tx (25P02). The tiny guard→create window is
  // the same benign class as the ParentAccount step above (a Guardian carries
  // no RLS policy and is find-or-create-idempotent).
  await withFacility(db, receipt.facilityId, (tx) =>
    assertReceiptStillApproved(tx, receipt.id, receipt.facilityId),
  );
  const guardian = await findOrCreateGuardian(db, receipt.facilityId, parentAccount.id, student.id);

  if (!receipt.classBatchId) {
    throw new Error(
      `Receipt ${receipt.id} is missing classBatchId; cannot activate enrollment.`,
    );
  }

  const enrollment = await activateEnrollmentForReceipt(db, {
    facilityId: receipt.facilityId,
    studentId: student.id,
    classBatchId: receipt.classBatchId,
    receiptId: receipt.id,
  });

  const studentAccount = await findOrCreateStudentAccount(
    db,
    receipt,
    student.id,
    parentAccount.id,
  );

  // Plan 3: unit range grant AFTER activate (money already committed — ADR 0041).
  // Failure MUST rethrow so receiptApprove records retry_pending (money stays).
  // Intentional skip only: unitCount === 0 → skipped_break_glass.
  // Idempotent via EnrollmentUnitRange.sourceReceiptId.
  const { grantUnitsFromReceipt } = await import('../lms-ops/grant-units.js');
  const unitGrant = await grantUnitsFromReceipt(db, {
    facilityId: receipt.facilityId,
    enrollmentId: enrollment.id,
    receiptId: receipt.id,
    unitCount: receipt.unitCount,
    actor: 'system',
  });

  // phase-04: one summary audit row on successful provisioning completion. The
  // tRPC audit middleware (trpc.ts) only sees the mutation call itself
  // (finance.receiptApprove); provisioning runs AFTER the money transaction and
  // on the reconciler/worker path too, so a successful chain otherwise leaves
  // no record of WHAT it created. Idempotent — a replay (approve retry or
  // reconciler re-run, ADR 0041) must not append a second row. AuditLog is a
  // global (non-RLS) table, so this plain db write needs no facility scope.
  const alreadyLogged = await db.auditLog.findFirst({
    where: { action: 'provisioning.completed', entityId: receipt.id },
    select: { id: true },
  });
  if (!alreadyLogged) {
    await db.auditLog.create({
      data: {
        actor: 'system',
        action: 'provisioning.completed',
        entity: 'Receipt',
        entityId: receipt.id,
        data: {
          studentId: student.id,
          parentAccountId: parentAccount.id,
          enrollmentId: enrollment.id,
          guardianId: guardian.id,
          studentAccountId: studentAccount.id,
          unitGrantStatus: unitGrant.status,
          unitRangeId:
            unitGrant.status === 'granted' || unitGrant.status === 'idempotent'
              ? unitGrant.range.id
              : null,
        },
      },
    });
  }

  return {
    parentAccountId: parentAccount.id,
    studentId: student.id,
    studentAccountId: studentAccount.id,
    enrollmentId: enrollment.id,
    guardianId: guardian.id,
  };
}
