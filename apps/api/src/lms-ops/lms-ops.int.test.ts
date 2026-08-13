// LMS foundation spike integration: createClassWithUnits + addWithUnits + rosterForSession.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupFacility,
  createTestFacility,
  seedActiveEnrollment,
  seedAppUser,
  seedCurriculumUnit,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('lmsOps foundation spike', () => {
  let facility: { id: string };
  let gddt: Caller;
  let sale: Caller;
  let unitIds: string[] = [];
  let courseId: string;

  beforeEach(async () => {
    facility = await createTestFacility('LmsOps Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'gddt-lmsops-1',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'sale-lmsops-1',
        roles: ['sale'],
      }),
    );

    const u1 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 101, title: 'U1' });
    const u2 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 102, title: 'U2' });
    const u3 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 103, title: 'U3' });
    const u4 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 104, title: 'U4' });
    unitIds = [u1.id, u2.id, u3.id, u4.id];

    const course = await testDbBypass((tx) =>
      tx.course.create({
        data: {
          facilityId: facility.id,
          program: 'UCREA',
          name: 'UCREA test course',
        },
      }),
    );
    courseId = course.id;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...unitIds);
    unitIds = [];
  });

  it('createClassWithUnits stamps every non-cancelled session', async () => {
    // Mon 2026-09-07 through Mon 2026-09-28 — 4 Mondays ⇒ one unit (4 sessions).
    const result = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-09-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });

    expect(result.sessionsCreated).toBeGreaterThanOrEqual(4);
    expect(result.sessionsStamped).toBe(result.sessionsCreated);
    expect(result.startUnitOrderGlobal).toBe(101);

    const sessions = await testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId: result.classBatchId },
        select: { curriculumUnitId: true, status: true },
      }),
    );
    expect(sessions.every((s) => s.curriculumUnitId != null)).toBe(true);
  });

  it('createClassWithUnits copies the class teacher and regenerate does not duplicate day+time', async () => {
    const teacher = await seedAppUser({
      facilityId: facility.id,
      userId: 'lmsops-gv-1',
      position: 'giao_vien',
      roles: ['giao_vien'],
    });
    const result = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-09-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      teacherId: teacher.id,
    });

    const sessions = await testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId: result.classBatchId },
        select: { teacherId: true },
      }),
    );
    expect(sessions.length).toBe(result.sessionsCreated);
    expect(sessions.every((row) => row.teacherId === null)).toBe(true);
    const listed = await gddt.classSession.list({ classBatchId: result.classBatchId });
    expect(listed.every((row) => row.teacherId === teacher.id)).toBe(true);

    const regen = await gddt.schedule.generateSessions({ classBatchId: result.classBatchId });
    expect(regen.sessionsCreated).toBe(0);
    const total = await testDbBypass((tx) =>
      tx.classSession.count({ where: { classBatchId: result.classBatchId } }),
    );
    expect(total).toBe(sessions.length);
  });

  it('roster: range cover/miss; reserved+range never on roster; sale cannot grantUnits', async () => {
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-09-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });

    const sessionUnit3 = await testDbBypass(async (tx) => {
      // Force one session onto unit order 103 for deterministic roster check.
      const s = await tx.classSession.findFirstOrThrow({
        where: { classBatchId: created.classBatchId },
        orderBy: { sessionDate: 'asc' },
      });
      await tx.classSession.update({
        where: { id: s.id },
        data: { curriculumUnitId: unitIds[2]! },
      });
      return s.id;
    });

    const active = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
      studentName: 'Active Kid',
    });

    // reserved + range still not on roster
    const reservedEnroll = await sale.enrollment.enroll({
      studentId: (
        await testDbBypass((tx) =>
          tx.student.create({
            data: { facilityId: facility.id, fullName: 'Reserved Kid' },
          }),
        )
      ).id,
      classBatchId: created.classBatchId,
    });
    await expect(
      gddt.lmsOps.addWithUnits({
        enrollmentId: reservedEnroll.id,
        fromOrderGlobal: 101,
        toOrderGlobal: 104,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    // sale cannot grant
    await expect(
      sale.lmsOps.addWithUnits({
        enrollmentId: active.id,
        fromOrderGlobal: 101,
        toOrderGlobal: 102,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // miss: only units 101-102, session is 103
    await gddt.lmsOps.addWithUnits({
      enrollmentId: active.id,
      fromOrderGlobal: 101,
      toOrderGlobal: 102,
    });
    let roster = await gddt.lmsOps.rosterForSession({ classSessionId: sessionUnit3 });
    expect(roster.sessionOrderGlobal).toBe(103);
    expect(roster.students.map((s) => s.studentId)).not.toContain(active.studentId);

    // hit: extend with non-overlapping 103-104
    await gddt.lmsOps.addWithUnits({
      enrollmentId: active.id,
      fromOrderGlobal: 103,
      toOrderGlobal: 104,
    });
    roster = await gddt.lmsOps.rosterForSession({ classSessionId: sessionUnit3 });
    expect(roster.students.map((s) => s.studentId)).toContain(active.studentId);
  });

  it('null session stamp ⇒ empty roster (fail-closed)', async () => {
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-09-14',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    const active = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
    });
    await gddt.lmsOps.addWithUnits({
      enrollmentId: active.id,
      fromOrderGlobal: 101,
      toOrderGlobal: 104,
    });

    const sessionId = await testDbBypass(async (tx) => {
      const s = await tx.classSession.findFirstOrThrow({
        where: { classBatchId: created.classBatchId },
      });
      await tx.classSession.update({
        where: { id: s.id },
        data: { curriculumUnitId: null },
      });
      return s.id;
    });

    const roster = await gddt.lmsOps.rosterForSession({ classSessionId: sessionId });
    expect(roster.sessionOrderGlobal).toBeNull();
    expect(roster.students).toEqual([]);
  });

  it('classSession.cancel unifies with restamp (same path as cancelSessionAndRestamp)', async () => {
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-10-26',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    const ordered = await testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId: created.classBatchId },
        orderBy: { sessionDate: 'asc' },
        select: { id: true, curriculumUnitId: true },
      }),
    );
    expect(ordered.length).toBeGreaterThanOrEqual(8);
    // With 4 sessions/unit: index 4 starts as unit 102 before cancel of first.
    expect(ordered[4]!.curriculumUnitId).toBe(unitIds[1]);

    const first = ordered[0]!;
    const cancelled = await gddt.classSession.cancel({ sessionId: first.id });
    expect(cancelled.status).toBe('cancelled');

    const live = await testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId: created.classBatchId, status: { not: 'cancelled' } },
        orderBy: { sessionDate: 'asc' },
        select: { id: true, curriculumUnitId: true },
      }),
    );
    expect(live.length).toBe(ordered.length - 1);
    expect(live.every((s) => s.curriculumUnitId != null)).toBe(true);
    // Boundary proof: old index-4 session slides 102 → 101 after cancel+restamp.
    const slid = live.find((s) => s.id === ordered[4]!.id);
    expect(slid?.curriculumUnitId).toBe(unitIds[0]);
    expect(live[0]!.curriculumUnitId).toBe(unitIds[0]);
  });

  it('cancelSessionAndRestamp: cancelled session excluded; remaining sessions re-stamped', async () => {
    // 8 Mondays → two units (4 sessions each) when starting at order 101.
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-10-26',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });

    const before = await testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId: created.classBatchId },
        orderBy: { sessionDate: 'asc' },
        select: { id: true, status: true, curriculumUnitId: true, sessionDate: true },
      }),
    );
    expect(before.length).toBeGreaterThanOrEqual(8);

    const first = before[0]!;
    const result = await gddt.lmsOps.cancelSessionAndRestamp({ classSessionId: first.id });
    expect(result.classSessionId).toBe(first.id);
    expect(result.restamped).toBeGreaterThan(0);

    const after = await testDbBypass((tx) =>
      tx.classSession.findMany({
        where: { classBatchId: created.classBatchId },
        orderBy: { sessionDate: 'asc' },
        select: { id: true, status: true, curriculumUnitId: true },
      }),
    );
    const cancelled = after.find((s) => s.id === first.id);
    expect(cancelled?.status).toBe('cancelled');
    // Cancelled sessions keep their prior stamp or null — they are not restamped as active units.
    const live = after.filter((s) => s.status !== 'cancelled');
    expect(live.every((s) => s.curriculumUnitId != null)).toBe(true);
    // After cancel, first live session should still map to start unit (order 101).
    expect(live[0]!.curriculumUnitId).toBe(unitIds[0]);

    await expect(
      gddt.lmsOps.cancelSessionAndRestamp({ classSessionId: first.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('grantPast allows past units; addWithUnits still blocks starts_in_past', async () => {
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[2]!, // start at order 103
      startDate: '2026-09-07',
      endDate: '2026-09-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    const active = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
      studentName: 'Past Grant Kid',
    });

    await expect(
      gddt.lmsOps.addWithUnits({
        enrollmentId: active.id,
        fromOrderGlobal: 101,
        toOrderGlobal: 102,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const past = await gddt.lmsOps.grantPast({
      enrollmentId: active.id,
      fromOrderGlobal: 101,
      toOrderGlobal: 102,
    });
    expect(past.fromOrderGlobal).toBe(101);
    expect(past.toOrderGlobal).toBe(102);

    // Overlap still forbidden on grantPast
    await expect(
      gddt.lmsOps.grantPast({
        enrollmentId: active.id,
        fromOrderGlobal: 102,
        toOrderGlobal: 103,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('revokeFromNext truncates future units; past ranges untouched', async () => {
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-09-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    const active = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
    });
    await gddt.lmsOps.addWithUnits({
      enrollmentId: active.id,
      fromOrderGlobal: 101,
      toOrderGlobal: 104,
    });

    const session103 = await testDbBypass(async (tx) => {
      const s = await tx.classSession.findFirstOrThrow({
        where: { classBatchId: created.classBatchId },
      });
      await tx.classSession.update({
        where: { id: s.id },
        data: { curriculumUnitId: unitIds[2]! },
      });
      return s.id;
    });

    let roster = await gddt.lmsOps.rosterForSession({ classSessionId: session103 });
    expect(roster.students.map((s) => s.studentId)).toContain(active.studentId);

    const rev = await gddt.lmsOps.revokeFromNext({
      enrollmentId: active.id,
      fromOrderGlobal: 103,
    });
    expect(rev.rangesTouched).toBeGreaterThanOrEqual(1);

    const ranges = await testDbBypass((tx) =>
      tx.enrollmentUnitRange.findMany({
        where: { enrollmentId: active.id },
        select: { fromOrderGlobal: true, toOrderGlobal: true },
      }),
    );
    expect(ranges).toEqual([{ fromOrderGlobal: 101, toOrderGlobal: 102 }]);

    roster = await gddt.lmsOps.rosterForSession({ classSessionId: session103 });
    expect(roster.students.map((s) => s.studentId)).not.toContain(active.studentId);
  });

  it('revokeFromNext rejects past subtract when fromOrderGlobal < class current unit', async () => {
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[2]!, // current unit order 103
      startDate: '2026-09-07',
      endDate: '2026-09-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    const active = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
    });
    await gddt.lmsOps.grantPast({
      enrollmentId: active.id,
      fromOrderGlobal: 101,
      toOrderGlobal: 104,
    });

    await expect(
      gddt.lmsOps.revokeFromNext({
        enrollmentId: active.id,
        fromOrderGlobal: 101,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    // Still allowed to cut from current unit forward.
    const rev = await gddt.lmsOps.revokeFromNext({
      enrollmentId: active.id,
      fromOrderGlobal: 103,
    });
    expect(rev.rangesTouched).toBeGreaterThanOrEqual(1);
    const ranges = await testDbBypass((tx) =>
      tx.enrollmentUnitRange.findMany({
        where: { enrollmentId: active.id },
        select: { fromOrderGlobal: true, toOrderGlobal: true },
      }),
    );
    expect(ranges).toEqual([{ fromOrderGlobal: 101, toOrderGlobal: 102 }]);
  });

  it('archiveEnrollment hides student from future sessions; unarchive restores', async () => {
    const created = await gddt.lmsOps.createClassWithUnits({
      courseId,
      startUnitId: unitIds[0]!,
      startDate: '2026-09-07',
      endDate: '2026-09-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    const active = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: created.classBatchId,
    });
    await gddt.lmsOps.addWithUnits({
      enrollmentId: active.id,
      fromOrderGlobal: 101,
      toOrderGlobal: 104,
    });

    // Session far in the future relative to archive day.
    const futureSessionId = await testDbBypass(async (tx) => {
      const s = await tx.classSession.findFirstOrThrow({
        where: { classBatchId: created.classBatchId },
        orderBy: { sessionDate: 'desc' },
      });
      return s.id;
    });

    let roster = await gddt.lmsOps.rosterForSession({ classSessionId: futureSessionId });
    expect(roster.students.map((s) => s.studentId)).toContain(active.studentId);

    // Archive "now" — sessions after today's ICT day drop off roster.
    await gddt.lmsOps.archiveEnrollment({ enrollmentId: active.id });

    // Force archivedAt to well before the future session date.
    await testDbBypass(async (tx) => {
      await tx.enrollment.update({
        where: { id: active.id },
        data: { archivedAt: new Date('2020-01-01T00:00:00.000Z') },
      });
    });

    roster = await gddt.lmsOps.rosterForSession({ classSessionId: futureSessionId });
    expect(roster.students.map((s) => s.studentId)).not.toContain(active.studentId);

    await gddt.lmsOps.unarchiveEnrollment({ enrollmentId: active.id });
    roster = await gddt.lmsOps.rosterForSession({ classSessionId: futureSessionId });
    expect(roster.students.map((s) => s.studentId)).toContain(active.studentId);
  });
});
