// classSession.get + doneProgress — Session Detail hub read APIs.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('classSession.get + doneProgress', () => {
  let facility: { id: string };
  let gddt: Caller;
  let giaoVien: Caller;
  let classBatchId: string;
  let sessionId: string;

  beforeEach(async () => {
    facility = await createTestFacility('SessionGet-Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'session-get-gddt',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    giaoVien = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'session-get-gv',
        roles: ['giao_vien'],
      }),
    );

    const course = await gddt.course.create({ program: 'UCREA', name: 'SessionGet Course' });
    const created = await gddt.classBatch.create({
      courseId: course.id,
      startDate: '2026-08-03',
      endDate: '2026-08-16',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
    });
    classBatchId = created.classBatch.id;
    const listed = await gddt.classSession.list({ classBatchId });
    expect(listed.length).toBeGreaterThan(0);
    sessionId = listed[0]!.id;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('get returns session identity with batch denorm', async () => {
    const row = await giaoVien.classSession.get({ sessionId });
    expect(row.id).toBe(sessionId);
    expect(row.classBatchId).toBe(classBatchId);
    expect(row.batchCode).toBeTruthy();
    expect(row.program).toBe('UCREA');
    expect(row.courseId).toBeTruthy();
  });

  it('get returns teacherAppUserId and fullName after assignTeacher', async () => {
    const teacher = await seedAppUser({
      facilityId: facility.id,
      userId: 'session-get-teacher',
      fullName: 'Cô Lan',
      roles: ['giao_vien'],
    });
    await gddt.classBatch.assignTeacher({
      classBatchId,
      teacherAppUserId: teacher.id,
    });
    const row = await giaoVien.classSession.get({ sessionId });
    expect(row.teacherAppUserId).toBe(teacher.id);
    expect(row.teacherFullName).toBe('Cô Lan');
    expect(row.teacherId).toBe(teacher.id);
  });

  it('get throws NOT_FOUND for unknown session', async () => {
    await expect(
      giaoVien.classSession.get({ sessionId: '00000000-0000-4000-8000-000000000099' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('doneProgress returns checklist flags for a fresh session', async () => {
    const progress = await giaoVien.classSession.doneProgress({ sessionId });
    expect(progress.sessionId).toBe(sessionId);
    expect(progress.attendanceOk).toBe(false);
    expect(progress.assessmentOk).toBe(false);
    expect(progress.evidenceOk).toBe(false);
    expect(progress.eligible).toBe(false);
    expect(typeof progress.timeGatePassed).toBe('boolean');
  });
});
