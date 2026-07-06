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
import type { PrismaClient } from '@cmc/db';
import { badRequest, conflict, forbidden, notFound } from '../errors.js';
import { provisionFromReceipt } from '../provisioning/provision-from-receipt.js';
import { requirePermission, router, scoped } from '../trpc.js';

/**
 * Compensating control (ADR-B, docs/16): when the same person both created
 * and approves a receipt ("multi-hat" staff), self-approval is still
 * allowed — but only up to this amount. Above it, an independent second
 * approver (a different userId with `finance.receiptApprove`) is required.
 *
 * ASSUMPTION: docs/16 ADR-B and docs/23 WF-P1-03 name this control
 * ("nguong tien X") without pinning a concrete VND figure — no decision doc
 * fixes the number. 20,000,000 VND is a placeholder or default value.
 */
export const SELF_APPROVE_THRESHOLD = 20_000_000;

/**
 * `ReceiptCodeCounter` row key shared by every facility. `Receipt.code` is a
 * SYSTEM-WIDE unique field (schema.prisma). docs/19 §2 "Quy tac chung" states
 * receipt/employee codes use a global atomic counter, unlike class codes
 * (`facility+program+year` scoped) — so this counter must NOT be keyed by
 * `facilityId`. Keying it by `facilityId` was a pre-existing Phase 1 bug: two
 * different facilities' first receipts both computed counter value 0 ->
 * "PT-000001", tripping the global unique constraint on `Receipt.code` the
 * moment more than one facility issues a receipt. Fixed here rather than in
 * a later phase since it blocks this phase's own money-gate tests from
 * running alongside Phase 1's.
 */
const GLOBAL_RECEIPT_CODE_COUNTER_KEY = 'GLOBAL_RECEIPT_CODE';

const receiptCreateInput = z.object({
  opportunityId: z.string().uuid().optional(),
  studentName: z.string().min(1),
  parentPhone: z.string().min(1),
  amount: z.number().positive(),
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
  parentPhone: string;
  studentName: string;
  classBatchId: string | null;
  netAmount: { toNumber(): number };
  createdAt: Date;
}

function toReceiptDto(receipt: ReceiptRow): ReceiptDto {
  return {
    id: receipt.id,
    code: receipt.code,
    status: receipt.status,
    kind: receipt.kind,
    opportunityId: receipt.opportunityId,
    parentPhone: receipt.parentPhone,
    studentName: receipt.studentName,
    classBatchId: receipt.classBatchId,
    netAmount: receipt.netAmount.toNumber(),
    createdAt: receipt.createdAt,
  };
}

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
  db: PrismaClient,
  facilityId: string,
  approverId: string,
  receiptId: string,
): Promise<{ receipt: ReceiptRow; opportunityStage: string | null }> {
  return db.$transaction(async (tx) => {
    const receipt = await tx.receipt.findFirst({ where: { id: receiptId, facilityId } });
    if (!receipt) {
      throw notFound('Receipt not found.');
    }
    if (receipt.status !== 'draft') {
      throw badRequest(`Receipt is "${receipt.status}", not "draft"; it cannot be approved again.`);
    }

    const selfApproved = receipt.createdById === approverId;
    const netAmount = receipt.netAmount.toNumber();
    if (selfApproved && netAmount > SELF_APPROVE_THRESHOLD) {
      throw forbidden(
        `Receipt exceeds the self-approval threshold (${SELF_APPROVE_THRESHOLD} VND); an independent second approver is required (ADR-B).`,
      );
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
  });
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
  db: PrismaClient,
  facilityId: string,
  actorId: string,
  receiptId: string,
  reason: string,
  voidFlag: boolean,
): Promise<{ receipt: ReceiptRow; opportunityReverted: boolean; studentLifecycle: string | null }> {
  return db.$transaction(async (tx) => {
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

    // I3: revert O5 -> O4 + clear closedAt only when this cancelled receipt
    // was the SOLE approved receipt on the linked opportunity. `cancelled` is
    // already flipped away from 'approved' above, so a plain status='approved'
    // lookup on the opportunity naturally excludes this receipt.
    let opportunityReverted = false;
    if (cancelled.opportunityId) {
      const opportunity = await tx.opportunity.findFirst({
        where: { id: cancelled.opportunityId, facilityId },
      });
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

    // Rollback provisioning (QĐ 0024). Student is 1:1 with the receipt via
    // `createdByReceiptId`; if provisioning never ran (or is still pending),
    // there is nothing to roll back.
    let studentLifecycle: string | null = null;
    const student = await tx.student.findUnique({ where: { createdByReceiptId: cancelled.id } });
    if (student) {
      if (cancelled.classBatchId) {
        await tx.enrollment.updateMany({
          where: { facilityId, studentId: student.id, classBatchId: cancelled.classBatchId },
          data: { status: 'withdrawn' },
        });
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
  });
}

const refundCreateInput = z.object({
  receiptId: z.string().uuid(),
  amount: z.number().positive(),
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
  db: PrismaClient,
  facilityId: string,
  receiptId: string,
  amount: number,
): Promise<RefundCreateResult> {
  return db.$transaction(async (tx) => {
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
    const refund = await tx.refundRecord.create({
      data: { receiptId: locked.id, amount },
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
  });
}

export const financeRouter = router({
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

      let opportunityNotAtO4Warning: string | null = null;
      if (input.opportunityId) {
        const opportunity = await ctx.db.opportunity.findFirst({
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

      const [existingParentAccount, existingReceiptForPhone] = await Promise.all([
        ctx.db.parentAccount.findUnique({ where: { phone: input.parentPhone } }),
        ctx.db.receipt.findFirst({ where: { facilityId, parentPhone: input.parentPhone } }),
      ]);
      const dupWarning = duplicatePhoneWarning(
        existingParentAccount !== null,
        existingReceiptForPhone !== null,
      );

      const receipt = await ctx.db.$transaction(async (tx) => {
        // Atomic code assignment: a single upsert/increment avoids a
        // read-then-write race on `ReceiptCodeCounter.value` (docs/11 §4).
        // Global key (see GLOBAL_RECEIPT_CODE_COUNTER_KEY) — `Receipt.code`
        // is unique system-wide, not per facility.
        const counter = await tx.receiptCodeCounter.upsert({
          where: { facilityId: GLOBAL_RECEIPT_CODE_COUNTER_KEY },
          create: { facilityId: GLOBAL_RECEIPT_CODE_COUNTER_KEY, value: 1 },
          update: { value: { increment: 1 } },
        });
        const code = nextReceiptCode(counter.value - 1);

        return tx.receipt.create({
          data: {
            facilityId,
            code,
            netAmount: input.amount,
            status: 'draft',
            kind: 'new',
            opportunityId: input.opportunityId,
            parentPhone: input.parentPhone,
            studentName: input.studentName,
            classBatchId: input.classBatchId,
            createdById: ctx.subject.userId,
          },
        });
      });

      const dto = toReceiptDto(receipt);

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

      const { receipt, opportunityStage } = await runMoneyTransaction(
        ctx.db,
        facilityId,
        ctx.subject.userId,
        input.receiptId,
      );

      // Provisioning runs AFTER the money transaction has committed, in its
      // own try/catch — a provisioning failure must NOT roll back the
      // approved status or netAmount (ADR 0041). Failure is recorded as a
      // retry marker instead of being swallowed.
      let provisioning: 'ok' | 'pending' = 'ok';
      try {
        await provisionFromReceipt(ctx.db, {
          id: receipt.id,
          facilityId,
          parentPhone: receipt.parentPhone,
          studentName: receipt.studentName,
          classBatchId: receipt.classBatchId,
        });

        // Outbox uses the existing `EmailOutboxStatus` enum (pending -> sent
        // | failed); there is no separate "queued" status in the schema.
        await ctx.db.emailOutbox.create({
          data: {
            to: receipt.parentPhone,
            transport: 'brevo',
            status: 'pending',
            payload: { receiptId: receipt.id, studentName: receipt.studentName, kind: receipt.kind },
          },
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

      return { receipt: toReceiptDto(receipt), opportunityStage, provisioning };
    }),

  // WF-P1-08: `receiptCancel` is a money-gate action (TL11 §5 catalog gates
  // it with the approve permission) — `sale` is excluded the same way as
  // `receiptApprove`.
  receiptCancel: requirePermission('finance', 'receiptApprove')
    .input(receiptCancelInput)
    .mutation(async ({ ctx, input }): Promise<ReceiptCancelResult> => {
      const { facilityId } = scoped(ctx);

      const { receipt, opportunityReverted, studentLifecycle } = await runCancelTransaction(
        ctx.db,
        facilityId,
        ctx.subject.userId,
        input.receiptId,
        input.reason,
        input.void,
      );

      return { receipt: toReceiptDto(receipt), opportunityReverted, studentLifecycle };
    }),

  // WF-P1-08: append-only refund ledger, capped at netAmount (I5).
  refundCreate: requirePermission('finance', 'refundCreate')
    .input(refundCreateInput)
    .mutation(async ({ ctx, input }): Promise<RefundCreateResult> => {
      const { facilityId } = scoped(ctx);

      return runRefundTransaction(ctx.db, facilityId, input.receiptId, input.amount);
    }),
});
