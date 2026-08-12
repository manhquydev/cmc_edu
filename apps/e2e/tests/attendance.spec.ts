// Critical-path e2e #2 (docs/26 phase-02, TL19 §5): GĐĐT creates a class +
// weekly sessions, a teacher marks attendance on a valid planned session
// (gate 1 pass), and marking a cancelled session is rejected (gate 1
// BAD_REQUEST). The active Enrollment this exercises is seeded directly
// (../src/db.ts's `seedActiveEnrollment`) rather than re-running the full
// CRM/receipt pipeline — that pipeline is already covered end to end by
// ./enrollment.spec.ts; this spec's job is the attendance gate + session
// lifecycle, same scoping apps/api/src/attendance/gate.test.ts uses.
//
// Sessions come from classBatch.create's auto weekly materialization
// (schedule slots) — not ad-hoc makeup sessions (product removed that path).

import { test, expect } from '@playwright/test';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../api/src/router.js';
import { seedActiveEnrollment, seedAppUser } from '../src/db.js';
import { createE2eStaffClient } from '../src/trpc-client.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

test.describe('attendance marking + session lifecycle', () => {
  test('marks present on a valid session, rejects a cancelled one', async () => {
    const gddt = createE2eStaffClient(baseUrl, {
      userId: 'e2e-gddt-attendance',
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });
    const teacher = createE2eStaffClient(baseUrl, {
      userId: 'e2e-teacher',
      roles: ['giao_vien'],
      facilityId,
    });
    const teacherAppUser = await seedAppUser({
      facilityId,
      userId: 'e2e-teacher',
      roles: ['giao_vien'],
    });

    const course = await gddt.course.create.mutate({ program: 'UCREA', name: 'E2E Attendance Course' });
    // Saturday slot across August → several weekly planned sessions.
    const classBatch = await gddt.classBatch.create.mutate({
      courseId: course.id,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      teacherId: teacherAppUser.id,
      slots: [{ weekday: 6, startTime: '08:00', endTime: '09:00' }],
    });
    const classBatchId = classBatch.classBatch.id;
    expect(classBatch.sessionsCreated).toBeGreaterThanOrEqual(2);

    const sessions = await gddt.classSession.list.query({ classBatchId });
    const planned = sessions.filter((s) => s.status === 'planned');
    expect(planned.length).toBeGreaterThanOrEqual(2);

    const validSession = planned[0]!;
    const toCancel = planned[1]!;
    expect(validSession.status).toBe('planned');

    const cancelled = await gddt.classSession.cancel.mutate({ sessionId: toCancel.id });
    expect(cancelled.status).toBe('cancelled');

    const { enrollmentId } = await seedActiveEnrollment({ facilityId, classBatchId });

    const marked = await teacher.attendance.mark.mutate({
      sessionId: validSession.id,
      enrollmentId,
      status: 'present',
    });
    expect(marked.status).toBe('present');

    let caughtError: unknown;
    try {
      await teacher.attendance.mark.mutate({
        sessionId: cancelled.id,
        enrollmentId,
        status: 'present',
      });
    } catch (error) {
      caughtError = error;
    }
    expect(caughtError).toBeInstanceOf(TRPCClientError);
    expect((caughtError as TRPCClientError<AppRouter>).data?.code).toBe('BAD_REQUEST');
  });
});
