// Gap-closure 260710-0005 Phase 2: submission.listForChild — parent-facing
// view of a child's homework results (score + starReward). Gate pattern
// copied from assessment.listForChild (parent-only, getApprovedChildren +
// auditChildDataAccess). Covers: happy path shape, sibling/non-approved
// parent FORBIDDEN, student-kind session FORBIDDEN (requireLmsParent,
// red-team H2), draft submissions excluded, and no forbidden fields
// (gradedById/teacherAnnotationLayer/annotationLayer/answerText) leak.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupExerciseLibrary,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  seedClassSession,
  seedCurriculumUnit,
  seedExerciseFolder,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

const PAST = new Date('2020-01-01T00:00:00.000Z');

describe('submission.listForChild (gap-closure 260710-0005 Phase 2)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let classBatch: { id: string; courseId: string };
  let unit: { id: string };
  let exercise: { id: string; maxScore: number; starReward: number };
  let sessionExerciseId: string;
  let parent: { id: string; phone: string };
  const seededUnitIds: string[] = [];
  const seededFolderIds: string[] = [];
  const parentPhonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('SubmissionListForChild Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-lfc-1', roles: ['giam_doc_dao_tao'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    unit = await seedCurriculumUnit({ title: 'Unit With A Real Title' });
    seededUnitIds.push(unit.id);

    const folder = await seedExerciseFolder();
    seededFolderIds.push(folder.id);
    const created = await gddt.exercise.create({
      folderId: folder.id,
      title: 'Bài tập list-for-child',
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
      maxScore: 10,
      starReward: 12,
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
    parentPhonesToClean.push(phone);
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupExerciseLibrary(...seededFolderIds);
    seededFolderIds.length = 0;
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    await cleanupParentAccountsByPhone(...parentPhonesToClean);
    parentPhonesToClean.length = 0;
  });

  async function seedSubmittedChild(): Promise<{ studentId: string }> {
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });
    const student = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId: enrollment.studentId, kind: 'student' }),
    );
    await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: { done: true } });
    await student.submission.submit({ sessionExerciseId: sessionExerciseId });
    return { studentId: enrollment.studentId };
  }

  it('returns the submitted exercise with score/starReward once graded, no forbidden fields', async () => {
    const { studentId } = await seedSubmittedChild();
    const [submission] = await testDbBypass((tx) => tx.submission.findMany({ where: { studentId } }));
    await gddt.submission.grade({ submissionId: submission!.id, score: 9 });

    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, kind: 'parent' }));
    const result = await parentCaller.submission.listForChild({ studentId });

    expect(result.items).toHaveLength(1);
    const item = result.items[0]!;
    expect(item.exerciseTitle).toBe('Bài tập list-for-child');
    expect(item.score).toBe(9);
    expect(item.starReward).toBe(12);
    expect(item.status).toBe('graded');
    // Assert-shape: none of these keys exist on the DTO at all.
    expect(item).not.toHaveProperty('gradedById');
    expect(item).not.toHaveProperty('teacherAnnotationLayer');
    expect(item).not.toHaveProperty('annotationLayer');
    expect(item).not.toHaveProperty('answerText');
  });

  it('excludes draft (not-yet-submitted) submissions', async () => {
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });
    const student = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId: enrollment.studentId, kind: 'student' }),
    );
    await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: {} });

    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, kind: 'parent' }));
    const result = await parentCaller.submission.listForChild({ studentId: enrollment.studentId });

    expect(result.items).toHaveLength(0);
  });

  it('FORBIDDEN: a parent without an approved Guardian link for this student', async () => {
    const { studentId } = await seedSubmittedChild();

    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const otherParent = await seedParentAccount(otherPhone);
    parentPhonesToClean.push(otherPhone);

    const otherParentCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: otherParent.id, kind: 'parent' }),
    );
    await expect(otherParentCaller.submission.listForChild({ studentId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('FORBIDDEN: a student-kind session (requireLmsParent is parent-only, red-team H2)', async () => {
    const { studentId } = await seedSubmittedChild();

    const studentCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId, kind: 'student' }),
    );
    await expect(studentCaller.submission.listForChild({ studentId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
