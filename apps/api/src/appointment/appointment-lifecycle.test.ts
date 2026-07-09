// Test backfill (gap-closure 260710-0005 Phase 3): testAppointment
// schedule/complete/noShow lifecycle. Registry roster (packages/auth/src/
// index.ts): 'testAppointment.manage' → giam_doc_kinh_doanh, giam_doc_dao_tao,
// sale. CRITICAL INVARIANT under test (router.ts header comment): entrance
// appointments never touch CRM/Opportunity — this module has no such FK, so
// the invariant is structural (asserted implicitly: no opportunity fields
// exist to mutate), not a separate assertion.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, testDbBypass } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('testAppointment.schedule / complete / noShow (test backfill)', () => {
  let facility: { id: string };
  let sale: Caller;
  let teacher: Caller;
  let student: { id: string };

  beforeEach(async () => {
    facility = await createTestFacility('Appointment Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-appt-1', roles: ['sale'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-appt-1', roles: ['giao_vien'] }),
    );
    student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Appointment Test Student' } }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('schedules an entrance appointment, then completes it', async () => {
    const scheduled = await sale.testAppointment.schedule({
      studentId: student.id,
      type: 'entrance',
      scheduledAt: '2026-08-01T09:00:00.000Z',
    });
    expect(scheduled.status).toBe('scheduled');
    expect(scheduled.type).toBe('entrance');

    const completed = await sale.testAppointment.complete({ appointmentId: scheduled.id, notes: 'Passed.' });
    expect(completed.status).toBe('done');
    expect(completed.notes).toBe('Passed.');
  });

  it('marks a periodic appointment as no_show', async () => {
    const scheduled = await sale.testAppointment.schedule({
      studentId: student.id,
      type: 'periodic',
      scheduledAt: '2026-08-02T09:00:00.000Z',
    });

    const noShow = await sale.testAppointment.noShow({ appointmentId: scheduled.id });
    expect(noShow.status).toBe('no_show');
  });

  it('rejects completing an appointment that is not scheduled (already done)', async () => {
    const scheduled = await sale.testAppointment.schedule({
      studentId: student.id,
      type: 'entrance',
      scheduledAt: '2026-08-03T09:00:00.000Z',
    });
    await sale.testAppointment.complete({ appointmentId: scheduled.id });

    await expect(sale.testAppointment.complete({ appointmentId: scheduled.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('forbids a role without testAppointment.manage permission', async () => {
    await expect(
      teacher.testAppointment.schedule({
        studentId: student.id,
        type: 'entrance',
        scheduledAt: '2026-08-04T09:00:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects scheduling for a student outside the caller facility', async () => {
    const otherFacility = await createTestFacility('Appointment Facility B');
    const otherStudent = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: otherFacility.id, fullName: 'Cross-Facility Student' } }),
    );
    try {
      await expect(
        sale.testAppointment.schedule({
          studentId: otherStudent.id,
          type: 'entrance',
          scheduledAt: '2026-08-05T09:00:00.000Z',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });
});
