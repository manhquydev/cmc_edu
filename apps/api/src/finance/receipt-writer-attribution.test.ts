// HR remediation phase 1 (findings #2 / #6): `finance.receiptCreate` /
// `finance.receiptApprove` writer tests — the new attribution FK and
// approval-instant column, exercised through the real tRPC procedures (not
// raw SQL, unlike ../payroll/policy-model.test.ts and
// ./receipt-attribution-backfill.test.ts, which cover schema-only /
// backfill-only concerns).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedAppUser,
  seedClassBatch,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance.receiptCreate / receiptApprove attribution writers (HR remediation phase 1)', () => {
  let facility: { id: string };
  let classBatch: { id: string };
  let saleAppUserId: string;
  let sale: Caller;
  let gdkd: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('ReceiptWriterAttribution-Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });

    const saleAppUser = await seedAppUser({
      facilityId: facility.id,
      userId: 'receipt-writer-sale-001',
      position: 'sale',
    });
    saleAppUserId = saleAppUser.id;

    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'receipt-writer-sale-001', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'receipt-writer-gdkd-001',
        roles: ['giam_doc_kinh_doanh'],
      }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  it('receiptCreate writes createdByAppUserId when the caller has an AppUser row in this facility', async () => {
    const parentPhone = '0933000001';
    phonesToClean.push(parentPhone);

    const result = await sale.finance.receiptCreate({
      studentName: 'Attribution Test',
      parentPhone,
      amount: 4_000_000,
      classBatchId: classBatch.id,
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('expected status success');

    const row = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: result.receipt.id } }));
    expect(row.createdByAppUserId).toBe(saleAppUserId);
    expect(row.createdById).toBe('receipt-writer-sale-001');
  });

  it('receiptCreate leaves createdByAppUserId null when the caller has no AppUser row in this facility (no throw)', async () => {
    const noAppUserSale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'no-app-user-sale-999', roles: ['sale'] }),
    );
    const parentPhone = '0933000002';
    phonesToClean.push(parentPhone);

    const result = await noAppUserSale.finance.receiptCreate({
      studentName: 'No AppUser Test',
      parentPhone,
      amount: 2_000_000,
      classBatchId: classBatch.id,
    });
    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('expected status success');

    const row = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: result.receipt.id } }));
    expect(row.createdByAppUserId).toBeNull();
  });

  it('receiptApprove writes approvedAt at the moment of approval', async () => {
    const parentPhone = '0933000003';
    phonesToClean.push(parentPhone);

    const created = await sale.finance.receiptCreate({
      studentName: 'ApprovedAt Test',
      parentPhone,
      amount: 3_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status !== 'success') throw new Error('expected status success');

    const before = Date.now();
    const approved = await gdkd.finance.receiptApprove({ receiptId: created.receipt.id });
    const after = Date.now();

    const row = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: approved.receipt.id } }));
    expect(row.approvedAt).not.toBeNull();
    const approvedAtMs = row.approvedAt!.getTime();
    expect(approvedAtMs).toBeGreaterThanOrEqual(before - 1000);
    expect(approvedAtMs).toBeLessThanOrEqual(after + 1000);
  });
});
