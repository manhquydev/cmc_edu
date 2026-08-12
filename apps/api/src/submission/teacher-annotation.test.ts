// Phase-01a (C3): submission.saveTeacherAnnotation integration tests.
// Verifies teacher annotation is stored separately from the student layer,
// gate is `submission.grade`, cap is 1MB, and draft submissions are rejected.

import { randomUUID } from 'node:crypto';
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
  seedClassSession,
  seedCurriculumUnit,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

const PAST = new Date('2020-01-01T00:00:00.000Z');

describe('submission.saveTeacherAnnotation (phase-01a C3)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let teacher: Caller;
  let classBatch: { id: string; courseId: string };
  let unit: { id: string };
  let exercise: { id: string; maxScore: number; starReward: number };
  let sessionExerciseId: string;
  let parent: { id: string; phone: string };
  const seededUnitIds: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Teacher Annotation Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-ta-1', roles: ['giam_doc_dao_tao'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ta-1', roles: ['giao_vien'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    // Teacher class-scoping (post-implementation hardening H1): saveTeacherAnnotation
    // now resolves scope via the student's enrolled classBatch — assign this
    // teacher to the class the student below gets enrolled in.
    const teacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-ta-1' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: teacherAppUser.id } }),
    );
    unit = await seedCurriculumUnit();
    seededUnitIds.push(unit.id);

    const created = await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
      maxScore: 10,
      starReward: 5,
    });
    exercise = await gddt.exercise.publish({ exerciseId: created.id });

    await gddt.lmsOps.assignExerciseSequence({
      classBatchId: classBatch.id,
      exerciseIds: [exercise.id],
    });
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      endTime: PAST,
    });
    const delivered = await gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id });
    if (!delivered.delivered) throw new Error('expected delivery');
    sessionExerciseId = delivered.sessionExercise.id;

    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    await cleanupParentAccountsByPhone(parent.phone);
  });

  async function seedSubmittedSubmission() {
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });
    const student = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId: enrollment.studentId, kind: 'student' }),
    );
    const studentLayer = { pen: 'red', strokes: [1, 2, 3] };
    await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: studentLayer });
    const submitted = await student.submission.submit({ sessionExerciseId: sessionExerciseId });
    return { submissionId: submitted.id, studentLayer };
  }

  it('stores teacherAnnotationLayer separately without touching student annotationLayer', async () => {
    const { submissionId, studentLayer } = await seedSubmittedSubmission();
    const teacherLayer = { pen: 'blue', comment: 'Good work' };

    const result = await teacher.submission.saveTeacherAnnotation({
      submissionId,
      teacherAnnotationLayer: teacherLayer,
    });

    expect(result.teacherAnnotationLayer).toEqual(teacherLayer);
    // Student's original layer must be untouched
    expect(result.annotationLayer).toEqual(studentLayer);
  });

  it('overwrites teacherAnnotationLayer on a second call (idempotent update)', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    await teacher.submission.saveTeacherAnnotation({
      submissionId,
      teacherAnnotationLayer: { v: 1 },
    });
    const second = await teacher.submission.saveTeacherAnnotation({
      submissionId,
      teacherAnnotationLayer: { v: 2, note: 'revised' },
    });

    expect(second.teacherAnnotationLayer).toEqual({ v: 2, note: 'revised' });
  });

  it('rejects annotation on a draft submission (not yet submitted)', async () => {
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });
    const student = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId: enrollment.studentId, kind: 'student' }),
    );
    const draft = await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: {} });

    await expect(
      teacher.submission.saveTeacherAnnotation({
        submissionId: draft.id,
        teacherAnnotationLayer: { x: 1 },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a teacherAnnotationLayer exceeding 1MB', async () => {
    const { submissionId } = await seedSubmittedSubmission();
    // Generate a payload > 1MB by creating a large string value
    const bigLayer = { data: 'x'.repeat(1_100_000) };

    await expect(
      teacher.submission.saveTeacherAnnotation({
        submissionId,
        teacherAnnotationLayer: bigLayer,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('forbids a teacher who does not own the student\'s class (cross-teacher annotation bypass, post-implementation hardening H1)', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    const otherClassBatch = await seedClassBatch({ facilityId: facility.id });
    const otherTeacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-ta-other' });
    await testDbBypass((tx) =>
      tx.classBatch.update({
        where: { id: otherClassBatch.id },
        data: { teacherAppUserId: otherTeacherAppUser.id },
      }),
    );
    const otherTeacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ta-other', roles: ['giao_vien'] }),
    );

    await expect(
      otherTeacher.submission.saveTeacherAnnotation({
        submissionId,
        teacherAnnotationLayer: { x: 1 },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a sale role (no submission.grade permission)', async () => {
    const { submissionId } = await seedSubmittedSubmission();
    const sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-ta-1', roles: ['sale'] }),
    );

    await expect(
      sale.submission.saveTeacherAnnotation({
        submissionId,
        teacherAnnotationLayer: { x: 1 },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
