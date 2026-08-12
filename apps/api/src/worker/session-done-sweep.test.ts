// HR remediation phase 7: integration tests for the session-done sweep
// worker (docs/26 phase-07, plan.md "Session-done engine"). Sweep-only
// marking (R2 #1) — no router hooks — so every test drives real rows
// directly and calls `runDoneSweep`/`runCancelSweep` the same way the
// worker loop does.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { runCancelSweep, runDoneSweep } from './session-done-sweep.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedActiveEnrollment,
  seedClassBatch,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('session-done-sweep (HR remediation phase 7)', () => {
  let facility: { id: string };
  let gddt: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('Session Done Sweep Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-sweep-1', roles: ['giam_doc_dao_tao'] }),
    );
  });

  afterEach(async () => {
    // T3 tables carry no DELETE grant to cmc_app and no cascading FK from
    // ClassSession — clean them up before cleanupFacility (same pattern as
    // session-evidence/publish.test.ts's cleanupEvidenceTables).
    await testDbBypass(async (tx) => {
      await tx.qualitativeAssessment.deleteMany({ where: { facilityId: facility.id } });
      await tx.sessionEvidencePhoto.deleteMany({ where: { facilityId: facility.id } });
      await tx.sessionEvidence.deleteMany({ where: { facilityId: facility.id } });
    });
    await cleanupFacility(facility.id);
  });

  /** Seeds a real Course + ClassBatch + 1 ScheduleSlot + its 1 generated
   * ClassSession via the real classBatch.create flow, so scheduleSlotId and
   * the tail-append logic have something real to key off (not a bypass-seeded
   * row with no slot). */
  async function seedRealSession(opts: {
    sessionDateOnly: string; // YYYY-MM-DD ICT, must match weekday
    weekday: number;
    startTime: string;
    endTime: string;
    roomId?: string;
  }): Promise<{ classBatchId: string; sessionId: string; scheduleSlotId: string }> {
    const course = await gddt.course.create({
      program: 'UCREA',
      name: `Sweep Course ${randomUUID().slice(0, 6)}`,
    });
    const batch = await gddt.classBatch.create({
      courseId: course.id,
      startDate: opts.sessionDateOnly,
      endDate: opts.sessionDateOnly,
      roomId: opts.roomId,
      slots: [{ weekday: opts.weekday, startTime: opts.startTime, endTime: opts.endTime }],
    });
    const session = await testDbBypass((tx) =>
      tx.classSession.findFirstOrThrow({ where: { classBatchId: batch.classBatch.id } }),
    );
    return { classBatchId: batch.classBatch.id, sessionId: session.id, scheduleSlotId: session.scheduleSlotId! };
  }

  /** Fully satisfies the 3 done-conditions for `sessionId`/`enrollment` directly
   * (bypasses tRPC — worker-test isolation, same convention as the other
   * worker test suites in this directory). */
  async function seedAllDoneConditions(
    sessionId: string,
    enrollmentId: string,
    studentId: string,
  ): Promise<void> {
    await testDbBypass(async (tx) => {
      await tx.attendance.create({
        data: {
          facilityId: facility.id,
          classSessionId: sessionId,
          enrollmentId,
          studentId,
          status: 'present',
          markedById: 'teacher-sweep-1',
          markedAt: new Date(),
        },
      });
      await tx.qualitativeAssessment.create({
        data: {
          facilityId: facility.id,
          studentId,
          classSessionId: sessionId,
          content: 'Học sinh tích cực.',
          status: 'confirmed',
          confirmedById: 'teacher-sweep-1',
          confirmedAt: new Date(),
        },
      });
      const evidence = await tx.sessionEvidence.create({
        data: {
          facilityId: facility.id,
          classSessionId: sessionId,
          summary: 'Buổi học diễn ra tốt.',
          status: 'published',
          publishedById: 'teacher-sweep-1',
          publishedAt: new Date(),
        },
      });
      await tx.sessionEvidencePhoto.create({
        data: { facilityId: facility.id, sessionEvidenceId: evidence.id, blobRef: 'photos/sweep-done.jpg' },
      });
    });
  }

  // ---------------------------------------------------------------------
  // Task A: done-sweep
  // ---------------------------------------------------------------------

  it('marks a session done when all 3 conditions hold and now is past endTime', async () => {
    const { sessionId, classBatchId } = await seedRealSession({
      sessionDateOnly: '2026-08-03', // Monday
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId });
    await seedAllDoneConditions(sessionId, enrollment.id, enrollment.studentId);

    const now = new Date('2026-08-03T13:00:00.000Z'); // past 19:30 ICT (12:30 UTC) endTime
    const result = await runDoneSweep(testDb(), now);

    expect(result.markedDone).toBe(1);
    const session = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: sessionId } }));
    expect(session.status).toBe('done');
    expect(session.doneAt).not.toBeNull();
  });

  it('does not mark a session done when endTime has not passed yet (not a sweep candidate)', async () => {
    const { sessionId, classBatchId } = await seedRealSession({
      sessionDateOnly: '2026-08-03',
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId });
    await seedAllDoneConditions(sessionId, enrollment.id, enrollment.studentId);

    const now = new Date('2026-08-03T11:00:00.000Z'); // before endTime (12:30 UTC)
    const result = await runDoneSweep(testDb(), now);

    expect(result.markedDone).toBe(0);
    const session = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: sessionId } }));
    expect(session.status).toBe('planned');
  });

  it('leaves a session unmarked when the evidence condition is missing (attendance + assessment only)', async () => {
    const { sessionId, classBatchId } = await seedRealSession({
      sessionDateOnly: '2026-08-03',
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId });
    await testDbBypass(async (tx) => {
      await tx.attendance.create({
        data: {
          facilityId: facility.id,
          classSessionId: sessionId,
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          status: 'present',
          markedById: 'teacher-sweep-1',
          markedAt: new Date(),
        },
      });
      await tx.qualitativeAssessment.create({
        data: {
          facilityId: facility.id,
          studentId: enrollment.studentId,
          classSessionId: sessionId,
          content: 'OK',
          status: 'confirmed',
          confirmedById: 'teacher-sweep-1',
          confirmedAt: new Date(),
        },
      });
    });

    const now = new Date('2026-08-03T13:00:00.000Z');
    const result = await runDoneSweep(testDb(), now);

    expect(result.markedDone).toBe(0);
    const session = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: sessionId } }));
    expect(session.status).toBe('planned');
  });

  it('is idempotent: a second sweep run after done is a no-op', async () => {
    const { sessionId, classBatchId } = await seedRealSession({
      sessionDateOnly: '2026-08-03',
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId });
    await seedAllDoneConditions(sessionId, enrollment.id, enrollment.studentId);

    const now = new Date('2026-08-03T13:00:00.000Z');
    await runDoneSweep(testDb(), now);
    const second = await runDoneSweep(testDb(), now);

    expect(second.markedDone).toBe(0);
  });

  // ---------------------------------------------------------------------
  // Task B: cancel + restamp (no makeup — Plan 2 owner rule)
  // ---------------------------------------------------------------------

  it('cancels a 0-present session past endTime+24h and restamps remaining units', async () => {
    const { sessionId } = await seedRealSession({
      sessionDateOnly: '2026-08-03', // Monday
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });

    const now = new Date('2026-08-05T00:00:00.000Z'); // > 24h past 12:30 UTC endTime
    const outcomes = await runCancelSweep(testDb(), now);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.sessionId).toBe(sessionId);
    expect(outcomes[0]!.roomConflict).toBe(false);

    const original = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: sessionId } }));
    expect(original.status).toBe('cancelled');

    const audit = await testDb().auditLog.findFirst({
      where: { action: 'worker.cancelSweep.restamp', entityId: sessionId },
    });
    expect(audit).not.toBeNull();
  });

  it('leaves a 0-present session alone before the 24h grace window elapses', async () => {
    const { sessionId } = await seedRealSession({
      sessionDateOnly: '2026-08-03',
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });

    const now = new Date('2026-08-03T13:00:00.000Z'); // 30 min past endTime, well inside 24h grace
    const outcomes = await runCancelSweep(testDb(), now);

    expect(outcomes).toHaveLength(0);
    const session = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: sessionId } }));
    expect(session.status).toBe('planned');
  });

  it('race: a present attendance marked before the sweep blocks the auto-cancel', async () => {
    const { sessionId, classBatchId } = await seedRealSession({
      sessionDateOnly: '2026-08-03',
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId });
    await testDbBypass((tx) =>
      tx.attendance.create({
        data: {
          facilityId: facility.id,
          classSessionId: sessionId,
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          status: 'present',
          markedById: 'teacher-sweep-1',
          markedAt: new Date(),
        },
      }),
    );

    const now = new Date('2026-08-05T00:00:00.000Z');
    const outcomes = await runCancelSweep(testDb(), now);

    expect(outcomes).toHaveLength(0);
    const session = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: sessionId } }));
    expect(session.status).toBe('planned');
  });

  it('an ad-hoc session (no scheduleSlot) cancels via the restamp path', async () => {
    const batch = await seedClassBatch({ facilityId: facility.id, startDate: '2026-08-01', endDate: '2026-08-31' });
    // Direct seed leaves scheduleSlotId null (ad-hoc session).
    const adHoc = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: batch.id,
          sessionDate: new Date('2026-08-03T00:00:00.000Z'),
          startTime: new Date('2026-08-03T11:00:00.000Z'),
          endTime: new Date('2026-08-03T12:30:00.000Z'),
          status: 'planned',
        },
      }),
    );

    const now = new Date('2026-08-05T00:00:00.000Z');
    const outcomes = await runCancelSweep(testDb(), now);

    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]!.sessionId).toBe(adHoc.id);
    expect(outcomes[0]!.roomConflict).toBe(false);

    const session = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: adHoc.id } }));
    expect(session.status).toBe('cancelled');
  });

  it('concurrency: two simultaneous sweep runs cancel exactly once', async () => {
    const { sessionId } = await seedRealSession({
      sessionDateOnly: '2026-08-03',
      weekday: 1,
      startTime: '18:00',
      endTime: '19:30',
    });

    const now = new Date('2026-08-05T00:00:00.000Z');
    const [outcomesA, outcomesB] = await Promise.all([
      runCancelSweep(testDb(), now),
      runCancelSweep(testDb(), now),
    ]);

    const combined = [...outcomesA, ...outcomesB].filter((o) => o.sessionId === sessionId);
    // Exactly one of the two concurrent runs wins the conditional cancel.
    expect(combined).toHaveLength(1);

    const original = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: sessionId } }));
    expect(original.status).toBe('cancelled');
  });
});
