// Student record events — emission and operational student timeline tests
// (resource-depth Phase 6, module 2; frozen map in
// plans/260817-1354-resource-detail-and-operational-timeline-depth/reports/
// phase-06-module-2-student-freeze.md).

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { activateEnrollmentForReceipt } from '../enrollment/activate-enrollment.js';
import { provisionFromReceipt } from '../provisioning/provision-from-receipt.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedAppUser,
  seedClassBatch,
  seedGuardianLink,
  seedParentAccount,
  seedStudentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';
import {
  labelForStudentRecordEventKind,
  studentEventPayloadLeaksSecret,
  STUDENT_RECORD_EVENT_HISTORY_SINCE,
} from './record-event.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

/** Distinct per test — provisioning find-or-creates a global ParentAccount by
 * phone, so each test owns its own phone and cleans it up separately. */
const PHONE_A = '0994000101';
const PHONE_B = '0994000102';
const CLEANUP_PHONES = [PHONE_A, PHONE_B, '84994000101', '84994000102'];

describe('Student record events & timeline (Phase 6 module 2)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let classBatch: { id: string; code: string; courseId: string };
  let gddt: Caller;
  let cskh: Caller;
  let directorB: Caller;
  let studentId: string;

  const eventsOf = (entityId: string) =>
    testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId: facilityA.id, entity: 'Student', entityId },
        orderBy: { createdAt: 'asc' },
      }),
    );

  const seedStudent = (name: string) =>
    testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facilityA.id, fullName: name } }),
    );

  /** An approved Receipt row — the handoff state receiptApprove gives
   * provisioning after its money transaction commits (same shape as
   * finance/receipt-cancel-provisioning-race.test.ts). */
  const seedApprovedReceipt = (parentPhone: string, studentName: string) =>
    testDbBypass((tx) =>
      tx.receipt.create({
        data: {
          facilityId: facilityA.id,
          code: `STU-EV-${randomUUID().slice(0, 8).toUpperCase()}`,
          parentPhone,
          studentName,
          classBatchId: classBatch.id,
          netAmount: 5_000_000,
          status: 'approved',
          createdById: 'test-seed',
        },
      }),
    );

  beforeEach(async () => {
    facilityA = await createTestFacility('StudentTimeline-A');
    facilityB = await createTestFacility('StudentTimeline-B');
    classBatch = await seedClassBatch({ facilityId: facilityA.id });
    studentId = (await seedStudent('Timeline Student')).id;

    await seedAppUser({
      facilityId: facilityA.id,
      userId: 'student-timeline-gddt',
      fullName: 'GĐĐT Timeline',
      roles: ['giam_doc_dao_tao'],
    });
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'student-timeline-gddt', roles: ['giam_doc_dao_tao'] }),
    );
    cskh = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'student-timeline-cskh', roles: ['cskh'] }),
    );
    directorB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'student-timeline-gdkb', roles: ['giam_doc_kinh_doanh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
    await cleanupParentAccountsByPhone(...CLEANUP_PHONES);
  });

  it('provisionFromReceipt — records created, guardian_linked and enrollment_activated', async () => {
    const receipt = await seedApprovedReceipt(PHONE_A, 'Provisioned Student');
    const provisioned = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facilityA.id,
      parentPhone: PHONE_A,
      studentName: 'Provisioned Student',
      classBatchId: classBatch.id,
    });
    const row = await testDbBypass((tx) => tx.student.findUnique({ where: { id: provisioned.studentId } }));
    expect(row?.fullName).toBe('Provisioned Student');

    const events = await eventsOf(provisioned.studentId);
    expect(events.map((e) => e.kind)).toEqual(['created', 'guardian_linked', 'enrollment_activated']);
    expect(events[0]?.payload).toBe(null);
    expect(events[1]?.payload).toMatchObject({ relation: 'guardian' });
    expect(events[2]?.payload).toMatchObject({ classBatchId: classBatch.id });
    // Provisioning is system-driven (approve flow / outbox replay).
    expect(events.map((e) => e.actor)).toEqual(['system', 'system', 'system']);
    for (const ev of events) {
      expect(studentEventPayloadLeaksSecret(ev.payload)).toBe(false);
    }
  });

  it('activateEnrollmentForReceipt — reserved flip emits once; idempotent replay emits nothing', async () => {
    const receipt = await seedApprovedReceipt(PHONE_A, 'Activation Student');
    const reserved = await testDbBypass((tx) =>
      tx.enrollment.create({
        data: { facilityId: facilityA.id, studentId, classBatchId: classBatch.id, status: 'reserved' },
      }),
    );

    const activated = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facilityA.id,
      studentId,
      classBatchId: classBatch.id,
      receiptId: receipt.id,
    });
    expect(activated.status).toBe('active');

    const again = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facilityA.id,
      studentId,
      classBatchId: classBatch.id,
      receiptId: receipt.id,
    });
    expect(again.status).toBe('active');

    const events = await eventsOf(studentId);
    expect(events.map((e) => e.kind)).toEqual(['enrollment_activated']);
    expect(events[0]?.payload).toEqual({ enrollmentId: reserved.id, classBatchId: classBatch.id });
  });

  it('activateEnrollmentForReceipt — concurrent receipts emit one activation event', async () => {
    const first = await seedApprovedReceipt(PHONE_A, 'Concurrent Activation Student');
    const second = await seedApprovedReceipt(PHONE_B, 'Concurrent Activation Student');
    const reserved = await testDbBypass((tx) =>
      tx.enrollment.create({
        data: { facilityId: facilityA.id, studentId, classBatchId: classBatch.id, status: 'reserved' },
      }),
    );

    const results = await Promise.all([
      activateEnrollmentForReceipt(testDb(), {
        facilityId: facilityA.id,
        studentId,
        classBatchId: classBatch.id,
        receiptId: first.id,
      }),
      activateEnrollmentForReceipt(testDb(), {
        facilityId: facilityA.id,
        studentId,
        classBatchId: classBatch.id,
        receiptId: second.id,
      }),
    ]);

    expect(results.every((result) => result.status === 'active')).toBe(true);
    const events = await eventsOf(studentId);
    expect(events.map((event) => event.kind)).toEqual(['enrollment_activated']);
    expect(events[0]?.payload).toEqual({ enrollmentId: reserved.id, classBatchId: classBatch.id });
  });

  it('enrollment.enroll — emits enrolled on the Student timeline alongside the class event', async () => {
    const enrollment = await gddt.enrollment.enroll({ studentId, classBatchId: classBatch.id });

    const events = await eventsOf(studentId);
    expect(events.map((e) => e.kind)).toEqual(['enrolled']);
    expect(events[0]?.payload).toEqual({ enrollmentId: enrollment.id, classBatchId: classBatch.id });
    expect(events[0]?.actor).toBe('student-timeline-gddt');
    expect(studentEventPayloadLeaksSecret(events[0]?.payload)).toBe(false);

    // Dual view: the ClassBatch timeline keeps its own student_enrolled event.
    const classEvents = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId: facilityA.id, entity: 'ClassBatch', entityId: classBatch.id },
      }),
    );
    expect(classEvents.map((e) => e.kind)).toEqual(['student_enrolled']);
  });

  it('blockLms and setLifecycle — emit lifecycle_changed, skip no-op writes', async () => {
    await gddt.enrollment.blockLms({ studentId });
    // No-op: already blocked_lms.
    await gddt.student.setLifecycle({ studentId, lifecycle: 'blocked_lms' });
    await gddt.student.setLifecycle({ studentId, lifecycle: 'withdrawn' });

    const events = await eventsOf(studentId);
    expect(events.map((e) => e.payload)).toEqual([
      { from: 'active', to: 'blocked_lms' },
      { from: 'blocked_lms', to: 'withdrawn' },
    ]);
  });

  it('setLifecycle — concurrent identical calls emit one transition event', async () => {
    const results = await Promise.all([
      gddt.student.setLifecycle({ studentId, lifecycle: 'blocked_lms' }),
      gddt.student.setLifecycle({ studentId, lifecycle: 'blocked_lms' }),
    ]);

    expect(results.every((result) => result.lifecycle === 'blocked_lms')).toBe(true);
    const events = await eventsOf(studentId);
    expect(events.map((event) => event.payload)).toEqual([{ from: 'active', to: 'blocked_lms' }]);
  });

  it('student.resetPassword — emits password_reset with the account write', async () => {
    const parent = await seedParentAccount(PHONE_A);
    await seedStudentAccount(studentId, parent.id);

    await gddt.student.resetPassword({ studentId });

    const events = await eventsOf(studentId);
    expect(events.map((e) => e.kind)).toEqual(['password_reset']);
    expect(events[0]?.payload).toBe(null);
  });

  it('finance.receiptCancel(void) — emits enrollment_withdrawn and lifecycle_changed', async () => {
    const receipt = await seedApprovedReceipt(PHONE_A, 'Cancel Student');
    const provisioned = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facilityA.id,
      parentPhone: PHONE_A,
      studentName: 'Cancel Student',
      classBatchId: classBatch.id,
    });

    const gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'student-timeline-gdkd', roles: ['giam_doc_kinh_doanh'] }),
    );
    const cancelled = await gdkd.finance.receiptCancel({
      receiptId: receipt.id,
      reason: 'module-2 timeline test',
      void: true,
    });
    expect(cancelled.studentLifecycle).toBe('withdrawn');

    const kinds = (await eventsOf(provisioned.studentId)).map((e) => e.kind);
    expect(kinds).toEqual([
      'created',
      'guardian_linked',
      'enrollment_activated',
      'enrollment_withdrawn',
      'lifecycle_changed',
    ]);
    const events = await eventsOf(provisioned.studentId);
    expect(events[3]?.payload).toEqual({ classBatchId: classBatch.id });
    expect(events[4]?.payload).toEqual({ from: 'active', to: 'withdrawn' });
  });

  it('finance.receiptCancel(void) — does not emit enrollment_withdrawn for a terminal enrollment', async () => {
    const receipt = await seedApprovedReceipt(PHONE_A, 'Terminal Enrollment Student');
    await testDbBypass((tx) =>
      tx.receipt.update({ where: { id: receipt.id }, data: { studentId } }),
    );
    await testDbBypass((tx) =>
      tx.enrollment.create({
        data: { facilityId: facilityA.id, studentId, classBatchId: classBatch.id, status: 'withdrawn' },
      }),
    );
    const gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityA.id, userId: 'student-timeline-gdkd', roles: ['giam_doc_kinh_doanh'] }),
    );

    await gdkd.finance.receiptCancel({
      receiptId: receipt.id,
      reason: 'no enrollment event test',
      void: true,
    });

    const events = await eventsOf(studentId);
    expect(events.map((event) => event.kind)).toEqual(['lifecycle_changed']);
  });

  it('guardian.approveLink — emits guardian_linked only for a NEW Guardian row', async () => {
    const parent = await seedParentAccount(PHONE_B);
    const first = await seedGuardianLink({ facilityId: facilityA.id, parentAccountId: parent.id, studentId });
    await gddt.guardian.approveLink({ requestId: first.id, relation: 'mother' });

    // Second request for the SAME (parent, student) pair: approval lands on an
    // existing Guardian row — the upsert's update branch records nothing.
    const second = await seedGuardianLink({ facilityId: facilityA.id, parentAccountId: parent.id, studentId });
    await gddt.guardian.approveLink({ requestId: second.id, relation: 'father' });

    const events = await eventsOf(studentId);
    expect(events.map((e) => e.kind)).toEqual(['guardian_linked']);
    expect(events[0]?.payload).toEqual({ parentAccountId: parent.id, relation: 'mother' });
    expect(events[0]?.actor).toBe('student-timeline-gddt');

    const parentEvents = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: {
          facilityId: facilityA.id,
          entity: 'ParentAccount',
          entityId: parent.id,
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(parentEvents.map((event) => event.kind)).toEqual(['child_linked']);
    expect(parentEvents[0]?.payload).toEqual({ studentId, relation: 'mother' });
  });

  it('guardian.approveLink — concurrent same-pair approvals append one event', async () => {
    const parent = await seedParentAccount(PHONE_B);
    const first = await seedGuardianLink({ facilityId: facilityA.id, parentAccountId: parent.id, studentId });
    const second = await seedGuardianLink({ facilityId: facilityA.id, parentAccountId: parent.id, studentId });

    await Promise.all([
      gddt.guardian.approveLink({ requestId: first.id, relation: 'mother' }),
      gddt.guardian.approveLink({ requestId: second.id, relation: 'father' }),
    ]);

    const events = await eventsOf(studentId);
    expect(events.filter((event) => event.kind === 'guardian_linked')).toHaveLength(1);
  });

  it('timeline — authorizes: denied role, cross-facility and missing ids fail; allowed role reads', async () => {
    await gddt.student.setLifecycle({ studentId, lifecycle: 'blocked_lms' });

    const page = await gddt.student.timeline({ studentId });
    expect(page.items.map((i) => i.kind)).toEqual(['lifecycle_changed']);
    // Staff actor ids project to a display label, never the raw userId.
    expect(page.items[0]?.actor).toBe('GĐĐT Timeline');

    // cskh holds no student.lookup — denied role (module-1 follow-up lesson).
    await expect(cskh.student.timeline({ studentId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // Out-of-facility ids look identical to non-existent ones.
    await expect(directorB.student.timeline({ studentId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      gddt.student.timeline({ studentId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('timeline — a student with no events reports the history epoch, empty items', async () => {
    const page = await gddt.student.timeline({ studentId });
    expect(page.items).toEqual([]);
    expect(page.historySince).toEqual(STUDENT_RECORD_EVENT_HISTORY_SINCE);
  });

  it('timeline — provisioning anchors historySince to the created event', async () => {
    const receipt = await seedApprovedReceipt(PHONE_A, 'Epoch Student');
    const provisioned = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facilityA.id,
      parentPhone: PHONE_A,
      studentName: 'Epoch Student',
      classBatchId: classBatch.id,
    });

    const page = await gddt.student.timeline({ studentId: provisioned.studentId });
    expect(page.historySince).toBeNull();
  });

  it('timeline — unknown kinds serialize payload as null and use the fallback label', async () => {
    await testDbBypass((tx) =>
      tx.recordEvent.create({
        data: {
          facilityId: facilityA.id,
          entity: 'Student',
          entityId: studentId,
          kind: 'future_kind',
          actor: 'someone',
          payload: { anything: true },
        },
      }),
    );

    const page = await gddt.student.timeline({ studentId });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.payload).toBeNull();
    expect(page.items[0]?.label).toBe(labelForStudentRecordEventKind('future_kind'));
    // Unknown actor ids project to a system label, never leak the raw id.
    expect(page.items[0]?.actor).toBe('Hệ thống');
  });

  it('timeline — keyset pagination returns newest-first pages and a usable cursor', async () => {
    // Three events in order: enrolled, blocked, withdrawn.
    await gddt.enrollment.enroll({ studentId, classBatchId: classBatch.id });
    await gddt.enrollment.blockLms({ studentId });
    await gddt.student.setLifecycle({ studentId, lifecycle: 'withdrawn' });

    const page1 = await gddt.student.timeline({ studentId, take: 2 });
    expect(page1.items.map((i) => i.kind)).toEqual(['lifecycle_changed', 'lifecycle_changed']);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await gddt.student.timeline({ studentId, take: 2, cursor: page1.nextCursor! });
    expect(page2.items.map((i) => i.kind)).toEqual(['enrolled']);
    expect(page2.nextCursor).toBe(null);

    // No overlap, no loss.
    const all = [...page1.items, ...page2.items].map((i) => i.id);
    expect(new Set(all).size).toBe(3);
  });

  it('emitted payloads never carry secret-shaped or PII keys', async () => {
    const receipt = await seedApprovedReceipt(PHONE_A, 'Leak Scan Student');
    const provisioned = await provisionFromReceipt(testDb(), {
      id: receipt.id,
      facilityId: facilityA.id,
      parentPhone: PHONE_A,
      studentName: 'Leak Scan Student',
      classBatchId: classBatch.id,
    });
    // A second class: provisioning already activated this student's seat in
    // classBatch, and H2's partial unique index forbids a second open row.
    const secondClass = await seedClassBatch({ facilityId: facilityA.id });
    await gddt.enrollment.enroll({ studentId: provisioned.studentId, classBatchId: secondClass.id });

    for (const ev of await eventsOf(provisioned.studentId)) {
      expect(studentEventPayloadLeaksSecret(ev.payload)).toBe(false);
      expect(JSON.stringify(ev.payload ?? {})).not.toMatch(/password|token|phone|email|fullName|studentName|amount/i);
    }
  });
});
