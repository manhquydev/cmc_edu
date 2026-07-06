// P4 integration tests — parentMeeting lifecycle (WF-P4-03).
//
// schedule → complete (with result) | cancel.
// complete without result → BAD_REQUEST.
// complete/cancel on a non-scheduled meeting → BAD_REQUEST.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('parentMeeting lifecycle (P4)', () => {
  let facility: { id: string };
  let manager: Caller;
  let sale: Caller;
  let studentId: string;

  const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(async () => {
    facility = await createTestFacility('Meeting Facility');
    manager = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-meeting-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-meeting-1', roles: ['sale'] }),
    );

    // Seed a bare student (no enrollment needed for meeting tests).
    const s = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Meeting Student' } }),
    );
    studentId = s.id;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('schedule → complete with result succeeds', async () => {
    const meeting = await manager.parentMeeting.schedule({ studentId, scheduledAt: FUTURE });
    expect(meeting.status).toBe('scheduled');

    const done = await manager.parentMeeting.complete({ meetingId: meeting.id, result: 'Good progress noted.' });
    expect(done.status).toBe('done');
    expect(done.result).toBe('Good progress noted.');
  });

  it('schedule → cancel succeeds', async () => {
    const meeting = await manager.parentMeeting.schedule({ studentId, scheduledAt: FUTURE });
    const cancelled = await manager.parentMeeting.cancel({ meetingId: meeting.id });
    expect(cancelled.status).toBe('cancelled');
  });

  it('complete without result → BAD_REQUEST (zod min(1))', async () => {
    const meeting = await manager.parentMeeting.schedule({ studentId, scheduledAt: FUTURE });
    await expect(
      manager.parentMeeting.complete({ meetingId: meeting.id, result: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('completing a cancelled meeting → BAD_REQUEST', async () => {
    const meeting = await manager.parentMeeting.schedule({ studentId, scheduledAt: FUTURE });
    await manager.parentMeeting.cancel({ meetingId: meeting.id });

    await expect(
      manager.parentMeeting.complete({ meetingId: meeting.id, result: 'Late result.' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('cancelling a done meeting → BAD_REQUEST', async () => {
    const meeting = await manager.parentMeeting.schedule({ studentId, scheduledAt: FUTURE });
    await manager.parentMeeting.complete({ meetingId: meeting.id, result: 'Notes here.' });

    await expect(
      manager.parentMeeting.cancel({ meetingId: meeting.id }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('sale role can schedule and complete (parentMeeting.manage)', async () => {
    const meeting = await sale.parentMeeting.schedule({ studentId, scheduledAt: FUTURE });
    const done = await sale.parentMeeting.complete({ meetingId: meeting.id, result: 'Sale notes.' });
    expect(done.status).toBe('done');
  });
});
