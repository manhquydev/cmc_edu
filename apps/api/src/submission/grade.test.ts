// T2-II integration tests (US-017, docs/26 WF-P2-06, TL19 §6):
// submission.grade — submitted-only gate, score cap, idempotent star award
// across regrades, FinalGrade recompute, submission.listForGrading, the
// submission.grade permission gate, and the facility RLS boundary.
//
// F1 remediation: uses real ParentAccount + approved Guardian rows;
// `loadLmsStudent` verifies the Guardian link before any student data access.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withFacility } from '@cmc/db';
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
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

const PAST = new Date('2020-01-01T00:00:00.000Z');

describe('submission.grade / listForGrading (US-017, TL19 §6)', () => {
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
    facility = await createTestFacility('Grade Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-grade-1', roles: ['giam_doc_dao_tao'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-grade-1', roles: ['giao_vien'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    // Teacher class-scoping remediation (2026-07-15): submission.grade now
    // resolves scope via the student's active Enrollment's classBatchId —
    // assign this teacher to the class the student below gets enrolled in.
    const teacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-grade-1' });
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
      starReward: 15,
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

    // Real ParentAccount for Guardian FK (F1 remediation).
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);
  });

  afterEach(async () => {
    // Facility teardown first: it deletes Submission rows (RESTRICT FK to
    // Exercise) before cleanupCurriculumUnits deletes the Exercise/unit rows.
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    await cleanupParentAccountsByPhone(parent.phone);
  });

  /**
   * Enrolls a student WITH an approved Guardian link, then drives the
   * saveDraft → submit flow so the grading tests have a real submitted row.
   */
  async function seedSubmittedSubmission(opts: { studentName?: string } = {}): Promise<{
    submissionId: string;
    studentId: string;
    enrollmentId: string;
  }> {
    const enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      studentName: opts.studentName,
      unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
    });
    const student = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId: enrollment.studentId, kind: 'student' }),
    );
    await student.submission.saveDraft({ sessionExerciseId: sessionExerciseId, annotationLayer: { done: true } });
    const submitted = await student.submission.submit({ sessionExerciseId: sessionExerciseId });
    return { submissionId: submitted.id, studentId: enrollment.studentId, enrollmentId: enrollment.id };
  }

  it('grades a submitted submission (submitted -> graded)', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    const graded = await teacher.submission.grade({ submissionId, score: 8 });
    expect(graded.status).toBe('graded');
    expect(graded.score).toBe(8);
    expect(graded.gradedAt).not.toBeNull();
  });

  // Concurrent grades on the same row.
  //
  // Product contract (`router.ts` grade): compare-and-swap via
  // `updateMany({ where: { status: submission.status } })` after a fresh read.
  // - True race on `submitted`: one CAS wins, the other gets CONFLICT.
  // - Near-sequential (one commits before the peer's findFirst): peer re-reads
  //   `graded` and takes the intentional regrade path (graded→graded) — both
  //   calls fulfill. That is NOT silent overwrite of an in-flight CAS; it is
  //   the same allowed regrade the next test covers sequentially.
  // - starReward: awarded at most once (in-tx check + partial unique index).
  //
  // Therefore fulfilled/rejected counts on Promise.allSettled are
  // non-deterministic. Assert the durable end-state instead.
  it('atomic-lock standardization (scenario audit pattern #3): 2 concurrent grades leave a single consistent graded row + one star award', async () => {
    const { submissionId, studentId } = await seedSubmittedSubmission();

    const results = await Promise.allSettled([
      teacher.submission.grade({ submissionId, score: 7 }),
      teacher.submission.grade({ submissionId, score: 9 }),
    ]);

    // Any rejection must be the CAS conflict, never a hard failure that left
    // the row half-applied. Zero rejections is allowed (regrade path).
    const rejected = results.filter((r) => r.status === 'rejected');
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toMatchObject({ code: 'CONFLICT' });
    }
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);

    const row = await testDbBypass((tx) =>
      tx.submission.findUniqueOrThrow({ where: { id: submissionId } }),
    );
    expect(row.status).toBe('graded');
    expect([7, 9]).toContain(row.score);
    expect(row.gradedAt).not.toBeNull();

    const starTxns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({
        where: {
          studentId,
          type: 'homework_completed',
          refType: 'submission',
          refId: submissionId,
        },
      }),
    );
    expect(starTxns).toHaveLength(1);
    expect(starTxns[0]?.amount).toBe(exercise.starReward);
  });

  it('a sequential regrade (submitted->graded, then graded->graded) is NOT a conflict — each call re-reads fresh state', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    const first = await teacher.submission.grade({ submissionId, score: 6 });
    expect(first.status).toBe('graded');
    const regraded = await teacher.submission.grade({ submissionId, score: 9 });
    expect(regraded.status).toBe('graded');
    expect(regraded.score).toBe(9);
  });

  it('rejects grading a draft (not yet submitted) submission', async () => {
    // This student needs a Guardian link so saveDraft succeeds.
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

    await expect(teacher.submission.grade({ submissionId: draft.id, score: 5 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects a score above exercise.maxScore', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    await expect(teacher.submission.grade({ submissionId, score: 11 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects a fractional score (Int column would silently truncate 8.5 → 8)', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    await expect(teacher.submission.grade({ submissionId, score: 8.5 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('allows a score exactly at maxScore (boundary)', async () => {
    const { submissionId } = await seedSubmittedSubmission();
    const graded = await teacher.submission.grade({ submissionId, score: 10 });
    expect(graded.score).toBe(10);
  });

  it('awards starReward exactly once, even across a regrade (idempotent)', async () => {
    const { submissionId, studentId } = await seedSubmittedSubmission();

    await teacher.submission.grade({ submissionId, score: 7 });
    await teacher.submission.grade({ submissionId, score: 9 }); // regrade

    const starTxns = await testDbBypass((tx) =>
      tx.starTransaction.findMany({ where: { studentId, type: 'homework_completed' } }),
    );
    expect(starTxns).toHaveLength(1);
    expect(starTxns[0]?.amount).toBe(exercise.starReward);
  });

  it('recomputes FinalGrade for the student/classBatch/ICT-month period', async () => {
    const { submissionId, studentId } = await seedSubmittedSubmission();
    await teacher.submission.grade({ submissionId, score: 10 });

    const finalGrades = await testDbBypass((tx) =>
      tx.finalGrade.findMany({ where: { studentId, classBatchId: classBatch.id } }),
    );
    expect(finalGrades).toHaveLength(1);
    expect(finalGrades[0]?.score).toBeGreaterThan(0);
  });

  it('forbids a role without submission.grade permission', async () => {
    const { submissionId } = await seedSubmittedSubmission();
    const sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-grade-1', roles: ['sale'] }),
    );

    await expect(sale.submission.grade({ submissionId, score: 5 })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('listForGrading returns the submitted queue', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    const queue = await teacher.submission.listForGrading({});
    expect(queue.items.map((s) => s.id)).toContain(submissionId);
  });

  it('listForGrading includes the student full name (post-audit fix: grading queue must not force teachers to identify students by raw UUID)', async () => {
    const { submissionId } = await seedSubmittedSubmission({ studentName: 'Nguyễn Văn Test' });

    const queue = await teacher.submission.listForGrading({});
    const item = queue.items.find((s) => s.id === submissionId);
    expect(item?.studentFullName).toBe('Nguyễn Văn Test');
  });

  it('listForGrading search matches student fullName (case-insensitive)', async () => {
    const { submissionId: hitId } = await seedSubmittedSubmission({
      studentName: 'Trần Search Alpha',
    });
    const { submissionId: missId } = await seedSubmittedSubmission({
      studentName: 'Lê Other Beta',
    });

    const queue = await teacher.submission.listForGrading({ search: 'search alpha' });
    expect(queue.items.map((s) => s.id)).toContain(hitId);
    expect(queue.items.map((s) => s.id)).not.toContain(missId);
  });

  it('listForGrading filters out a submission from a class the teacher does not own (post-implementation hardening MH1)', async () => {
    const { submissionId } = await seedSubmittedSubmission();

    const otherClassBatch = await seedClassBatch({ facilityId: facility.id });
    const otherTeacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-grade-other' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: otherClassBatch.id }, data: { teacherAppUserId: otherTeacherAppUser.id } }),
    );
    const otherTeacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-grade-other', roles: ['giao_vien'] }),
    );

    const queue = await otherTeacher.submission.listForGrading({});
    expect(queue.items.find((s) => s.id === submissionId)).toBeUndefined();

    // The owning teacher (and a director) still see it.
    const ownerQueue = await teacher.submission.listForGrading({});
    expect(ownerQueue.items.map((s) => s.id)).toContain(submissionId);
    const gddtQueue = await gddt.submission.listForGrading({});
    expect(gddtQueue.items.map((s) => s.id)).toContain(submissionId);
  });

  it('listForGrading no longer includes a submission once graded (default status filter)', async () => {
    const { submissionId } = await seedSubmittedSubmission();
    await teacher.submission.grade({ submissionId, score: 6 });

    const queue = await teacher.submission.listForGrading({});
    expect(queue.items.find((s) => s.id === submissionId)).toBeUndefined();

    const gradedQueue = await teacher.submission.listForGrading({ status: 'graded' });
    expect(gradedQueue.items.map((s) => s.id)).toContain(submissionId);
  });

  // ---- Child-data / RLS boundary ----

  it("a different facility's staff cannot grade or read this facility's submission (RLS negative)", async () => {
    const { submissionId } = await seedSubmittedSubmission();

    const otherFacility = await createTestFacility('Grade Facility (other)');
    const otherTeacher = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'teacher-grade-other', roles: ['giao_vien'] }),
    );

    try {
      await expect(otherTeacher.submission.grade({ submissionId, score: 5 })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      const otherQueue = await otherTeacher.submission.listForGrading({});
      expect(otherQueue.items.find((s) => s.id === submissionId)).toBeUndefined();
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });

  it("RLS enforces the boundary even if the app-level facilityId filter were removed (raw cross-facility read)", async () => {
    const { submissionId } = await seedSubmittedSubmission();

    const otherFacility = await createTestFacility('Grade Facility (raw-rls)');
    try {
      // Deliberately skip the app-level `where facilityId` filter entirely —
      // scope the OTHER facility's GUC via `withFacility` and query by `id`
      // alone. RLS must still return zero rows (defense-in-depth, ADR 0042).
      const rows = await withFacility(testDb(), otherFacility.id, (tx) =>
        tx.submission.findMany({ where: { id: submissionId } }),
      );
      expect(rows).toHaveLength(0);
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });
});
