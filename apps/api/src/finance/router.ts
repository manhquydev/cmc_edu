// finance router — WF-P1-02 (create a draft Receipt from an Opportunity),
// WF-P1-03 (money gate: `receiptApprove` -> auto-O5 + provisioning), and
// WF-P1-08 (`receiptCancel` -> revert O4 + rollback provisioning;
// `refundCreate` -> append-only refund ledger, capped at `netAmount`).

import { z } from 'zod';
import {
  assertRefundWithinCap,
  computeReceiptKind,
  duplicatePhoneWarning,
  nextReceiptCode,
  RefundCapExceededError,
} from '@cmc/domain-finance';
import { withFacility, type Prisma, type PrismaClient } from '@cmc/db';
import { can } from '@cmc/auth';
import type { AuthSubject, Role } from '@cmc/auth';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { provisionFromReceipt } from '../provisioning/provision-from-receipt.js';
import { requirePermission, router, scoped } from '../trpc.js';

/**
 * H1 remediation (ADR-B, docs/16): a general "independent second eye"
 * control, not just a self-approval guard. Any receipt with `netAmount`
 * above this threshold requires an approver holding `giam_doc_dao_tao` or
 * `super_admin` — a `giam_doc_kinh_doanh`-only approval over threshold is
 * FORBIDDEN even when the drafter and approver are different people (the
 * prior version only checked self-approval, so a `sale`-drafted, GĐKD-approved
 * receipt of any size passed unchecked). The self-approve audit flag below
 * is kept for every self-approval regardless of amount.
 *
 * ASSUMPTION: docs/16 ADR-B and docs/23 WF-P1-03 name this control
 * ("nguong tien X") without pinning a concrete VND figure — no decision doc
 * fixes the number. 20,000,000 VND is a placeholder/default value.
 */
export const APPROVAL_SECOND_EYE_THRESHOLD = 20_000_000;

/** ADR-B: roles that satisfy the independent-second-eye requirement above
 * the threshold. `super_admin` bypasses `can()` entirely elsewhere in the
 * stack, but is listed here too so this check reads as a complete rule on
 * its own. */
const SECOND_EYE_ROLES: readonly Role[] = ['giam_doc_dao_tao', 'super_admin'];

/**
 * `ReceiptCodeCounter` row key shared by every facility. `Receipt.code` is a
 * SYSTEM-WIDE unique field (schema.prisma). docs/19 §2 "Quy tac chung" states
 * receipt/employee codes use a global atomic counter, unlike class codes
 * (`facility+program+year` scoped) — so this counter must NOT be keyed by
 * `facilityId`. Keying it by `facilityId` was a pre-existing Phase 1 bug: two
 * different facilities' first receipts both computed counter value 0 ->
 * "SO00001", tripping the global unique constraint on `Receipt.code` the
 * moment more than one facility issues a receipt. Fixed here rather than in
 * a later phase since it blocks this phase's own money-gate tests from
 * running alongside Phase 1's.
 */
const GLOBAL_RECEIPT_CODE_COUNTER_KEY = 'GLOBAL_RECEIPT_CODE';

/**
 * F7 remediation: VND has no sub-unit (no cents) — an `amount` with decimals
 * is a caller/UI bug, not a valid fractional payment. `max` guards against
 * overflow/fat-finger inputs (1 trillion VND is already an absurd single
 * receipt); `int` rejects sub-VND amounts. Shared by `receiptCreate` and
 * `refundCreate` (both are VND money fields).
 */
const vndAmountSchema = z.number().int().positive().max(1_000_000_000_000);

const receiptCreateInput = z.object({
  opportunityId: z.string().uuid().optional(),
  /** H3 remediation: the existing Student being renewed, when this receipt
   * is a renewal for a known child — provisioning reuses this Student
   * instead of creating a new one (see ../provisioning/provision-from-receipt.ts). */
  studentId: z.string().uuid().optional(),
  studentName: z.string().min(1),
  parentPhone: z.string().min(1),
  /** C1/phase-01b: optional email address for the parent. When provided,
   * provisioning upserts it onto the ParentAccount so the parent can also log
   * in via email-OTP (lmsAuth.requestOtpEmail). */
  parentEmail: z.string().email().optional(),
  amount: vndAmountSchema,
  classBatchId: z.string().min(1).optional(),
});

export interface ReceiptDto {
  id: string;
  code: string;
  status: string;
  kind: string;
  opportunityId: string | null;
  parentPhone: string;
  studentName: string;
  classBatchId: string | null;
  netAmount: number;
  createdAt: Date;
  /** Server-derived UI hint: true iff the calling subject has the
   * `finance.receiptApprove` permission, is not the drafter of this receipt
   * (no self-approval), and satisfies the over-threshold second-eye rule when
   * `netAmount > APPROVAL_SECOND_EYE_THRESHOLD`. `false` whenever subject is
   * not provided (e.g. post-mutation responses where approval is moot). */
  canApprove: boolean;
}

export type ReceiptCreateResult =
  | { status: 'success'; receipt: ReceiptDto }
  | { status: 'warning'; receipt: ReceiptDto; message: string };

/** Shape returned by Prisma for a Receipt row (Decimal netAmount). */
interface ReceiptRow {
  id: string;
  code: string;
  status: string;
  kind: string;
  opportunityId: string | null;
  /** H3 remediation: the Student this receipt renews, when known. */
  studentId: string | null;
  parentPhone: string;
  /** C1/phase-01b: optional parent email captured at receipt creation. */
  parentEmail: string | null;
  studentName: string;
  classBatchId: string | null;
  netAmount: { toNumber(): number };
  createdAt: Date;
  createdById: string;
}

function toReceiptDto(
  receipt: ReceiptRow,
  subject?: AuthSubject,
): ReceiptDto {
  const netAmount = receipt.netAmount.toNumber();
  let canApprove = false;
  if (subject) {
    const notSelf = receipt.createdById !== subject.userId;
    const secondEyeOk =
      netAmount <= APPROVAL_SECOND_EYE_THRESHOLD ||
      subject.roles.some((r) => SECOND_EYE_ROLES.includes(r));
    canApprove = notSelf && secondEyeOk && can(subject, 'finance', 'receiptApprove');
  }
  return {
    id: receipt.id,
    code: receipt.code,
    status: receipt.status,
    kind: receipt.kind,
    opportunityId: receipt.opportunityId,
    parentPhone: receipt.parentPhone,
    studentName: receipt.studentName,
    classBatchId: receipt.classBatchId,
    netAmount,
    createdAt: receipt.createdAt,
    canApprove,
  };
}

/** Full ReceiptStatus catalog (schema.prisma). */
const RECEIPT_STATUS_VALUES = ['draft', 'approved', 'sent', 'cancelled'] as const;

/**
 * K3 remediation (deep-review consolidated report): the HITL work-queue for
 * the money gate. Before this, an approver (≠ the drafting `sale`) had no
 * way to find receipts awaiting approval — `receiptId` was only ever handed
 * back to the caller that created it (grep: zero list/get procedures
 * existed). `status: 'draft'` is the primary filter an approver uses; other
 * statuses remain queryable for history/audit.
 */
const receiptListInput = z.object({
  status: z.enum(RECEIPT_STATUS_VALUES).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

const receiptGetInput = z.object({
  receiptId: z.string().uuid(),
});

const receiptApproveInput = z.object({
  receiptId: z.string().uuid(),
});

export interface ReceiptApproveResult {
  receipt: ReceiptDto;
  opportunityStage: string | null;
  provisioning: 'ok' | 'pending';
}

/**
 * Money transaction (WF-P1-03 happy path 3): loads the draft receipt,
 * enforces the self-approval compensating control, computes `kind` BEFORE
 * mutating anything (I: kind computed before stage change), freezes the
 * receipt as `approved` (never touching `netAmount` — I4), auto-advances the
 * linked opportunity to O5_ENROLLED + `closedAt` (I2), and writes the audit
 * trail — all atomically. Provisioning is intentionally NOT part of this
 * transaction (ADR 0041); the caller runs it afterward in a separate
 * try/catch.
 */
async function runMoneyTransaction(
  tx: Prisma.TransactionClient,
  facilityId: string,
  approverId: string,
  approverRoles: readonly Role[],
  receiptId: string,
): Promise<{ receipt: ReceiptRow; opportunityStage: string | null }> {
  const receipt = await tx.receipt.findFirst({ where: { id: receiptId, facilityId } });
  if (!receipt) {
    throw notFound('Receipt not found.');
  }
  if (receipt.status !== 'draft') {
    throw badRequest(`Receipt is "${receipt.status}", not "draft"; it cannot be approved again.`);
  }

  const selfApproved = receipt.createdById === approverId;
  const netAmount = receipt.netAmount.toNumber();

  // H1: general over-threshold second-eye rule (not just self-approval). A
  // giam_doc_kinh_doanh-only approver over threshold is FORBIDDEN regardless
  // of who drafted the receipt.
  if (netAmount > APPROVAL_SECOND_EYE_THRESHOLD) {
    const hasSecondEye = approverRoles.some((role) => SECOND_EYE_ROLES.includes(role));
    if (!hasSecondEye) {
      throw forbidden(
        `Receipt exceeds the second-eye approval threshold (${APPROVAL_SECOND_EYE_THRESHOLD} VND); ` +
          `an approver with giam_doc_dao_tao or super_admin is required (ADR-B).`,
      );
    }
  }

  // Kind MUST be computed before the stage/status mutation below.
  const priorApprovedReceipt = await tx.receipt.findFirst({
    where: {
      facilityId,
      parentPhone: receipt.parentPhone,
      status: 'approved',
      id: { not: receipt.id },
    },
    select: { id: true },
  });
  const kind = computeReceiptKind(priorApprovedReceipt !== null);

  // Atomic claim: the `status: 'draft'` predicate in the WHERE means only one
  // concurrent transaction can flip draft -> approved. Under a concurrent
  // double-approve the loser matches 0 rows and is rejected with CONFLICT,
  // instead of the plain `update({where:{id}})` which would re-approve and
  // double-provision on a stale read (HIGH-2). The row lock also serialises
  // the two calls so the winner's commit is visible to the loser's predicate.
  const claim = await tx.receipt.updateMany({
    where: { id: receipt.id, facilityId, status: 'draft' },
    data: { status: 'approved', approvedById: approverId, kind },
  });
  if (claim.count !== 1) {
    throw conflict('Receipt was already approved by a concurrent request.');
  }
  const approved = await tx.receipt.findFirstOrThrow({
    where: { id: receipt.id, facilityId },
  });

  let opportunityStage: string | null = null;
  if (approved.opportunityId) {
    const opportunity = await tx.opportunity.findFirst({
      where: { id: approved.opportunityId, facilityId },
    });
    if (!opportunity) {
      throw notFound('Linked opportunity not found.');
    }
    const advanced = await tx.opportunity.update({
      where: { id: opportunity.id },
      data: { stage: 'O5_ENROLLED', closedAt: new Date() },
    });
    opportunityStage = advanced.stage;
  }

  await tx.auditLog.create({
    data: {
      actor: approverId,
      action: 'finance.receiptApprove',
      entity: 'Receipt',
      entityId: approved.id,
      data: {
        createdById: approved.createdById,
        approvedById: approverId,
        netAmount,
        selfApproved,
        kind,
      },
    },
  });

  return { receipt: approved, opportunityStage };
}

const receiptCancelInput = z.object({
  receiptId: z.string().uuid(),
  reason: z.string().min(1),
  /**
   * `false` (default, "hoàn tiền thật" — genuine cancel/refund): keeps the
   * Student's lifecycle untouched (QĐ 0024). `true` ("void nhầm" — mistaken
   * entry): archives the Student.
   *
   * ASSUMPTION: `StudentLifecycle` (schema.prisma) has only
   * `active | blocked_lms | withdrawn` — there is no separate "archived"
   * value. docs/24 WF-P1-08 and docs/07 glossary both describe the
   * mistaken-void outcome as "archive + withdraw", but no doc defines a
   * distinct archived state in the data model. This maps that outcome onto
   * the existing `withdrawn` value (the only terminal/inactive value
   * available) rather than inventing a new enum member, which the schema is
   * out of scope to change for this phase.
   */
  void: z.boolean().optional().default(false),
});

export interface ReceiptCancelResult {
  receipt: ReceiptDto;
  /** Whether the linked opportunity was reverted O5 -> O4 (I3). */
  opportunityReverted: boolean;
  /** Student lifecycle after rollback, or `null` if no student was provisioned. */
  studentLifecycle: string | null;
}

/**
 * WF-P1-08 happy path (huỷ nhầm): flips `approved -> cancelled` via the same
 * atomic-claim pattern as `receiptApprove` (updateMany WHERE status=
 * 'approved' — a concurrent double-cancel loses the race and gets CONFLICT),
 * then applies invariant I3 (revert opp O5 -> O4 + clear closedAt ONLY when
 * this was the sole approved receipt that advanced it) and rolls back
 * provisioning per QĐ 0024 (Enrollment -> withdrawn always, per the explicit
 * WF-P1-05 state transition "active --> withdrawn: rút (WF-P1-08)"; Student
 * lifecycle only archived when `void: true`).
 */
async function runCancelTransaction(
  tx: Prisma.TransactionClient,
  facilityId: string,
  actorId: string,
  receiptId: string,
  reason: string,
  voidFlag: boolean,
): Promise<{ receipt: ReceiptRow; opportunityReverted: boolean; studentLifecycle: string | null }> {
  const receipt = await tx.receipt.findFirst({ where: { id: receiptId, facilityId } });
  if (!receipt) {
    throw notFound('Receipt not found.');
  }
  if (receipt.status !== 'approved') {
    throw badRequest(`Receipt is "${receipt.status}", not "approved"; it cannot be cancelled.`);
  }

  // Atomic claim (same shape as receiptApprove's): only one concurrent
  // cancel of the same receipt can flip approved -> cancelled.
  const claim = await tx.receipt.updateMany({
    where: { id: receipt.id, facilityId, status: 'approved' },
    data: { status: 'cancelled' },
  });
  if (claim.count !== 1) {
    throw conflict('Receipt was already cancelled by a concurrent request.');
  }
  const cancelled = await tx.receipt.findFirstOrThrow({ where: { id: receipt.id, facilityId } });

  // I3 + H6: lock the linked Opportunity row for the rest of this
  // transaction BEFORE deciding whether to revert. Two concurrent cancels of
  // the two approved receipts on the SAME opportunity both try to acquire
  // this lock; the loser blocks until the winner commits, then re-reads the
  // now-committed stage/receipt state under READ COMMITTED — so the two
  // decisions can never both observe "another approved receipt exists" and
  // both skip the revert, which would otherwise strand the opportunity at
  // O5 with zero approved receipts.
  let opportunityReverted = false;
  if (cancelled.opportunityId) {
    const lockedRows = await tx.$queryRaw<{ id: string; stage: string }[]>`
      SELECT "id", "stage" FROM "Opportunity"
      WHERE "id" = ${cancelled.opportunityId} AND "facilityId" = ${facilityId}
      FOR UPDATE
    `;
    const opportunity = lockedRows[0];
    if (opportunity && opportunity.stage === 'O5_ENROLLED') {
      const otherApprovedReceipt = await tx.receipt.findFirst({
        where: { opportunityId: opportunity.id, status: 'approved' },
        select: { id: true },
      });
      if (!otherApprovedReceipt) {
        await tx.opportunity.update({
          where: { id: opportunity.id },
          data: { stage: 'O4_TESTED', closedAt: null },
        });
        opportunityReverted = true;
      }
    }
  }

  // Rollback provisioning (QĐ 0024). Resolve the Student via `studentId`
  // (H3 renewal reuse) when the cancelled receipt set one, falling back to
  // `createdByReceiptId` (the receipt that originally provisioned a NEW
  // Student) otherwise — a renewal receipt never carries its own
  // `createdByReceiptId` link, since it reused an existing Student.
  let studentLifecycle: string | null = null;
  const student = cancelled.studentId
    ? await tx.student.findFirst({ where: { id: cancelled.studentId, facilityId } })
    : await tx.student.findFirst({ where: { createdByReceiptId: cancelled.id, facilityId } });
  if (student) {
    // M9: only withdraw the enrollment when NO OTHER approved receipt still
    // covers this exact student+class (e.g. a duplicate/renewal receipt paid
    // into the same class) — cancelling one receipt must not strand a seat
    // that another still-approved receipt legitimately paid for.
    if (cancelled.classBatchId) {
      const otherApprovedReceiptForClass = await tx.receipt.findFirst({
        where: {
          facilityId,
          classBatchId: cancelled.classBatchId,
          status: 'approved',
          id: { not: cancelled.id },
          OR: [{ studentId: student.id }, { id: student.createdByReceiptId ?? '' }],
        },
        select: { id: true },
      });
      if (!otherApprovedReceiptForClass) {
        await tx.enrollment.updateMany({
          where: { facilityId, studentId: student.id, classBatchId: cancelled.classBatchId },
          data: { status: 'withdrawn' },
        });
      }
    }
    if (voidFlag) {
      const archived = await tx.student.update({
        where: { id: student.id },
        data: { lifecycle: 'withdrawn' },
      });
      studentLifecycle = archived.lifecycle;
    } else {
      studentLifecycle = student.lifecycle;
    }
  }

  await tx.auditLog.create({
    data: {
      actor: actorId,
      action: 'finance.receiptCancel',
      entity: 'Receipt',
      entityId: cancelled.id,
      data: { reason, void: voidFlag, opportunityReverted, studentId: student?.id ?? null },
    },
  });

  return { receipt: cancelled, opportunityReverted, studentLifecycle };
}

const refundCreateInput = z.object({
  receiptId: z.string().uuid(),
  amount: vndAmountSchema,
  /** M4 remediation (docs/11 §4 idempotency): a repeat call with the same
   * key returns the existing RefundRecord instead of appending a duplicate —
   * for an agent/outbox retry after a network timeout, not a normal UI flow. */
  idempotencyKey: z.string().min(1).optional(),
});

export interface RefundDto {
  id: string;
  receiptId: string;
  amount: number;
  createdAt: Date;
}

export interface RefundCreateResult {
  refund: RefundDto;
  /** `netAmount - SUM(RefundRecord.amount)` after this refund is appended. */
  remainingBalance: number;
}

/** Row shape from the raw `SELECT ... FOR UPDATE` lock query below. */
interface LockedReceiptRow {
  id: string;
  netAmount: string | number;
  status: string;
}

/**
 * I5 (append-only refund ledger, cap `SUM(refund) <= netAmount`, atomic).
 * Locks the Receipt row with `SELECT ... FOR UPDATE` so concurrent refunds on
 * the same receipt serialise: the second call's lock acquisition blocks until
 * the first transaction commits, then re-reads the now-updated refund sum —
 * so two refunds that each fit alone but together exceed the cap can only
 * ever have exactly one succeed.
 */
async function runRefundTransaction(
  tx: Prisma.TransactionClient,
  facilityId: string,
  receiptId: string,
  amount: number,
  idempotencyKey?: string,
): Promise<RefundCreateResult> {
  const rows = await tx.$queryRaw<LockedReceiptRow[]>`
    SELECT "id", "netAmount", "status" FROM "Receipt"
    WHERE "id" = ${receiptId} AND "facilityId" = ${facilityId}
    FOR UPDATE
  `;
  const locked = rows[0];
  if (!locked) {
    throw notFound('Receipt not found.');
  }
  if (locked.status !== 'approved') {
    throw badRequest(`Receipt is "${locked.status}", not "approved"; refunds require an approved receipt.`);
  }
  const netAmount = Number(locked.netAmount);

  // M4: idempotent replay — a repeat call with the same (receiptId,
  // idempotencyKey) returns the existing row rather than appending a
  // duplicate (also enforced at the DB layer by a unique index, so a
  // concurrent replay can never race past this check either).
  if (idempotencyKey) {
    const existingRefund = await tx.refundRecord.findFirst({
      where: { receiptId: locked.id, idempotencyKey },
    });
    if (existingRefund) {
      const aggregate = await tx.refundRecord.aggregate({
        where: { receiptId: locked.id },
        _sum: { amount: true },
      });
      const sum = aggregate._sum.amount?.toNumber() ?? 0;
      return {
        refund: {
          id: existingRefund.id,
          receiptId: existingRefund.receiptId,
          amount: existingRefund.amount.toNumber(),
          createdAt: existingRefund.createdAt,
        },
        remainingBalance: netAmount - sum,
      };
    }
  }

  const aggregate = await tx.refundRecord.aggregate({
    where: { receiptId: locked.id },
    _sum: { amount: true },
  });
  const existingSum = aggregate._sum.amount?.toNumber() ?? 0;

  try {
    assertRefundWithinCap(existingSum, amount, netAmount);
  } catch (error) {
    if (error instanceof RefundCapExceededError) {
      throw badRequest(error.message);
    }
    throw error;
  }

  // Append-only: a new RefundRecord row, never an update/delete of a prior one.
  // `facilityId` denormalized from the locked Receipt (M5 remediation — the
  // money ledger must be facility-scoped for RLS, ADR 0042).
  const refund = await tx.refundRecord.create({
    data: { receiptId: locked.id, facilityId, amount, idempotencyKey: idempotencyKey ?? null },
  });

  return {
    refund: {
      id: refund.id,
      receiptId: refund.receiptId,
      amount: refund.amount.toNumber(),
      createdAt: refund.createdAt,
    },
    remainingBalance: netAmount - (existingSum + amount),
  };
}

export const financeRouter = router({
  // K3 remediation: paginated, facility-scoped, filterable by status — the
  // work queue an approver (GĐKD/GĐĐT/ke_toan, same roster as receiptApprove)
  // actually needs to find drafts awaiting a decision.
  receiptList: requirePermission('finance', 'receiptList')
    .input(receiptListInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      const where = { facilityId, ...(input.status ? { status: input.status } : {}) };

      return withFacility(ctx.db, facilityId, async (tx) => {
        const [rows, total] = await Promise.all([
          tx.receipt.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
          }),
          tx.receipt.count({ where }),
        ]);

        return {
          items: rows.map((r) => toReceiptDto(r, ctx.subject ?? undefined)),
          total,
          page: input.page,
          pageSize: input.pageSize,
        };
      });
    }),

  // K3 remediation: the single-receipt companion to receiptList (e.g. an
  // approver opening one item from the queue).
  receiptGet: requirePermission('finance', 'receiptGet')
    .input(receiptGetInput)
    .query(async ({ ctx, input }): Promise<ReceiptDto> => {
      const { facilityId } = scoped(ctx);

      const receipt = await withFacility(ctx.db, facilityId, (tx) =>
        tx.receipt.findFirst({ where: { id: input.receiptId, facilityId } }),
      );
      // Out-of-facility ids look identical to non-existent ones (RLS — TL11 §2).
      if (!receipt) {
        throw notFound('Receipt not found.');
      }
      return toReceiptDto(receipt, ctx.subject ?? undefined);
    }),

  receiptCreate: requirePermission('finance', 'receiptCreate')
    .input(receiptCreateInput)
    .mutation(async ({ ctx, input }): Promise<ReceiptCreateResult> => {
      const { facilityId } = scoped(ctx);

      // classBatchId is optional at the type level (docs/11 §5 catalog
      // signature) but required by the business rule (docs/24 WF-P1-02
      // exceptions: "Thieu lop/hoc phi -> BAD_REQUEST").
      if (!input.classBatchId) {
        throw badRequest('classBatchId is required to create a receipt.');
      }

      const { created, dupWarning, opportunityNotAtO4Warning } = await withFacility(
        ctx.db,
        facilityId,
        async (tx) => {
          // P2-Foundation seam: classBatchId must point at a real ClassBatch
          // in the caller's facility — an out-of-facility or nonexistent id
          // looks identical to a nonexistent one (RLS), same as every other
          // facility-scoped lookup in this codebase.
          const classBatch = await tx.classBatch.findFirst({
            where: { id: input.classBatchId, facilityId },
          });
          if (!classBatch) {
            throw notFound('ClassBatch not found.');
          }

          let opportunityNotAtO4Warning: string | null = null;
          if (input.opportunityId) {
            const opportunity = await tx.opportunity.findFirst({
              where: { id: input.opportunityId, facilityId },
            });
            if (!opportunity) {
              throw notFound('Opportunity not found.');
            }
            if (opportunity.stage !== 'O4_TESTED') {
              // Allowed but flagged (WF-P1-02 exceptions: "Opp chua O4 -> canh bao").
              opportunityNotAtO4Warning =
                'Cơ hội chưa ở giai đoạn O4_TESTED — phiếu vẫn được tạo, vui lòng rà lại.';
            }
          }

          // H3 remediation: validate a caller-supplied renewal `studentId`
          // exists in this facility BEFORE creating the receipt (RLS/app-level
          // scoped) — an out-of-facility or nonexistent id looks identical to
          // a nonexistent one, same as every other facility-scoped lookup.
          if (input.studentId) {
            const student = await tx.student.findFirst({
              where: { id: input.studentId, facilityId },
            });
            if (!student) {
              throw notFound('Student not found for renewal.');
            }
          }

          const [existingParentAccount, existingReceiptForPhone] = await Promise.all([
            tx.parentAccount.findUnique({ where: { phone: input.parentPhone } }),
            tx.receipt.findFirst({ where: { facilityId, parentPhone: input.parentPhone } }),
          ]);
          const dupWarning = duplicatePhoneWarning(
            existingParentAccount !== null,
            existingReceiptForPhone !== null,
          );

          // Atomic code assignment: a single upsert/increment avoids a
          // read-then-write race on `ReceiptCodeCounter.value` (docs/11 §4).
          // Global key (see GLOBAL_RECEIPT_CODE_COUNTER_KEY) — `Receipt.code`
          // is unique system-wide, not per facility. `ReceiptCodeCounter` has
          // no Postgres RLS (its `facilityId` column is a global sentinel,
          // not real per-facility data — see schema.prisma) but is upserted
          // on the same `tx` for atomicity with the receipt insert below.
          const counter = await tx.receiptCodeCounter.upsert({
            where: { facilityId: GLOBAL_RECEIPT_CODE_COUNTER_KEY },
            create: { facilityId: GLOBAL_RECEIPT_CODE_COUNTER_KEY, value: 1 },
            update: { value: { increment: 1 } },
          });
          const code = nextReceiptCode(counter.value - 1);

          const created = await tx.receipt.create({
            data: {
              facilityId,
              code,
              netAmount: input.amount,
              status: 'draft',
              kind: 'new',
              opportunityId: input.opportunityId,
              studentId: input.studentId,
              parentPhone: input.parentPhone,
              parentEmail: input.parentEmail ?? null,
              studentName: input.studentName,
              classBatchId: input.classBatchId,
              createdById: ctx.subject.userId,
            },
          });

          return { created, dupWarning, opportunityNotAtO4Warning };
        },
      );

      const dto = toReceiptDto(created, ctx.subject ?? undefined);

      const warnings = [dupWarning, opportunityNotAtO4Warning].filter(
        (warning): warning is string => warning !== null,
      );
      if (warnings.length > 0) {
        return { status: 'warning', receipt: dto, message: warnings.join(' ') };
      }
      return { status: 'success', receipt: dto };
    }),

  // WF-P1-03: the money gate. Sale (drafter) is FORBIDDEN here by the
  // registry (`finance.receiptApprove` excludes `sale` — packages/auth).
  receiptApprove: requirePermission('finance', 'receiptApprove')
    .input(receiptApproveInput)
    .mutation(async ({ ctx, input }): Promise<ReceiptApproveResult> => {
      const { facilityId } = scoped(ctx);

      const { receipt, opportunityStage } = await withFacility(ctx.db, facilityId, (tx) =>
        runMoneyTransaction(tx, facilityId, ctx.subject.userId, ctx.subject.roles, input.receiptId),
      );

      // Provisioning runs AFTER the money transaction has committed, in its
      // own try/catch — a provisioning failure must NOT roll back the
      // approved status or netAmount (ADR 0041). Failure is recorded as a
      // retry marker instead of being swallowed. `provisionFromReceipt`
      // manages its own per-step RLS scoping internally (see that file) —
      // its find-or-create steps must NOT share one transaction, so partial
      // progress survives a later mid-provisioning failure (ADR 0041 replay).
      let provisioning: 'ok' | 'pending' = 'ok';
      try {
        await provisionFromReceipt(ctx.db, {
          id: receipt.id,
          facilityId,
          parentPhone: receipt.parentPhone,
          parentEmail: receipt.parentEmail ?? undefined,
          studentName: receipt.studentName,
          classBatchId: receipt.classBatchId,
          studentId: receipt.studentId,
        });
      } catch (error) {
        provisioning = 'pending';
        await ctx.db.auditLog.create({
          data: {
            actor: 'system',
            action: 'provisioning.retry_pending',
            entity: 'Receipt',
            entityId: receipt.id,
            data: { error: error instanceof Error ? error.message : String(error) },
          },
        });
      }

      // R5 remediation (deep-review adversarial verification): email enqueue
      // is deliberately OUTSIDE the provisioning try/catch above, isolated in
      // its own best-effort helper (see `enqueueReceiptEmailBestEffort`
      // below). Before this fix both calls shared one try/catch, so an
      // outbox INSERT failure (e.g. a transient DB hiccup) flipped a
      // fully-successful provisioning to `provisioning: 'pending'` and wrote
      // a spurious `provisioning.retry_pending` marker even though
      // Student/Guardian/Enrollment/StudentAccount all committed correctly —
      // misleading the reconciler and anyone reading the audit trail. Only
      // attempted when provisioning actually succeeded (nothing to notify
      // about otherwise).
      if (provisioning === 'ok') {
        await enqueueReceiptEmailBestEffort(ctx.db, receipt);
      }

      return { receipt: toReceiptDto(receipt, ctx.subject ?? undefined), opportunityStage, provisioning };
    }),

  // WF-P1-08: `receiptCancel` is a money-gate action (TL11 §5 catalog gates
  // it with the approve permission) — `sale` is excluded the same way as
  // `receiptApprove`.
  receiptCancel: requirePermission('finance', 'receiptApprove')
    .input(receiptCancelInput)
    .mutation(async ({ ctx, input }): Promise<ReceiptCancelResult> => {
      const { facilityId } = scoped(ctx);

      const { receipt, opportunityReverted, studentLifecycle } = await withFacility(
        ctx.db,
        facilityId,
        (tx) => runCancelTransaction(tx, facilityId, ctx.subject.userId, input.receiptId, input.reason, input.void),
      );

      return { receipt: toReceiptDto(receipt, ctx.subject ?? undefined), opportunityReverted, studentLifecycle };
    }),

  // WF-P1-08: append-only refund ledger, capped at netAmount (I5).
  refundCreate: requirePermission('finance', 'refundCreate')
    .input(refundCreateInput)
    .mutation(async ({ ctx, input }): Promise<RefundCreateResult> => {
      const { facilityId } = scoped(ctx);

      return withFacility(ctx.db, facilityId, (tx) =>
        runRefundTransaction(tx, facilityId, input.receiptId, input.amount, input.idempotencyKey),
      );
    }),
});

/**
 * F8 remediation: dedupe the outbox enqueue by `receiptId`. `EmailOutbox` has
 * no dedicated `receiptId` column (schema stores it inside the JSON
 * `payload`), so the existence check reads the JSON payload via a raw query.
 * A retried `receiptApprove` provisioning step (ADR 0041 replay) must not
 * enqueue a second notification email for the same receipt — there is only
 * ever one "kind" of notification enqueued per receipt approval today, so
 * `receiptId` alone is a sufficient dedupe key (no separate `type` column
 * needed yet).
 */
export async function enqueueReceiptEmail(
  db: PrismaClient,
  receipt: { id: string; parentEmail: string | null; studentName: string; kind: string },
): Promise<void> {
  if (!receipt.parentEmail) return;

  const existing = await db.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "EmailOutbox" WHERE "payload"->>'receiptId' = ${receipt.id} LIMIT 1
  `;
  if (existing.length > 0) return;

  // Outbox uses the existing `EmailOutboxStatus` enum (pending -> sent |
  // failed); there is no separate "queued" status in the schema.
  await db.emailOutbox.create({
    data: {
      to: receipt.parentEmail,
      transport: 'brevo',
      status: 'pending',
      payload: { receiptId: receipt.id, studentName: receipt.studentName, kind: receipt.kind },
    },
  });
}

/**
 * R5 remediation (deep-review adversarial verification): runs the
 * receipt-notification email enqueue best-effort, fully isolated from
 * `receiptApprove`'s provisioning success/failure boundary — its failure must
 * NEVER be reported as `provisioning: 'pending'` nor recorded under the
 * `provisioning.retry_pending` marker, since the money + Student/Guardian/
 * Enrollment/StudentAccount chain is already durably committed by the time
 * this runs. Failure here is recorded under its own distinct audit marker and
 * swallowed — email is a best-effort notification, not part of the
 * money/provisioning invariant.
 *
 * `enqueue` is dependency-injected (defaulting to the real
 * `enqueueReceiptEmail`) so this isolation invariant is unit-testable with a
 * deliberately-throwing stub, without needing to force a real Postgres
 * INSERT failure against the outbox table.
 */
export async function enqueueReceiptEmailBestEffort(
  db: PrismaClient,
  receipt: { id: string; parentEmail: string | null; studentName: string; kind: string },
  enqueue: typeof enqueueReceiptEmail = enqueueReceiptEmail,
): Promise<void> {
  try {
    await enqueue(db, receipt);
  } catch (error) {
    try {
      await db.auditLog.create({
        data: {
          actor: 'system',
          action: 'email.enqueue_failed',
          entity: 'Receipt',
          entityId: receipt.id,
          data: { error: error instanceof Error ? error.message : String(error) },
        },
      });
    } catch {
      // DB also unavailable — truly swallow so provisioning success is never masked
    }
  }
}
