// T2-II integration tests (US-016, docs/26 WF-P2-05, TL19 §3):
// submission.saveDraft / submission.submit — version increments, immutability
// after submit, unique (sessionExerciseId, studentId), delivery gate,
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
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

const PAST = new Date('2020-01-01T00:00:00.000Z');

describe('submission.saveDraft / submission.submit (US-016, TL19 §3)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let classBatch: { id: string; courseId: string };
  let unit: { id: string };
  let exercise: { id: string; maxScore: number };
  let sessionExerciseId: string;
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

    // Open via SessionExercise delivery (B3/B4 — submit targets delivery id).
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

  /** Enrolls a student with approved Guardian + unit range (on-roster for delivery). */
  async function seedStudent() {
    return seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });
  }

  function studentCaller(studentId: string): Caller {
    return appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, studentId, kind: 'student' }));
  }

  it('creates a draft, then re-saves it (version increments, same row)', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);

    const first = await student.submission.saveDraft({
      sessionExerciseId: sessionExerciseId,
      annotationLayer: { strokes: ['a'] },
    });
    expect(first.version).toBe(1);
    expect(first.status).toBe('draft');

    const second = await student.submission.saveDraft({
      sessionExerciseId: sessionExerciseId,
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
    await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: {} });

    const submitted = await student.submission.submit({ sessionExerciseId });
    expect(submitted.status).toBe('submitted');
    expect(submitted.submittedAt).not.toBeNull();
  });

  it('Metric & Data Integrity remediation (scenario audit): rejects submit() once the exercise has been closed after the draft was saved', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);
    const draft = await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: {} });

    await gddt.exercise.close({ exerciseId: exercise.id });

    await expect(student.submission.submit({ sessionExerciseId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    // The draft itself is untouched (still draft, not silently submitted).
    const row = await testDbBypass((tx) => tx.submission.findUniqueOrThrow({ where: { id: draft.id } }));
    expect(row.status).toBe('draft');
  });

  it('blocks saveDraft once the submission has been submitted (immutable)', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);
    await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: {} });
    await student.submission.submit({ sessionExerciseId });

    await expect(
      student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: { strokes: ['edit-after-submit'] } }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects submitting twice (only a draft can be submitted)', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);
    await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: {} });
    await student.submission.submit({ sessionExerciseId });

    await expect(student.submission.submit({ sessionExerciseId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects submitting with no draft on file', async () => {
    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);

    await expect(student.submission.submit({ sessionExerciseId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('unique (exercise, student): two students each get their own independent submission', async () => {
    const a = await seedStudent();
    const b = await seedStudent();

    const draftA = await studentCaller(a.studentId).submission.saveDraft({
      sessionExerciseId: sessionExerciseId,
      annotationLayer: { who: 'a' },
    });
    const draftB = await studentCaller(b.studentId).submission.saveDraft({
      sessionExerciseId: sessionExerciseId,
      annotationLayer: { who: 'b' },
    });

    expect(draftA.id).not.toBe(draftB.id);
    expect(draftA.studentId).toBe(a.studentId);
    expect(draftB.studentId).toBe(b.studentId);
  });

  it('rejects a draft on a delivery that does not exist / is not open for this student', async () => {
    const enrollment = await seedStudent();
    await expect(
      studentCaller(enrollment.studentId).submission.saveDraft({
        sessionExerciseId: randomUUID(),
        annotationLayer: {},
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects saveDraft when homework is delivered but student is off-roster (no unit range)', async () => {
    // Main fixture already delivered `exercise` for the class; enroll without range.
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      // no unitRange → dual-gate roster excludes unit-stamped sessions
    });
    await expect(
      studentCaller(enrollment.studentId).submission.saveDraft({
        sessionExerciseId: sessionExerciseId,
        annotationLayer: {},
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects an annotationLayer larger than 1MB', async () => {
    const enrollment = await seedStudent();
    const bigString = 'x'.repeat(1_100_000);

    await expect(
      studentCaller(enrollment.studentId).submission.saveDraft({
        sessionExerciseId: sessionExerciseId,
        annotationLayer: { blob: bigString },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a call with no selected student profile', async () => {
    const noStudent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, kind: 'student' }));
    await expect(
      noStudent.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: {} }),
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
        sessionExerciseId: sessionExerciseId,
        annotationLayer: {},
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('B4: same catalog exercise delivered on two sessions yields two independent submissions', async () => {
    // Second SessionExercise for the SAME catalog exercise on another session
    // (retake / spiral) — proves unique key is per delivery, not per exercise.
    const session2 = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      sessionDate: new Date('2020-02-01T00:00:00.000Z'),
      startTime: new Date('2020-02-01T11:00:00.000Z'),
      endTime: new Date('2020-02-01T12:00:00.000Z'),
    });
    const se2 = await testDbBypass(async (tx) =>
      tx.sessionExercise.create({
        data: {
          facilityId: facility.id,
          classSessionId: session2.id,
          exerciseId: exercise.id,
          position: 2,
        },
      }),
    );

    const enrollment = await seedStudent();
    const student = studentCaller(enrollment.studentId);

    const draft1 = await student.submission.saveDraft({
      sessionExerciseId,
      annotationLayer: { which: 1 },
    });
    const draft2 = await student.submission.saveDraft({
      sessionExerciseId: se2.id,
      annotationLayer: { which: 2 },
    });
    expect(draft1.id).not.toBe(draft2.id);
    expect(draft1.sessionExerciseId).toBe(sessionExerciseId);
    expect(draft2.sessionExerciseId).toBe(se2.id);
    expect(draft1.exerciseId).toBe(exercise.id);
    expect(draft2.exerciseId).toBe(exercise.id);

    const s1 = await student.submission.submit({ sessionExerciseId });
    const s2 = await student.submission.submit({ sessionExerciseId: se2.id });
    expect(s1.id).toBe(draft1.id);
    expect(s2.id).toBe(draft2.id);
    expect(s1.status).toBe('submitted');
    expect(s2.status).toBe('submitted');

    const rows = await testDbBypass((tx) =>
      tx.submission.findMany({
        where: { studentId: enrollment.studentId },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.sessionExerciseId)).size).toBe(2);
  });
});
