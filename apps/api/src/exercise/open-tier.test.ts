// T2-II integration tests (US-015, docs/26 WF-P2-03, ADR 0038 verbatim,
// TL19 §4): the exercise.openForStudent / listForStudent Tier A/B gate.
//
// F1 remediation: every `studentCaller()` in this file uses a real
// `ParentAccount.id` (FK constraint on Guardian) and a real approved
// `Guardian` row — `loadLmsStudent` now verifies the Guardian link before
// disclosing any student data. The negative test at the bottom proves that a
// parent requesting a student they have NO Guardian link for gets FORBIDDEN.

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
const FUTURE = new Date('2999-01-01T00:00:00.000Z');

describe('exercise.openForStudent / listForStudent (US-015, ADR 0038 Tier A/B)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let classBatch: { id: string; courseId: string };
  let parent: { id: string; phone: string };
  const seededUnitIds: string[] = [];
  // Extra ParentAccount phones created inside individual tests (e.g. the F1
  // negative test). cleanupFacility in afterEach deletes the Guardian rows
  // first (FK), so these accounts can be cleaned up safely afterward.
  const extraParentPhones: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Open-Tier Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-ot-1', roles: ['giam_doc_dao_tao'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    // Teacher class-scoping remediation (2026-07-15): the Tier B tests below
    // call attendance.mark as setup — assign a shared teacher to the class.
    const teacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-ot-shared' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: teacherAppUser.id } }),
    );
    // Real ParentAccount needed for Guardian FK (F1 remediation).
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);
  });

  afterEach(async () => {
    await cleanupCurriculumUnits(...seededUnitIds);
    seededUnitIds.length = 0;
    // cleanupFacility deletes Guardian rows first (FK) before we delete accounts.
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(parent.phone, ...extraParentPhones);
    extraParentPhones.length = 0;
  });

  async function seedUnit() {
    const unit = await seedCurriculumUnit();
    seededUnitIds.push(unit.id);
    return unit;
  }

  async function publishedExerciseFor(unitId: string) {
    const created = await gddt.exercise.create({
      curriculumUnitId: unitId,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });
    return gddt.exercise.publish({ exerciseId: created.id });
  }

  /** Builds an LMS caller using the test's real ParentAccount. */
  function studentCaller(studentId: string): Caller {
    return appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, studentId, kind: 'student' }));
  }

  /** Enrolls a student AND creates an approved Guardian link for `parent`.
   * Dual-gate ready by default (wide range) so attendance.mark on unit-stamped
   * sessions works. Pass unitRange: null for entitlement-gate negatives. */
  async function seedStudent(opts?: {
    unitRange?: { fromOrderGlobal: number; toOrderGlobal: number } | null;
  }) {
    const unitRange =
      opts && 'unitRange' in opts && opts.unitRange === null
        ? undefined
        : (opts?.unitRange ?? { fromOrderGlobal: 1, toOrderGlobal: 10_000 });
    return seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
      unitRange,
    });
  }

  // ---- Base condition ----

  it('a draft (unpublished) exercise never appears, even if the unit tier is open', async () => {
    const unit = await seedUnit();
    const created = await gddt.exercise.create({
      curriculumUnitId: unit.id,
      type: 'homework',
      basePdfRef: 'exercise-pdf/seed.pdf',
    });
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      endTime: PAST,
    });
    const enrollment = await seedStudent();

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === created.id)).toBeUndefined();
  });

  it('blocked_lms students see an empty list regardless of open tiers', async () => {
    const unit = await seedUnit();
    await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      endTime: PAST,
    });
    const enrollment = await seedStudent();
    await testDbBypass((tx) => tx.student.update({ where: { id: enrollment.studentId }, data: { lifecycle: 'blocked_lms' } }));

    // blocked_lms is excluded from getApprovedChildren — loadLmsStudent will throw FORBIDDEN.
    await expect(studentCaller(enrollment.studentId).exercise.openForStudent()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  // ---- Tier A ----

  it('Tier A: hides the exercise until the (non-makeup) teaching session has ENDED', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: false,
      endTime: FUTURE,
    });
    const enrollment = await seedStudent();

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  it('Tier A: opens for the WHOLE batch once the teaching session has ended (ICT)', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: false,
      endTime: PAST,
    });
    const studentA = await seedStudent();
    const studentB = await seedStudent();

    const resultA = await studentCaller(studentA.studentId).exercise.openForStudent();
    const resultB = await studentCaller(studentB.studentId).exercise.openForStudent();
    expect(resultA.items.map((e) => e.id)).toContain(exercise.id);
    expect(resultB.items.map((e) => e.id)).toContain(exercise.id);
  });

  it('Tier A: a cancelled session never opens the unit, even if its endTime has passed', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: false,
      status: 'cancelled',
      endTime: PAST,
    });
    const enrollment = await seedStudent();

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  it('listForStudent is an alias of openForStudent', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      endTime: PAST,
    });
    const enrollment = await seedStudent();

    const result = await studentCaller(enrollment.studentId).exercise.listForStudent();
    expect(result.items.map((e) => e.id)).toContain(exercise.id);
  });

  // ---- Tier B ----

  it('Tier B: a makeup session (already ENDED) the student attended present/late opens the unit ONLY for that student', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    // Metric & Data Integrity remediation (scenario audit): Tier B now
    // mirrors Tier A's "session must have ended" gate — explicit PAST so this
    // positive-outcome test isolates the attendance-status variable only.
    const makeup = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: true,
      endTime: PAST,
    });
    const present = await seedStudent();
    const bystander = await seedStudent();

    const teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ot-shared', roles: ['giao_vien'] }),
    );
    await teacher.attendance.mark({ sessionId: makeup.id, enrollmentId: present.id, status: 'present' });

    const resultPresent = await studentCaller(present.studentId).exercise.openForStudent();
    const resultBystander = await studentCaller(bystander.studentId).exercise.openForStudent();

    expect(resultPresent.items.map((e) => e.id)).toContain(exercise.id);
    expect(resultBystander.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  it('Tier B: a makeup session the student attended LATE also opens the unit for them (once ended)', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    const makeup = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: true,
      endTime: PAST,
    });
    const late = await seedStudent();
    const teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ot-shared', roles: ['giao_vien'] }),
    );
    await teacher.attendance.mark({ sessionId: makeup.id, enrollmentId: late.id, status: 'late' });

    const result = await studentCaller(late.studentId).exercise.openForStudent();
    expect(result.items.map((e) => e.id)).toContain(exercise.id);
  });

  it('Tier B: a makeup session the student was marked ABSENT for does not open the unit', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    const makeup = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: true,
      endTime: PAST,
    });
    const absent = await seedStudent();
    const teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ot-shared', roles: ['giao_vien'] }),
    );
    await teacher.attendance.mark({ sessionId: makeup.id, enrollmentId: absent.id, status: 'absent' });

    const result = await studentCaller(absent.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  it('Metric & Data Integrity remediation (scenario audit): a makeup session marked present in ADVANCE (endTime in the future) does NOT open the unit yet', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    const makeup = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: true,
      endTime: FUTURE,
    });
    const student = await seedStudent();
    const teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ot-shared', roles: ['giao_vien'] }),
    );
    await teacher.attendance.mark({ sessionId: makeup.id, enrollmentId: student.id, status: 'present' });

    const result = await studentCaller(student.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  it('attendance on a NON-makeup session never triggers Tier B (only Tier A can open via a regular session)', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    const regular = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: false,
      endTime: FUTURE,
    });
    const enrollment = await seedStudent();
    const teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-ot-shared', roles: ['giao_vien'] }),
    );
    await teacher.attendance.mark({ sessionId: regular.id, enrollmentId: enrollment.id, status: 'present' });

    const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
    expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
  });

  // ---- LMS session shape ----

  it('rejects a call with no selected student profile', async () => {
    const noStudent = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, kind: 'student' }));
    await expect(noStudent.exercise.openForStudent()).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ---- F1 remediation: child-data ownership gate ----

  it('FORBIDDEN when the studentId belongs to a different parent (no approved Guardian link)', async () => {
    // Enroll a student genuinely linked to a DIFFERENT parent (no Guardian for our `parent`).
    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    extraParentPhones.push(otherPhone); // cleaned up in afterEach, after cleanupFacility removes Guardian rows
    const otherParent = await seedParentAccount(otherPhone);
    const otherEnrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: otherParent.id,
    });

    // Our parent tries to access the other parent's student — must be FORBIDDEN.
    await expect(
      studentCaller(otherEnrollment.studentId).exercise.openForStudent(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // ---- Plan 2: open-tier kill-switch + entitlement gate ----

  it('LMS_OPEN_TIER_ENABLED=0 returns empty open set even when Tier A would open', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: false,
      endTime: PAST,
    });
    const enrollment = await seedStudent();

    const prev = process.env.LMS_OPEN_TIER_ENABLED;
    process.env.LMS_OPEN_TIER_ENABLED = '0';
    try {
      const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
      expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
      expect(result.items).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.LMS_OPEN_TIER_ENABLED;
      else process.env.LMS_OPEN_TIER_ENABLED = prev;
    }
  });

  it('LMS_ENTITLEMENT_GATE=1 hides units outside EnrollmentUnitRange', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: false,
      endTime: PAST,
    });
    const enrollment = await seedStudent({ unitRange: null });
    // No unit ranges granted — entitlement gate must empty the open set.

    const prevOpen = process.env.LMS_OPEN_TIER_ENABLED;
    const prevGate = process.env.LMS_ENTITLEMENT_GATE;
    process.env.LMS_OPEN_TIER_ENABLED = '1';
    process.env.LMS_ENTITLEMENT_GATE = '1';
    try {
      const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
      expect(result.items.find((e) => e.id === exercise.id)).toBeUndefined();
    } finally {
      if (prevOpen === undefined) delete process.env.LMS_OPEN_TIER_ENABLED;
      else process.env.LMS_OPEN_TIER_ENABLED = prevOpen;
      if (prevGate === undefined) delete process.env.LMS_ENTITLEMENT_GATE;
      else process.env.LMS_ENTITLEMENT_GATE = prevGate;
    }
  });

  it('LMS_ENTITLEMENT_GATE=1 keeps units covered by EnrollmentUnitRange', async () => {
    const unit = await seedUnit();
    const exercise = await publishedExerciseFor(unit.id);
    await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      curriculumUnitId: unit.id,
      isMakeup: false,
      endTime: PAST,
    });
    const enrollment = await seedStudent();
    await testDbBypass((tx) =>
      tx.enrollmentUnitRange.create({
        data: {
          facilityId: facility.id,
          enrollmentId: enrollment.id,
          fromOrderGlobal: unit.orderGlobal,
          toOrderGlobal: unit.orderGlobal,
        },
      }),
    );

    const prevOpen = process.env.LMS_OPEN_TIER_ENABLED;
    const prevGate = process.env.LMS_ENTITLEMENT_GATE;
    process.env.LMS_OPEN_TIER_ENABLED = '1';
    process.env.LMS_ENTITLEMENT_GATE = '1';
    try {
      const result = await studentCaller(enrollment.studentId).exercise.openForStudent();
      expect(result.items.map((e) => e.id)).toContain(exercise.id);
    } finally {
      if (prevOpen === undefined) delete process.env.LMS_OPEN_TIER_ENABLED;
      else process.env.LMS_OPEN_TIER_ENABLED = prevOpen;
      if (prevGate === undefined) delete process.env.LMS_ENTITLEMENT_GATE;
      else process.env.LMS_ENTITLEMENT_GATE = prevGate;
    }
  });
});
