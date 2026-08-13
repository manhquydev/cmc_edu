// WF-P1-03 integration tests: the money gate. Covers I1 (sale FORBIDDEN),
// I2 (auto-O5 + closedAt in the same transaction as approve), I4 (netAmount
// frozen after approve), the ADR-B self-approval compensating control (audit
// flag under the threshold, FORBIDDEN above it), and kind computed before the
// stage mutation (new vs renewal).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import { APPROVAL_SECOND_EYE_THRESHOLD, enqueueReceiptEmail } from './router.js';
import { financePayloadLeaksMoney } from '../crm/record-event.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('finance.receiptApprove (WF-P1-03 money gate)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let gddt: Caller;
  let teacher: Caller;
  let classBatch: { id: string };
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Approve Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-approve-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-approve-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-approve-1', roles: ['giam_doc_dao_tao'] }),
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
    opts: {
      contactPhone: string;
      parentPhone: string;
      parentEmail?: string;
      amount?: number;
      classBatchId?: string;
      studentId?: string;
      confirmNewStudent?: boolean;
      opportunityId?: string;
    },
  ) {
    let opportunityId = opts.opportunityId;
    if (!opportunityId) {
      const opp = await creator.crm.opportunityCreate({ contactName: 'Contact ' + opts.contactPhone, phone: opts.contactPhone });
      await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O2_CONTACTED' });
      await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O3_TEST_SCHEDULED' });
      await creator.crm.opportunityAdvance({ opportunityId: opp.id, toStage: 'O4_TESTED' });
      opportunityId = opp.id;
    }

    phonesToClean.push(opts.parentPhone);
    const result = await creator.finance.receiptCreate({
      opportunityId,
      studentName: 'Student for ' + opts.parentPhone,
      parentPhone: opts.parentPhone,
      parentEmail: opts.parentEmail,
      amount: opts.amount ?? 5_000_000,
      classBatchId: opts.classBatchId ?? classBatch.id,
      studentId: opts.studentId,
      confirmNewStudent: opts.confirmNewStudent,
    });
    // A repeat parentPhone with no existing Student for it yet (or an
    // explicitly disambiguated studentId/confirmNewStudent) legitimately
    // returns `status: 'warning'` (soft dup-phone warning, docs/24 WF-P1-02).
    // `needs_confirmation` (scenario audit, PO round 3) means the caller
    // forgot to disambiguate an existing-student phone — a test bug, not a
    // valid draftReceipt outcome, so it throws here instead of silently
    // returning an unusable receipt.
    if (result.status === 'needs_confirmation') {
      throw new Error(
        `draftReceipt: phone ${opts.parentPhone} needs disambiguation (studentId or confirmNewStudent) — this helper caller must pass one.`,
      );
    }
    return { opportunityId, receipt: result.receipt };
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

    const opportunity = await testDbBypass((tx) =>
      tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }),
    );
    expect(opportunity.stage).toBe('O5_ENROLLED');
    expect(opportunity.closedAt).not.toBeNull();

    const enrolled = await testDbBypass((tx) =>
      tx.recordEvent.findMany({ where: { entityId: opportunityId, kind: 'enrolled' } }),
    );
    expect(enrolled).toHaveLength(1);
    expect(financePayloadLeaksMoney(enrolled[0]?.payload)).toBe(false);
    expect(JSON.stringify(enrolled[0]?.payload ?? {})).not.toMatch(/amount|receiptId|approver/i);
  });

  it('Metric & Data Integrity remediation (scenario audit): a SECOND approval on the same opportunity does NOT overwrite closedAt', async () => {
    const first = await draftReceipt(sale, { contactPhone: '0930000017', parentPhone: '0940000017' });
    const firstApproved = await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
    expect(firstApproved.opportunityStage).toBe('O5_ENROLLED');
    const originalClosedAt = (
      await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: first.opportunityId } }))
    ).closedAt;
    expect(originalClosedAt).not.toBeNull();

    // A second receipt on the SAME opportunity (different phone — a sibling
    // enrolled via the same opportunity), approved later.
    const second = await draftReceipt(sale, {
      contactPhone: '0930000017',
      parentPhone: '0940000018',
      classBatchId: classBatch.id,
      opportunityId: first.opportunityId,
    });
    await gdkd.finance.receiptApprove({ receiptId: second.receipt.id });

    const opportunity = await testDbBypass((tx) =>
      tx.opportunity.findUniqueOrThrow({ where: { id: first.opportunityId } }),
    );
    expect(opportunity.stage).toBe('O5_ENROLLED');
    expect(opportunity.closedAt?.getTime()).toBe(originalClosedAt?.getTime());

    const enrolled = await testDbBypass((tx) =>
      tx.recordEvent.findMany({ where: { entityId: first.opportunityId, kind: 'enrolled' } }),
    );
    expect(enrolled).toHaveLength(1);
  });

  it('rejects approving a receipt whose opportunity was marked lost after the draft was created — receipt stays draft (phase-02)', async () => {
    const { opportunityId, receipt } = await draftReceipt(sale, {
      contactPhone: '0930000030',
      parentPhone: '0940000030',
    });
    // The opp is marked lost between draft and approve.
    await sale.crm.opportunityMarkLost({ opportunityId, lostReason: 'schedule_conflict' });

    await expect(gdkd.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    // No side effects: receipt still draft, opp still lost (not force-advanced to O5).
    const stillDraft = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(stillDraft.status).toBe('draft');
    const opp = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }));
    expect(opp.stage).not.toBe('O5_ENROLLED');
    expect(opp.lostReason).toBe('schedule_conflict');
  });

  it('approves after the lost opportunity is reopened — O5 with lostReason cleared (phase-02)', async () => {
    const { opportunityId, receipt } = await draftReceipt(sale, {
      contactPhone: '0930000031',
      parentPhone: '0940000031',
    });
    await sale.crm.opportunityMarkLost({ opportunityId, lostReason: 'price_too_high' });
    await sale.crm.opportunityMarkLost({ opportunityId, reopen: true });

    const result = await gdkd.finance.receiptApprove({ receiptId: receipt.id });
    expect(result.opportunityStage).toBe('O5_ENROLLED');

    const opp = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }));
    expect(opp.stage).toBe('O5_ENROLLED');
    expect(opp.lostReason).toBeNull(); // no won row ever carries a lost reason
    expect(opp.closedAt).not.toBeNull();
  });

  it('serialises approve racing opportunityMarkLost: never leaves an O5 row with a lostReason (phase-02)', async () => {
    const { opportunityId, receipt } = await draftReceipt(sale, {
      contactPhone: '0930000032',
      parentPhone: '0940000032',
    });

    // Fire approve (→ O5) and markLost (→ lostReason+closedAt) concurrently on
    // the same opportunity. FOR UPDATE on both sides serialises them; whichever
    // commits first, the other observes it — the corrupt "O5 + lostReason" row
    // must be impossible regardless of ordering.
    await Promise.allSettled([
      gdkd.finance.receiptApprove({ receiptId: receipt.id }),
      sale.crm.opportunityMarkLost({ opportunityId, lostReason: 'not_interested' }),
    ]);

    const opp = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }));
    const corrupt = opp.stage === 'O5_ENROLLED' && opp.lostReason !== null;
    expect(corrupt).toBe(false);
  });

  it('walk-in: approving an UNLINKED receipt auto-creates a Contact + Opportunity ending at O5 (phase-05)', async () => {
    const parentPhone = '0940000050';
    phonesToClean.push(parentPhone);
    const created = await sale.finance.receiptCreate({
      studentName: 'Walk In Kid',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
    expect(created.receipt.opportunityId).toBeNull();

    const result = await gdkd.finance.receiptApprove({ receiptId: created.receipt.id });
    expect(result.opportunityStage).toBe('O5_ENROLLED');

    const linked = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: created.receipt.id } }));
    expect(linked.opportunityId).not.toBeNull();

    const contact = await testDbBypass((tx) =>
      tx.contact.findFirst({ where: { facilityId: facility.id, phone: '84940000050' } }),
    );
    expect(contact).not.toBeNull();
    expect(contact?.name).toBe('PH Walk In Kid'); // placeholder — no parent-name source field

    const opp = await testDbBypass((tx) =>
      tx.opportunity.findUniqueOrThrow({ where: { id: linked.opportunityId! } }),
    );
    expect(opp.stage).toBe('O5_ENROLLED');
    expect(opp.closedAt).not.toBeNull();
    expect(opp.lostReason).toBeNull();
    expect(opp.source).toBe('walkin'); // phase-10: auto-created walk-in opp tagged

    const events = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { entityId: linked.opportunityId!, entity: 'Opportunity' },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(events.map((e) => e.kind)).toEqual(['created', 'enrolled']);
    expect(events[0]?.payload).toEqual({ source: 'walkin' });
    expect(financePayloadLeaksMoney(events[1]?.payload)).toBe(false);
  });

  it('walk-in: an UNLINKED receipt for a phone with an OPEN opp links AND advances that opp to O5 (no strand at O2) (phase-05)', async () => {
    const parentPhone = '0940000051';
    phonesToClean.push(parentPhone);
    const existing = await sale.crm.opportunityCreate({ contactName: 'Existing Lead', phone: parentPhone });
    await sale.crm.opportunityAdvance({ opportunityId: existing.id, toStage: 'O2_CONTACTED' });

    const created = await sale.finance.receiptCreate({
      studentName: 'Kid B',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');

    await gdkd.finance.receiptApprove({ receiptId: created.receipt.id });

    const linked = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: created.receipt.id } }));
    expect(linked.opportunityId).toBe(existing.id); // linked the existing open opp, not a new one
    const updated = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: existing.id } }));
    expect(updated.stage).toBe('O5_ENROLLED'); // advanced, NOT stranded at O2
  });

  it('walk-in: when the phone\'s only opp is LOST, it is left untouched and a fresh opp is created ending O5 (phase-05)', async () => {
    const parentPhone = '0940000052';
    phonesToClean.push(parentPhone);
    const lostOpp = await sale.crm.opportunityCreate({ contactName: 'Lost Lead', phone: parentPhone });
    await sale.crm.opportunityAdvance({ opportunityId: lostOpp.id, toStage: 'O2_CONTACTED' });
    await sale.crm.opportunityMarkLost({ opportunityId: lostOpp.id, lostReason: 'no_response' });

    const created = await sale.finance.receiptCreate({
      studentName: 'Kid C',
      parentPhone,
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');

    await gdkd.finance.receiptApprove({ receiptId: created.receipt.id });

    const linked = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: created.receipt.id } }));
    expect(linked.opportunityId).not.toBe(lostOpp.id); // not the lost opp

    const lostAfter = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: lostOpp.id } }));
    expect(lostAfter.lostReason).toBe('no_response'); // untouched
    expect(lostAfter.stage).not.toBe('O5_ENROLLED');

    const newOpp = await testDbBypass((tx) => tx.opportunity.findUniqueOrThrow({ where: { id: linked.opportunityId! } }));
    expect(newOpp.stage).toBe('O5_ENROLLED');
  });

  it('walk-in: a phone-format variant of an existing contact matches it — no duplicate Contact (phase-05)', async () => {
    phonesToClean.push('+84 940 000 053');
    await sale.crm.opportunityCreate({ contactName: 'Variant Lead', phone: '0940000053' });

    const created = await sale.finance.receiptCreate({
      studentName: 'Kid D',
      parentPhone: '+84 940 000 053',
      amount: 5_000_000,
      classBatchId: classBatch.id,
    });
    if (created.status === 'needs_confirmation') throw new Error('unexpected needs_confirmation');
    await gdkd.finance.receiptApprove({ receiptId: created.receipt.id });

    const contacts = await testDbBypass((tx) =>
      tx.contact.findMany({ where: { facilityId: facility.id, phone: '84940000053' } }),
    );
    expect(contacts).toHaveLength(1); // normalized match — no duplicate
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
    const finalReceipt = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(finalReceipt.status).toBe('approved');
    const opportunity = await testDbBypass((tx) =>
      tx.opportunity.findUniqueOrThrow({ where: { id: opportunityId } }),
    );
    expect(opportunity.stage).toBe('O5_ENROLLED');
    // Exactly one Student was provisioned (no double-provision).
    const students = await testDbBypass((tx) =>
      tx.student.findMany({ where: { createdByReceiptId: receipt.id } }),
    );
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
      amount: APPROVAL_SECOND_EYE_THRESHOLD + 1,
    });

    await expect(soloGdkd.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const stillDraft = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(stillDraft.status).toBe('draft');
  });

  it('forbids a GĐKD-only approver over threshold even when NOT self-approved — H1 general second-eye rule', async () => {
    const { receipt } = await draftReceipt(sale, {
      contactPhone: '0930000011',
      parentPhone: '0940000011',
      amount: APPROVAL_SECOND_EYE_THRESHOLD + 1,
    });

    await expect(gdkd.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const stillDraft = await testDbBypass((tx) => tx.receipt.findUniqueOrThrow({ where: { id: receipt.id } }));
    expect(stillDraft.status).toBe('draft');
  });

  it('allows an over-threshold approval by GĐĐT (independent second eye satisfied) — H1', async () => {
    const { receipt } = await draftReceipt(sale, {
      contactPhone: '0930000012',
      parentPhone: '0940000012',
      amount: APPROVAL_SECOND_EYE_THRESHOLD + 1,
    });

    const result = await gddt.finance.receiptApprove({ receiptId: receipt.id });
    expect(result.receipt.status).toBe('approved');
    expect(result.receipt.netAmount).toBe(APPROVAL_SECOND_EYE_THRESHOLD + 1);
  });

  it('allows a GĐKD approval under threshold (no second eye required) — H1', async () => {
    const { receipt } = await draftReceipt(sale, {
      contactPhone: '0930000013',
      parentPhone: '0940000013',
      amount: APPROVAL_SECOND_EYE_THRESHOLD - 1,
    });

    const result = await gdkd.finance.receiptApprove({ receiptId: receipt.id });
    expect(result.receipt.status).toBe('approved');
  });

  it('computes kind=renewal for a SECOND receipt naming the SAME student (studentId), kind=new for the first', async () => {
    const parentPhone = '0940000006';
    const first = await draftReceipt(sale, { contactPhone: '0930000006', parentPhone });
    const firstApproved = await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
    expect(firstApproved.receipt.kind).toBe('new');

    const student = await testDbBypass((tx) =>
      tx.student.findUniqueOrThrow({ where: { createdByReceiptId: first.receipt.id } }),
    );

    // Metric & Data Integrity remediation (scenario audit, PO round 3): kind
    // is now STUDENT-scoped, not phone-scoped — a repeat phone with no
    // studentId is a duplicate-student gate case (see
    // duplicate-student-gate.test.ts), not an automatic 'renewal'. This test
    // now exercises the real renewal path: same phone AND explicit studentId.
    const second = await draftReceipt(sale, {
      contactPhone: '0930000007',
      parentPhone,
      classBatchId: classBatch.id,
      studentId: student.id,
    });
    const secondApproved = await gdkd.finance.receiptApprove({ receiptId: second.receipt.id });
    expect(secondApproved.receipt.kind).toBe('renewal');
  });

  it('computes kind=new for a SECOND receipt on the same phone naming a genuinely different child (confirmNewStudent)', async () => {
    const parentPhone = '0940000015';
    const first = await draftReceipt(sale, { contactPhone: '0930000015', parentPhone });
    const firstApproved = await gdkd.finance.receiptApprove({ receiptId: first.receipt.id });
    expect(firstApproved.receipt.kind).toBe('new');

    const second = await draftReceipt(sale, {
      contactPhone: '0930000016',
      parentPhone,
      classBatchId: classBatch.id,
      confirmNewStudent: true,
    });
    const secondApproved = await gdkd.finance.receiptApprove({ receiptId: second.receipt.id });
    expect(secondApproved.receipt.kind).toBe('new');
  });

  it('forbids a role without finance.receiptApprove permission', async () => {
    const { receipt } = await draftReceipt(sale, { contactPhone: '0930000008', parentPhone: '0940000008' });

    await expect(teacher.finance.receiptApprove({ receiptId: receipt.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('is idempotent: replaying the outbox enqueue for the same receipt never creates a duplicate row — F8', async () => {
    const parentEmail = 'f8test@example.com';
    const { receipt } = await draftReceipt(sale, {
      contactPhone: '0930000014',
      parentPhone: '0940000014',
      parentEmail,
    });
    const approved = await gdkd.finance.receiptApprove({ receiptId: receipt.id });

    // First call was made internally by receiptApprove; replay it — must not
    // create a second EmailOutbox row (dedup by receiptId in payload).
    await enqueueReceiptEmail(testDb(), {
      id: approved.receipt.id,
      parentEmail,
      studentName: approved.receipt.studentName,
      kind: approved.receipt.kind,
    });

    const rows = await testDb().$queryRaw<{ id: string }[]>`
      SELECT id FROM "EmailOutbox" WHERE payload->>'receiptId' = ${receipt.id}
    `;
    expect(rows).toHaveLength(1);

    await testDb().$executeRaw`DELETE FROM "EmailOutbox" WHERE payload->>'receiptId' = ${receipt.id}`;
  });
});
