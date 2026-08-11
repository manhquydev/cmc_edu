// SessionExercise delivery integration (teaching spine phase 6).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedAppUser,
  seedClassBatch,
  seedCurriculumUnit,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDbBypass,
} from '../test/db.js';
import { deliverDueExercises } from './exercise-delivery.js';
import { createPrismaClient } from '@cmc/db';
import { randomUUID } from 'node:crypto';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('lmsOps exercise delivery', () => {
  let facility: { id: string };
  let gddt: Caller;
  let unitIds: string[] = [];
  let parentPhone: string;

  beforeEach(async () => {
    facility = await createTestFacility('Exercise Delivery Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'gddt-ex-del-1',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    const u1 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 201, title: 'D1' });
    const u2 = await seedCurriculumUnit({ program: 'UCREA', orderGlobal: 202, title: 'D2' });
    unitIds = [u1.id, u2.id];
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...unitIds);
    unitIds = [];
    if (parentPhone) {
      await cleanupParentAccountsByPhone(parentPhone);
      parentPhone = '';
    }
  });

  async function publishedHomework(unitId: string) {
    const created = await gddt.exercise.create({
      curriculumUnitId: unitId,
      type: 'homework',
      basePdfRef: `exercise-pdf/del-${unitId.slice(0, 8)}.pdf`,
    });
    return gddt.exercise.publish({ exerciseId: created.id });
  }

  it('assignExerciseSequence freezes positions; deliverSessionExercise is idempotent', async () => {
    const batch = await seedClassBatch({ facilityId: facility.id });
    const teacher = await seedAppUser({ facilityId: facility.id, userId: 'teacher-del-1' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: batch.id }, data: { teacherAppUserId: teacher.id } }),
    );

    const ex1 = await publishedHomework(unitIds[0]!);
    const ex2 = await publishedHomework(unitIds[1]!);

    const seq = await gddt.lmsOps.assignExerciseSequence({
      classBatchId: batch.id,
      exerciseIds: [ex1.id, ex2.id],
    });
    expect(seq.items).toEqual([
      { position: 1, exerciseId: ex1.id },
      { position: 2, exerciseId: ex2.id },
    ]);
    expect(seq.deliveredCount).toBe(0);

    const pastEnd = new Date(Date.now() - 60_000);
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: batch.id,
          sessionDate: pastEnd,
          startTime: new Date(pastEnd.getTime() - 90 * 60_000),
          endTime: pastEnd,
          status: 'planned',
          curriculumUnitId: unitIds[0]!,
        },
      }),
    );

    const d1 = await gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id });
    expect(d1.delivered).toBe(true);
    if (d1.delivered) {
      expect(d1.sessionExercise.exerciseId).toBe(ex1.id);
      expect(d1.sessionExercise.position).toBe(1);
    }

    const d2 = await gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id });
    expect(d2.delivered).toBe(true);
    if (d2.delivered) {
      expect(d2.sessionExercise.id).toBe(
        d1.delivered ? d1.sessionExercise.id : '',
      );
    }

    // Re-assign sequence keeps delivered position 1, replaces future.
    const created = await gddt.exercise.create({
      curriculumUnitId: unitIds[1]!,
      type: 'test_periodic',
      basePdfRef: 'exercise-pdf/del-period.pdf',
    });
    const exAlt = await gddt.exercise.publish({ exerciseId: created.id });

    const seq2 = await gddt.lmsOps.assignExerciseSequence({
      classBatchId: batch.id,
      exerciseIds: [exAlt.id],
    });
    // deliveredCount freeze keeps position 1 content (old), appends from 2
    expect(seq2.deliveredCount).toBe(1);
    expect(seq2.items.find((i) => i.position === 1)?.exerciseId).toBe(ex1.id);
    expect(seq2.items.find((i) => i.position === 2)?.exerciseId).toBe(exAlt.id);
  });

  it('unit-stamp fallback delivers published homework without sequence', async () => {
    const batch = await seedClassBatch({ facilityId: facility.id });
    const homework = await publishedHomework(unitIds[0]!);
    const pastEnd = new Date(Date.now() - 60_000);
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: batch.id,
          sessionDate: pastEnd,
          startTime: new Date(pastEnd.getTime() - 90 * 60_000),
          endTime: pastEnd,
          status: 'planned',
          curriculumUnitId: unitIds[0]!,
        },
      }),
    );

    const d = await gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id });
    expect(d.delivered).toBe(true);
    if (d.delivered) {
      expect(d.sessionExercise.exerciseId).toBe(homework.id);
    }
  });

  it('cancelled session cannot receive delivery', async () => {
    const batch = await seedClassBatch({ facilityId: facility.id });
    await publishedHomework(unitIds[0]!);
    const pastEnd = new Date(Date.now() - 60_000);
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: batch.id,
          sessionDate: pastEnd,
          startTime: new Date(pastEnd.getTime() - 90 * 60_000),
          endTime: pastEnd,
          status: 'cancelled',
          curriculumUnitId: unitIds[0]!,
        },
      }),
    );

    await expect(
      gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('open-tier OFF: homework only via delivered SessionExercise + dual-gate roster', async () => {
    const batch = await seedClassBatch({ facilityId: facility.id });
    const homework = await publishedHomework(unitIds[0]!);
    const pastEnd = new Date(Date.now() - 60_000);
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: batch.id,
          sessionDate: pastEnd,
          startTime: new Date(pastEnd.getTime() - 90 * 60_000),
          endTime: pastEnd,
          status: 'planned',
          curriculumUnitId: unitIds[0]!,
        },
      }),
    );

    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parentPhone = phone;
    const parent = await seedParentAccount(phone);
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: batch.id,
      parentAccountId: parent.id,
    });
    // Dual-gate range cover unit 201
    await gddt.lmsOps.addWithUnits({
      enrollmentId: enrollment.id,
      fromOrderGlobal: 201,
      toOrderGlobal: 202,
    });

    await gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id });

    const prev = process.env.LMS_OPEN_TIER_ENABLED;
    process.env.LMS_OPEN_TIER_ENABLED = '0';
    try {
      const student = appRouter.createCaller(
        buildLmsContext({
          parentAccountId: parent.id,
          studentId: enrollment.studentId,
          kind: 'student',
        }),
      );
      const open = await student.exercise.openForStudent();
      expect(open.items.map((e) => e.id)).toContain(homework.id);
    } finally {
      if (prev === undefined) delete process.env.LMS_OPEN_TIER_ENABLED;
      else process.env.LMS_OPEN_TIER_ENABLED = prev;
    }
  });

  it('cancel after deliver revokes SessionExercise when no submissions', async () => {
    const batch = await seedClassBatch({ facilityId: facility.id });
    await publishedHomework(unitIds[0]!);
    const pastEnd = new Date(Date.now() - 60_000);
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: batch.id,
          sessionDate: pastEnd,
          startTime: new Date(pastEnd.getTime() - 90 * 60_000),
          endTime: pastEnd,
          status: 'planned',
          curriculumUnitId: unitIds[0]!,
        },
      }),
    );
    await gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id });
    const before = await testDbBypass((tx) =>
      tx.sessionExercise.findUnique({ where: { classSessionId: session.id } }),
    );
    expect(before).not.toBeNull();

    await gddt.classSession.cancel({ sessionId: session.id });
    const after = await testDbBypass((tx) =>
      tx.sessionExercise.findUnique({ where: { classSessionId: session.id } }),
    );
    expect(after).toBeNull();
  });

  it('deliverDueExercises worker path delivers ended sessions', async () => {
    const batch = await seedClassBatch({ facilityId: facility.id });
    const homework = await publishedHomework(unitIds[0]!);
    const pastEnd = new Date(Date.now() - 120_000);
    await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: batch.id,
          sessionDate: pastEnd,
          startTime: new Date(pastEnd.getTime() - 90 * 60_000),
          endTime: pastEnd,
          status: 'planned',
          curriculumUnitId: unitIds[0]!,
        },
      }),
    );

    const db = createPrismaClient();
    const result = await deliverDueExercises(db, { now: new Date() });
    expect(result.delivered).toBeGreaterThanOrEqual(1);

    const rows = await testDbBypass((tx) =>
      tx.sessionExercise.findMany({
        where: { facilityId: facility.id },
        select: { exerciseId: true },
      }),
    );
    expect(rows.some((r) => r.exerciseId === homework.id)).toBe(true);
  });
});
