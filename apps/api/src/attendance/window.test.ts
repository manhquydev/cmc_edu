// Attendance teacher window (teaching spine phase 5).
// Enforced only when ATTENDANCE_WINDOW_ENFORCED=1 (or production).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedActiveEnrollment,
  seedAppUser,
  seedClassBatch,
  testDbBypass,
} from '../test/db.js';
import { assertAttendanceWindow, isAttendanceWindowEnforced } from './router.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('attendance window (phase 5)', () => {
  let facility: { id: string };
  let teacher: Caller;
  let gddt: Caller;
  let classBatch: { id: string };
  const prev = process.env.ATTENDANCE_WINDOW_ENFORCED;

  beforeEach(async () => {
    process.env.ATTENDANCE_WINDOW_ENFORCED = '1';
    facility = await createTestFacility('Att Window Facility');
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-win-1', roles: ['giao_vien'] }),
    );
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-win-1', roles: ['giam_doc_dao_tao'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    const teacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-win-1' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: teacherAppUser.id } }),
    );
  });

  afterEach(async () => {
    if (prev === undefined) delete process.env.ATTENDANCE_WINDOW_ENFORCED;
    else process.env.ATTENDANCE_WINDOW_ENFORCED = prev;
    await cleanupFacility(facility.id);
  });

  it('isAttendanceWindowEnforced reads ATTENDANCE_WINDOW_ENFORCED', () => {
    process.env.ATTENDANCE_WINDOW_ENFORCED = '1';
    expect(isAttendanceWindowEnforced()).toBe(true);
    process.env.ATTENDANCE_WINDOW_ENFORCED = '0';
    expect(isAttendanceWindowEnforced()).toBe(false);
  });

  it('assertAttendanceWindow: director overrides closed window', () => {
    const past = {
      startTime: new Date('2020-01-01T10:00:00.000Z'),
      endTime: new Date('2020-01-01T11:00:00.000Z'),
    };
    expect(() =>
      assertAttendanceWindow(past, { roles: ['giao_vien'] }, new Date()),
    ).toThrow();
    expect(() =>
      assertAttendanceWindow(past, { roles: ['giam_doc_dao_tao'] }, new Date()),
    ).not.toThrow();
  });

  it('teacher mark rejected outside window; director succeeds', async () => {
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: classBatch.id,
          sessionDate: new Date('2020-01-01T00:00:00.000Z'),
          startTime: new Date('2020-01-01T10:00:00.000Z'),
          endTime: new Date('2020-01-01T11:00:00.000Z'),
          status: 'planned',
        },
      }),
    );
    const enrollment = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: classBatch.id,
    });

    await expect(
      teacher.attendance.mark({
        sessionId: session.id,
        enrollmentId: enrollment.id,
        status: 'present',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const marked = await gddt.attendance.mark({
      sessionId: session.id,
      enrollmentId: enrollment.id,
      status: 'present',
    });
    expect(marked.status).toBe('present');
  });

  it('teacher mark allowed inside window', async () => {
    const now = Date.now();
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: classBatch.id,
          sessionDate: new Date(now),
          startTime: new Date(now - 15 * 60_000),
          endTime: new Date(now + 60 * 60_000),
          status: 'planned',
        },
      }),
    );
    const enrollment = await seedActiveEnrollment({
      facilityId: facility.id,
      classBatchId: classBatch.id,
    });

    const marked = await teacher.attendance.mark({
      sessionId: session.id,
      enrollmentId: enrollment.id,
      status: 'late',
    });
    expect(marked.status).toBe('late');
  });
});
