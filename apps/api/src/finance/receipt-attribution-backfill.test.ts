// HR remediation phase 1 (findings #2 / #6): acceptance test for the two
// one-time backfills shipped in migration
// 20260712000000_hr_remediation_policy_quota_reject_done — since a
// migration's UPDATE statements only ever ran once (at deploy time, against
// whatever rows existed then), this test seeds a fresh "old-style" Receipt
// row (createdByAppUserId=null, approvedAt=null, status='approved') and
// replays the EXACT same SQL the migration ran, to prove the backfill logic
// itself is correct — not just that it happened to run once historically.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupFacility, createTestFacility, seedAppUser, testDbBypass } from '../test/db.js';

/** Replays migration 20260712000000's two backfill UPDATE statements. */
async function runReceiptAttributionBackfill(): Promise<void> {
  await testDbBypass(async (tx) => {
    await tx.$executeRaw`
      UPDATE "Receipt" SET "approvedAt" = "updatedAt" WHERE status = 'approved' AND "approvedAt" IS NULL
    `;
    await tx.$executeRaw`
      UPDATE "Receipt" r SET "createdByAppUserId" = au.id
      FROM "AppUser" au WHERE au."userId" = r."createdById" AND r."createdByAppUserId" IS NULL
    `;
  });
}

describe('Receipt attribution + approvedAt backfill (HR remediation phase 1)', () => {
  let facilityId: string;

  beforeEach(async () => {
    const facility = await createTestFacility('ReceiptBackfill-Facility');
    facilityId = facility.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  async function seedOldStyleApprovedReceipt(createdById: string) {
    return testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId,
          code: `BACKFILL-${randomUUID().slice(0, 8)}`,
          netAmount: 5_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone: '0900000900',
          studentName: 'Backfill Test Student',
          createdById,
          // Old-style shape: neither of the 2 new/under-populated columns set.
          createdByAppUserId: null,
          approvedAt: null,
        },
      }),
    );
  }

  it('backfills createdByAppUserId from AppUser.userId = Receipt.createdById', async () => {
    const devUserId = 'backfill-attribution-user-001';
    const appUser = await seedAppUser({ facilityId, userId: devUserId });
    const receipt = await seedOldStyleApprovedReceipt(devUserId);
    expect(receipt.createdByAppUserId).toBeNull();

    await runReceiptAttributionBackfill();

    const after = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(after.createdByAppUserId).toBe(appUser.id);
  });

  it('backfills approvedAt from updatedAt for status="approved" rows only', async () => {
    const devUserId = 'backfill-approvedat-user-001';
    await seedAppUser({ facilityId, userId: devUserId });
    const receipt = await seedOldStyleApprovedReceipt(devUserId);
    expect(receipt.approvedAt).toBeNull();

    await runReceiptAttributionBackfill();

    const after = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(after.approvedAt).not.toBeNull();
    expect(after.approvedAt?.getTime()).toBe(after.updatedAt.getTime());
  });

  it('does not touch approvedAt for a draft receipt', async () => {
    const devUserId = 'backfill-draft-user-001';
    const appUser = await seedAppUser({ facilityId, userId: devUserId });
    const draft = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId,
          code: `BACKFILL-DRAFT-${randomUUID().slice(0, 8)}`,
          netAmount: 1_000_000,
          status: 'draft',
          kind: 'new',
          parentPhone: '0900000901',
          studentName: 'Draft Backfill Student',
          createdById: devUserId,
        },
      }),
    );

    await runReceiptAttributionBackfill();

    const after = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: draft.id } }));
    expect(after.approvedAt).toBeNull();
    // Attribution backfill still applies regardless of status (it only
    // predicates on createdByAppUserId being NULL).
    expect(after.createdByAppUserId).toBe(appUser.id);
  });

  it('leaves createdByAppUserId null when no AppUser row matches createdById', async () => {
    const receipt = await seedOldStyleApprovedReceipt('no-such-app-user-anywhere');

    await runReceiptAttributionBackfill();

    const after = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(after.createdByAppUserId).toBeNull();
    // approvedAt backfill is independent of the attribution backfill and
    // still applies.
    expect(after.approvedAt).not.toBeNull();
  });

  it('is idempotent: running the backfill twice does not change already-backfilled rows', async () => {
    const devUserId = 'backfill-idempotent-user-001';
    await seedAppUser({ facilityId, userId: devUserId });
    const receipt = await seedOldStyleApprovedReceipt(devUserId);

    await runReceiptAttributionBackfill();
    const once = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));

    await runReceiptAttributionBackfill();
    const twice = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));

    expect(twice.createdByAppUserId).toBe(once.createdByAppUserId);
    expect(twice.approvedAt?.getTime()).toBe(once.approvedAt?.getTime());
  });
});
