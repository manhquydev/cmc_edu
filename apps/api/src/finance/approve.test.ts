// WF-P1-03 integration tests: the money gate. Covers I1 (sale FORBIDDEN),
// I2 (auto-O5 + closedAt in the same transaction as approve), I4 (netAmount
// frozen after approve), the ADR-B self-approval compensating control (audit
// flag under the threshold, FORBIDDEN above it), and kind computed before the
// stage mutation (new vs renewal).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import { SELF_APPROVE_THRESHOLD } from './router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  testDb,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance.receiptApprove (WF-P1-03 money gate)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let teacher: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Approve Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-approve-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-approve-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-approve-1', roles: ['giao_vien'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  /** Draft a receipt through the full O1..O4 -> receiptCreate flow. */
  async function draftReceipt(
    creator: Caller,
    opts: { contactPhone: string; parentPhone: string; amount?: number; classBatchId?: string },
  ) {
    const opp = await creator.crm.opportunityCreate({ contactName: 'Contact ' + opts.contactPhone, phone: opts.contactPhone });
    await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O3_TEST_SCHEDULED' });
    await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });

    phonesToClean.push(opts.parentPhone);
    const result = await creator.finance.receiptCreate({
      opportunityId: opp.id,
      studentName: 'Student for ' + opts.parentPhone,
      parentPhone: opts.parentPhone,
      amount: opts.amount ?? 5_000_000,
      classBatchId: opts.classBatchId ?? 'class-batch-approve-1',
    });
    // A repeat parentPhone (e.g. the renewal-kind test) legitimately returns
    // `status: 'warning'` (soft dup-phone warning, docs/24 WF-P1-02) — both
    // branches of the discriminated union still carry a usable `receipt`.
    return { opportunityId: opp.id, receipt: result.receipt };
  }

  it('forbids sale (the drafter role) from approving — I1', async () => {
    const { receipt } = await draftReceipt(sale, { contactPhone: '0930000001', parentPhone: '0940000001' });

    await expect(sale.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('approves a draft: freezes status, advances opp to O5 + closedAt, keeps netAmount unchanged — I2/I4', async () => {
    const { opportunityId, receipt } = await draftReceipt(sale, {
      contactPhone: '0930000002',
      parentPhone: '0940000002',
      amount: 7_500_000,
    });

    const result = await gdkd.finance.receiptApprove({ receiptId: receipt.id });

    expect(result.receipt.status).toBe('approved');
    expect(result.receipt.netAmount).toBe(7_500_000); // I4: unchanged from draft
    expect(result.opportunityStage).toBe('O5_ENROLLED');
    expect(result.provisioning).toBe('ok');

    const opportunity = await testDb().opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
    expect(opportunity.stage).toBe('O5_ENROLLED');
    expect(opportunity.closedAt).not.toBeNull();
  });

  it('rejects approving a non-draft receipt (already approved)', async () => {
    const { receipt } = await draftReceipt(sale, { contactPhone: '0930000003', parentPhone: '0940000003' });
    await gdkd.finance.receiptApprove({ receiptId: receipt.id });

    await expect(gdkd.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('serialises a concurrent double-approve: exactly one succeeds, opp advances once — HIGH-2', async () => {
    const { opportunityId, receipt } = await draftReceipt(sale, {
      contactPhone: '0930000009',
      parentPhone: '0940000009',
    });

    // Fire two approvals of the same draft concurrently. The atomic claim
    // (updateMany WHERE status='draft') must let exactly one win; the loser
    // gets CONFLICT (or BAD_REQUEST if it read the already-approved state)
    // rather than re-approving and double-provisioning.
    const results = await Promise.allSettled([
      gdkd.finance.receiptApprove({ receiptId: receipt.id }),
      gdkd.finance.receiptApprove({ receiptId: receipt.id }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toMatch(/CONFLICT|BAD_REQUEST/);

    // The receipt is approved exactly once and the opportunity reached O5 once.
    const finalReceipt = await testDb().receipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(finalReceipt.status).toBe('approved');
    const opportunity = await testDb().opportunity.findUniqueOrThrow({ where: { id: opportunityId } });
    expect(opportunity.stage).toBe('O5_ENROLLED');
    // Exactly one Student was provisioned (no double-provision).
    const students = await testDb().student.findMany({ where: { createdByReceiptId: receipt.id } });
    expect(students).toHaveLength(1);
  });

  it('records "created & self-approved" in the audit trail when creator === approver (multi-hat, under threshold)', async () => {
    const soloGdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-solo-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    const { receipt } = await draftReceipt(soloGdkd, {
      contactPhone: '0930000004',
      parentPhone: '0940000004',
      amount: 3_000_000,
    });

    const result = await soloGdkd.finance.receiptApprove({ receiptId: receipt.id });
    expect(result.receipt.status).toBe('approved');

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'Receipt', entityId: receipt.id, action: 'finance.receiptApprove' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect((audit!.data as { selfApproved: boolean }).selfApproved).toBe(true);
  });

  it('forbids self-approval above the threshold — requires an independent second approver (ADR-B)', async () => {
    const soloGdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-solo-2', roles: ['giam_doc_kinh_doanh'] }),
    );
    const { receipt } = await draftReceipt(soloGdkd, {
      contactPhone: '0930000005',
      parentPhone: '0940000005',
      amount: SELF_APPROVE_THRESHOLD + 1,
    });

    await expect(soloGdkd.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const stillDraft = await testDb().receipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(stillDraft.status).toBe('draft');
  });

  it('computes kind=renewal for a second approved receipt on the same parent phone, kind=new for the first', async () => {
    const parentPhone = '0940000006';
    const first = await draftReceipt(sale, { contactPhone: '0930000006', parentPhone });
    const firstApproved = await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
    expect(firstApproved.receipt.kind).toBe('new');

    const second = await draftReceipt(sale, {
      contactPhone: '0930000007',
      parentPhone,
      classBatchId: 'class-batch-approve-2',
    });
    const secondApproved = await gdkd.finance.receiptApprove({ receiptId: second.receipt.id });
    expect(secondApproved.receipt.kind).toBe('renewal');
  });

  it('forbids a role without finance.receiptApprove permission', async () => {
    const { receipt } = await draftReceipt(sale, { contactPhone: '0930000008', parentPhone: '0940000008' });

    await expect(teacher.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
