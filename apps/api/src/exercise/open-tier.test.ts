// Student homework open surface (B3): exercise.openForStudent / listForStudent
// only via SessionExercise delivery + dual-gate roster — not ADR 0038 Tier A.
//
// Every studentCaller uses a real ParentAccount + approved Guardian
// (`loadLmsStudent` ownership gate).

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

describe('exercise.openForStudent — delivery-only (B3)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let classBatch: { id: string; courseId: string };
  let parent: { id: string; phone: string };
  const seededUnitIds: string[] = [];
  const seededFolderIds: string[] = [];
  const extraParentPhones: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Open-Delivery Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-ot-1', roles: ['giam_doc_dao_tao'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);
  });

  afterEach(async () => {
    // Facility first: drops ClassExerciseItem / SessionExercise FKs to exercises.
    await cleanupFacility(facility.id);
    await cleanupExerciseLibrary(...seededFolderIds);
    seededFolderIds.length = 0;
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    await cleanupParentAccountsByPhone(parent.phone, ...extraParentPhones);
    extraParentPhones.length = 0;
  });

  async function seedUnit() {
    const unit = await seedCurriculumUnit();
    seededUnitIds.push(unit.id);
    return unit;
  }

  async function publishedExerciseFor(_unitId: string) {
    const folder = await seedExerciseFolder();
    seededFolderIds.push(folder.id);
    const created = await gddt.exercise.create({
      folderId: folder.id,
      title: 'Bài tập mở',
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });
    return gddt.exercise.publish({ exerciseId: created.id });
  }

  /** Freeze sequence + deliver on an ended, unit-stamped session. */
  async function deliverOnClass(exerciseId: string, unitId: string) {
    await gddt.lmsOps.assignExerciseSequence({
      classBatchId: classBatch.id,
      exerciseIds: [exerciseId],
    });
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unitId,
      endTime: PAST,
    });
    await gddt.lmsOps.deliverSessionExercise({ classSessionId: session.id });
    return session;
  }

  function studentCaller(studentId: string): Caller {
    return appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId, kind: 'student' }),
    );
  }

  /** On-roster student: active enrollment + wide unit range. */
  async function seedStudentOnRoster() {
    return seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });
  }

  /** Active enrollment but no unit range → dual-gate roster excludes unit-stamped sessions. */
  async function seedStudentOffRoster() {
    return seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      // no unitRange
    });
  }

  it('on-roster student sees published homework delivered on their session', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await deliverOnClass(exercise.id, unit.id);
    const enrollment = await seedStudentOnRoster();

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.map((e) => e.id)).toContain(exercise.id);
  });

  it('listForStudent is an alias of openForStudent', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await deliverOnClass(exercise.id, unit.id);
    const enrollment = await seedStudentOnRoster();

    const result = await studentCaller(enrollment.studentId).exercise.listForStudent();
    expect(result.items.map((e) => e.id)).toContain(exercise.id);
  });

  it('off-roster student (no unit range) does not see delivered homework', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await deliverOnClass(exercise.id, unit.id);
    const enrollment = await seedStudentOffRoster();

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  it('delivered exercise that is no longer published is hidden', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await deliverOnClass(exercise.id, unit.id);
    // Force draft after delivery (product close path sets closed; draft still
    // exercises the status=published filter on the open list).
    await testDbBypass((tx) =>
      tx.exercise.update({ where: { id: exercise.id }, data: { status: 'draft' } }),
    );
    const enrollment = await seedStudentOnRoster();

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  it('ended teaching session without SessionExercise does not open homework (no Tier A)', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      endTime: PAST,
    });
    // No assignSequence / deliverSessionExercise
    const enrollment = await seedStudentOnRoster();

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
    expect(result.items).toEqual([]);
  });

  it('blocked_lms students cannot open homework (Guardian / ownership)', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await deliverOnClass(exercise.id, unit.id);
    const enrollment = await seedStudentOnRoster();
    await testDbBypass((tx) =>
      tx.student.update({ where: { id: enrollment.studentId }, data: { lifecycle: 'blocked_lms' } }),
    );

    // blocked_lms is excluded from getApprovedChildren — loadLmsStudent FORBIDDEN.
    await expect(studentCaller(enrollment.studentId).exercise.openForStudent()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects a call with no selected student profile', async () => {
    const noStudent = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, kind: 'student' }),
    );
    await expect(noStudent.exercise.openForStudent()).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('FORBIDDEN when the studentId belongs to a different parent', async () => {
    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    extraParentPhones.push(otherPhone);
    const otherParent = await seedParentAccount(otherPhone);
    const otherEnrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: otherParent.id,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });

    await expect(
      studentCaller(otherEnrollment.studentId).exercise.openForStudent(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
