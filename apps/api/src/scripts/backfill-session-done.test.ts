// HR remediation phase 7 backfill (docs/26 phase-07, R2 #3): integration
// tests for the one-time pre-activation backfill script.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { backfillSessionDone } from './backfill-session-done.js';
import {
  cleanupFacility,
  createTestFacility,
  seedActiveEnrollment,
  seedClassBatch,
  seedClassSession,
  testDb,
  testDbBypass,
} from '../test/db.js';

describe('backfillSessionDone (HR remediation phase 7, R2 #3)', () => {
  let facility: { id: string };
  let classBatch: { id: string };
  const activatedAt = new Date('2026-07-12T00:00:00.000Z');

  beforeEach(async () => {
    facility = await createTestFacility('Backfill Session Done Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id, startDate: '2026-06-01', endDate: '2026-06-30' });
  });

  afterEach(async () => {
    await testDbBypass(async (tx) => {
      await tx.qualitativeAssessment.deleteMany({ where: { facilityId: facility.id } });
      await tx.sessionEvidencePhoto.deleteMany({ where: { facilityId: facility.id } });
      await tx.sessionEvidence.deleteMany({ where: { facilityId: facility.id } });
    });
    await cleanupFacility(facility.id);
  });

  async function seedFullDoneConditions(sessionId: string, enrollmentId: string, studentId: string): Promise<void> {
    await testDbBypass(async (tx) => {
      await tx.attendance.create({
        data: {
          facilityId: facility.id,
          classSessionId: sessionId,
          enrollmentId,
          studentId,
          status: 'present',
          markedById: 'teacher-backfill-1',
          markedAt: new Date('2026-06-03T12:00:00.000Z'),
        },
      });
      await tx.qualitativeAssessment.create({
        data: {
          facilityId: facility.id,
          studentId,
          classSessionId: sessionId,
          content: 'Tốt.',
          status: 'confirmed',
          confirmedById: 'teacher-backfill-1',
          confirmedAt: new Date('2026-06-03T12:05:00.000Z'),
        },
      });
      const evidence = await tx.sessionEvidence.create({
        data: {
          facilityId: facility.id,
          classSessionId: sessionId,
          summary: 'Buổi học.',
          status: 'published',
          publishedById: 'teacher-backfill-1',
          publishedAt: new Date('2026-06-03T12:10:00.000Z'),
        },
      });
      await tx.sessionEvidencePhoto.create({
        data: { facilityId: facility.id, sessionEvidenceId: evidence.id, blobRef: 'photos/backfill.jpg' },
      });
    });
  }

  it('marks a pre-activation session done, preserving the real historical doneAt', async () => {
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      sessionDate: new Date('2026-06-03T00:00:00.000Z'),
      startTime: new Date('2026-06-03T11:00:00.000Z'),
      endTime: new Date('2026-06-03T12:30:00.000Z'),
      status: 'planned',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await seedFullDoneConditions(session.id, enrollment.id, enrollment.studentId);

    const result = await backfillSessionDone(testDb(), activatedAt);

    expect(result.markedDone).toBe(1);
    const updated = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: session.id } }));
    expect(updated.status).toBe('done');
    // The real last-condition timestamp (evidence publishedAt), not activatedAt.
    expect(updated.doneAt?.toISOString()).toBe('2026-06-03T12:10:00.000Z');
  });

  it('does not backfill a session whose endTime is on/after the activation instant', async () => {
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      sessionDate: new Date('2026-07-12T00:00:00.000Z'),
      startTime: new Date('2026-07-12T01:00:00.000Z'),
      endTime: activatedAt, // exactly at activation -> excluded by strict `lt`
      status: 'planned',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await seedFullDoneConditions(session.id, enrollment.id, enrollment.studentId);

    const result = await backfillSessionDone(testDb(), activatedAt);

    expect(result.markedDone).toBe(0);
    const unchanged = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: session.id } }));
    expect(unchanged.status).toBe('planned');
  });

  it('does not backfill a pre-activation session missing a condition (no evidence)', async () => {
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      sessionDate: new Date('2026-06-03T00:00:00.000Z'),
      startTime: new Date('2026-06-03T11:00:00.000Z'),
      endTime: new Date('2026-06-03T12:30:00.000Z'),
      status: 'planned',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await testDbBypass(async (tx) => {
      await tx.attendance.create({
        data: {
          facilityId: facility.id,
          classSessionId: session.id,
          enrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          status: 'present',
          markedById: 'teacher-backfill-1',
          markedAt: new Date('2026-06-03T12:00:00.000Z'),
        },
      });
      await tx.qualitativeAssessment.create({
        data: {
          facilityId: facility.id,
          studentId: enrollment.studentId,
          classSessionId: session.id,
          content: 'OK',
          status: 'confirmed',
          confirmedById: 'teacher-backfill-1',
          confirmedAt: new Date('2026-06-03T12:05:00.000Z'),
        },
      });
    });

    const result = await backfillSessionDone(testDb(), activatedAt);

    expect(result.markedDone).toBe(0);
    const unchanged = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: session.id } }));
    expect(unchanged.status).toBe('planned');
  });

  it('is idempotent: a second backfill run after done is a no-op', async () => {
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      sessionDate: new Date('2026-06-03T00:00:00.000Z'),
      startTime: new Date('2026-06-03T11:00:00.000Z'),
      endTime: new Date('2026-06-03T12:30:00.000Z'),
      status: 'planned',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await seedFullDoneConditions(session.id, enrollment.id, enrollment.studentId);

    await backfillSessionDone(testDb(), activatedAt);
    const second = await backfillSessionDone(testDb(), activatedAt);

    expect(second.markedDone).toBe(0);
  });

  it('uses the real SESSION_DONE_ACTIVATED_AT constant as the default cutoff', async () => {
    const session = await seedClassSession({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      sessionDate: new Date('2026-06-03T00:00:00.000Z'),
      startTime: new Date('2026-06-03T11:00:00.000Z'),
      endTime: new Date('2026-06-03T12:30:00.000Z'),
      status: 'planned',
    });
    const enrollment = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });
    await seedFullDoneConditions(session.id, enrollment.id, enrollment.studentId);

    const result = await backfillSessionDone(testDb());

    expect(result.markedDone).toBe(1);
  });
});
