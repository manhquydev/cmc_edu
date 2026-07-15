// HR remediation phase 3 (docs/20, plan.md "KPI auto-score & lifecycle"):
// unit + collector tests for auto-score.ts.
//
// Covers:
//   - computeKpiValue: pure formula biên (0%, 50%×50%, 100%×100%, cap, 0/null
//     required)
//   - collectSaleRevenue: createdByAppUserId namespace ONLY (never coalesces
//     to the legacy createdById userId scalar — R2 #2)
//   - collectTeacherHours: Σ hours × creditFactor (24h/48h/0 decay), pre-
//     activation sessions get full credit regardless of doneAt lateness
//   - collectActualShifts: DISTINCT (date, shiftTemplateId), ticket-approved
//     credits every shift that day, adjacent-shift punches not reused,
//     span<50% flag
//   - refreshKpiScore: target GĐ/super_admin → BAD_REQUEST

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import {
  collectActualShifts,
  collectSaleRevenue,
  collectTeacherHours,
  computeKpiValue,
  refreshKpiScore,
  resolveKpiTargetRole,
  submitSlipOpensAt,
} from './auto-score.js';
import {
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  seedClassBatch,
  testDbBypass,
} from '../test/db.js';

// ---------------------------------------------------------------------------
// computeKpiValue — pure formula, no DB
// ---------------------------------------------------------------------------

describe('computeKpiValue', () => {
  it('0% shift or 0% metric → value 0', () => {
    expect(
      computeKpiValue({ shiftActual: 0, shiftRequired: 20, metricValue: 100, metricRequired: 100, unitRate: 1_000_000 }),
    ).toBe(0);
    expect(
      computeKpiValue({ shiftActual: 20, shiftRequired: 20, metricValue: 0, metricRequired: 100, unitRate: 1_000_000 }),
    ).toBe(0);
  });

  it('50% shift × 50% metric × unitRate = 25% of unitRate', () => {
    const value = computeKpiValue({
      shiftActual: 10,
      shiftRequired: 20,
      metricValue: 50,
      metricRequired: 100,
      unitRate: 1_000_000,
    });
    expect(value).toBe(250_000);
  });

  it('100% shift × 100% metric = full unitRate', () => {
    const value = computeKpiValue({
      shiftActual: 20,
      shiftRequired: 20,
      metricValue: 100,
      metricRequired: 100,
      unitRate: 1_000_000,
    });
    expect(value).toBe(1_000_000);
  });

  it('caps each percentage at 100% — overachieving does not exceed unitRate', () => {
    const value = computeKpiValue({
      shiftActual: 40, // 200% of required
      shiftRequired: 20,
      metricValue: 300, // 300% of required
      metricRequired: 100,
      unitRate: 1_000_000,
    });
    expect(value).toBe(1_000_000);
  });

  it('shiftRequired or metricRequired of 0/undefined → that percentage is 0, never div-by-zero', () => {
    expect(
      computeKpiValue({ shiftActual: 10, shiftRequired: 0, metricValue: 100, metricRequired: 100, unitRate: 1_000_000 }),
    ).toBe(0);
    expect(
      computeKpiValue({ shiftActual: 10, shiftRequired: 20, metricValue: 100, metricRequired: 0, unitRate: 1_000_000 }),
    ).toBe(0);
  });

  it('rounds half-up to whole VND (R3-13 precision contract)', () => {
    // 1/3 × 100% × 100_000 = 33_333.33... -> 33_333
    const value = computeKpiValue({
      shiftActual: 1,
      shiftRequired: 3,
      metricValue: 100,
      metricRequired: 100,
      unitRate: 100_000,
    });
    expect(value).toBe(33_333);
  });

  it('clamps negative shiftActual to 0 (corrupted upstream data guard)', () => {
    const value = computeKpiValue({
      shiftActual: -5, // negative input
      shiftRequired: 20,
      metricValue: 100,
      metricRequired: 100,
      unitRate: 1_000_000,
    });
    expect(value).toBe(0); // clamped to 0, shiftPct becomes 0
  });

  it('clamps negative metricValue to 0 (corrupted upstream data guard)', () => {
    const value = computeKpiValue({
      shiftActual: 20,
      shiftRequired: 20,
      metricValue: -50, // negative input
      metricRequired: 100,
      unitRate: 1_000_000,
    });
    expect(value).toBe(0); // clamped to 0, metricPct becomes 0
  });

  it('clamps both negative shiftActual and metricValue to 0', () => {
    const value = computeKpiValue({
      shiftActual: -10,
      shiftRequired: 20,
      metricValue: -100,
      metricRequired: 100,
      unitRate: 1_000_000,
    });
    expect(value).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// submitSlipOpensAt — guard boundary (day 3 of next month ICT)
// ---------------------------------------------------------------------------

describe('submitSlipOpensAt', () => {
  it('returns the ICT midnight instant of day 3 of the FOLLOWING month', () => {
    // For period '2026-07', the guard opens on 2026-08-03 00:00 ICT
    const openAt = submitSlipOpensAt('2026-07');
    const dateOnly = ictDateOnlyOf(openAt);
    expect(dateOnly).toBe('2026-08-03');
  });

  it('handles December -> January year rollover', () => {
    // For period '2026-12', the guard opens on 2027-01-03 00:00 ICT
    const openAt = submitSlipOpensAt('2026-12');
    const dateOnly = ictDateOnlyOf(openAt);
    expect(dateOnly).toBe('2027-01-03');
  });

  it('throws RangeError on malformed period format', () => {
    expect(() => submitSlipOpensAt('2026-7')).toThrow(RangeError); // single-digit month
    expect(() => submitSlipOpensAt('not-a-period')).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// resolveKpiTargetRole — target role discriminator
// ---------------------------------------------------------------------------

describe('resolveKpiTargetRole', () => {
  it('returns sale when roles include sale', () => {
    expect(resolveKpiTargetRole(['sale'])).toBe('sale');
  });

  it('returns giao_vien when roles include giao_vien', () => {
    expect(resolveKpiTargetRole(['giao_vien'])).toBe('giao_vien');
  });

  it('prefers sale when both sale and giao_vien are present (documented precedence)', () => {
    // sale is checked first in the implementation, so it takes precedence
    expect(resolveKpiTargetRole(['sale', 'giao_vien'])).toBe('sale');
  });

  it('returns null for director/super_admin roles (no KPI slip)', () => {
    expect(resolveKpiTargetRole(['giam_doc_kinh_doanh'])).toBeNull();
    expect(resolveKpiTargetRole(['giam_doc_dao_tao'])).toBeNull();
    expect(resolveKpiTargetRole(['super_admin'])).toBeNull();
  });

  it('returns null for empty roles array', () => {
    expect(resolveKpiTargetRole([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Collectors — integration against the real dev Postgres
// ---------------------------------------------------------------------------

describe('auto-score collectors', () => {
  let facilityId: string;

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  // -------------------------------------------------------------------------
  // collectSaleRevenue
  // -------------------------------------------------------------------------

  describe('collectSaleRevenue', () => {
    const PERIOD = '2099-07';
    let saleAppUserId: string;
    let otherAppUserId: string;

    beforeEach(async () => {
      const facility = await createTestFacility('AutoScore-Sale-Facility');
      facilityId = facility.id;
      const sale = await seedAppUser({ facilityId, userId: 'auto-score-sale-001', position: 'sale' });
      saleAppUserId = sale.id;
      const other = await seedAppUser({ facilityId, userId: 'auto-score-sale-other-001', position: 'sale' });
      otherAppUserId = other.id;
    });

    async function seedReceipt(opts: {
      netAmount: number;
      status: 'draft' | 'approved';
      createdByAppUserId: string | null;
      approvedAt: Date | null;
    }): Promise<void> {
      await testDbBypass((tx) =>
        tx.receipt.create({
          data: {
            facilityId,
            code: `RCP-${randomUUID().slice(0, 8)}`,
            netAmount: opts.netAmount,
            status: opts.status,
            parentPhone: '0900000000',
            studentName: 'Auto Score Test',
            createdById: 'legacy-userid-namespace', // deliberately NOT matching createdByAppUserId
            createdByAppUserId: opts.createdByAppUserId,
            approvedAt: opts.approvedAt,
          },
        }),
      );
    }

    it('sums approved receipts attributed via createdByAppUserId within the ICT period', async () => {
      await seedReceipt({
        netAmount: 4_000_000,
        status: 'approved',
        createdByAppUserId: saleAppUserId,
        approvedAt: ictToUtc('2099-07-15', '10:00'),
      });
      await seedReceipt({
        netAmount: 2_500_000,
        status: 'approved',
        createdByAppUserId: saleAppUserId,
        approvedAt: ictToUtc('2099-07-20', '10:00'),
      });

      const revenue = await testDbBypass((tx) => collectSaleRevenue(tx, facilityId, saleAppUserId, PERIOD));
      expect(revenue).toBe(6_500_000);
    });

    it('excludes receipts outside the ICT period and non-approved receipts', async () => {
      await seedReceipt({
        netAmount: 9_000_000,
        status: 'approved',
        createdByAppUserId: saleAppUserId,
        approvedAt: ictToUtc('2099-08-01', '10:00'), // next month — excluded
      });
      await seedReceipt({
        netAmount: 9_000_000,
        status: 'draft', // not approved — excluded
        createdByAppUserId: saleAppUserId,
        approvedAt: null,
      });

      const revenue = await testDbBypass((tx) => collectSaleRevenue(tx, facilityId, saleAppUserId, PERIOD));
      expect(revenue).toBe(0);
    });

    it('never coalesces to the legacy createdById userId namespace (R2 #2)', async () => {
      // Attributed to `otherAppUserId`, NOT `saleAppUserId` — even though
      // `createdById` (legacy userId scalar) is unrelated to either AppUser.
      await seedReceipt({
        netAmount: 5_000_000,
        status: 'approved',
        createdByAppUserId: otherAppUserId,
        approvedAt: ictToUtc('2099-07-10', '10:00'),
      });

      const revenue = await testDbBypass((tx) => collectSaleRevenue(tx, facilityId, saleAppUserId, PERIOD));
      expect(revenue).toBe(0);
    });

    it('returns 0 (not throw) when createdByAppUserId is null (unattributed legacy row)', async () => {
      await seedReceipt({
        netAmount: 5_000_000,
        status: 'approved',
        createdByAppUserId: null,
        approvedAt: ictToUtc('2099-07-10', '10:00'),
      });

      const revenue = await testDbBypass((tx) => collectSaleRevenue(tx, facilityId, saleAppUserId, PERIOD));
      expect(revenue).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // collectTeacherHours
  // -------------------------------------------------------------------------

  describe('collectTeacherHours', () => {
    let teacherAppUserId: string;

    beforeEach(async () => {
      const facility = await createTestFacility('AutoScore-Teacher-Facility');
      facilityId = facility.id;
      const teacher = await seedAppUser({ facilityId, userId: 'auto-score-gv-001', position: 'giao_vien' });
      teacherAppUserId = teacher.id;
    });

    async function seedDoneSession(opts: {
      classBatchId: string;
      sessionDate: Date;
      startTime: Date;
      endTime: Date;
      doneAt: Date;
    }): Promise<void> {
      await testDbBypass((tx) =>
        tx.classSession.create({
          data: {
            facilityId,
            classBatchId: opts.classBatchId,
            sessionDate: opts.sessionDate,
            startTime: opts.startTime,
            endTime: opts.endTime,
            status: 'done',
            doneAt: opts.doneAt,
          },
        }),
      );
    }

    it('sums (endTime-startTime) hours × creditFactor for done sessions this ICT month', async () => {
      const batch = await seedClassBatch({ facilityId, startDate: '2099-09-01', endDate: '2099-09-30' });
      await testDbBypass((tx) =>
        tx.classBatch.update({ where: { id: batch.id }, data: { teacherAppUserId } }),
      );

      // 2h session, marked done 1h after endTime (within 24h -> factor 1.0).
      const start = ictToUtc('2099-09-10', '08:00');
      const end = ictToUtc('2099-09-10', '10:00');
      await seedDoneSession({
        classBatchId: batch.id,
        sessionDate: ictToUtc('2099-09-10', '00:00'),
        startTime: start,
        endTime: end,
        doneAt: new Date(end.getTime() + 1 * 60 * 60 * 1000),
      });

      const hours = await testDbBypass((tx) => collectTeacherHours(tx, facilityId, teacherAppUserId, '2099-09'));
      expect(hours).toBe(2);
    });

    it('applies creditFactor decay: <=24h full, <=48h half, >48h zero', async () => {
      const batch = await seedClassBatch({ facilityId, startDate: '2099-10-01', endDate: '2099-10-31' });
      await testDbBypass((tx) =>
        tx.classBatch.update({ where: { id: batch.id }, data: { teacherAppUserId } }),
      );

      const dayEnd = (day: string) => ictToUtc(day, '10:00');

      // Session 1: 2h, done 23h late -> factor 1.0 -> 2h credit
      await seedDoneSession({
        classBatchId: batch.id,
        sessionDate: ictToUtc('2099-10-05', '00:00'),
        startTime: ictToUtc('2099-10-05', '08:00'),
        endTime: dayEnd('2099-10-05'),
        doneAt: new Date(dayEnd('2099-10-05').getTime() + 23 * 60 * 60 * 1000),
      });
      // Session 2: 2h, done 36h late -> factor 0.5 -> 1h credit
      await seedDoneSession({
        classBatchId: batch.id,
        sessionDate: ictToUtc('2099-10-06', '00:00'),
        startTime: ictToUtc('2099-10-06', '08:00'),
        endTime: dayEnd('2099-10-06'),
        doneAt: new Date(dayEnd('2099-10-06').getTime() + 36 * 60 * 60 * 1000),
      });
      // Session 3: 2h, done 49h late -> factor 0 -> 0h credit
      await seedDoneSession({
        classBatchId: batch.id,
        sessionDate: ictToUtc('2099-10-07', '00:00'),
        startTime: ictToUtc('2099-10-07', '08:00'),
        endTime: dayEnd('2099-10-07'),
        doneAt: new Date(dayEnd('2099-10-07').getTime() + 49 * 60 * 60 * 1000),
      });

      const hours = await testDbBypass((tx) => collectTeacherHours(tx, facilityId, teacherAppUserId, '2099-10'));
      expect(hours).toBe(3); // 2 + 1 + 0
    });

    it('pre-activation sessions (endTime before SESSION_DONE_ACTIVATED_AT) get full credit regardless of doneAt lateness', async () => {
      const batch = await seedClassBatch({ facilityId, startDate: '2026-06-01', endDate: '2026-06-30' });
      await testDbBypass((tx) =>
        tx.classBatch.update({ where: { id: batch.id }, data: { teacherAppUserId } }),
      );

      const start = ictToUtc('2026-06-10', '08:00');
      const end = ictToUtc('2026-06-10', '10:00'); // well before SESSION_DONE_ACTIVATED_AT (2026-07-12)
      await seedDoneSession({
        classBatchId: batch.id,
        sessionDate: ictToUtc('2026-06-10', '00:00'),
        startTime: start,
        endTime: end,
        // doneAt is 10 days late — would be factor 0 post-activation, but
        // pre-activation credit is unconditional.
        doneAt: new Date(end.getTime() + 10 * 24 * 60 * 60 * 1000),
      });

      const hours = await testDbBypass((tx) => collectTeacherHours(tx, facilityId, teacherAppUserId, '2026-06'));
      expect(hours).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // collectActualShifts
  // -------------------------------------------------------------------------

  describe('collectActualShifts', () => {
    const PERIOD = '2099-11';
    let gvAppUserId: string;
    let gvGroupId: string;
    let ca1Id: string;
    let ca2Id: string;

    beforeEach(async () => {
      const facility = await createTestFacility('AutoScore-Shifts-Facility');
      facilityId = facility.id;
      const gv = await seedAppUser({ facilityId, userId: 'auto-score-shift-gv-001', position: 'giao_vien' });
      gvAppUserId = gv.id;

      const group = await testDbBypass((tx) =>
        tx.shiftGroup.create({
          data: { facilityId, name: `GV Group ${randomUUID().slice(0, 6)}`, type: 'GIAO_VIEN', selectionMode: 'MULTIPLE' },
        }),
      );
      gvGroupId = group.id;
      ca1Id = (
        await testDbBypass((tx) =>
          tx.shiftTemplate.create({ data: { facilityId, shiftGroupId: group.id, name: 'Ca 1', startTime: '08:00', endTime: '12:00' } }),
        )
      ).id;
      ca2Id = (
        await testDbBypass((tx) =>
          tx.shiftTemplate.create({ data: { facilityId, shiftGroupId: group.id, name: 'Ca 2', startTime: '13:00', endTime: '17:00' } }),
        )
      ).id;
    });

    async function seedApprovedRegistration(dateOnly: string, templateIds: string[]): Promise<string> {
      const reg = await testDbBypass((tx) =>
        tx.shiftRegistration.create({
          data: {
            facilityId,
            appUserId: gvAppUserId,
            shiftGroupId: gvGroupId,
            fromDate: ictToUtc(dateOnly, '00:00'),
            toDate: ictToUtc(dateOnly, '00:00'),
            status: 'approved',
            selectionMode: 'MULTIPLE',
          },
        }),
      );
      for (const templateId of templateIds) {
        await testDbBypass((tx) =>
          tx.shiftRegistrationEntry.create({
            data: { facilityId, shiftRegistrationId: reg.id, date: ictToUtc(dateOnly, '00:00'), shiftTemplateId: templateId },
          }),
        );
      }
      return reg.id;
    }

    async function punch(dateOnly: string, time: string): Promise<void> {
      await testDbBypass((tx) =>
        tx.timePunch.create({
          data: { facilityId, appUserId: gvAppUserId, method: 'ip', punchAt: ictToUtc(dateOnly, time) },
        }),
      );
    }

    it('counts a fully-punched shift once', async () => {
      const date = '2099-11-05';
      await seedApprovedRegistration(date, [ca1Id]);
      await punch(date, '07:55');
      await punch(date, '12:05');

      const result = await testDbBypass((tx) => collectActualShifts(tx, facilityId, gvAppUserId, PERIOD));
      expect(result.shiftActual).toBe(1);
    });

    it('duplicate (date, shiftTemplateId) entries collapse to DISTINCT 1 (R3-8)', async () => {
      const date = '2099-11-06';
      // Two separate registrations both register ca1 on the same date.
      await seedApprovedRegistration(date, [ca1Id]);
      await seedApprovedRegistration(date, [ca1Id]);
      await punch(date, '07:55');
      await punch(date, '12:05');

      const result = await testDbBypass((tx) => collectActualShifts(tx, facilityId, gvAppUserId, PERIOD));
      expect(result.shiftActual).toBe(1);
    });

    it('registered but not punched → not counted (absent)', async () => {
      const date = '2099-11-07';
      await seedApprovedRegistration(date, [ca1Id]);
      // No punches at all.

      const result = await testDbBypass((tx) => collectActualShifts(tx, facilityId, gvAppUserId, PERIOD));
      expect(result.shiftActual).toBe(0);
    });

    it('ADR 0043 — a ticket-approved day with frozen hours covering both shifts credits both', async () => {
      const date = '2099-11-08';
      await seedApprovedRegistration(date, [ca1Id, ca2Id]);
      // Frozen hours must actually cover the shifts to credit them (R1/E3) —
      // an approved ticket with no checkInAt/checkOutAt credits nothing
      // (structurally impossible from the real checkInOut.punch flow, which
      // always populates these; a bare status:'approved' with null hours,
      // as this test used to seed pre-0043, is no longer a valid fixture).
      await testDbBypass((tx) =>
        tx.manualAttendanceTicket.create({
          data: {
            facilityId,
            appUserId: gvAppUserId,
            ticketDate: ictToUtc(date, '00:00'),
            status: 'approved',
            checkInAt: ictToUtc(date, '08:00'),
            checkOutAt: ictToUtc(date, '17:00'),
          },
        }),
      );

      const result = await testDbBypass((tx) => collectActualShifts(tx, facilityId, gvAppUserId, PERIOD));
      expect(result.shiftActual).toBe(2);
    });

    it('ADR 0043 — 2 shifts/day, checkin=day\'s first punch + checkout=day\'s last punch overlap both → both credited', async () => {
      const date = '2099-11-09';
      await seedApprovedRegistration(date, [ca1Id, ca2Id]);
      // Day-level pairing (not per-shift, ADR 0043 §1): checkin=07:55 (first),
      // checkout=17:05 (last) — a window wide enough to overlap both ca1 and
      // ca2, so both are credited even though the middle 2 punches (12:00,
      // 13:00) are not separately used for anything.
      await punch(date, '07:55');
      await punch(date, '12:00');
      await punch(date, '13:00');
      await punch(date, '17:05');

      const result = await testDbBypass((tx) => collectActualShifts(tx, facilityId, gvAppUserId, PERIOD));
      expect(result.shiftActual).toBe(2);
    });

    it('ADR 0043 — a cặp vào/ra that only overlaps ONE of two registered shifts credits only that one (E3)', async () => {
      const date = '2099-11-10';
      await seedApprovedRegistration(date, [ca1Id, ca2Id]); // ca1 08-12, ca2 13-17
      // checkin=13:50 (after ca1 already ended) → ca1 not credited; checkout=16:10 → ca2 credited.
      await punch(date, '13:50');
      await punch(date, '16:10');

      const result = await testDbBypass((tx) => collectActualShifts(tx, facilityId, gvAppUserId, PERIOD));
      expect(result.shiftActual).toBe(1);
    });

    // ADR 0043 R5 (accepted risk, plan.md Edge Case Ledger): the `shortSpan`
    // anti-gaming flag (<50% of nominal shift duration) has no equivalent in
    // the day-level in/out pairing model and was removed entirely — a
    // checkin+checkout pair ~10s apart (past the cooldown) now credits the
    // shift with no flag raised. Deliberate simplification, not an oversight
    // — see plan.md "Open Questions" for the accepted trade-off.
  });

  // -------------------------------------------------------------------------
  // refreshKpiScore — target role guard
  // -------------------------------------------------------------------------

  describe('refreshKpiScore', () => {
    beforeEach(async () => {
      const facility = await createTestFacility('AutoScore-Refresh-Facility');
      facilityId = facility.id;
    });

    it('target role GĐ/super_admin → BAD_REQUEST (no KPI slip for directors)', async () => {
      const director = await seedAppUser({ facilityId, userId: 'auto-score-gd-001', position: 'giam_doc_kinh_doanh' });

      await expect(
        testDbBypass((tx) =>
          refreshKpiScore(tx, {
            facilityId,
            appUserId: director.id,
            roles: ['giam_doc_kinh_doanh'],
            period: '2099-12',
          }),
        ),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });
});
