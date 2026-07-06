// WF-P1-02 integration tests: receipt prefilled/linked from an opportunity,
// dup-phone warning (discriminated union narrowing), missing-amount
// BAD_REQUEST, and FORBIDDEN for a role without finance.receiptCreate.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  testDb,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance.receiptCreate from opportunity (WF-P1-02)', () => {
  let facility: { id: string };
  let sale: Caller;
  let teacher: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Finance Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-1', roles: ['sale'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-1', roles: ['giao_vien'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  it('creates a draft receipt linked to an O4 opportunity, with a generated code', async () => {
    const opp = await sale.crm.opportunityCreate({ contactName: 'Tran Thi F', phone: '0911000001' });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O3_TEST_SCHEDULED' });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });

    const parentPhone = '0922000001';
    phonesToClean.push(parentPhone);

    const result = await sale.finance.receiptCreate({
      opportunityId: opp.id,
      studentName: 'Tran Van Con',
      parentPhone,
      amount: 5000000,
      classBatchId: 'class-batch-1',
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('expected status success');
    expect(result.receipt.opportunityId).toBe(opp.id);
    expect(result.receipt.code).toMatch(/^PT-\d{6}$/);
    expect(result.receipt.status).toBe('draft');
    expect(result.receipt.netAmount).toBe(5000000);
  });

  it('warns on a duplicate parent phone; the caller must narrow status==="success" before reading receipt', async () => {
    const dupPhone = '0922000002';
    phonesToClean.push(dupPhone);
    await testDb().parentAccount.create({ data: { phone: dupPhone } });

    const result = await sale.finance.receiptCreate({
      studentName: 'Someone',
      parentPhone: dupPhone,
      amount: 3000000,
      classBatchId: 'class-batch-2',
    });

    expect(result.status).toBe('warning');
    if (result.status === 'success') throw new Error('expected status warning, narrowing must be required');
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.receipt.parentPhone).toBe(dupPhone);
  });

  it('rejects a receipt with a missing amount', async () => {
    // `as any`: intentionally malformed input (amount omitted) to exercise
    // the runtime zod boundary; a well-typed caller could never omit it.
    const malformedInput = {
      studentName: 'No Amount',
      parentPhone: '0922000003',
      classBatchId: 'class-batch-3',
    } as any;

    await expect(sale.finance.receiptCreate(malformedInput)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects a receipt with a missing classBatchId', async () => {
    await expect(
      sale.finance.receiptCreate({
        studentName: 'No Class',
        parentPhone: '0922000005',
        amount: 1000000,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('forbids a role without finance.receiptCreate permission', async () => {
    await expect(
      teacher.finance.receiptCreate({
        studentName: 'X',
        parentPhone: '0922000004',
        amount: 1000000,
        classBatchId: 'class-batch-4',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
