// Integration tests for reconcile-finance-flags worker (P5).
//
// Each rule has a positive case (receipt SHOULD be flagged) and a negative
// case (receipt should NOT be flagged). Additional tests cover:
//   - Dedup: running scanFacility twice creates no duplicate flags.
//   - Permission gate: reconciliation.dismiss forbidden for non-director roles.
//   - RLS: flags from facilityA invisible to caller scoped to facilityB.
//   - Audit log: reconciliation.dismiss records an AuditLog entry.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { scanFacility } from './reconcile-finance-flags.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

/** Seeds an approved Receipt directly (bypasses tRPC for worker-test isolation). */
async function seedApprovedReceipt(opts: {
  facilityId: string;
  netAmount?: number;
  createdById?: string;
  approvedById?: string;
  /** If true, backtracks updatedAt by 2 hours (simulates old approval). */
  backdateUpdatedAt?: boolean;
}): Promise<{ id: string }> {
  const code = `TST-${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const receipt = await testDbBypass((tx) =>
    tx.receipt.create({
      data: {
        facilityId: opts.facilityId,
        code,
        netAmount: opts.netAmount ?? 5_000_000,
        status: 'approved',
        parentPhone: `0${Math.floor(Math.random() * 900_000_000 + 100_000_000)}`,
        studentName: `Test Student ${code}`,
        createdById: opts.createdById ?? 'creator-1',
        approvedById: opts.approvedById ?? 'approver-1',
      },
      select: { id: true },
    }),
  );

  if (opts.backdateUpdatedAt) {
    // `@updatedAt` is Prisma-managed — backdate via raw SQL for the
    // missing_provisioning rule test (which uses `updatedAt < cutoff`).
    await testDbBypass(async (tx) => {
      await tx.$executeRaw`
        UPDATE "Receipt"
        SET "updatedAt" = now() - interval '2 hours'
        WHERE "id" = ${receipt.id}
      `;
    });
  }

  return receipt;
}

/** Seeds a RefundRecord for a receipt. */
async function seedRefund(receiptId: string, facilityId: string, amount: number): Promise<void> {
  await testDbBypass((tx) =>
    tx.refundRecord.create({
      data: { receiptId, facilityId, amount },
      select: { id: true },
    }),
  );
}

/** Counts open ReconciliationFlags of a given kind for a facility+receiptId. */
async function countOpenFlags(
  facilityId: string,
  receiptId: string,
  kind: string,
): Promise<number> {
  const flags = await testDbBypass((tx) =>
    tx.reconciliationFlag.findMany({
      where: { facilityId, receiptId, kind, status: 'open' },
      select: { id: true },
    }),
  );
  return flags.length;
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('reconcile-finance-flags worker', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let directorA: Caller; // giam_doc_dao_tao on facilityA — has reconciliation.review
  let studentCaller: Caller; // giao_vien on facilityA — lacks reconciliation.review

  beforeEach(async () => {
    facilityA = await createTestFacility('Recon FacilityA');
    facilityB = await createTestFacility('Recon FacilityB');

    directorA = appRouter.createCaller(
      buildStaffContext({
        facilityId: facilityA.id,
        userId: 'gddt-recon-a',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    studentCaller = appRouter.createCaller(
      buildStaffContext({
        facilityId: facilityA.id,
        userId: 'gv-recon-a',
        roles: ['giao_vien'],
      }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  // -------------------------------------------------------------------------
  // Rule 1: self_approved
  // -------------------------------------------------------------------------

  describe('Rule 1: self_approved', () => {
    it('flags a receipt where createdById === approvedById', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        createdById: 'same-user',
        approvedById: 'same-user',
      });

      const result = await scanFacility(testDb(), facilityA.id);
      expect(result.flagsCreated).toBeGreaterThanOrEqual(1);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'self_approved');
      expect(count).toBe(1);
    });

    it('does NOT flag a receipt where createdById !== approvedById', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        createdById: 'creator-user',
        approvedById: 'different-approver',
      });

      await scanFacility(testDb(), facilityA.id);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'self_approved');
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 2: exceeds_threshold
  // -------------------------------------------------------------------------

  describe('Rule 2: exceeds_threshold', () => {
    it('flags an approved receipt with netAmount > 20,000,000', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 25_000_000,
        createdById: 'creator-2',
        approvedById: 'approver-2',
      });

      const result = await scanFacility(testDb(), facilityA.id);
      expect(result.flagsCreated).toBeGreaterThanOrEqual(1);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'exceeds_threshold');
      expect(count).toBe(1);
    });

    it('does NOT flag a receipt with netAmount <= 20,000,000', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 20_000_000,
        createdById: 'creator-2b',
        approvedById: 'approver-2b',
      });

      await scanFacility(testDb(), facilityA.id);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'exceeds_threshold');
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 3: excess_refunds
  // -------------------------------------------------------------------------

  describe('Rule 3: excess_refunds', () => {
    it('flags a receipt with more than 2 refunds', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 10_000_000,
        createdById: 'creator-3',
        approvedById: 'approver-3',
      });
      await seedRefund(receipt.id, facilityA.id, 1_000_000);
      await seedRefund(receipt.id, facilityA.id, 1_000_000);
      await seedRefund(receipt.id, facilityA.id, 1_000_000); // 3 refunds → flag

      const result = await scanFacility(testDb(), facilityA.id);
      expect(result.flagsCreated).toBeGreaterThanOrEqual(1);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'excess_refunds');
      expect(count).toBe(1);
    });

    it('flags a receipt where refund sum exceeds 80% of netAmount', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 10_000_000,
        createdById: 'creator-3b',
        approvedById: 'approver-3b',
      });
      // 2 refunds totaling 9,000,000 = 90% of 10,000,000
      await seedRefund(receipt.id, facilityA.id, 4_500_000);
      await seedRefund(receipt.id, facilityA.id, 4_500_000);

      await scanFacility(testDb(), facilityA.id);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'excess_refunds');
      expect(count).toBe(1);
    });

    it('does NOT flag a receipt with 2 refunds totaling < 80% of netAmount', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 10_000_000,
        createdById: 'creator-3c',
        approvedById: 'approver-3c',
      });
      // 2 refunds totaling 1,000,000 = 10% — well under 80%
      await seedRefund(receipt.id, facilityA.id, 500_000);
      await seedRefund(receipt.id, facilityA.id, 500_000);

      await scanFacility(testDb(), facilityA.id);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'excess_refunds');
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Rule 4: missing_provisioning
  // -------------------------------------------------------------------------

  describe('Rule 4: missing_provisioning', () => {
    it('flags an approved receipt with no Student after > 1h', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 5_000_000,
        createdById: 'creator-4',
        approvedById: 'approver-4',
        backdateUpdatedAt: true,
      });
      // No Student.createdByReceiptId = receipt.id is seeded → should flag.

      const result = await scanFacility(testDb(), facilityA.id);
      expect(result.flagsCreated).toBeGreaterThanOrEqual(1);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'missing_provisioning');
      expect(count).toBe(1);
    });

    it('does NOT flag an approved receipt that has a Student provisioned', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 5_000_000,
        createdById: 'creator-4b',
        approvedById: 'approver-4b',
        backdateUpdatedAt: true,
      });
      // Seed a Student whose createdByReceiptId points at this receipt.
      await testDbBypass((tx) =>
        tx.student.create({
          data: {
            facilityId: facilityA.id,
            fullName: 'Provisioned Student',
            createdByReceiptId: receipt.id,
          },
          select: { id: true },
        }),
      );

      await scanFacility(testDb(), facilityA.id);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'missing_provisioning');
      expect(count).toBe(0);
    });

    it('does NOT flag a recently-approved receipt (updatedAt < 1h ago)', async () => {
      // No backdateUpdatedAt — receipt was just created, updatedAt is now.
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        netAmount: 5_000_000,
        createdById: 'creator-4c',
        approvedById: 'approver-4c',
        backdateUpdatedAt: false,
      });

      await scanFacility(testDb(), facilityA.id);

      const count = await countOpenFlags(facilityA.id, receipt.id, 'missing_provisioning');
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Dedup: running scanFacility twice creates no duplicate open flags
  // -------------------------------------------------------------------------

  describe('Dedup', () => {
    it('does not create duplicate open flags on a second scan', async () => {
      const receipt = await seedApprovedReceipt({
        facilityId: facilityA.id,
        createdById: 'dup-user',
        approvedById: 'dup-user',
      });

      await scanFacility(testDb(), facilityA.id);
      await scanFacility(testDb(), facilityA.id); // second run

      const count = await countOpenFlags(facilityA.id, receipt.id, 'self_approved');
      expect(count).toBe(1); // still exactly 1, not 2
    });
  });

  // -------------------------------------------------------------------------
  // Permission gate
  // -------------------------------------------------------------------------

  describe('Permission gate', () => {
    it('forbids reconciliation.dismiss for roles without reconciliation.review', async () => {
      // Seed a flag directly so we have something to target.
      const flagId = await testDbBypass(async (tx) => {
        const flag = await tx.reconciliationFlag.create({
          data: {
            facilityId: facilityA.id,
            kind: 'self_approved',
            detail: { netAmount: 5_000_000 },
          },
          select: { id: true },
        });
        return flag.id;
      });

      await expect(studentCaller.reconciliation.dismiss({ flagId })).rejects.toThrow(
        /FORBIDDEN|Missing permission/i,
      );
    });
  });

  // -------------------------------------------------------------------------
  // RLS isolation
  // -------------------------------------------------------------------------

  describe('RLS isolation', () => {
    it('listFlags for facilityA returns no flags belonging to facilityB', async () => {
      // Seed a flag in facilityB.
      await testDbBypass((tx) =>
        tx.reconciliationFlag.create({
          data: {
            facilityId: facilityB.id,
            kind: 'self_approved',
            detail: { netAmount: 5_000_000 },
          },
          select: { id: true },
        }),
      );

      // DirectorA scoped to facilityA should see 0 flags (facilityB's flag
      // is invisible via RLS).
      const flags = await directorA.reconciliation.listFlags({});
      const crossFacilityFlags = flags.filter((f) => f.facilityId === facilityB.id);
      expect(crossFacilityFlags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // reconciliation.dismiss creates an AuditLog
  // -------------------------------------------------------------------------

  describe('reconciliation.dismiss', () => {
    it('transitions status to dismissed and creates an AuditLog entry', async () => {
      const flagId = await testDbBypass(async (tx) => {
        const receipt = await seedApprovedReceipt({
          facilityId: facilityA.id,
          createdById: 'audit-user',
          approvedById: 'audit-user',
        });
        const flag = await tx.reconciliationFlag.create({
          data: {
            facilityId: facilityA.id,
            receiptId: receipt.id,
            kind: 'self_approved',
            detail: { netAmount: 5_000_000 },
          },
          select: { id: true },
        });
        return flag.id;
      });

      await directorA.reconciliation.dismiss({ flagId });

      // Verify status is dismissed.
      const flag = await testDbBypass((tx) =>
        tx.reconciliationFlag.findUniqueOrThrow({ where: { id: flagId } }),
      );
      expect(flag.status).toBe('dismissed');
      expect(flag.resolvedById).toBe('gddt-recon-a');
      expect(flag.resolvedAt).not.toBeNull();

      // Verify AuditLog entry was created.
      const auditLog = await testDb().auditLog.findFirst({
        where: {
          entity: 'ReconciliationFlag',
          entityId: flagId,
          action: 'reconciliation.dismiss',
        },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actor).toBe('gddt-recon-a');
    });

    it('returns BAD_REQUEST when attempting to dismiss an already-dismissed flag', async () => {
      const flagId = await testDbBypass(async (tx) => {
        const flag = await tx.reconciliationFlag.create({
          data: {
            facilityId: facilityA.id,
            kind: 'exceeds_threshold',
            detail: { netAmount: 25_000_000 },
            status: 'dismissed',
          },
          select: { id: true },
        });
        return flag.id;
      });

      await expect(directorA.reconciliation.dismiss({ flagId })).rejects.toThrow(
        /BAD_REQUEST|already dismissed/i,
      );
    });

    it('reconciliation.action transitions open flag to actioned', async () => {
      const flagId = await testDbBypass(async (tx) => {
        const flag = await tx.reconciliationFlag.create({
          data: {
            facilityId: facilityA.id,
            kind: 'exceeds_threshold',
            detail: { netAmount: 25_000_000 },
          },
          select: { id: true },
        });
        return flag.id;
      });

      await directorA.reconciliation.action({ flagId });

      const flag = await testDbBypass((tx) =>
        tx.reconciliationFlag.findUniqueOrThrow({ where: { id: flagId } }),
      );
      expect(flag.status).toBe('actioned');
      expect(flag.resolvedById).toBe('gddt-recon-a');
    });
  });
});
