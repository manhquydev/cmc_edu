// finance.receiptList / finance.receiptGet integration tests (K3 remediation,
// deep-review consolidated report): the HITL work-queue for the money gate.
// Before this, an approver had no way to find receipts awaiting a decision —
// this proves the queue is permission-gated to the same roster as
// `receiptApprove`, facility-scoped, and status-filterable.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance.receiptList / finance.receiptGet (K3)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let saleA: Caller;
  let gdkdA: Caller;
  let gdkdB: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facilityA = await createTestFacility('Receipt List Facility A');
    facilityB = await createTestFacility('Receipt List Facility B');
    saleA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'sale-list-a', roles: ['sale'] }),
    );
    gdkdA = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'gdkd-list-a', roles: ['giam_doc_kinh_doanh'] }),
    );
    gdkdB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'gdkd-list-b', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  async function draftReceipt(caller: Caller, parentPhone: string, classBatchId: string) {
    phonesToClean.push(parentPhone);
    return caller.finance.receiptCreate({
      studentName: 'Receipt List Student',
      parentPhone,
      amount: 3_000_000,
      classBatchId,
    });
  }

  it('an approver (GĐKD) can list draft receipts awaiting approval, facility-scoped', async () => {
    const draft = await draftReceipt(saleA, '0970000101', 'class-batch-list-1');

    const { items, total, page, pageSize } = await gdkdA.finance.receiptList({ status: 'draft' });
    expect(page).toBe(1);
    expect(pageSize).toBe(20);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items.some((r) => r.id === draft.receipt.id)).toBe(true);
    expect(items.every((r) => r.status === 'draft')).toBe(true);
  });

  it('lists all statuses when no status filter is given', async () => {
    const draft = await draftReceipt(saleA, '0970000105', 'class-batch-list-5');

    const { items } = await gdkdA.finance.receiptList({});
    expect(items.some((r) => r.id === draft.receipt.id)).toBe(true);
  });

  it('receiptGet returns the single receipt for an approver', async () => {
    const draft = await draftReceipt(saleA, '0970000102', 'class-batch-list-2');

    const fetched = await gdkdA.finance.receiptGet({ receiptId: draft.receipt.id });
    expect(fetched.id).toBe(draft.receipt.id);
    expect(fetched.status).toBe('draft');
  });

  it('sale (the drafter) is FORBIDDEN from the approver work queue', async () => {
    await expect(saleA.finance.receiptList({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      saleA.finance.receiptGet({ receiptId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('RLS: facility B sees none of facility A drafts, and cannot receiptGet by id', async () => {
    const draft = await draftReceipt(saleA, '0970000103', 'class-batch-list-3');

    const listB = await gdkdB.finance.receiptList({ status: 'draft' });
    expect(listB.items.some((r) => r.id === draft.receipt.id)).toBe(false);

    await expect(gdkdB.finance.receiptGet({ receiptId: draft.receipt.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('status filter narrows to approved after receiptApprove', async () => {
    const draft = await draftReceipt(saleA, '0970000104', 'class-batch-list-4');
    await gdkdA.finance.receiptApprove({ receiptId: draft.receipt.id });

    const approvedList = await gdkdA.finance.receiptList({ status: 'approved' });
    expect(approvedList.items.some((r) => r.id === draft.receipt.id)).toBe(true);

    const draftList = await gdkdA.finance.receiptList({ status: 'draft' });
    expect(draftList.items.some((r) => r.id === draft.receipt.id)).toBe(false);
  });
});
