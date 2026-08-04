// classSession.listInRange — facility calendar window for FullCalendar timed events.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('classSession.listInRange', () => {
  let facility: { id: string };
  let gddt: Caller;
  let giaoVien: Caller;
  let courseId: string;
  let classBatchId: string;
  let sessionIds: string[];

  beforeEach(async () => {
    facility = await createTestFacility('ListInRange-Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'list-range-gddt',
        roles: ['giam_doc_dao_tao'],
      }),
    );
    giaoVien = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'list-range-gv',
        roles: ['giao_vien'],
      }),
    );

    const course = await gddt.course.create({ program: 'UCREA', name: 'ListInRange Course' });
    courseId = course.id;

    // Mon 2026-08-03 + Wed 2026-08-05 within Aug 3–16 → 4 sessions.
    const created = await gddt.classBatch.create({
      courseId,
      startDate: '2026-08-03',
      endDate: '2026-08-16',
      slots: [
        { weekday: 1, startTime: '18:00', endTime: '19:30' },
        { weekday: 3, startTime: '18:00', endTime: '19:30' },
      ],
    });
    classBatchId = created.classBatch.id;
    expect(created.sessionsCreated).toBe(4);

    const listed = await gddt.classSession.list({ classBatchId });
    sessionIds = listed.map((s) => s.id);
    expect(sessionIds).toHaveLength(4);
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('returns sessions whose sessionDate falls in [from, to] inclusive', async () => {
    const rows = await giaoVien.classSession.listInRange({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.classBatchId).toBe(classBatchId);
      expect(row.batchCode).toBeTruthy();
      expect(row.program).toBe('UCREA');
      expect(row.courseId).toBe(courseId);
      expect(row.startTime.getTime()).toBeLessThan(row.endTime.getTime());
    }
  });

  it('get returns session identity with batch denorm', async () => {
    const sessionId = sessionIds[0]!;
    const row = await giaoVien.classSession.get({ sessionId });
    expect(row.id).toBe(sessionId);
    expect(row.classBatchId).toBe(classBatchId);
    expect(row.batchCode).toBeTruthy();
    expect(row.program).toBe('UCREA');
    expect(row.courseId).toBe(courseId);
  });

  it('get throws NOT_FOUND for unknown session', async () => {
    await expect(
      giaoVien.classSession.get({ sessionId: '00000000-0000-4000-8000-000000000099' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('doneProgress returns checklist flags for a fresh session', async () => {
    const sessionId = sessionIds[0]!;
    const progress = await giaoVien.classSession.doneProgress({ sessionId });
    expect(progress.sessionId).toBe(sessionId);
    expect(progress.attendanceOk).toBe(false);
    expect(progress.assessmentOk).toBe(false);
    expect(progress.evidenceOk).toBe(false);
    expect(progress.eligible).toBe(false);
    expect(typeof progress.timeGatePassed).toBe('boolean');
  });

  it('excludes sessions outside the window', async () => {
    // Only the first Monday 2026-08-03
    const rows = await gddt.classSession.listInRange({
      from: '2026-08-03',
      to: '2026-08-03',
    });
    expect(rows).toHaveLength(1);
  });

  it('excludes cancelled sessions by default', async () => {
    const first = sessionIds[0]!;
    await gddt.classSession.cancel({ sessionId: first });

    const rows = await gddt.classSession.listInRange({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id)).not.toContain(first);
  });

  it('includes cancelled when includeCancelled is true', async () => {
    const first = sessionIds[0]!;
    await gddt.classSession.cancel({ sessionId: first });

    const rows = await gddt.classSession.listInRange({
      from: '2026-08-01',
      to: '2026-08-31',
      includeCancelled: true,
    });
    expect(rows).toHaveLength(4);
    expect(rows.find((r) => r.id === first)?.status).toBe('cancelled');
  });

  it('filters by courseId', async () => {
    const otherCourse = await gddt.course.create({ program: 'BRIGHT_IG', name: 'Other' });
    await gddt.classBatch.create({
      courseId: otherCourse.id,
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      slots: [{ weekday: 1, startTime: '09:00', endTime: '10:00' }],
    });

    const filtered = await gddt.classSession.listInRange({
      from: '2026-08-01',
      to: '2026-08-31',
      courseId,
    });
    expect(filtered.every((r) => r.courseId === courseId)).toBe(true);
    expect(filtered).toHaveLength(4);

    const other = await gddt.classSession.listInRange({
      from: '2026-08-01',
      to: '2026-08-31',
      courseId: otherCourse.id,
    });
    expect(other).toHaveLength(1);
    expect(other[0]!.courseId).toBe(otherCourse.id);
  });

  it('rejects from > to', async () => {
    await expect(
      gddt.classSession.listInRange({ from: '2026-08-10', to: '2026-08-01' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects ranges longer than 120 days', async () => {
    // 121 inclusive days: 2026-01-01 .. 2026-05-01
    await expect(
      gddt.classSession.listInRange({ from: '2026-01-01', to: '2026-05-01' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('allows a 120-day inclusive window', async () => {
    // Jan 1 .. Apr 30 = 120 days
    await expect(
      gddt.classSession.listInRange({ from: '2026-01-01', to: '2026-04-30' }),
    ).resolves.toEqual([]);
  });

  it('giao_vien has class.read and can call listInRange', async () => {
    const rows = await giaoVien.classSession.listInRange({
      from: '2026-08-01',
      to: '2026-08-31',
    });
    expect(rows.length).toBeGreaterThan(0);
  });

  it('does not return sessions from another facility', async () => {
    const other = await createTestFacility('ListInRange-Other-Facility');
    try {
      const otherCaller = appRouter.createCaller(
        buildStaffContext({
          facilityId: other.id,
          userId: 'list-range-other-gddt',
          roles: ['giam_doc_dao_tao'],
        }),
      );
      const otherCourse = await otherCaller.course.create({
        program: 'UCREA',
        name: 'Other Facility Course',
      });
      await otherCaller.classBatch.create({
        courseId: otherCourse.id,
        startDate: '2026-08-03',
        endDate: '2026-08-03',
        slots: [{ weekday: 1, startTime: '18:00', endTime: '19:30' }],
      });

      const fromOther = await otherCaller.classSession.listInRange({
        from: '2026-08-01',
        to: '2026-08-31',
      });
      expect(fromOther).toHaveLength(1);

      // Caller's facility must not see other facility sessions.
      const fromHome = await gddt.classSession.listInRange({
        from: '2026-08-01',
        to: '2026-08-31',
      });
      expect(fromHome).toHaveLength(4);
      const foreignIds = new Set(fromOther.map((r) => r.id));
      expect(fromHome.every((r) => !foreignIds.has(r.id))).toBe(true);
    } finally {
      await cleanupFacility(other.id);
    }
  });

  it('includes session on inclusive `to` when from < to', async () => {
    // Sessions: Mon 8/3, Wed 8/5, Mon 8/10, Wed 8/12
    const rows = await gddt.classSession.listInRange({
      from: '2026-08-03',
      to: '2026-08-05',
    });
    expect(rows).toHaveLength(2);
  });
});
