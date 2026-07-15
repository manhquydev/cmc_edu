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
});
