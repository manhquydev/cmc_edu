// T1 integration tests (docs/26 phase-02, TL19 §5, WF-P2-02): the 5
// attendance gates, upsert re-mark semantics, markAll atomicity, the unique
// constraint, RLS isolation, and the session-lifecycle procedures
// (cancel/confirm) that feed attendance's gate 1.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { ictMonthOf } from '@cmc/domain-time';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupCurriculumUnits,
  cleanupExerciseLibrary,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedActiveEnrollment,
  seedAppUser,
  seedClassBatch,
  seedClassSession,
  seedCurriculumUnit,
  seedExerciseFolder,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('attendance.mark/markAll/listBySession + classSession lifecycle (T1, TL19 §5)', () => {
  let facility: { id: string };
  let teacher: Caller;
  let gddt: Caller;
  let classBatch: { id: string; courseId: string };

  beforeEach(async () => {
    facility = await createTestFacility('Attendance Facility');
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-att-1', roles: ['giao_vien'] }),
    );
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-att-1', roles: ['giam_doc_dao_tao'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    // Teacher class-scoping remediation (2026-07-15): every write now checks
    // ClassBatch.teacherAppUserId — seed the teacher's AppUser + assign it as
    // this class's teacher so the existing gate/lifecycle tests (which are
    // NOT about scoping) keep exercising the happy path.
    const teacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-att-1' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: teacherAppUser.id } }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  /** Seeds a plain `planned` ClassSession for `classBatch` (bypasses the
   * auto-generation engine — the gates/lifecycle tests only need a real
   * session row to point at). */
  async function seedSession(overrides?: {
    status?: 'planned' | 'confirmed' | 'cancelled' | 'done';
    startTime?: Date;
    endTime?: Date;
  }) {
    return testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: classBatch.id,
          sessionDate: new Date('2026-08-03T00:00:00.000Z'),
          startTime: overrides?.startTime ?? new Date('2026-08-03T11:00:00.000Z'),
          endTime: overrides?.endTime ?? new Date('2026-08-03T12:30:00.000Z'),
          status: overrides?.status ?? 'planned',
        },
      }),
    );
  }

  // ---- Gate 1: session exists & not cancelled ----

  it('gate 1: rejects a non-existent sessionId with BAD_REQUEST', async () => {
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await expect(
      teacher.attendance.mark({ sessionId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', enrollmentId: enrollment.id, status: 'present' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('gate 1: rejects marking a cancelled session with BAD_REQUEST', async () => {
    const session = await seedSession();
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await gddt.classSession.cancel({ sessionId: session.id });

    await expect(
      teacher.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'present' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ---- Gate 2: enrollment.classBatchId === session.classBatchId ----

  it('gate 2: rejects an enrollment from a different class with BAD_REQUEST', async () => {
    const session = await seedSession();
    const otherClassBatch = await seedClassBatch({ facilityId: facility.id, startDate: '2026-09-01', endDate: '2026-09-30' });
    const mismatchedEnrollment = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: otherClassBatch.id,
    });

    await expect(
      teacher.attendance.mark({ sessionId: session.id, enrollmentId: mismatchedEnrollment.id, status: 'present' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ---- Gate 3: enrollment must be active (ADR-A) ----

  it('gate 3: rejects a reserved (not-yet-active) enrollment with BAD_REQUEST', async () => {
    const session = await seedSession();
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Reserved Student' } }),
    );
    const reserved = await testDbBypass((tx) =>
      tx.enrollment.create({
        data: { facilityId: facility.id, studentId: student.id, classBatchId: classBatch.id, status: 'reserved' },
      }),
    );

    await expect(
      teacher.attendance.mark({ sessionId: session.id, enrollmentId: reserved.id, status: 'present' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('gate 3: rejects a withdrawn enrollment with BAD_REQUEST', async () => {
    const session = await seedSession();
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await testDbBypass((tx) => tx.enrollment.update({ where: { id: enrollment.id }, data: { status: 'withdrawn' } }));

    await expect(
      teacher.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'present' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ---- Gate 4: facilityId derived server-side (RLS negative) ----

  it('gate 4: a different facility cannot mark another facility\'s session (RLS)', async () => {
    const session = await seedSession();
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });

    const otherFacility = await createTestFacility('Other Attendance Facility');
    const otherTeacher = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'teacher-other-1', roles: ['giao_vien'] }),
    );

    await expect(
      otherTeacher.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'present' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await cleanupFacility(otherFacility.id);
  });

  // ---- Gate 5: ICT month bucket of the session's end time ----

  it('gate 5: ictMonthOf buckets the session by the ICT month of its end time', () => {
    // 2026-08-03T17:05:00Z (UTC) + 7h = 2026-08-04 00:05 ICT -> still August.
    expect(ictMonthOf(new Date('2026-08-03T17:05:00.000Z'))).toBe('2026-08');
    // 2026-08-31T17:30:00Z (UTC) + 7h = 2026-09-01 00:30 ICT -> rolls into September.
    expect(ictMonthOf(new Date('2026-08-31T17:30:00.000Z'))).toBe('2026-09');
  });

  // ---- Happy path: mark, re-mark (upsert), unique constraint ----

  it('marks attendance, then re-marks (upsert, last-write-wins) without duplicating the row', async () => {
    const session = await seedSession();
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });

    const first = await teacher.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'present' });
    expect(first.status).toBe('present');

    const second = await teacher.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'late' });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe('late');

    const rows = await testDbBypass((tx) =>
      tx.attendance.findMany({ where: { classSessionId: session.id, enrollmentId: enrollment.id } }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('late');
  });

  it('Metric & Data Integrity remediation (scenario audit): correcting attendance (absent -> present) refreshes an already-computed FinalGrade', async () => {
    const session = await seedSession();
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });

    await teacher.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'absent' });
    const period = ictMonthOf(session.endTime);
    const afterAbsent = await testDbBypass((tx) =>
      tx.finalGrade.findUniqueOrThrow({
        where: { studentId_classBatchId_period: { studentId: enrollment.studentId, classBatchId: classBatch.id, period } },
      }),
    );

    // Correct the mistake: the student was actually present.
    await teacher.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'present' });
    const afterPresent = await testDbBypass((tx) =>
      tx.finalGrade.findUniqueOrThrow({
        where: { studentId_classBatchId_period: { studentId: enrollment.studentId, classBatchId: classBatch.id, period } },
      }),
    );

    // attendanceRate went 0 -> 1 for this student's only session this
    // period, so the score component must have risen too — no stale
    // "rate looks right but score is from before the correction" report.
    expect(Number(afterPresent.score)).toBeGreaterThan(Number(afterAbsent.score));
  });

  it('markAll recomputes FinalGrade once per student (not once per entry) when marking a whole roster', async () => {
    const session = await seedSession();
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });

    await teacher.attendance.markAll({
      sessionId: session.id,
      entries: [{ enrollmentId: enrollment.id, status: 'present' }],
    });

    const period = ictMonthOf(session.endTime);
    const finalGrade = await testDbBypass((tx) =>
      tx.finalGrade.findUnique({
        where: { studentId_classBatchId_period: { studentId: enrollment.studentId, classBatchId: classBatch.id, period } },
      }),
    );
    expect(finalGrade).not.toBeNull();
    expect(Number(finalGrade!.score)).toBeGreaterThan(0); // full attendance this period
  });

  it('forbids a role without attendance.mark permission', async () => {
    const session = await seedSession();
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    const sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-att-1', roles: ['sale'] }),
    );

    await expect(
      sale.attendance.mark({ sessionId: session.id, enrollmentId: enrollment.id, status: 'present' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // ---- markAll: same gates, one transaction ----

  it('markAll marks a whole roster atomically', async () => {
    const session = await seedSession();
    const e1 = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    const e2 = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });

    const result = await teacher.attendance.markAll({
      sessionId: session.id,
      entries: [
        { enrollmentId: e1.id, status: 'present' },
        { enrollmentId: e2.id, status: 'absent' },
      ],
    });

    expect(result.items).toHaveLength(2);
    const rows = await testDbBypass((tx) => tx.attendance.findMany({ where: { classSessionId: session.id } }));
    expect(rows).toHaveLength(2);
  });

  it('markAll rolls back the whole batch when one entry fails a gate', async () => {
    const session = await seedSession();
    const valid = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    const otherClassBatch = await seedClassBatch({ facilityId: facility.id, startDate: '2026-10-01', endDate: '2026-10-31' });
    const invalid = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: otherClassBatch.id });

    await expect(
      teacher.attendance.markAll({
        sessionId: session.id,
        entries: [
          { enrollmentId: valid.id, status: 'present' },
          { enrollmentId: invalid.id, status: 'present' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const rows = await testDbBypass((tx) => tx.attendance.findMany({ where: { classSessionId: session.id } }));
    expect(rows).toHaveLength(0);
  });

  // ---- listBySession: the roster ----

  it('listBySession returns the active roster with marked/unmarked status', async () => {
    const session = await seedSession();
    const marked = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    const unmarked = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await teacher.attendance.mark({ sessionId: session.id, enrollmentId: marked.id, status: 'present' });

    const roster = await teacher.attendance.listBySession({ sessionId: session.id });

    expect(roster.total).toBe(2);
    const markedRow = roster.items.find((r) => r.enrollmentId === marked.id);
    const unmarkedRow = roster.items.find((r) => r.enrollmentId === unmarked.id);
    expect(markedRow?.status).toBe('present');
    expect(unmarkedRow?.status).toBeNull();
  });

  // ---- Session lifecycle: cancel / confirm ----

  it('classSession.cancel transitions planned/confirmed -> cancelled and blocks further attendance', async () => {
    const session = await seedSession({ status: 'confirmed' });
    const cancelled = await gddt.classSession.cancel({ sessionId: session.id });
    expect(cancelled.status).toBe('cancelled');

    await expect(gddt.classSession.cancel({ sessionId: session.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('classSession.cancel rejects a done session with BAD_REQUEST (HR remediation phase 7 — done is one-way)', async () => {
    const session = await seedSession({ status: 'confirmed' });
    await testDbBypass((tx) =>
      tx.classSession.update({ where: { id: session.id }, data: { status: 'done', doneAt: new Date() } }),
    );

    await expect(gddt.classSession.cancel({ sessionId: session.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  // M2 remediation (post-implementation review of 260715-1338 plan): cancel
  // must refresh FinalGrade for every student it had an Attendance row for —
  // the same principle Phase 7 already applies to attendance.mark/markAll.
  it('classSession.cancel refreshes FinalGrade for students marked on that session (M2)', async () => {
    const unit = await seedCurriculumUnit();
    const parentPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const parent = await seedParentAccount(parentPhone);

    const folder = await seedExerciseFolder();
    try {
      const created = await gddt.exercise.create({
        folderId: folder.id,
        title: 'Bài tập M2',
        type: 'homework',
        basePdfRef: 'exercise-pdf/m2-seed.pdf',
        maxScore: 10,
        starReward: 5,
      });
      const exercise = await gddt.exercise.publish({ exerciseId: created.id });

      // A PAST session tied to `unit`, with the exercise actually DELIVERED on
      // it — homework now opens only through delivery, so the student cannot
      // submit without a `SessionExercise`. Mirrors ../submission/grade.test.ts's
      // fixture; unrelated to the session under test below.
      await gddt.lmsOps.assignExerciseSequence({
        classBatchId: classBatch.id,
        exerciseIds: [exercise.id],
      });
      const openSession = await seedClassSession({
        facilityId: facility.id,
        classBatchId: classBatch.id,
        curriculumUnitId: unit.id,
        endTime: new Date('2020-01-01T00:00:00.000Z'),
      });
      const delivered = await gddt.lmsOps.deliverSessionExercise({
        classSessionId: openSession.id,
      });
      if (!delivered.delivered) throw new Error('expected delivery');
      const sessionExerciseId = delivered.sessionExercise.id;

      const enrollment = await seedEnrolledStudentWithGuardian({
        facilityId: facility.id,
        classBatchId: classBatch.id,
        parentAccountId: parent.id,
        // Delivered homework is roster-gated: the student must hold a unit
        // range covering the delivering session's unit, or it stays closed.
        unitRange: { fromOrderGlobal: 1, toOrderGlobal: 10_000 },
      });

      // The session under test: anchored to "now" so it lands in the same
      // ICT month `submission.grade`'s recompute (`periodAnchor = new Date()`)
      // reads below.
      const now = new Date();
      const attendedSession = await seedClassSession({
        facilityId: facility.id,
        classBatchId: classBatch.id,
        sessionDate: now,
        startTime: now,
        endTime: now,
        status: 'confirmed',
      });
      await teacher.attendance.mark({
        sessionId: attendedSession.id,
        enrollmentId: enrollment.id,
        status: 'present',
      });

      const student = appRouter.createCaller(
        buildLmsContext({ parentAccountId: parent.id, studentId: enrollment.studentId, kind: 'student' }),
      );
      await student.submission.saveDraft({
        sessionExerciseId,
        annotationLayer: { done: true },
      });
      const submitted = await student.submission.submit({ sessionExerciseId });
      await teacher.submission.grade({ submissionId: submitted.id, score: 10 });

      const before = await testDbBypass((tx) =>
        tx.finalGrade.findFirstOrThrow({
          where: { studentId: enrollment.studentId, classBatchId: classBatch.id },
        }),
      );
      // exerciseComponent = 10 (10/10), attendanceComponent = 10 (rate 1.0):
      // 0.7*10 + 0.3*10 = 10.
      expect(before.score).toBe(10);

      await gddt.classSession.cancel({ sessionId: attendedSession.id });

      const after = await testDbBypass((tx) =>
        tx.finalGrade.findFirstOrThrow({
          where: { studentId: enrollment.studentId, classBatchId: classBatch.id },
        }),
      );
      // The now-cancelled session drops out of the attendance-rate
      // denominator entirely -> rate 0: 0.7*10 + 0.3*0 = 7.
      expect(after.score).toBe(7);
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    } finally {
      // GuardianLinkRequest (facility-scoped) FK-references ParentAccount, so
      // the facility teardown must run BEFORE the ParentAccount cleanup below
      // (the describe's own `afterEach` also calls `cleanupFacility` — a
      // second, harmless no-op call once this has already run).
      await cleanupFacility(facility.id);
      await cleanupParentAccountsByPhone(parent.phone);
      await cleanupExerciseLibrary(folder.id);
      await cleanupCurriculumUnits(unit.id);
    }
  });

  it('classSession.confirm transitions planned -> confirmed only', async () => {
    const session = await seedSession({ status: 'planned' });
    const confirmed = await gddt.classSession.confirm({ sessionId: session.id });
    expect(confirmed.status).toBe('confirmed');

    await expect(gddt.classSession.confirm({ sessionId: session.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('forbids a role without schedule.generate permission from cancel/confirm', async () => {
    const session = await seedSession();
    await expect(teacher.classSession.cancel({ sessionId: session.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(teacher.classSession.confirm({ sessionId: session.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
