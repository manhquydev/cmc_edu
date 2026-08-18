// phase-04 AuditLog coverage: locks the invariant that every money mutation
// (finance.receiptCreate, finance.refundCreate), every CRM stage mutation
// (crm.opportunityAdvance, crm.opportunityMarkLost), and successful
// provisioning all leave an AuditLog row — enforced by test, not memory
// (plan success criterion).
//
// Note on mechanism (verified against source, not the plan's stale F6
// premise): receiptCreate/refundCreate/opportunityAdvance/opportunityMarkLost
// are covered by the GLOBAL `auditLogMiddleware` (trpc.ts) that auto-audits
// every successful mutation not in AUDIT_EXCLUDED_PATHS — so no in-handler
// audit write is (or should be) added for them; a second write would double
// the rows. `provisioning.completed` is the one genuine gap this phase adds
// directly, because provisioning runs OUTSIDE any tRPC handler (after the
// money transaction, and on the reconciler path) where the middleware never
// sees it.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
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

async function latestAudit(action: string, entityId: string) {
  return testDb().auditLog.findFirst({
    where: { action, entityId },
    orderBy: { createdAt: 'desc' },
  });
}

describe('phase-04 mutation audit coverage', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let classBatch: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Audit Coverage Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-audit-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-audit-1', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean.map((p) => normalizeLoginPhone(p)));
    phonesToClean.length = 0;
  });

  async function draftAtO4(parentPhone: string) {
    const opp = await sale.crm.opportunityCreate({ contactName: 'Audit Lead', phone: `c${parentPhone}` });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O3_TEST_SCHEDULED' });
    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });
    phonesToClean.push(parentPhone);
    const created = await sale.finance.receiptCreate({
      opportunityId: opp.id,
      studentName: 'Audit Student',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
    return { opp, receipt: created.receipt };
  }

  it('crm stage mutations (advance, markLost) are audited by the global middleware', async () => {
    const opp = await sale.crm.opportunityCreate({ contactName: 'Stage Audit', phone: '0901111001' });

    await sale.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
    const advanceRow = await latestAudit('crm.opportunityAdvance', opp.id);
    expect(advanceRow).not.toBeNull();
    expect((advanceRow?.data as { toStage?: string })?.toStage).toBe('O2_CONTACTED');

    await sale.crm.opportunityMarkLost({ opportunityId: opp.id, lostReason: 'no_response' });
    const lostRow = await latestAudit('crm.opportunityMarkLost', opp.id);
    expect(lostRow).not.toBeNull();
    expect((lostRow?.data as { lostReason?: string })?.lostReason).toBe('no_response');
  });

  it('finance.receiptCreate is audited with the created receipt as entityId', async () => {
    // Keyed unwrap: entityId is the created Receipt id (deterministic),
    // while the full input — including opportunityId + classBatchId — is
    // still echoed into `data`.
    const { opp, receipt } = await draftAtO4('0902222002');
    const row = await latestAudit('finance.receiptCreate', receipt.id);
    expect(row).not.toBeNull();
    expect(row?.entityId).toBe(receipt.id);
    const data = row?.data as Record<string, unknown>;
    expect(data.opportunityId).toBe(opp.id);
    expect(data.classBatchId).toBe(classBatch.id);
  });

  it('the provisioning.completed row carries only ids (no name/phone PII)', async () => {
    // The one audit row this phase writes directly (vs. the middleware's
    // input-echo rows) must not persist PII — AuditLog is a global table.
    const { receipt } = await draftAtO4('0905555005');
    await gdkd.finance.receiptApprove({ receiptId: receipt.id });
    const row = await latestAudit('provisioning.completed', receipt.id);
    const data = row?.data as Record<string, unknown>;
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('0905555005'); // no parent phone
    expect(serialized).not.toContain('Audit Student'); // no student name
    // Plan 3 unit grant: unitGrantStatus is a closed enum status (not PII);
    // every other key is an id reference.
    expect(
      Object.keys(data).every((k) => k.endsWith('Id') || k === 'unitGrantStatus'),
    ).toBe(true);
  });

  it('successful provisioning writes exactly one idempotent provisioning.completed summary row', async () => {
    const { receipt } = await draftAtO4('0903333003');
    await gdkd.finance.receiptApprove({ receiptId: receipt.id });

    const rows = await testDb().auditLog.findMany({
      where: { action: 'provisioning.completed', entityId: receipt.id },
    });
    expect(rows).toHaveLength(1);
    const data = rows[0].data as Record<string, unknown>;
    expect(typeof data.studentId).toBe('string');
    expect(typeof data.enrollmentId).toBe('string');
  });

  it('finance.refundCreate is audited with the created refund as entityId', async () => {
    const { receipt } = await draftAtO4('0904444004');
    await gdkd.finance.receiptApprove({ receiptId: receipt.id });

    const refund = await gdkd.finance.refundCreate({ receiptId: receipt.id, amount: 2_000_000 });
    const row = await latestAudit('finance.refundCreate', refund.refund.id);
    expect(row).not.toBeNull();
    expect(row?.entityId).toBe(refund.refund.id);
    const data = row?.data as Record<string, unknown>;
    expect(data.receiptId).toBe(receipt.id);
    expect(data.amount).toBe(2_000_000);
  });
});
