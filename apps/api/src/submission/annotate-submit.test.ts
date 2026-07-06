// T2-II integration tests (US-016, docs/26 WF-P2-05, TL19 §3):
// submission.saveDraft / submission.submit — version increments, immutability
// after submit, the unique (exercise, student) row, the open-tier gate reuse,
// and the 1MB annotationLayer cap.
//
// F1 remediation: uses real ParentAccount + approved Guardian rows;
// `loadLmsStudent` verifies the Guardian link before any student data access.

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
  seedClassBatch,
  seedClassSession,
  seedCurriculumUnit,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

const PAST = new Date('2020-01-01T00:00:00.000Z');

describe('submission.saveDraft / submission.submit (US-016, TL19 §3)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let classBatch: { id: string; courseId: string };
  let unit: { id: string };
  let exercise: { id: string; maxScore: number };
  let parent: { id: string; phone: string };
  const seededUnitIds: string[] = [];
  const extraParentPhones: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Submission Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-sub-1', roles: ['giam_doc_dao_tao'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    unit = await seedCurriculumUnit();
    seededUnitIds.push(unit.id);

    const created = await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });
    exercise = await gddt.exercise.publish({ exerciseId: created.id });

    // Opens the unit (Tier A: a non-makeup session teaching it has ended).
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      endTime: PAST,
    });

    // Real ParentAccount for Guardian FK (F1 remediation).
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);
  });

  afterEach(async () => {
    // Facility teardown first: deletes Guardian + Submission rows (FK) before
    // accounts and curriculum units can be deleted.
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    await cleanupParentAccountsByPhone(parent.phone, ...extraParentPhones);
    extraParentPhones.length = 0;
  });

  /** Enrolls a student with an approved Guardian link for `parent`. */
  async function seedStudent() {
    return seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
    });
  }

  function studentCaller(studentId: string): Caller {
    return appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, studentId }));
  }

  it('creates a draft, then re-saves it (version increments, same row)', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);

    const first = await student.submission.saveDraft({
      exerciseId: exercise.id,
      annotationLayer: { strokes: ['a'] },
    });
    expect(first.version).toBe(1);
    expect(first.status).toBe('draft');

    const second = await student.submission.saveDraft({
      exerciseId: exercise.id,
      annotationLayer: { strokes: ['a', 'b'] },
      answerText: 'my answer',
    });
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(2);
    expect(second.answerText).toBe('my answer');
  });

  it('submit flips draft -> submitted and stamps submittedAt', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);
    await student.submission.saveDraft({ exerciseId: exercise.id, annotationLayer: {} });

    const submitted = await student.submission.submit({ exerciseId: exercise.id });
    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).not.toBeNull();
  });

  it('blocks saveDraft once the submission has been submitted (immutable)', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);
    await student.submission.saveDraft({ exerciseId: exercise.id, annotationLayer: {} });
    await student.submission.submit({ exerciseId: exercise.id });

    await expect(
      student.submission.saveDraft({ exerciseId: exercise.id, annotationLayer: { strokes: ['edit-after-submit'] } }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects submitting twice (only a draft can be submitted)', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);
    await student.submission.saveDraft({ exerciseId: exercise.id, annotationLayer: {} });
    await student.submission.submit({ exerciseId: exercise.id });

    await expect(student.submission.submit({ exerciseId: exercise.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects submitting with no draft on file', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);

    await expect(student.submission.submit({ exerciseId: exercise.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('unique (exercise, student): two students each get their own independent submission', async () => {
    const a = await seedStudent();
    const b = await seedStudent();

    const draftA = await studentCaller(a.studentId).submission.saveDraft({
      exerciseId: exercise.id,
      annotationLayer: { who: 'a' },
    });
    const draftB = await studentCaller(b.studentId).submission.saveDraft({
      exerciseId: exercise.id,
      annotationLayer: { who: 'b' },
    });

    expect(draftA.id).not.toBe(draftB.id);
    expect(draftA.studentId).toBe(a.studentId);
    expect(draftB.studentId).toBe(b.studentId);
  });

  it('rejects a draft on an exercise that is not open yet (Tier A not reached)', async () => {
    const notYetUnit = await seedCurriculumUnit();
    seededUnitIds.push(notYetUnit.id);
    const createdNotYet = await gddt.exercise.create({
      curriculumUnitId: notYetUnit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/not-yet.pdf',
    });
    const notYetExercise = await gddt.exercise.publish({ exerciseId: createdNotYet.id });
    // No teaching session at all for this unit -> never opened.

    const enrollment = await seedStudent();
    await expect(
      studentCaller(enrollment.studentId).submission.saveDraft({
        exerciseId: notYetExercise.id,
        annotationLayer: {},
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects an annotationLayer larger than 1MB', async () => {
    const enrollment = await seedStudent();
    const bigString = 'x'.repeat(1_100_000);

    await expect(
      studentCaller(enrollment.studentId).submission.saveDraft({
        exerciseId: exercise.id,
        annotationLayer: { blob: bigString },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a call with no selected student profile', async () => {
    const noStudent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id }));
    await expect(
      noStudent.submission.saveDraft({ exerciseId: exercise.id, annotationLayer: {} }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ---- F1 remediation: ownership gate ----

  it('FORBIDDEN when the studentId does not have an approved Guardian link to this parent', async () => {
    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    extraParentPhones.push(otherPhone); // afterEach cleans account after cleanupFacility removes Guardian rows
    const otherParent = await seedParentAccount(otherPhone);
    const otherEnrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: otherParent.id,
    });

    await expect(
      studentCaller(otherEnrollment.studentId).submission.saveDraft({
        exerciseId: exercise.id,
        annotationLayer: {},
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
