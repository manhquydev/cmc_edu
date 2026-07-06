// T1 integration tests (docs/26 phase-02, TL19 §5, WF-P2-02): the 5
// attendance gates, upsert re-mark semantics, markAll atomicity, the unique
// constraint, RLS isolation, and the session-lifecycle procedures
// (cancel/confirm/addMakeup) that feed attendance's gate 1.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { ictMonthOf } from '../class/ict-time.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedActiveEnrollment,
  seedClassBatch,
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
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  /** Seeds a plain `planned` ClassSession for `classBatch` (bypasses the
   * auto-generation engine — the gates/lifecycle tests only need a real
   * session row to point at). */
  async function seedSession(overrides?: {
    status?: 'planned' | 'confirmed' | 'cancelled';
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

  // ---- Session lifecycle: cancel / confirm / addMakeup ----

  it('classSession.cancel transitions planned/confirmed -> cancelled and blocks further attendance', async () => {
    const session = await seedSession({ status: 'confirmed' });
    const cancelled = await gddt.classSession.cancel({ sessionId: session.id });
    expect(cancelled.status).toBe('cancelled');

    await expect(gddt.classSession.cancel({ sessionId: session.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('classSession.confirm transitions planned -> confirmed only', async () => {
    const session = await seedSession({ status: 'planned' });
    const confirmed = await gddt.classSession.confirm({ sessionId: session.id });
    expect(confirmed.status).toBe('confirmed');

    await expect(gddt.classSession.confirm({ sessionId: session.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('forbids a role without schedule.generate permission from cancel/confirm/addMakeup', async () => {
    const session = await seedSession();
    await expect(teacher.classSession.cancel({ sessionId: session.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(teacher.classSession.confirm({ sessionId: session.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      teacher.classSession.addMakeup({
        classBatchId: classBatch.id,
        sessionDate: '2026-08-10',
        startTime: '18:00',
        endTime: '19:30',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('classSession.addMakeup creates an isMakeup=true session for the batch', async () => {
    const result = await gddt.classSession.addMakeup({
      classBatchId: classBatch.id,
      sessionDate: '2026-08-10',
      startTime: '18:00',
      endTime: '19:30',
    });

    expect(result.isMakeup).toBe(true);
    expect(result.classBatchId).toBe(classBatch.id);
    expect(result.scheduleSlotId).toBeNull();

    const persisted = await testDbBypass((tx) => tx.classSession.findUniqueOrThrow({ where: { id: result.id } }));
    expect(persisted.isMakeup).toBe(true);
    expect(persisted.status).toBe('planned');
  });

  it('classSession.addMakeup rejects an overlapping room booking with CONFLICT (shared assertNoRoomConflict)', async () => {
    const room = await testDbBypass((tx) =>
      tx.room.create({ data: { facilityId: facility.id, code: 'MK-ROOM-1', name: 'Makeup Room' } }),
    );
    await testDbBypass((tx) => tx.classBatch.update({ where: { id: classBatch.id }, data: { roomId: room.id } }));
    // Existing booked session: 2026-08-10 18:00-19:30 ICT (11:00-12:30 UTC).
    await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facility.id,
          classBatchId: classBatch.id,
          sessionDate: new Date('2026-08-10T00:00:00.000Z'),
          startTime: new Date('2026-08-10T11:00:00.000Z'),
          endTime: new Date('2026-08-10T12:30:00.000Z'),
          status: 'planned',
        },
      }),
    );

    const otherClassBatch = await seedClassBatch({ facilityId: facility.id, startDate: '2026-08-01', endDate: '2026-08-31' });
    await testDbBypass((tx) => tx.classBatch.update({ where: { id: otherClassBatch.id }, data: { roomId: room.id } }));

    await expect(
      gddt.classSession.addMakeup({
        classBatchId: otherClassBatch.id,
        sessionDate: '2026-08-10',
        startTime: '18:00',
        endTime: '19:30',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
