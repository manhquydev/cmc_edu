// crm.opportunityReport — P1 báo cáo tuyển sinh.
//
// Locks time-semantics (createdAt cohort vs closedAt outcomes) and the
// sale own-only KPI rule (procedure-layer, not registry).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

const PERIOD_FROM = new Date('2026-03-01T00:00:00.000Z');
const PERIOD_TO = new Date('2026-03-31T23:59:59.999Z');
const BEFORE_PERIOD = new Date('2026-02-15T12:00:00.000Z');
const IN_PERIOD = new Date('2026-03-15T12:00:00.000Z');
const AFTER_PERIOD = new Date('2026-04-10T12:00:00.000Z');

describe('crm.opportunityReport', () => {
  let facility: { id: string };
  let facilityB: { id: string };
  let saleA: Caller;
  let manager: Caller;
  let hr: Caller;
  let saleAAppUserId: string;
  let saleBAppUserId: string;
  let phoneSeq = 0;

  beforeEach(async () => {
    facility = await createTestFacility('CRM Report Facility A');
    facilityB = await createTestFacility('CRM Report Facility B');
    const a = await seedAppUser({
      facilityId: facility.id,
      userId: 'sale-report-a',
      position: 'sale',
      roles: ['sale'],
    });
    const b = await seedAppUser({
      facilityId: facility.id,
      userId: 'sale-report-b',
      position: 'sale',
      roles: ['sale'],
    });
    saleAAppUserId = a.id;
    saleBAppUserId = b.id;
    saleA = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-report-a', roles: ['sale'] }),
    );
    manager = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'gdkd-report-1',
        roles: ['giam_doc_kinh_doanh'],
      }),
    );
    hr = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'hr-report-1', roles: ['hr'] }),
    );
    phoneSeq = 0;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupFacility(facilityB.id);
  });

  function nextPhone() {
    phoneSeq += 1;
    return `09550000${String(phoneSeq).padStart(2, '0')}`;
  }

  async function seedOpp(opts: {
    name: string;
    stage?: 'O1_LEAD' | 'O2_CONTACTED' | 'O3_TEST_SCHEDULED' | 'O4_TESTED' | 'O5_ENROLLED';
    source?: string | null;
    lostReason?: 'no_response' | 'price_too_high' | 'chose_competitor' | 'schedule_conflict' | 'not_interested' | 'other' | null;
    assignedToId?: string | null;
    createdAt: Date;
    closedAt?: Date | null;
    facilityId?: string;
  }) {
    return testDbBypass(async (tx) => {
      const fid = opts.facilityId ?? facility.id;
      const contact = await tx.contact.create({
        data: { facilityId: fid, name: opts.name, phone: nextPhone() },
      });
      return tx.opportunity.create({
        data: {
          facilityId: fid,
          contactId: contact.id,
          stage: opts.stage ?? 'O1_LEAD',
          source: opts.source ?? null,
          lostReason: opts.lostReason ?? null,
          assignedToId: opts.assignedToId ?? null,
          createdAt: opts.createdAt,
          closedAt: opts.closedAt ?? null,
        },
      });
    });
  }

  const periodInput = {
    from: PERIOD_FROM.toISOString(),
    to: PERIOD_TO.toISOString(),
  };

  it('forbids a role without crm.report permission', async () => {
    await expect(hr.crm.opportunityReport(periodInput)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('funnelSnapshot is current open+won counts (no date filter) and excludes lost', async () => {
    await seedOpp({ name: 'Open O1', stage: 'O1_LEAD', createdAt: BEFORE_PERIOD });
    await seedOpp({ name: 'Open O2', stage: 'O2_CONTACTED', createdAt: IN_PERIOD });
    await seedOpp({
      name: 'Lost O2',
      stage: 'O2_CONTACTED',
      lostReason: 'no_response',
      createdAt: IN_PERIOD,
      closedAt: IN_PERIOD,
    });
    await seedOpp({
      name: 'Won O5',
      stage: 'O5_ENROLLED',
      createdAt: BEFORE_PERIOD,
      closedAt: IN_PERIOD,
    });

    const report = await manager.crm.opportunityReport(periodInput);

    expect(report.funnelSnapshot.stageCounts.O1_LEAD).toBe(1);
    expect(report.funnelSnapshot.stageCounts.O2_CONTACTED).toBe(1);
    expect(report.funnelSnapshot.stageCounts.O5_ENROLLED).toBe(1);
    expect(report.funnelSnapshot.lostCount).toBe(1);
  });

  it('separates createdAt cohort from closedAt outcomes (cross-period lead)', async () => {
    // Created before the period, closed (enrolled) inside the period.
    await seedOpp({
      name: 'Cross period enrolled',
      stage: 'O5_ENROLLED',
      source: 'fanpage',
      assignedToId: saleAAppUserId,
      createdAt: BEFORE_PERIOD,
      closedAt: IN_PERIOD,
    });
    // Created inside period, still open.
    await seedOpp({
      name: 'In-period open',
      stage: 'O1_LEAD',
      source: 'hotline',
      assignedToId: saleAAppUserId,
      createdAt: IN_PERIOD,
    });
    // Created inside period, lost after period → in cohort as open? No: lost after period means
    // at report time it is lost, but closedAt is outside period so not in closedOutcomes.
    // Cohort counts by createdAt: totalCreated includes it; enrolled/lost based on current state.
    await seedOpp({
      name: 'Created in period lost later',
      stage: 'O2_CONTACTED',
      source: 'event',
      lostReason: 'price_too_high',
      assignedToId: saleBAppUserId,
      createdAt: IN_PERIOD,
      closedAt: AFTER_PERIOD,
    });

    const report = await manager.crm.opportunityReport(periodInput);

    // Intake cohort: 2 created in period (open + lost-later). Cross-period enrolled excluded.
    expect(report.intakeCohort.totalCreated).toBe(2);
    expect(report.intakeCohort.enrolledCount).toBe(0);
    expect(report.intakeCohort.lostCount).toBe(1);
    expect(report.intakeCohort.openCount).toBe(1);

    // Closed outcomes: only the cross-period enrolled (closedAt in period).
    expect(report.closedOutcomes.enrolledCount).toBe(1);
    expect(report.closedOutcomes.lostCount).toBe(0);

    const fanpage = report.closedOutcomes.bySource.find((r) => r.source === 'fanpage');
    expect(fanpage).toMatchObject({ enrolled: 1, lost: 0, total: 1 });
  });

  it('closedOutcomes.lostByReason counts lost reasons for closes in the period', async () => {
    await seedOpp({
      name: 'Lost no response',
      stage: 'O2_CONTACTED',
      lostReason: 'no_response',
      createdAt: BEFORE_PERIOD,
      closedAt: IN_PERIOD,
    });
    await seedOpp({
      name: 'Lost price',
      stage: 'O3_TEST_SCHEDULED',
      lostReason: 'price_too_high',
      createdAt: BEFORE_PERIOD,
      closedAt: IN_PERIOD,
    });
    await seedOpp({
      name: 'Lost no response 2',
      stage: 'O1_LEAD',
      lostReason: 'no_response',
      createdAt: IN_PERIOD,
      closedAt: IN_PERIOD,
    });

    const report = await manager.crm.opportunityReport(periodInput);
    expect(report.closedOutcomes.lostCount).toBe(3);
    const byReason = Object.fromEntries(
      report.closedOutcomes.lostByReason.map((r) => [r.reason, r.count]),
    );
    expect(byReason.no_response).toBe(2);
    expect(byReason.price_too_high).toBe(1);
  });

  it('sale sees facility funnel/cohort/source but only own byAssignee KPI', async () => {
    await seedOpp({
      name: 'Sale A enrolled',
      stage: 'O5_ENROLLED',
      source: 'referral',
      assignedToId: saleAAppUserId,
      createdAt: BEFORE_PERIOD,
      closedAt: IN_PERIOD,
    });
    await seedOpp({
      name: 'Sale B enrolled',
      stage: 'O5_ENROLLED',
      source: 'walkin',
      assignedToId: saleBAppUserId,
      createdAt: BEFORE_PERIOD,
      closedAt: IN_PERIOD,
    });
    await seedOpp({
      name: 'Sale B lost',
      stage: 'O2_CONTACTED',
      source: 'walkin',
      lostReason: 'not_interested',
      assignedToId: saleBAppUserId,
      createdAt: BEFORE_PERIOD,
      closedAt: IN_PERIOD,
    });

    const asSaleA = await saleA.crm.opportunityReport(periodInput);
    // Facility-wide totals remain visible.
    expect(asSaleA.closedOutcomes.enrolledCount).toBe(2);
    expect(asSaleA.closedOutcomes.lostCount).toBe(1);
    // bySource is facility-wide (channel effectiveness of the cơ sở).
    expect(asSaleA.closedOutcomes.bySource.some((r) => r.source === 'walkin')).toBe(true);
    // byAssignee is own-only for sale.
    expect(asSaleA.closedOutcomes.byAssignee).toHaveLength(1);
    expect(asSaleA.closedOutcomes.byAssignee[0]).toMatchObject({
      assignedToId: saleAAppUserId,
      enrolled: 1,
      lost: 0,
      total: 1,
    });

    const asManager = await manager.crm.opportunityReport(periodInput);
    expect(asManager.closedOutcomes.byAssignee.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(asManager.closedOutcomes.byAssignee.map((r) => r.assignedToId));
    expect(ids.has(saleAAppUserId)).toBe(true);
    expect(ids.has(saleBAppUserId)).toBe(true);
  });

  it('never leaks facility B rows into facility A report', async () => {
    await seedOpp({
      name: 'Facility B lost',
      stage: 'O1_LEAD',
      lostReason: 'other',
      facilityId: facilityB.id,
      createdAt: IN_PERIOD,
      closedAt: IN_PERIOD,
    });
    await seedOpp({
      name: 'Facility A open',
      stage: 'O1_LEAD',
      createdAt: IN_PERIOD,
    });

    const report = await manager.crm.opportunityReport(periodInput);
    expect(report.funnelSnapshot.stageCounts.O1_LEAD).toBe(1);
    expect(report.funnelSnapshot.lostCount).toBe(0);
    expect(report.intakeCohort.totalCreated).toBe(1);
    expect(report.closedOutcomes.lostCount).toBe(0);
  });

  it('flags right-censoring when the period ends near now', async () => {
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = now;
    const report = await manager.crm.opportunityReport({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    expect(report.intakeCohort.rightCensoringWarning).toBe(true);
  });

  it('does not flag right-censoring for a fully closed historical period', async () => {
    const report = await manager.crm.opportunityReport(periodInput);
    expect(report.intakeCohort.rightCensoringWarning).toBe(false);
  });
});
