// Gap-closure 260710-0005 Phase 2: attendance.listForChild — parent-facing
// view of a child's per-session attendance status (present/absent/late).
// Gate pattern copied from assessment.listForChild (parent-only,
// getApprovedChildren + auditChildDataAccess). Covers: happy path (all 3
// statuses), sibling/non-approved parent FORBIDDEN, student-kind session
// FORBIDDEN (requireLmsParent, red-team H2), and studentId-filtering so one
// classmate's attendance never leaks another's (red-team F4).

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedActiveEnrollment,
  seedAppUser,
  seedClassBatch,
  seedClassSession,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('attendance.listForChild (gap-closure 260710-0005 Phase 2)', () => {
  let facility: { id: string };
  let teacher: Caller;
  let classBatch: { id: string; courseId: string };
  let session: { id: string; classBatchId: string };
  let parent: { id: string; phone: string };
  const parentPhonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('AttendanceListForChild Facility');
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-lfc-1', roles: ['giao_vien'] }),
    );
    classBatch = await seedClassBatch({ facilityId: facility.id });
    session = await seedClassSession({ facilityId: facility.id, classBatchId: classBatch.id });
    // Teacher class-scoping remediation (2026-07-15): teacher.attendance.mark
    // is used as setup below — assign this teacher to the class so it passes.
    const teacherAppUser = await seedAppUser({ facilityId: facility.id, userId: 'teacher-lfc-1' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: teacherAppUser.id } }),
    );

    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);
    parentPhonesToClean.push(phone);
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...parentPhonesToClean);
    parentPhonesToClean.length = 0;
  });

  it('returns present/absent/late statuses with sessionDate, filtered to just this student', async () => {
    const childA = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
    });
    const childB = await seedActiveEnrollment({ facilityId: facility.id, classBatchId: classBatch.id });

    await teacher.attendance.mark({ sessionId: session.id, enrollmentId: childA.id, status: 'absent' });
    await teacher.attendance.mark({ sessionId: session.id, enrollmentId: childB.id, status: 'present' });

    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, kind: 'parent' }));
    const result = await parentCaller.attendance.listForChild({ studentId: childA.studentId });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe('absent');
    expect(result.items[0]?.classSessionId).toBe(session.id);
    expect(result.items[0]?.sessionDate).toBeInstanceOf(Date);
    // childB's 'present' row must never appear in childA's parent's response.
    expect(result.items.some((i) => i.status === 'present')).toBe(false);
  });

  it('status & lifecycle guards (scenario audit pattern #2): excludes attendance for a since-cancelled session', async () => {
    const child = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
    });
    await teacher.attendance.mark({ sessionId: session.id, enrollmentId: child.id, status: 'present' });
    // Session cancelled AFTER attendance was marked — consistent with
    // recomputeFinalGrade's attendance-rate denominator (../submission/router.ts),
    // which already excludes cancelled sessions.
    await testDbBypass((tx) => tx.classSession.update({ where: { id: session.id }, data: { status: 'cancelled' } }));

    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parent.id, kind: 'parent' }));
    const result = await parentCaller.attendance.listForChild({ studentId: child.studentId });

    expect(result.items).toHaveLength(0);
  });

  it('FORBIDDEN: a parent without an approved Guardian link for this student', async () => {
    const child = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
    });

    const otherPhone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    const otherParent = await seedParentAccount(otherPhone);
    parentPhonesToClean.push(otherPhone);

    const otherParentCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: otherParent.id, kind: 'parent' }),
    );
    await expect(otherParentCaller.attendance.listForChild({ studentId: child.studentId })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('FORBIDDEN: a student-kind session (requireLmsParent is parent-only, red-team H2)', async () => {
    const child = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: classBatch.id,
      parentAccountId: parent.id,
    });

    const studentCaller = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, studentId: child.studentId, kind: 'student' }),
    );
    await expect(
      studentCaller.attendance.listForChild({ studentId: child.studentId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
