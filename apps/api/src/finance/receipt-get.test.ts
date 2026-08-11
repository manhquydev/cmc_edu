import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withFacility } from '@cmc/db';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  testDb,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance.receiptGet — classBatchCode', () => {
  let facility: { id: string };
  let sale: Caller;
  let director: Caller;
  let classBatch: { id: string; code: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('ReceiptGet Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-rg-1', roles: ['sale'] }),
    );
    director = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'dir-rg-1',
        roles: ['giam_doc_kinh_doanh'],
      }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  it('returns classBatchCode when receipt has a classBatch', async () => {
    const phone = '0933000001';
    phonesToClean.push(phone);

    const created = await sale.finance.receiptCreate({
      studentName: 'Test Student',
      parentPhone: phone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');

    const receipt = await director.finance.receiptGet({
      receiptId: created.receipt.id,
    });

    expect(receipt.classBatchCode).toBe(classBatch.code);
  });

  it('returns null classBatchCode when receipt has no classBatch', async () => {
    const phone = '0933000002';
    phonesToClean.push(phone);

    const db = testDb();
    const counter = await db.receiptCodeCounter.upsert({
      where: { facilityId: 'GLOBAL_RECEIPT_CODE' },
      create: { facilityId: 'GLOBAL_RECEIPT_CODE', value: 1 },
      update: { value: { increment: 1 } },
    });
    const code = `SO${String(counter.value).padStart(5, '0')}`;

    const receipt = await withFacility(db, facility.id, (tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code,
          netAmount: 1_000_000,
          status: 'draft',
          kind: 'new',
          parentPhone: phone,
          studentName: 'No Class Student',
          classBatchId: null,
          createdById: 'sale-rg-1',
        },
      }),
    );

    const result = await director.finance.receiptGet({
      receiptId: receipt.id,
    });

    expect(result.classBatchCode).toBeNull();
  });

  it('receiptGet returns empty refund ledger and viewerCanRefund for GĐKD on approved receipt', async () => {
    const phone = '0933000003';
    phonesToClean.push(phone);

    const created = await sale.finance.receiptCreate({
      studentName: 'Refund Ledger Student',
      parentPhone: phone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');

    // Second-eye: director approves sale-drafted receipt.
    await director.finance.receiptApprove({ receiptId: created.receipt.id });

    const got = await director.finance.receiptGet({ receiptId: created.receipt.id });
    expect(got.refunds).toEqual([]);
    expect(got.refundedTotal).toBe(0);
    expect(got.remainingBalance).toBe(5_000_000);
    expect(got.viewerCanRefund).toBe(true);
    expect(got.viewerCanCancel).toBe(true);
  });

  it('receiptGet viewerCanCancel is false on draft and after cancel', async () => {
    const phone = '0933000006';
    phonesToClean.push(phone);

    const created = await sale.finance.receiptCreate({
      studentName: 'Cancel Flag Student',
      parentPhone: phone,
      amount: 4_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');

    const draft = await director.finance.receiptGet({ receiptId: created.receipt.id });
    expect(draft.viewerCanCancel).toBe(false);

    await director.finance.receiptApprove({ receiptId: created.receipt.id });
    const approved = await director.finance.receiptGet({ receiptId: created.receipt.id });
    expect(approved.viewerCanCancel).toBe(true);

    await director.finance.receiptCancel({
      receiptId: created.receipt.id,
      reason: 'test cancel flag',
    });
    const cancelled = await director.finance.receiptGet({ receiptId: created.receipt.id });
    expect(cancelled.viewerCanCancel).toBe(false);
    expect(cancelled.status).toBe('cancelled');
  });

  it('receiptGet includes refunds after refundCreate and drops viewerCanRefund at full refund', async () => {
    const phone = '0933000004';
    phonesToClean.push(phone);

    const created = await sale.finance.receiptCreate({
      studentName: 'Full Refund Student',
      parentPhone: phone,
      amount: 2_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
    await director.finance.receiptApprove({ receiptId: created.receipt.id });

    const partial = await director.finance.refundCreate({
      receiptId: created.receipt.id,
      amount: 500_000,
    });
    expect(partial.remainingBalance).toBe(1_500_000);

    const mid = await director.finance.receiptGet({ receiptId: created.receipt.id });
    expect(mid.refunds).toHaveLength(1);
    expect(mid.refunds[0]?.amount).toBe(500_000);
    expect(mid.refundedTotal).toBe(500_000);
    expect(mid.remainingBalance).toBe(1_500_000);
    expect(mid.viewerCanRefund).toBe(true);

    await director.finance.refundCreate({
      receiptId: created.receipt.id,
      amount: 1_500_000,
    });
    const full = await director.finance.receiptGet({ receiptId: created.receipt.id });
    expect(full.refunds).toHaveLength(2);
    expect(full.refundedTotal).toBe(2_000_000);
    expect(full.remainingBalance).toBe(0);
    expect(full.viewerCanRefund).toBe(false);
  });

  it('receiptGet sets viewerCanRefund false for GĐĐT (no refundCreate permission)', async () => {
    const phone = '0933000005';
    phonesToClean.push(phone);
    const gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'dir-dt-rg-1',
        roles: ['giam_doc_dao_tao'],
      }),
    );

    const created = await sale.finance.receiptCreate({
      studentName: 'GDDT View Student',
      parentPhone: phone,
      amount: 3_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
    await director.finance.receiptApprove({ receiptId: created.receipt.id });

    const got = await gddt.finance.receiptGet({ receiptId: created.receipt.id });
    expect(got.viewerCanRefund).toBe(false);
    expect(got.remainingBalance).toBe(3_000_000);
  });
});
