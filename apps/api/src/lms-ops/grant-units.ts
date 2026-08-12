// Single writer for EnrollmentUnitRange (Plan 1/2 freeze, Plan 3 money bridge).
// Used by lmsOps.addWithUnits/grantPast and provisionFromReceipt grants.

import type { Prisma, PrismaClient } from '@cmc/db';
import { withFacility } from '@cmc/db';
import {
  rangeEndpointsOnAxis,
  resolvePackageGrantRange,
  toProgramUnitAxis,
  validateNewRange,
  type ProgramUnitAxis,
  type UnitRange,
} from '@cmc/domain-lms';
import { badRequest, notFound } from '../errors.js';

export { resolvePackageGrantRange };

type Tx = Prisma.TransactionClient;

export function rangesOverlap(a: UnitRange, b: UnitRange): boolean {
  return a.fromOrderGlobal <= b.toOrderGlobal && b.fromOrderGlobal <= a.toOrderGlobal;
}

export async function loadProgramUnitOrders(
  tx: Tx,
  program: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE',
): Promise<Map<number, string>> {
  const units = await tx.curriculumUnit.findMany({
    where: { program },
    select: { id: true, orderGlobal: true },
  });
  return new Map(units.map((u) => [u.orderGlobal, u.id]));
}

/** Ascending real order_global spine for a program (gap-aware progression). */
export async function loadProgramUnitAxis(
  tx: Tx,
  program: 'UCREA' | 'BRIGHT_IG' | 'BLACK_HOLE',
): Promise<ProgramUnitAxis> {
  const unitOrders = await loadProgramUnitOrders(tx, program);
  return toProgramUnitAxis(unitOrders.keys());
}

/** Endpoints must exist on the program axis; integer holes between them are OK. */
export function assertRangeOnProgram(
  range: UnitRange,
  unitOrders: Map<number, string>,
  program: string,
): void {
  const axis = toProgramUnitAxis(unitOrders.keys());
  if (!rangeEndpointsOnAxis(range, axis)) {
    throw badRequest(
      `orderGlobal range [${range.fromOrderGlobal}..${range.toOrderGlobal}] ` +
        `is not on program ${program} (endpoints must be real units; gaps between are allowed).`,
    );
  }
}

export async function resolveClassCurrentOrder(
  tx: Tx,
  classBatch: { currentUnitId: string | null },
): Promise<number> {
  if (!classBatch.currentUnitId) return 1;
  const cu = await tx.curriculumUnit.findUnique({
    where: { id: classBatch.currentUnitId },
    select: { orderGlobal: true },
  });
  return cu?.orderGlobal ?? 1;
}

export function defaultUnitCountFromEnv(): number {
  const raw = process.env.LMS_DEFAULT_UNIT_COUNT_ON_RECEIPT;
  if (raw === undefined || raw === '') return 4;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 4;
  return n;
}

export interface GrantRangeResult {
  id: string;
  enrollmentId: string;
  fromOrderGlobal: number;
  toOrderGlobal: number;
  sourceReceiptId: string | null;
  created: boolean;
}

/**
 * Create a non-overlapping range on an active enrollment.
 * When sourceReceiptId is set, idempotent: existing row returned without create.
 */
export async function grantRangeOnEnrollment(
  tx: Tx,
  opts: {
    facilityId: string;
    enrollmentId: string;
    range: UnitRange;
    sourceReceiptId?: string | null;
    actor: string;
    auditAction: string;
    /** When true, allow fromOrder before class current (grantPast). */
    allowPast?: boolean;
  },
): Promise<GrantRangeResult> {
  if (opts.range.fromOrderGlobal > opts.range.toOrderGlobal) {
    throw badRequest('fromOrderGlobal must be <= toOrderGlobal.');
  }

  if (opts.sourceReceiptId) {
    const existing = await tx.enrollmentUnitRange.findUnique({
      where: { sourceReceiptId: opts.sourceReceiptId },
    });
    if (existing) {
      return {
        id: existing.id,
        enrollmentId: existing.enrollmentId,
        fromOrderGlobal: existing.fromOrderGlobal,
        toOrderGlobal: existing.toOrderGlobal,
        sourceReceiptId: existing.sourceReceiptId,
        created: false,
      };
    }
  }

  const enrollment = await tx.enrollment.findFirst({
    where: { id: opts.enrollmentId, facilityId: opts.facilityId },
    include: {
      classBatch: { select: { program: true, currentUnitId: true } },
      unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } },
    },
  });
  if (!enrollment) throw notFound('Enrollment not found.');
  if (enrollment.status !== 'active') {
    throw badRequest('Enrollment must be active before granting unit ranges.');
  }
  if (enrollment.archivedAt) {
    throw badRequest('Cannot grant units on an archived enrollment.');
  }

  const currentOrder = await resolveClassCurrentOrder(tx, enrollment.classBatch);
  if (!opts.allowPast) {
    const validated = validateNewRange(opts.range, currentOrder);
    if (!validated.ok) {
      throw badRequest(
        validated.reason === 'inverted'
          ? 'fromOrderGlobal must be <= toOrderGlobal.'
          : 'Range cannot start before the class current unit (use grantPast for backfill).',
      );
    }
  }

  const unitOrders = await loadProgramUnitOrders(tx, enrollment.classBatch.program);
  assertRangeOnProgram(opts.range, unitOrders, enrollment.classBatch.program);

  await tx.$queryRawUnsafe(
    `SELECT id FROM "Enrollment" WHERE id = $1 AND "facilityId" = $2 FOR UPDATE`,
    enrollment.id,
    opts.facilityId,
  );

  if (opts.sourceReceiptId) {
    const raced = await tx.enrollmentUnitRange.findUnique({
      where: { sourceReceiptId: opts.sourceReceiptId },
    });
    if (raced) {
      return {
        id: raced.id,
        enrollmentId: raced.enrollmentId,
        fromOrderGlobal: raced.fromOrderGlobal,
        toOrderGlobal: raced.toOrderGlobal,
        sourceReceiptId: raced.sourceReceiptId,
        created: false,
      };
    }
  }

  const freshRanges = await tx.enrollmentUnitRange.findMany({
    where: { enrollmentId: enrollment.id },
    select: { fromOrderGlobal: true, toOrderGlobal: true },
  });
  for (const existing of freshRanges) {
    if (rangesOverlap(opts.range, existing)) {
      throw badRequest('Range overlaps an existing unit range for this enrollment.');
    }
  }

  const created = await tx.enrollmentUnitRange.create({
    data: {
      facilityId: opts.facilityId,
      enrollmentId: enrollment.id,
      fromOrderGlobal: opts.range.fromOrderGlobal,
      toOrderGlobal: opts.range.toOrderGlobal,
      sourceReceiptId: opts.sourceReceiptId ?? null,
    },
  });

  await tx.auditLog.create({
    data: {
      actor: opts.actor,
      action: opts.auditAction,
      entity: 'EnrollmentUnitRange',
      entityId: created.id,
      data: {
        enrollmentId: enrollment.id,
        fromOrderGlobal: opts.range.fromOrderGlobal,
        toOrderGlobal: opts.range.toOrderGlobal,
        facilityId: opts.facilityId,
        sourceReceiptId: opts.sourceReceiptId ?? null,
      },
    },
  });

  return {
    id: created.id,
    enrollmentId: enrollment.id,
    fromOrderGlobal: created.fromOrderGlobal,
    toOrderGlobal: created.toOrderGlobal,
    sourceReceiptId: created.sourceReceiptId,
    created: true,
  };
}

export type GrantFromReceiptResult =
  | { status: 'granted'; range: GrantRangeResult }
  | { status: 'skipped_break_glass' }
  | { status: 'skipped_no_class' }
  | { status: 'idempotent'; range: GrantRangeResult };

/**
 * After activateEnrollment: grant units from receipt package.
 * Never throws for "no units" — break-glass is intentional.
 * Throws only for data integrity (missing program units) after attempting grant.
 */
export async function grantUnitsFromReceipt(
  db: PrismaClient,
  opts: {
    facilityId: string;
    enrollmentId: string;
    receiptId: string;
    unitCount: number | null | undefined;
    actor?: string;
  },
): Promise<GrantFromReceiptResult> {
  const unitCount =
    opts.unitCount === null || opts.unitCount === undefined
      ? defaultUnitCountFromEnv()
      : opts.unitCount;

  if (unitCount === 0) {
    return { status: 'skipped_break_glass' };
  }

  return withFacility(db, opts.facilityId, async (tx) => {
    // Serialize with refundCreate: refuse grant when receipt is fully refunded.
    const receiptRows = await tx.$queryRaw<
      { id: string; netAmount: string | number; status: string }[]
    >`
      SELECT "id", "netAmount", "status" FROM "Receipt"
      WHERE "id" = ${opts.receiptId} AND "facilityId" = ${opts.facilityId}
      FOR UPDATE
    `;
    const receiptRow = receiptRows[0];
    if (!receiptRow) throw notFound('Receipt not found.');
    if (receiptRow.status !== 'approved') {
      throw badRequest(`Receipt is "${receiptRow.status}", not "approved"; cannot grant units.`);
    }
    const refundAgg = await tx.refundRecord.aggregate({
      where: { receiptId: opts.receiptId },
      _sum: { amount: true },
    });
    const refunded = refundAgg._sum.amount?.toNumber() ?? 0;
    const net = Number(receiptRow.netAmount);
    if (net - refunded <= 0) {
      throw badRequest('Receipt has no remaining balance; cannot grant units after full refund.');
    }

    const existingByReceipt = await tx.enrollmentUnitRange.findUnique({
      where: { sourceReceiptId: opts.receiptId },
    });
    if (existingByReceipt) {
      return {
        status: 'idempotent' as const,
        range: {
          id: existingByReceipt.id,
          enrollmentId: existingByReceipt.enrollmentId,
          fromOrderGlobal: existingByReceipt.fromOrderGlobal,
          toOrderGlobal: existingByReceipt.toOrderGlobal,
          sourceReceiptId: existingByReceipt.sourceReceiptId,
          created: false,
        },
      };
    }

    // Serialize concurrent package grants on the same enrollment (two receipts
    // for one student race). Lock first, then recompute the package range from
    // fresh unitRanges so the second grant extends after the first instead of
    // overlapping on a pre-lock snapshot of empty ranges.
    await tx.$queryRawUnsafe(
      `SELECT id FROM "Enrollment" WHERE id = $1 AND "facilityId" = $2 FOR UPDATE`,
      opts.enrollmentId,
      opts.facilityId,
    );

    // Same-receipt winner may have committed while we waited on the lock.
    const racedByReceipt = await tx.enrollmentUnitRange.findUnique({
      where: { sourceReceiptId: opts.receiptId },
    });
    if (racedByReceipt) {
      return {
        status: 'idempotent' as const,
        range: {
          id: racedByReceipt.id,
          enrollmentId: racedByReceipt.enrollmentId,
          fromOrderGlobal: racedByReceipt.fromOrderGlobal,
          toOrderGlobal: racedByReceipt.toOrderGlobal,
          sourceReceiptId: racedByReceipt.sourceReceiptId,
          created: false,
        },
      };
    }

    const enrollment = await tx.enrollment.findFirst({
      where: { id: opts.enrollmentId, facilityId: opts.facilityId },
      include: {
        classBatch: { select: { program: true, currentUnitId: true } },
        unitRanges: { select: { fromOrderGlobal: true, toOrderGlobal: true } },
      },
    });
    if (!enrollment) throw notFound('Enrollment not found.');

    const currentOrder = await resolveClassCurrentOrder(tx, enrollment.classBatch);
    const programAxis = await loadProgramUnitAxis(tx, enrollment.classBatch.program);
    if (programAxis.length === 0) {
      throw badRequest(
        `Program ${enrollment.classBatch.program} has no CurriculumUnit rows; cannot grant units.`,
      );
    }
    let range: UnitRange;
    try {
      range = resolvePackageGrantRange({
        currentOrder,
        existingRanges: enrollment.unitRanges,
        unitCount,
        programAxis,
      });
    } catch (err) {
      throw badRequest(String(err instanceof Error ? err.message : err));
    }

    try {
      const granted = await grantRangeOnEnrollment(tx, {
        facilityId: opts.facilityId,
        enrollmentId: opts.enrollmentId,
        range,
        sourceReceiptId: opts.receiptId,
        actor: opts.actor ?? 'system',
        auditAction: 'enrollment.grantUnitsFromReceipt',
        allowPast: false,
      });
      return { status: 'granted' as const, range: granted };
    } catch (err) {
      // Concurrent same-receipt grant: unique sourceReceiptId → return winner.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      ) {
        const raced = await tx.enrollmentUnitRange.findUnique({
          where: { sourceReceiptId: opts.receiptId },
        });
        if (raced) {
          return {
            status: 'idempotent' as const,
            range: {
              id: raced.id,
              enrollmentId: raced.enrollmentId,
              fromOrderGlobal: raced.fromOrderGlobal,
              toOrderGlobal: raced.toOrderGlobal,
              sourceReceiptId: raced.sourceReceiptId,
              created: false,
            },
          };
        }
      }
      throw err;
    }
  });
}

/**
 * On refund: remove range rows sourced by this receipt (unlearned cut).
 * Attendance history is never erased — only entitlement ranges.
 */
export async function revokeRangesForReceipt(
  tx: Tx,
  opts: {
    facilityId: string;
    receiptId: string;
    actor: string;
    /** Default enrollment.revokeOnRefund; cancel passes enrollment.revokeOnCancel. */
    auditAction?: string;
  },
): Promise<{ deleted: number }> {
  const auditAction = opts.auditAction ?? 'enrollment.revokeOnRefund';
  const ranges = await tx.enrollmentUnitRange.findMany({
    where: { facilityId: opts.facilityId, sourceReceiptId: opts.receiptId },
  });
  for (const r of ranges) {
    await tx.enrollmentUnitRange.delete({ where: { id: r.id } });
    await tx.auditLog.create({
      data: {
        actor: opts.actor,
        action: auditAction,
        entity: 'EnrollmentUnitRange',
        entityId: r.id,
        data: {
          facilityId: opts.facilityId,
          receiptId: opts.receiptId,
          enrollmentId: r.enrollmentId,
          fromOrderGlobal: r.fromOrderGlobal,
          toOrderGlobal: r.toOrderGlobal,
        },
      },
    });
  }
  return { deleted: ranges.length };
}
