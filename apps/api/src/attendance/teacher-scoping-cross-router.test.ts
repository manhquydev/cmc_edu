// Teacher class-scoping remediation (scenario audit H1+H2, 2026-07-15):
// integration proof that `assertTeacherOwnsClass`/`assertTeacherOwnsSessionClass`
// is actually WIRED into every write procedure the plan named — not just
// unit-tested in isolation (see ./assert-teacher-owns-class.test.ts for the
// helper's own exhaustive case coverage). One "teacher B touches teacher A's
// class" FORBIDDEN case per procedure, plus one "teacher A on their own
// class" pass case to prove the guard isn't blanket-blocking.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
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

describe('teacher class-scoping — cross-router FORBIDDEN proof (H1+H2)', () => {
  let facility: { id: string };
  let teacherA: Caller;
  let teacherB: Caller;
  let gddt: Caller;
  let classBatchA: { id: string };
  let session: { id: string };
  let enrollment: { id: string; studentId: string };
  const seededUnitIds: string[] = [];
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    // AppUser.userId is globally unique — randomize per test run so a prior
    // run's incomplete cleanup (e.g. a crashed process) can never collide
    // with this one.
    const suffix = randomUUID().slice(0, 8);
    const userIdA = `gv-a-${suffix}`;
    const userIdB = `gv-b-${suffix}`;

    facility = await createTestFacility('Teacher Scope Cross-Router Facility');
    teacherA = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: userIdA, roles: ['giao_vien'] }),
    );
    teacherB = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: userIdB, roles: ['giao_vien'] }),
    );
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: `gddt-scope-${suffix}`, roles: ['giam_doc_dao_tao'] }),
    );

    classBatchA = await seedClassBatch({ facilityId: facility.id });
    const teacherAAppUser = await seedAppUser({ facilityId: facility.id, userId: userIdA });
    await seedAppUser({ facilityId: facility.id, userId: userIdB });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatchA.id }, data: { teacherAppUserId: teacherAAppUser.id } }),
    );

    session = await seedClassSession({ facilityId: facility.id, classBatchId: classBatchA.id });

    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParentAccount(phone);
    phonesToClean.push(phone);
    enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatchA.id,
      parentAccountId: parent.id,
    });
  });

  afterEach(async () => {
    await testDbBypass((tx) => tx.qualitativeAssessment.deleteMany({ where: { facilityId: facility.id } }));
    await testDbBypass(async (tx) => {
      await tx.sessionEvidencePhoto.deleteMany({ where: { facilityId: facility.id } });
      await tx.sessionEvidence.deleteMany({ where: { facilityId: facility.id } });
    });
    // cleanupFacility deletes Submission rows (facility-scoped) FIRST — must
    // run before cleanupCurriculumUnits, which deletes the Exercise rows
    // Submission.exerciseId RESTRICT-references.
    await cleanupFacility(facility.id);
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  describe('attendance', () => {
    it('mark: FORBIDDEN for teacher B, OK for teacher A', async () => {
      await expect(
        teacherB.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'present' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const marked = await teacherA.attendance.mark({
        sessionId: session.id,
        enrollmentId: enrollment.id,
        status: 'present',
      });
      expect(marked.status).toBe('present');
    });

    it('markAll: FORBIDDEN for teacher B', async () => {
      await expect(
        teacherB.attendance.markAll({
          sessionId: session.id,
          entries: [{ enrollmentId: enrollment.id, status: 'present' }],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('listBySession: FORBIDDEN for teacher B, OK for teacher A', async () => {
      await expect(teacherB.attendance.listBySession({ sessionId: session.id })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(teacherA.attendance.listBySession({ sessionId: session.id })).resolves.toBeDefined();
    });

    it('director bypass: GĐĐT can mark on any class regardless of teacherAppUserId', async () => {
      await expect(
        gddt.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'late' }),
      ).resolves.toMatchObject({ status: 'late' });
    });
  });

  describe('submission.grade', () => {
    it('FORBIDDEN for teacher B, OK for teacher A', async () => {
      const unit = await seedCurriculumUnit();
      seededUnitIds.push(unit.id);
      const created = await gddt.exercise.create({
        curriculumUnitId: unit.id,
        type: 'homework',
        basePdfRef: 'exercise-pdf/scope-test.pdf',
        maxScore: 10,
        starReward: 5,
      });
      const exercise = await gddt.exercise.publish({ exerciseId: created.id });
      const submission = await testDbBypass((tx) =>
        tx.submission.create({
          data: {
            facilityId: facility.id,
            exerciseId: exercise.id,
            studentId: enrollment.studentId,
            annotationLayer: {},
            status: 'submitted',
            submittedAt: new Date(),
          },
        }),
      );

      await expect(
        teacherB.submission.grade({ submissionId: submission.id, score: 8 }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      await expect(
        teacherA.submission.grade({ submissionId: submission.id, score: 8 }),
      ).resolves.toMatchObject({ status: 'graded', score: 8 });
    });
  });

  describe('assessment', () => {
    it('draftComment: FORBIDDEN for teacher B when classSessionId is given', async () => {
      await expect(
        teacherB.assessment.draftComment({ studentId: enrollment.studentId, classSessionId: session.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('confirm/discard: FORBIDDEN for teacher B on an assessment tied to teacher A\'s session', async () => {
      const draft = await teacherA.assessment.draftComment({
        studentId: enrollment.studentId,
        classSessionId: session.id,
      });

      await expect(
        teacherB.assessment.confirm({ assessmentId: draft.id, content: 'Nội dung của giáo viên khác' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(teacherB.assessment.discard({ assessmentId: draft.id })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });

      // Teacher A (the real owner) can still confirm it.
      await expect(
        teacherA.assessment.confirm({ assessmentId: draft.id, content: 'Nhận xét chốt' }),
      ).resolves.toMatchObject({ status: 'confirmed' });
    });

    it('draftComment: period-based drafts are scoped through the student active enrollment', async () => {
      await expect(
        teacherB.assessment.draftComment({ studentId: enrollment.studentId, period: '2026-08' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('listBySession: FORBIDDEN for teacher B, OK for teacher A and director (M1)', async () => {
      await teacherA.assessment.draftComment({ studentId: enrollment.studentId, classSessionId: session.id });

      await expect(
        teacherB.assessment.listBySession({ classSessionId: session.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      await expect(teacherA.assessment.listBySession({ classSessionId: session.id })).resolves.toBeDefined();
      await expect(gddt.assessment.listBySession({ classSessionId: session.id })).resolves.toBeDefined();
    });
  });

  describe('sessionEvidence', () => {
    it('upsert: FORBIDDEN for teacher B, OK for teacher A', async () => {
      await expect(
        teacherB.sessionEvidence.upsert({ classSessionId: session.id, summary: 'Buổi học tốt' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      await expect(
        teacherA.sessionEvidence.upsert({ classSessionId: session.id, summary: 'Buổi học tốt' }),
      ).resolves.toMatchObject({ classSessionId: session.id });
    });

    it('addPhoto + publish: FORBIDDEN for teacher B on evidence teacher A owns', async () => {
      const evidence = await teacherA.sessionEvidence.upsert({
        classSessionId: session.id,
        summary: 'Buổi học tốt',
      });

      await expect(
        teacherB.sessionEvidence.addPhoto({ sessionEvidenceId: evidence.id, blobRef: 'blob/scope-test.jpg' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        teacherB.sessionEvidence.publish({ sessionEvidenceId: evidence.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const photo = await teacherA.sessionEvidence.addPhoto({
        sessionEvidenceId: evidence.id,
        blobRef: 'blob/scope-test.jpg',
      });
      expect(photo.id).toBeDefined();
      await expect(
        teacherA.sessionEvidence.publish({ sessionEvidenceId: evidence.id }),
      ).resolves.toMatchObject({ status: 'published' });
    });

    it('getBySession: FORBIDDEN for teacher B, OK for teacher A (M1)', async () => {
      await teacherA.sessionEvidence.upsert({ classSessionId: session.id, summary: 'Buổi học tốt' });

      await expect(
        teacherB.sessionEvidence.getBySession({ classSessionId: session.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      await expect(
        teacherA.sessionEvidence.getBySession({ classSessionId: session.id }),
      ).resolves.toMatchObject({ status: 'draft' });
    });
  });
});
