// classSession.assignTeacher — one session, not the class and not sibling sessions.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDb,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('classSession.assignTeacher', () => {
  let facility: { id: string };
  let classBatchId: string;
  let sessionIds: string[];
  let classTeacherId: string;
  let substituteId: string;
  let gddt: Caller;
  let sale: Caller;
  let giaoVien: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('AssignSessionTeacher-Facility');

    const classTeacher = await seedAppUser({
      facilityId: facility.id,
      userId: 'assign-sess-gv-class',
      position: 'giao_vien',
      roles: ['giao_vien'],
    });
    classTeacherId = classTeacher.id;

    const substitute = await seedAppUser({
      facilityId: facility.id,
      userId: 'assign-sess-gv-sub',
      position: 'giao_vien',
      roles: ['giao_vien'],
    });
    substituteId = substitute.id;

    gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'assign-sess-gddt',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'assign-sess-sale',
        roles: ['sale'],
      }),
    );
    giaoVien = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'assign-sess-gv-actor',
        roles: ['giao_vien'],
      }),
    );

    const course = await gddt.course.create({ program: 'UCREA', name: 'Assign Session Teacher Course' });
    const created = await gddt.classBatch.create({
      courseId: course.id,
      startDate: '2026-08-03',
      endDate: '2026-08-10',
      slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      teacherId: classTeacherId,
    });
    classBatchId = created.classBatch.id;
    const listed = await gddt.classSession.list({ classBatchId });
    sessionIds = listed.map((row) => row.id);
    expect(sessionIds).toHaveLength(2);
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('changes only the target session; sibling sessions and the class stay put', async () => {
    const targetId = sessionIds[0]!;
    const siblingId = sessionIds[1]!;

    const updated = await gddt.classSession.assignTeacher({
      sessionId: targetId,
      teacherAppUserId: substituteId,
    });
    expect(updated.teacherId).toBe(substituteId);

    const listed = await gddt.classSession.list({ classBatchId });
    expect(listed.find((row) => row.id === targetId)?.teacherId).toBe(substituteId);
    expect(listed.find((row) => row.id === siblingId)?.teacherId).toBe(classTeacherId);

    const batch = await gddt.classBatch.get({ classBatchId });
    expect(batch.teacherId).toBe(classTeacherId);
  });

  it('writes an AuditLog row for the successful mutation', async () => {
    const targetId = sessionIds[0]!;
    await gddt.classSession.assignTeacher({
      sessionId: targetId,
      teacherAppUserId: substituteId,
    });

    const audit = await testDb().auditLog.findFirst({
      where: { action: 'classSession.assignTeacher' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit!.entityId).toBe(targetId);
  });

  it('forbids sale and giao_vien (class.create is GĐĐT-only)', async () => {
    const targetId = sessionIds[0]!;
    await expect(
      sale.classSession.assignTeacher({ sessionId: targetId, teacherAppUserId: substituteId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      giaoVien.classSession.assignTeacher({ sessionId: targetId, teacherAppUserId: substituteId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects an unknown session and a non-teacher staff member', async () => {
    await expect(
      gddt.classSession.assignTeacher({
        sessionId: '00000000-0000-0000-0000-000000000000',
        teacherAppUserId: substituteId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const salesperson = await seedAppUser({
      facilityId: facility.id,
      userId: 'assign-sess-sale-profile',
      position: 'sale',
      roles: ['sale'],
    });
    await expect(
      gddt.classSession.assignTeacher({
        sessionId: sessionIds[0]!,
        teacherAppUserId: salesperson.id,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
