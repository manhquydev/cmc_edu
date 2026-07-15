// M10 remediation: finance-specific RLS negative tests — a caller scoped to
// facility B must never be able to approve/cancel/refund a Receipt that
// belongs to facility A. Complements the generic acceptance test in
// ../security/rls-enforcement.test.ts with the actual finance procedures.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance cross-facility RLS negative tests (M10)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let saleA: Caller;
  let gdkdA: Caller;
  let gdkdB: Caller;
  let classBatchA: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facilityA = await createTestFacility('RLS Finance Facility A');
    facilityB = await createTestFacility('RLS Finance Facility B');
    classBatchA = await seedClassBatch({ facilityId: facilityA.id });
    saleA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'sale-rlsA-1', roles: ['sale'] }),
    );
    gdkdA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'gdkd-rlsA-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    gdkdB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'gdkd-rlsB-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  async function draftReceiptInA(opts: { contactPhone: string; parentPhone: string; classBatchId: string }) {
    const opp = await saleA.crm.opportunityCreate({ contactName: 'RLS Contact', phone: opts.contactPhone });
    await saleA.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await saleA.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O3_TEST_SCHEDULED' });
    await saleA.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });
    phonesToClean.push(opts.parentPhone);
    const result = await saleA.finance.receiptCreate({
      opportunityId: opp.id,
      studentName: 'RLS Student',
      parentPhone: opts.parentPhone,
      amount: 5_000_000,
      classBatchId: opts.classBatchId,
    });
    if (result.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
    return result;
  }

  async function draftAndApproveInA(opts: { contactPhone: string; parentPhone: string; classBatchId: string }) {
    const created = await draftReceiptInA(opts);
    return gdkdA.finance.receiptApprove({ receiptId: created.receipt.id });
  }

  it('facility B cannot approve a draft receipt that belongs to facility A', async () => {
    const created = await draftReceiptInA({
      contactPhone: '0975000001',
      parentPhone: '0985000001',
      classBatchId: classBatchA.id,
    });

    await expect(gdkdB.finance.receiptApprove({ receiptId: created.receipt.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('facility B cannot cancel an approved receipt that belongs to facility A', async () => {
    const approved = await draftAndApproveInA({
      contactPhone: '0975000002',
      parentPhone: '0985000002',
      classBatchId: classBatchA.id,
    });

    await expect(
      gdkdB.finance.receiptCancel({ receiptId: approved.receipt.id, reason: 'cross facility attempt' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('facility B cannot refund an approved receipt that belongs to facility A', async () => {
    const approved = await draftAndApproveInA({
      contactPhone: '0975000003',
      parentPhone: '0985000003',
      classBatchId: classBatchA.id,
    });

    await expect(
      gdkdB.finance.refundCreate({ receiptId: approved.receipt.id, amount: 1_000_000 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
