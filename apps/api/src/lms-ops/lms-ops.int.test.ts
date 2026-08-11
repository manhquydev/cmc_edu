// LMS foundation spike integration: createClassWithUnits + addWithUnits + rosterForSession.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupFacility,
  createTestFacility,
  seedActiveEnrollment,
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
});
