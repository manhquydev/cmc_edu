// Worker: reconcile-finance-flags — P5 finance audit flag generation.
//
// Scans every facility for 4 rule violations and creates ReconciliationFlag
// rows (open, deduplicated) for staff review via the reconciliation router.
//
// Rules:
//   1. self_approved        — receipt approved by its own drafter
//   2. exceeds_threshold    — approved receipt > 20,000,000 VND
//   3. excess_refunds       — receipt with >2 refunds OR sum(refunds) > 80% netAmount
//   4. missing_provisioning — approved receipt with no Student provisioned after 1h
//
// The worker is AGENT-PRINCIPAL: it only reads + creates ReconciliationFlag.
// It MUST NOT call any tRPC mutation. Audit actor = 'ai:recon'.
//
// Dedup: before creating a flag, checks whether an open flag for the same
// (facilityId, receiptId, kind) already exists — if so, skips silently.

import { withFacility, type Prisma, type PrismaClient } from '@cmc/db';

/** 20,000,000 VND — matches APPROVAL_SECOND_EYE_THRESHOLD in finance/router.ts */
const THRESHOLD = 20_000_000;

/** 1 hour in milliseconds */
const ONE_HOUR_MS = 60 * 60 * 1000;

export interface ScanFacilityResult {
  facilityId: string;
  flagsCreated: number;
}

/**
 * Creates a ReconciliationFlag if no open flag of the same (facilityId,
 * receiptId, kind) already exists. Returns true if a flag was created.
 */
async function maybeCreateFlag(
  tx: Parameters<Parameters<typeof withFacility>[2]>[0],
  opts: {
    facilityId: string;
    receiptId: string | null;
    kind: string;
    detail: Prisma.InputJsonValue;
    deepLink: string | null;
  },
): Promise<boolean> {
  const existing = await tx.reconciliationFlag.findFirst({
    where: {
      facilityId: opts.facilityId,
      receiptId: opts.receiptId ?? null,
      kind: opts.kind,
      status: 'open',
    },
    select: { id: true },
  });
  if (existing) return false;

  try {
    await tx.reconciliationFlag.create({
      data: {
        facilityId: opts.facilityId,
        receiptId: opts.receiptId,
        kind: opts.kind,
        detail: opts.detail,
        deepLink: opts.deepLink,
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation from concurrent worker run — skip silently
    if ((err as { code?: string }).code !== 'P2002') throw err;
    return false;
  }
  return true;
}

/**
 * Scans a single facility for all 4 rule violations and creates flags.
 * Uses `withFacility(db, facilityId)` — RLS is active, no bypass.
 * Exported for targeted testing of individual rules.
 */
export async function scanFacility(
  db: PrismaClient,
  facilityId: string,
): Promise<ScanFacilityResult> {
  let flagsCreated = 0;

  await withFacility(db, facilityId, async (tx) => {
    // -----------------------------------------------------------------
    // Rule 1: self_approved — receipt approved by its own drafter.
    // `selfApproved` is not a DB column; computed by comparing createdById
    // to approvedById (which is set on approval in finance/router.ts).
    // -----------------------------------------------------------------
    const approvedReceipts = await tx.receipt.findMany({
      where: {
        facilityId,
        status: 'approved',
        approvedById: { not: null },
      },
      select: { id: true, netAmount: true, createdById: true, approvedById: true },
    });

    for (const r of approvedReceipts) {
      if (r.createdById === r.approvedById) {
        const created = await maybeCreateFlag(tx, {
          facilityId,
          receiptId: r.id,
          kind: 'self_approved',
          detail: { netAmount: r.netAmount.toNumber() },
          deepLink: `/finance/receipts/${r.id}?flag=self_approved`,
        });
        if (created) flagsCreated++;
      }
    }

    // -----------------------------------------------------------------
    // Rule 2: exceeds_threshold — approved receipt > 20,000,000 VND.
    // -----------------------------------------------------------------
    const bigReceipts = await tx.receipt.findMany({
      where: {
        facilityId,
        status: 'approved',
        netAmount: { gt: THRESHOLD },
      },
      select: { id: true, netAmount: true },
    });

    for (const r of bigReceipts) {
      const created = await maybeCreateFlag(tx, {
        facilityId,
        receiptId: r.id,
        kind: 'exceeds_threshold',
        detail: { netAmount: r.netAmount.toNumber() },
        deepLink: `/finance/receipts/${r.id}?flag=exceeds_threshold`,
      });
      if (created) flagsCreated++;
    }

    // -----------------------------------------------------------------
    // Rule 3: excess_refunds — >2 refunds OR sum > 80% of netAmount.
    // We query all RefundRecord rows for this facility, group by receiptId
    // in application code (avoids raw SQL, keeps RLS in effect).
    // -----------------------------------------------------------------
    const refunds = await tx.refundRecord.findMany({
      where: { facilityId },
      select: { receiptId: true, amount: true },
    });

    // Build per-receipt aggregates.
    const refundMap = new Map<string, { count: number; sum: number }>();
    for (const rr of refunds) {
      const key = rr.receiptId;
      const entry = refundMap.get(key) ?? { count: 0, sum: 0 };
      entry.count++;
      entry.sum += rr.amount.toNumber();
      refundMap.set(key, entry);
    }

    if (refundMap.size > 0) {
      const receiptIds = Array.from(refundMap.keys());
      const receiptsForRefunds = await tx.receipt.findMany({
        where: { facilityId, status: 'approved', id: { in: receiptIds } },
        select: { id: true, netAmount: true },
      });

      for (const rec of receiptsForRefunds) {
        const agg = refundMap.get(rec.id);
        if (!agg) continue;
        const netAmount = rec.netAmount.toNumber();
        const isExcess = agg.count > 2 || agg.sum > netAmount * 0.8;
        if (isExcess) {
          const created = await maybeCreateFlag(tx, {
            facilityId,
            receiptId: rec.id,
            kind: 'excess_refunds',
            detail: { refundCount: agg.count, refundSum: agg.sum, netAmount },
            deepLink: `/finance/receipts/${rec.id}?flag=excess_refunds`,
          });
          if (created) flagsCreated++;
        }
      }
    }

    // -----------------------------------------------------------------
    // Rule 4: missing_provisioning — approved receipt with no Student
    // provisioned after 1 hour.
    // `approvedAt` does not exist on Receipt; use `updatedAt` as proxy
    // (it is the last mutation, which for an approved receipt is approval).
    // No separate Provisioning model — check Student.createdByReceiptId.
    // -----------------------------------------------------------------
    const cutoff = new Date(Date.now() - ONE_HOUR_MS);
    const oldApproved = await tx.receipt.findMany({
      where: {
        facilityId,
        status: 'approved',
        updatedAt: { lt: cutoff },
      },
      select: { id: true, updatedAt: true, netAmount: true, studentId: true },
    });

    for (const r of oldApproved) {
      const student = await tx.student.findFirst({
        where: {
          OR: [
            { createdByReceiptId: r.id },
            ...(r.studentId ? [{ id: r.studentId }] : []),  // renewal path
          ],
        },
        select: { id: true },
      });
      if (!student) {
        const created = await maybeCreateFlag(tx, {
          facilityId,
          receiptId: r.id,
          kind: 'missing_provisioning',
          detail: { netAmount: r.netAmount.toNumber(), approvedAt: r.updatedAt.toISOString() },
          deepLink: `/finance/receipts/${r.id}?flag=missing_provisioning`,
        });
        if (created) flagsCreated++;
      }
    }
  });

  return { facilityId, flagsCreated };
}

export interface RunReconcileFinanceFlagsResult {
  facilityCount: number;
  flagsCreated: number;
}

/**
 * Entry point for the reconcile-finance-flags background worker.
 * Lists all facilities (Facility has no RLS — safe without withFacility),
 * then scans each one via `scanFacility`.
 */
export async function runReconcileFinanceFlags(
  db: PrismaClient,
): Promise<RunReconcileFinanceFlagsResult> {
  const facilities = await db.facility.findMany({ select: { id: true } });

  let totalFlagsCreated = 0;
  for (const facility of facilities) {
    try {
      const result = await scanFacility(db, facility.id);
      totalFlagsCreated += result.flagsCreated;

      await db.auditLog.create({
        data: {
          actor: 'ai:recon',
          action: 'worker.reconcileFinanceFlags.scanned',
          entity: 'Facility',
          entityId: facility.id,
          data: { flagsCreated: result.flagsCreated },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.auditLog.create({
        data: {
          actor: 'ai:recon',
          action: 'worker.reconcileFinanceFlags.failed',
          entity: 'Facility',
          entityId: facility.id,
          data: { error: message },
        },
      });
    }
  }

  return { facilityCount: facilities.length, flagsCreated: totalFlagsCreated };
}
