// Phase-01a: canApprove flag on ReceiptDto — 4 cases per H2/H1 spec.
// canApprove is a server-derived UI hint; actual gate remains server-side.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import { APPROVAL_SECOND_EYE_THRESHOLD } from './router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('ReceiptDto.canApprove (phase-01a H2/H1)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let gddt: Caller;
  let classBatch: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('CanApprove Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-ca-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-ca-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-ca-1', roles: ['giam_doc_dao_tao'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  async function draft(phone: string, amount: number) {
    phonesToClean.push(phone);
    const result = await sale.finance.receiptCreate({
      studentName: 'Test HS',
      parentPhone: phone,
      amount,
      classBatchId: classBatch.id,
    });
    if (result.status !== 'success') throw new Error('unexpected status');
    return result.receipt;
  }

  it('canApprove=true for a non-drafter with approval permission viewing a below-threshold receipt', async () => {
    const receipt = await draft('0900000001', 5_000_000);
    // gdkd-ca-1 is NOT the drafter (sale-ca-1 created it), amount is under threshold
    const got = await gdkd.finance.receiptGet({ receiptId: receipt.id });
    expect(got.canApprove).toBe(true);
  });

  it('canApprove=false when drafter == approver (same userId, under threshold)', async () => {
    // Create as gdkd-ca-1 so the drafter has receiptCreate permission.
    const gdkdAsCreator = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-ca-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    phonesToClean.push('0900000002');
    const result = await gdkdAsCreator.finance.receiptCreate({
      studentName: 'Test HS2',
      parentPhone: '0900000002',
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (result.status !== 'success') throw new Error('unexpected');
    // Same gdkd user views their own receipt
    const got = await gdkd.finance.receiptGet({ receiptId: result.receipt.id });
    expect(got.canApprove).toBe(false); // self-draft
  });

  it('canApprove=false for non-second-eye role when amount > threshold', async () => {
    const overThreshold = APPROVAL_SECOND_EYE_THRESHOLD + 1;
    const receipt = await draft('0900000003', overThreshold);
    // gdkd (giam_doc_kinh_doanh) is NOT in SECOND_EYE_ROLES
    const got = await gdkd.finance.receiptGet({ receiptId: receipt.id });
    expect(got.canApprove).toBe(false);
  });

  it('canApprove=true for second-eye role (giam_doc_dao_tao) over threshold', async () => {
    const overThreshold = APPROVAL_SECOND_EYE_THRESHOLD + 1;
    const receipt = await draft('0900000004', overThreshold);
    // gddt (giam_doc_dao_tao) IS a second-eye role
    const got = await gddt.finance.receiptGet({ receiptId: receipt.id });
    expect(got.canApprove).toBe(true);
  });
});
