// WF-P2-01 / US-011 integration tests: classBatch.create auto-generates
// ClassSession rows in one transaction; schedule.generateSessions re-runs
// idempotently; the class-code format + atomic counter; room+time conflict;
// the P1<->P2 seam (finance.receiptCreate / enrollment.enroll now require a
// real, same-facility ClassBatch); reserved-hold -> active with a real class;
// RLS isolation; and ICT timestamptz storage.
//
// Covers plan edge-case groups 1-8 (see
// plans/260706-1703-p2-foundation-class-ops/plan.md) -- group 9 (migration
// greenfield: the FK on Receipt/Enrollment.classBatchId) is exercised
// implicitly by every seam test here rejecting a non-real classBatchId.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withFacility } from '@cmc/db';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedClassBatch,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('classBatch.create / schedule.generateSessions (WF-P2-01, US-011)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let sale: Caller;
  let courseId: string;

  beforeEach(async () => {
    facility = await createTestFacility('Class Ops Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-class-1', roles: ['giam_doc_dao_tao'] }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-class-1', roles: ['sale'] }),
    );
    const course = await gddt.course.create({ program: 'UCREA', name: 'UCREA Level 1' });
    courseId = course.id;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  // ---- Edge case 1: auto-session count ----

  it('generates one ClassSession per (date x slot) match in [startDate, endDate] -- edge case 1', async () => {
    const result = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03', // Monday
      endDate: '2026-08-16', // 2 weeks later, Sunday
      slots: [
        { weekday: 1, startTime: '18:00', endTime: '19:30' }, // Monday
        { weekday: 3, startTime: '18:00', endTime: '19:30' }, // Wednesday
      ],
    });

    // 2 Mondays (Aug 3, 10) + 2 Wednesdays (Aug 5, 12) = 4 sessions.
    expect(result.sessionsCreated).toBe(4);
    expect(result.slotsCreated).toBe(2);

    const sessions = await testDbBypass((tx) =>
      tx.classSession.findMany({ where: { classBatchId: result.classBatch.id } }),
    );
    expect(sessions).toHaveLength(4);
  });

  it('Low-Severity Hygiene remediation (scenario audit): rejects more than 20 slots with BAD_REQUEST (resource guard)', async () => {
    const tooManySlots = Array.from({ length: 21 }, (_, i) => ({
      weekday: i % 7,
      startTime: '06:00',
      endTime: '06:30',
    }));
    await expect(
      gddt.classBatch.create({
        courseId,
        startDate: '2026-08-03',
        endDate: '2026-08-03',
        slots: tooManySlots,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects startDate > endDate with BAD_REQUEST -- edge case 1', async () => {
    await expect(
      gddt.classBatch.create({
        courseId,
        startDate: '2026-08-10',
        endDate: '2026-08-01',
        slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('a range with no weekday match generates 0 sessions (no warning field, just an empty result) -- edge case 1', async () => {
    const result = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-04', // Tuesday
      endDate: '2026-08-04',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }], // Monday only
    });
    expect(result.sessionsCreated).toBe(0);
  });

  // ---- Edge case 2: re-generate idempotent ----

  it('schedule.generateSessions re-run is idempotent: no duplicate sessions -- edge case 2', async () => {
    const created = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    expect(created.sessionsCreated).toBe(1);

    const regen = await gddt.schedule.generateSessions({ classBatchId: created.classBatch.id });
    expect(regen.sessionsCreated).toBe(0);

    const total = await testDbBypass((tx) =>
      tx.classSession.count({ where: { classBatchId: created.classBatch.id } }),
    );
    expect(total).toBe(1);
  });

  it('schedule.generateSessions adds only the new sessions when the range is extended -- edge case 2', async () => {
    const created = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    expect(created.sessionsCreated).toBe(1);

    // Mondays in the extended range (Aug 3..17): Aug 3 (existing), 10, 17 -- 2 new.
    const regen = await gddt.schedule.generateSessions({
      classBatchId: created.classBatch.id,
      endDate: '2026-08-17',
    });
    expect(regen.sessionsCreated).toBe(2);

    const total = await testDbBypass((tx) =>
      tx.classSession.count({ where: { classBatchId: created.classBatch.id } }),
    );
    expect(total).toBe(3);
  });

  // ---- Edge case 3: class-code format + atomic counter ----

  it('code format is {facility.code}-{program}-{year}-{seq} (QD 0036) -- edge case 3', async () => {
    const result = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    const facilityRow = await testDb().facility.findUniqueOrThrow({ where: { id: facility.id } });
    expect(result.classBatch.code).toBe(`${facilityRow.code}-UCREA-2026-001`);
  });

  it('atomic counter: concurrent classBatch.create calls never produce duplicate codes -- edge case 3', async () => {
    const [a, b] = await Promise.all([
      gddt.classBatch.create({
        courseId,
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        slots: [{ weekday: 2, startTime: '18:00', endTime: '19:00' }],
      }),
      gddt.classBatch.create({
        courseId,
        startDate: '2026-09-02',
        endDate: '2026-09-02',
        slots: [{ weekday: 3, startTime: '18:00', endTime: '19:00' }],
      }),
    ]);
    expect(a.classBatch.code).not.toBe(b.classBatch.code);
    expect(new Set([a.classBatch.code, b.classBatch.code]).size).toBe(2);
  });

  // ---- Edge case 4: room+time conflict ----

  it('two classes in the same room with an overlapping time -> CONFLICT -- edge case 4', async () => {
    const room = await gddt.room.create({ code: 'R101', name: 'Room 101' });
    await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      roomId: room.id,
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });

    await expect(
      gddt.classBatch.create({
        courseId,
        startDate: '2026-08-03',
        endDate: '2026-08-03',
        roomId: room.id,
        slots: [{ weekday: 1, startTime: '19:00', endTime: '20:00' }], // overlaps 18:00-19:30
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('two classes in the same room with a back-to-back (non-overlapping) time succeed -- edge case 4', async () => {
    const room = await gddt.room.create({ code: 'R102', name: 'Room 102' });
    await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      roomId: room.id,
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:00' }],
    });

    const second = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      roomId: room.id,
      slots: [{ weekday: 1, startTime: '19:00', endTime: '20:00' }],
    });
    expect(second.sessionsCreated).toBe(1);
  });

  it('schedule.generateSessions enforces the room conflict on extend -- G1 review M1', async () => {
    const room = await gddt.room.create({ code: 'R201', name: 'Room 201' });
    // Class A holds the room on 2026-08-10 (Mon) 18:00-19:30.
    await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      roomId: room.id,
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    // Class B initially only 2026-08-03 (Mon) -- no conflict at create time.
    const b = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      roomId: room.id,
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    // Extending B to 2026-08-10 collides with class A in the same room.
    await expect(
      gddt.schedule.generateSessions({ classBatchId: b.classBatch.id, endDate: '2026-08-10' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects a class span beyond the day limit with BAD_REQUEST -- G1 review M2', async () => {
    await expect(
      gddt.classBatch.create({
        courseId,
        startDate: '2026-01-01',
        endDate: '2030-01-01', // ~4 years > MAX_CLASS_SPAN_DAYS
        slots: [{ weekday: 1, startTime: '18:00', endTime: '19:00' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ---- Edge case 5: seam validation (receiptCreate / enroll) ----

  it('seam: receiptCreate rejects an unknown classBatchId with NOT_FOUND -- edge case 5', async () => {
    await expect(
      sale.finance.receiptCreate({
        studentName: 'Seam Student',
        parentPhone: '0900555001',
        amount: 1_000_000,
        classBatchId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('seam: enrollment.enroll rejects an unknown classBatchId with NOT_FOUND -- edge case 5', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Seam Enroll Student' } }),
    );
    await expect(
      sale.enrollment.enroll({ studentId: student.id, classBatchId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('seam: receiptCreate/enroll reject a cross-facility classBatchId with NOT_FOUND -- edge case 5', async () => {
    const otherFacility = await createTestFacility('Other Class Ops Facility');
    const otherClassBatch = await seedClassBatch({ facilityId: otherFacility.id });

    await expect(
      sale.finance.receiptCreate({
        studentName: 'Cross Facility Seam',
        parentPhone: '0900555002',
        amount: 1_000_000,
        classBatchId: otherClassBatch.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Cross Seam Student' } }),
    );
    await expect(
      sale.enrollment.enroll({ studentId: student.id, classBatchId: otherClassBatch.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await cleanupFacility(otherFacility.id);
  });

  it('seam: receiptCreate/enroll accept a valid, same-facility classBatchId -- edge case 5', async () => {
    const classBatch = await seedClassBatch({ facilityId: facility.id });
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Valid Seam Student' } }),
    );

    const enrollment = await sale.enrollment.enroll({ studentId: student.id, classBatchId: classBatch.id });
    expect(enrollment.status).toBe('reserved');

    const receipt = await sale.finance.receiptCreate({
      studentName: 'Valid Seam Student',
      parentPhone: '0900555004',
      amount: 1_000_000,
      classBatchId: classBatch.id,
    });
    expect(receipt.status === 'success' || receipt.status === 'warning').toBe(true);
  });

  // ---- Edge case 6: reserved-hold operable end-to-end ----

  it('enroll (reserved) into a real class, then receiptApprove flips it to active -- edge case 6', async () => {
    const classBatch = await seedClassBatch({ facilityId: facility.id });
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Reserved Hold Student' } }),
    );

    const enrollment = await sale.enrollment.enroll({ studentId: student.id, classBatchId: classBatch.id });
    expect(enrollment.status).toBe('reserved');

    const gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-seam-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    const receipt = await gdkd.finance.receiptCreate({
      studentId: student.id,
      studentName: 'Reserved Hold Student',
      parentPhone: '0900555003',
      amount: 2_000_000,
      classBatchId: classBatch.id,
    });
    if (receipt.status !== 'success' && receipt.status !== 'warning') {
      throw new Error('expected receiptCreate to succeed');
    }
    await gdkd.finance.receiptApprove({ receiptId: receipt.receipt.id });

    const activated = await testDbBypass((tx) =>
      tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
    );
    expect(activated.status).toBe('active');
  });

  // ---- Edge case 7: RLS ----

  it('RLS: facility B cannot see, get, or list facility A\'s class -- app-level and DB-level -- edge case 7', async () => {
    const facilityB = await createTestFacility('Other RLS Class Facility');
    const gddtB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'gddt-classB-1', roles: ['giam_doc_dao_tao'] }),
    );
    const classBatch = await seedClassBatch({ facilityId: facility.id });

    // App-level (scoped(ctx) + tRPC procedure): facility B never sees it.
    await expect(gddtB.classBatch.get({ classBatchId: classBatch.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const listB = await gddtB.classBatch.list({});
    expect(listB.items.some((c) => c.id === classBatch.id)).toBe(false);

    // DB-level negative (app-filter removed): RLS rejects a raw query with no
    // facilityId predicate at all, same acceptance shape as
    // ../security/rls-enforcement.test.ts.
    const rows = await withFacility(testDb(), facilityB.id, (tx) =>
      tx.classBatch.findMany({ where: { id: classBatch.id } }),
    );
    expect(rows).toHaveLength(0);

    await cleanupFacility(facilityB.id);
  });

  it('RLS: facility B cannot create a class referencing facility A\'s Course (NOT_FOUND, not a cross-facility write)', async () => {
    const facilityB = await createTestFacility('Other RLS Course Facility');
    const gddtB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'gddt-classB-2', roles: ['giam_doc_dao_tao'] }),
    );

    await expect(
      gddtB.classBatch.create({
        courseId,
        startDate: '2026-08-03',
        endDate: '2026-08-03',
        slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await cleanupFacility(facilityB.id);
  });

  // ---- Edge case 8: timestamptz / ICT ----

  it('ClassSession start/end are stored as the correct UTC instant for the ICT wall-clock supplied -- edge case 8', async () => {
    const created = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      slots: [{ weekday: 1, startTime: '08:00', endTime: '09:30' }],
    });
    const session = await testDbBypass((tx) =>
      tx.classSession.findFirstOrThrow({ where: { classBatchId: created.classBatch.id } }),
    );
    // 08:00/09:30 ICT (UTC+7) == 01:00/02:30 UTC.
    expect(session.startTime.toISOString()).toBe('2026-08-03T01:00:00.000Z');
    expect(session.endTime.toISOString()).toBe('2026-08-03T02:30:00.000Z');
  });

  // ---- Permission gate ----

  it('forbids a role without class.create permission', async () => {
    await expect(
      sale.classBatch.create({
        courseId,
        startDate: '2026-08-03',
        endDate: '2026-08-03',
        slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('course.list paginates the facility-scoped course catalog', async () => {
    const { items, total } = await gddt.course.list({});
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items.some((c) => c.id === courseId)).toBe(true);
  });

  it('room.list paginates the facility-scoped room catalog', async () => {
    const room = await gddt.room.create({ code: 'R900', name: 'Room 900' });
    const { items, total } = await gddt.room.list({});
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items.some((r) => r.id === room.id)).toBe(true);
  });
});
