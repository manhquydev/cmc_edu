// HR remediation phase 1 (R2 #C5): `classBatch.assignTeacher` — the first
// writer for `ClassBatch.teacherAppUserId` — plus `classBatch.create`'s
// teacher-resolve path when the caller supplies `teacherId`.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, seedAppUser, seedClassBatch } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('classBatch.assignTeacher + create teacher-resolve (HR remediation phase 1)', () => {
  let facility: { id: string };
  let classBatch: { id: string; code: string; courseId: string };
  let teacherAppUserId: string;
  let gddt: Caller;
  let sale: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('AssignTeacher-Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });

    const teacher = await seedAppUser({
      facilityId: facility.id,
      userId: 'assign-teacher-gv-001',
      position: 'giao_vien',
    });
    teacherAppUserId = teacher.id;

    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'assign-teacher-gddt-001', roles: ['giam_doc_dao_tao'] }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'assign-teacher-sale-001', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('assigns a teacher: writes both teacherAppUserId (real FK) and legacy teacherId', async () => {
    const result = await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId });
    expect(result.teacherAppUserId).toBe(teacherAppUserId);
    expect(result.teacherId).toBe(teacherAppUserId);
  });

  it('rejects an unknown teacherAppUserId with NOT_FOUND', async () => {
    await expect(
      gddt.classBatch.assignTeacher({
        classBatchId: classBatch.id,
        teacherAppUserId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects an unknown classBatchId with NOT_FOUND', async () => {
    await expect(
      gddt.classBatch.assignTeacher({
        classBatchId: '00000000-0000-0000-0000-000000000000',
        teacherAppUserId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('forbids a role without class.create permission (registry reuse — no dedicated class.manage key)', async () => {
    await expect(
      sale.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('create resolves + validates teacherId (AppUser.id) into teacherAppUserId', async () => {
    // Reuses the Course seeded by seedClassBatch (facility already has one
    // from the outer beforeEach) rather than exercising course.manage, which
    // is out of this test's scope.
    const created = await gddt.classBatch.create({
      courseId: classBatch.courseId,
      startDate: '2099-02-01',
      endDate: '2099-02-28',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      teacherId: teacherAppUserId,
    });
    expect(created.classBatch.teacherId).toBe(teacherAppUserId);
    expect(created.classBatch.teacherAppUserId).toBe(teacherAppUserId);
  });

  it('create rejects an unknown teacherId with NOT_FOUND', async () => {
    await expect(
      gddt.classBatch.create({
        courseId: classBatch.courseId,
        startDate: '2099-03-01',
        endDate: '2099-03-28',
        slots: [{ weekday: 2, startTime: '18:00', endTime: '19:30' }],
        teacherId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
