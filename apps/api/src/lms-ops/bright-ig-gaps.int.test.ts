// Integration: teaching spine on Bright I.G with intentional order_global gaps
// (40 / 44 / 48 / 52 / 56 missing — labels, not units).
//
// Proves gap-aware restamp, package grant, dual-gate roster, and cancel+restamp
// survive the real framework axis after the 96-unit catalog import. Complements
// pure domain tests in packages/domain-lms (unit-progression.test.ts) with the
// full lmsOps / grantUnitsFromReceipt / classSession.cancel stack.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  realOrdersInRange,
  remainingUnits,
  toProgramUnitAxis,
} from '@cmc/domain-lms';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupFacility,
  createTestFacility,
  seedActiveEnrollment,
  seedCurriculumUnit,
  testDb,
  testDbBypass,
} from '../test/db.js';
import { grantUnitsFromReceipt } from './grant-units.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

/** Framework gaps preserved from CMC_EDU_Khung_Chuong_Trinh.csv (Bright I.G). */
const BRIGHT_IG_GAPS = new Set([40, 44, 48, 52, 56]);

/** Real order_global spine: 37–59 minus gaps → 18 units. */
const BRIGHT_AXIS = toProgramUnitAxis(
  Array.from({ length: 59 - 37 + 1 }, (_, i) => 37 + i).filter((o) => !BRIGHT_IG_GAPS.has(o)),
);

describe('Bright I.G gapped order_global teaching spine (lmsOps integration)', () => {
  let facility: { id: string };
  let gddt: Caller;
  /** Only units created by this suite — never delete pre-seeded catalog rows. */
  let ownedUnitIds: string[] = [];
  let unitIdByOrder: Map<number, string>;
  let courseId: string;

  async function ensureBrightUnit(orderGlobal: number): Promise<{ id: string; orderGlobal: number }> {
    const existing = await testDb().curriculumUnit.findUnique({
      where: { program_orderGlobal: { program: 'BRIGHT_IG', orderGlobal } },
      select: { id: true, orderGlobal: true },
    });
    if (existing) return existing;

    const created = await seedCurriculumUnit({
      program: 'BRIGHT_IG',
      orderGlobal,
      level: 'J',
      monthIndex: Math.max(1, BRIGHT_AXIS.indexOf(orderGlobal) + 1),
      title: `Bright I.G order ${orderGlobal}`,
    });
    ownedUnitIds.push(created.id);
    return created;
  }

  beforeEach(async () => {
    facility = await createTestFacility('Bright IG Gaps Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'gddt-bright-gaps-1',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    ownedUnitIds = [];

    // Materialize full real axis (and assert gap labels stay absent).
    unitIdByOrder = new Map();
    for (const order of BRIGHT_AXIS) {
      const u = await ensureBrightUnit(order);
      unitIdByOrder.set(order, u.id);
    }
    for (const gap of BRIGHT_IG_GAPS) {
      const poison = await testDb().curriculumUnit.findUnique({
        where: { program_orderGlobal: { program: 'BRIGHT_IG', orderGlobal: gap } },
        select: { id: true },
      });
      expect(poison, `gap order_global ${gap} must not exist as a CurriculumUnit`).toBeNull();
    }
    expect(unitIdByOrder.size).toBe(18);
    expect(BRIGHT_AXIS[0]).toBe(37);
    expect(BRIGHT_AXIS[3]).toBe(41);

    const course = await testDbBypass((tx) =>
      tx.course.create({
        data: {
          facilityId: facility.id,
          program: 'BRIGHT_IG',
          name: 'Bright I.G gap spine course',
        },
      }),
    );
    courseId = course.id;
  });

  afterEach(async () => {
    if (facility?.id) await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...ownedUnitIds);
    ownedUnitIds = [];
  });

  /**
   * 16 Mondays from 2026-09-07 → 2026-12-21: four units × 4 sessions.
   * Neo at order 37 (first real Bright unit).
   */
  async function createBrightClass16Sessions() {
    const startUnitId = unitIdByOrder.get(37)!;
    const result = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId,
      startDate: '2026-09-07',
      endDate: '2026-12-21',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    expect(result.startUnitOrderGlobal).toBe(37);
    expect(result.sessionsCreated).toBeGreaterThanOrEqual(16);
    expect(result.sessionsStamped).toBe(result.sessionsCreated);
    return result;
  }

  async function orderedSessions(classBatchId: string) {
    return testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
        select: {
          id: true,
          status: true,
          curriculumUnitId: true,
          sessionDate: true,
        },
      }),
    );
  }

  it('(1) createClassWithUnits: sessions 13–16 stamp unit 41 (not 40); no null stamps', async () => {
    const created = await createBrightClass16Sessions();
    const ordered = await orderedSessions(created.classBatchId);
    expect(ordered.length).toBeGreaterThanOrEqual(16);

    const first16 = ordered.slice(0, 16);
    expect(first16.every((s) => s.status !== 'cancelled')).toBe(true);
    expect(first16.every((s) => s.curriculumUnitId != null)).toBe(true);

    // 0-based k → unit: 0–3→37, 4–7→38, 8–11→39, 12–15→41 (skip hole 40).
    const expectedOrders = [
      37, 37, 37, 37, // sessions 1–4
      38, 38, 38, 38, // 5–8
      39, 39, 39, 39, // 9–12
      41, 41, 41, 41, // 13–16 — NOT 40
    ];
    for (let i = 0; i < 16; i++) {
      const wantId = unitIdByOrder.get(expectedOrders[i]!)!;
      expect(
        first16[i]!.curriculumUnitId,
        `session index ${i} (1-based ${i + 1}) should be order ${expectedOrders[i]}`,
      ).toBe(wantId);
    }

    // Explicit gap proof: no session stamped to a missing order label.
    for (const s of first16) {
      const order = [...unitIdByOrder.entries()].find(([, id]) => id === s.curriculumUnitId)?.[0];
      expect(order).toBeDefined();
      expect(BRIGHT_IG_GAPS.has(order!)).toBe(false);
    }
  });

  it('(2) package grant of 4 real units spans gap 40 → endpoints 37..41, count 4 not 5', async () => {
    const created = await createBrightClass16Sessions();

    const receipt = await testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facility.id,
          code: `PT-BIG-${Math.random().toString(36).slice(2, 10)}`,
          netAmount: 5_000_000,
          status: 'approved',
          kind: 'new',
          parentPhone: '0961888001',
          studentName: 'Bright Grant Kid',
          classBatchId: created.classBatchId,
          unitCount: 4,
          createdById: 'sale-bright-gaps',
        },
      }),
    );

    const enrollment = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
      studentName: 'Bright Grant Kid',
    });

    const granted = await grantUnitsFromReceipt(testDb(), {
      facilityId: facility.id,
      enrollmentId: enrollment.id,
      receiptId: receipt.id,
      unitCount: 4,
    });
    expect(granted.status).toBe('granted');
    if (granted.status !== 'granted') throw new Error('expected granted');

    // Contiguous-math would yield 37–40 (includes hole). Gap-aware yields 37–41.
    expect(granted.range.fromOrderGlobal).toBe(37);
    expect(granted.range.toOrderGlobal).toBe(41);
    expect(granted.range.toOrderGlobal).not.toBe(40);

    const real = realOrdersInRange(BRIGHT_AXIS, granted.range.fromOrderGlobal, granted.range.toOrderGlobal);
    expect(real).toEqual([37, 38, 39, 41]);
    expect(real).toHaveLength(4);
    // Integer span length is 5 — product must count real units, not labels.
    expect(granted.range.toOrderGlobal - granted.range.fromOrderGlobal + 1).toBe(5);
    expect(remainingUnits([granted.range], 37, BRIGHT_AXIS)).toBe(4);

    // Endpoint-only validation: granting a range that ends ON a hole must fail.
    await expect(
      gddt.lmsOps.addWithUnits({
        enrollmentId: enrollment.id,
        fromOrderGlobal: 42,
        toOrderGlobal: 44, // 44 is a gap label
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('(3) rosterForSession: entitled student on every stamped session; none empty', async () => {
    const created = await createBrightClass16Sessions();
    const enrollment = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
      studentName: 'Bright Roster Kid',
    });

    // Cover first four real units (37..41 spans gap 40).
    await gddt.lmsOps.addWithUnits({
      enrollmentId: enrollment.id,
      fromOrderGlobal: 37,
      toOrderGlobal: 41,
    });

    const ordered = await orderedSessions(created.classBatchId);
    const first16 = ordered.slice(0, 16);
    expect(first16.every((s) => s.curriculumUnitId != null)).toBe(true);

    for (const session of first16) {
      const roster = await gddt.lmsOps.rosterForSession({ classSessionId: session.id });
      expect(
        roster.sessionOrderGlobal,
        `session ${session.id} must expose a real orderGlobal`,
      ).not.toBeNull();
      expect(BRIGHT_IG_GAPS.has(roster.sessionOrderGlobal!)).toBe(false);
      expect(
        roster.students.map((s) => s.studentId),
        `roster must include entitled student on order ${roster.sessionOrderGlobal}`,
      ).toContain(enrollment.studentId);
      expect(roster.students.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('(4) cancel + restamp slides units on gapped axis (no inventing 40)', async () => {
    const created = await createBrightClass16Sessions();
    const before = await orderedSessions(created.classBatchId);
    expect(before.length).toBeGreaterThanOrEqual(16);

    // Pre-cancel: index 4 = unit 38; index 12 = unit 41 (past gap 40).
    expect(before[4]!.curriculumUnitId).toBe(unitIdByOrder.get(38));
    expect(before[12]!.curriculumUnitId).toBe(unitIdByOrder.get(41));

    const first = before[0]!;
    const cancelled = await gddt.classSession.cancel({ sessionId: first.id });
    expect(cancelled.status).toBe('cancelled');

    const live = await testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId: created.classBatchId, status: { not: 'cancelled' } },
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
        select: { id: true, curriculumUnitId: true },
      }),
    );
    expect(live.length).toBe(before.length - 1);
    expect(live.every((s) => s.curriculumUnitId != null)).toBe(true);

    // Old index-4 session slides 38 → 37 after losing one session of the first unit.
    const slidFromSecondUnit = live.find((s) => s.id === before[4]!.id);
    expect(slidFromSecondUnit?.curriculumUnitId).toBe(unitIdByOrder.get(37));

    // Old index-12 (was 41) becomes live k=11 → floor(11/4)=2 → axis[2]=39, not 40.
    const slidAcrossGap = live.find((s) => s.id === before[12]!.id);
    expect(slidAcrossGap?.curriculumUnitId).toBe(unitIdByOrder.get(39));
    expect(slidAcrossGap?.curriculumUnitId).not.toBe(unitIdByOrder.get(41));

    // No live session may point at a gap label (gaps have no unit id; double-check map).
    for (const s of live) {
      const order = [...unitIdByOrder.entries()].find(([, id]) => id === s.curriculumUnitId)?.[0];
      expect(order).toBeDefined();
      expect(BRIGHT_IG_GAPS.has(order!)).toBe(false);
    }

    // First live session still at neo unit 37.
    expect(live[0]!.curriculumUnitId).toBe(unitIdByOrder.get(37));
  });
});
