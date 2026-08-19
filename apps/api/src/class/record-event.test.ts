// ClassBatch record events — emission and operational class timeline tests
// (resource-depth Phase 6, module 1).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  seedClassBatch,
  testDbBypass,
} from '../test/db.js';
import {
  classEventPayloadLeaksSecret,
  labelForClassRecordEventKind,
} from './record-event.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('ClassBatch record events & timeline (Phase 6 module 1)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let classBatch: { id: string; code: string; courseId: string };
  let gddt: Caller;
  let teacher: Caller;
  let directorB: Caller;
  let teacherAppUserId: string;

  const eventsOf = (facilityId: string, entityId: string) =>
    testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId, entity: 'ClassBatch', entityId },
        orderBy: { createdAt: 'asc' },
      }),
    );

  beforeEach(async () => {
    facilityA = await createTestFacility('ClassTimeline-A');
    facilityB = await createTestFacility('ClassTimeline-B');
    classBatch = await seedClassBatch({ facilityId: facilityA.id });

    const teacherRow = await seedAppUser({
      facilityId: facilityA.id,
      userId: 'class-timeline-gv-001',
      fullName: 'GV Timeline',
      roles: ['giao_vien'],
    });
    teacherAppUserId = teacherRow.id;
    await seedAppUser({
      facilityId: facilityA.id,
      userId: 'class-timeline-gddt',
      fullName: 'GĐĐT Timeline',
      roles: ['giam_doc_dao_tao'],
    });

    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'class-timeline-gddt', roles: ['giam_doc_dao_tao'] }),
    );
    teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'class-timeline-gv-001', roles: ['giao_vien'] }),
    );
    directorB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'class-timeline-gdb', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('classBatch.assignTeacher — emits teacher_changed with the allowlisted payload', async () => {
    await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId });

    const events = await eventsOf(facilityA.id, classBatch.id);
    expect(events.map((e) => e.kind)).toEqual(['teacher_changed']);
    expect(events[0]?.payload).toEqual({ teacherAppUserId });
    expect(events[0]?.actor).toBe('class-timeline-gddt');
    expect(classEventPayloadLeaksSecret(events[0]?.payload)).toBe(false);
  });

  it('classBatch.assignTeacher — no event when the teacher does not change', async () => {
    await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId });
    await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId });

    const events = await eventsOf(facilityA.id, classBatch.id);
    expect(events).toHaveLength(1);
  });

  it('schedule slot mutations — add, update and archive each emit one event', async () => {
    const slot = await gddt.schedule.addSlot({
      classBatchId: classBatch.id,
      weekday: 6,
      startTime: '09:00',
      endTime: '10:30',
    });
    await gddt.schedule.updateSlot({
      scheduleSlotId: slot.id,
      weekday: 6,
      startTime: '09:30',
      endTime: '11:00',
    });
    await gddt.schedule.archiveSlot({ scheduleSlotId: slot.id });

    const events = await eventsOf(facilityA.id, classBatch.id);
    expect(events.map((e) => e.kind)).toEqual(['slot_added', 'slot_updated', 'slot_archived']);
    expect(events[0]?.payload).toEqual({ weekday: 6, startTime: '09:00', endTime: '10:30' });
    expect(events[1]?.payload).toEqual({ weekday: 6, startTime: '09:30', endTime: '11:00' });
    expect(events[2]?.payload).toBeNull();
  });

  it('classSession.confirm/cancel — emit session events on the class timeline', async () => {
    const session = await testDbBypass((tx) =>
      tx.classSession.create({
        data: {
          facilityId: facilityA.id,
          classBatchId: classBatch.id,
          sessionDate: new Date('2026-08-20T00:00:00.000Z'),
          startTime: new Date('2026-08-20T02:00:00.000Z'),
          endTime: new Date('2026-08-20T03:30:00.000Z'),
          status: 'planned',
        },
        select: { id: true },
      }),
    );
    const sessionId = session.id;

    await gddt.classSession.confirm({ sessionId });
    await gddt.classSession.cancel({ sessionId });

    const events = await eventsOf(facilityA.id, classBatch.id);
    expect(events.map((e) => e.kind)).toEqual(['session_confirmed', 'session_cancelled']);
    expect(events[0]?.payload).toEqual({ sessionId });
  });

  it('timeline — authorizes the parent record and scopes to facility', async () => {
    await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId });

    // Allowed role (class.read) sees the events with a projected actor label.
    const page = await teacher.classBatch.timeline({ classBatchId: classBatch.id });
    expect(page.items.map((i) => i.kind)).toEqual(['teacher_changed']);
    expect(page.items[0]?.actor).toBe('GĐĐT Timeline');
    expect(page.items[0]?.label).toBe(labelForClassRecordEventKind('teacher_changed'));
    // The class was seeded (not created through the mutation), so no 'created'
    // event exists — the read correctly reports the history epoch instead.
    expect(page.historySince).toBeInstanceOf(Date);

    // Cross-facility id looks identical to a missing one (RLS).
    await expect(
      directorB.classBatch.timeline({ classBatchId: classBatch.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      teacher.classBatch.timeline({ classBatchId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('timeline — a class with no events reports the history epoch, empty items', async () => {
    const page = await teacher.classBatch.timeline({ classBatchId: classBatch.id });
    expect(page.items).toEqual([]);
    expect(page.historySince).toBeInstanceOf(Date);
  });

  it('timeline — unknown kinds serialize payload as null and use the fallback label', async () => {
    await testDbBypass((tx) =>
      tx.recordEvent.create({
        data: {
          facilityId: facilityA.id,
          entity: 'ClassBatch',
          entityId: classBatch.id,
          kind: 'future_kind',
          actor: 'someone',
          payload: { anything: true },
        },
      }),
    );

    const page = await teacher.classBatch.timeline({ classBatchId: classBatch.id });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.payload).toBeNull();
    expect(page.items[0]?.label).toBe('Sự kiện không đọc được');
    // Unknown actor ids project to a system label, never leak the raw id.
    expect(page.items[0]?.actor).toBe('Hệ thống');
  });

  it('timeline — keyset pagination returns newest-first pages and a usable cursor', async () => {
    // Three events on the class, inserted in order.
    const teacher2 = await seedAppUser({
      facilityId: facilityA.id,
      userId: 'class-timeline-gv-002',
      fullName: 'GV Hai',
      roles: ['giao_vien'],
    });
    await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId });
    await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId: teacher2.id });
    await testDbBypass((tx) =>
      tx.recordEvent.create({
        data: {
          facilityId: facilityA.id,
          entity: 'ClassBatch',
          entityId: classBatch.id,
          kind: 'slot_archived',
          actor: 'class-timeline-gddt',
        },
      }),
    );

    // Page one: newest two, cursor for the last one.
    const page1 = await teacher.classBatch.timeline({ classBatchId: classBatch.id, take: 2 });
    expect(page1.items.map((i) => i.kind)).toEqual(['slot_archived', 'teacher_changed']);
    expect(page1.nextCursor).toBeTruthy();

    // Page two: exactly the oldest event, end of list.
    const page2 = await teacher.classBatch.timeline({
      classBatchId: classBatch.id,
      take: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.map((i) => i.kind)).toEqual(['teacher_changed']);
    expect(page2.nextCursor).toBe(null);

    // No overlap, no loss.
    const all = [...page1.items, ...page2.items].map((i) => i.id);
    expect(new Set(all).size).toBe(3);
  });

  it('emitted payloads never carry secret-shaped or PII keys', async () => {
    await gddt.classBatch.assignTeacher({ classBatchId: classBatch.id, teacherAppUserId });
    const events = await eventsOf(facilityA.id, classBatch.id);
    for (const ev of events) {
      expect(classEventPayloadLeaksSecret(ev.payload)).toBe(false);
      expect(JSON.stringify(ev.payload ?? {})).not.toMatch(/password|token|phone|email|fullName/i);
    }
  });
});
