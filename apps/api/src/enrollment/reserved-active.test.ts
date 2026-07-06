// WF-P1-05 integration tests (ADR-A): `enrollment.enroll` creates a
// `reserved` seat hold; the `reserved` -> `active` transition is
// Receipt-driven (performed by `finance.receiptApprove` provisioning via
// `activateEnrollmentForReceipt`, exercised directly here plus end-to-end in
// ../provisioning/idempotent.test.ts) — never settable by a direct mutation.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { activateEnrollmentForReceipt } from './activate-enrollment.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedClassBatch,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('enrollment reserved -> active (WF-P1-05, ADR-A)', () => {
  let facility: { id: string };
  let gdkd: Caller;
  let student: { id: string };
  let classBatch: { id: string };

  beforeEach(async () => {
    facility = await createTestFacility('Enrollment Facility');
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-enroll-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    // Provisioning normally creates Student rows; here we only need a
    // facility-scoped student to exercise the enrollment state machine.
    student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Existing Student' } }),
    );
    // P2-Foundation seam: enrollment.enroll/activateEnrollmentForReceipt now
    // require a real, same-facility ClassBatch — each test below reuses this
    // one seeded batch (they never enroll the same student into two
    // DIFFERENT classes within one test, so sharing it is safe).
    classBatch = await seedClassBatch({ facilityId: facility.id });
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('enrollment.enroll creates a reserved enrollment (seat held, unpaid)', async () => {
    const enrollment = await gdkd.enrollment.enroll({ studentId: student.id, classBatchId: classBatch.id });
    expect(enrollment.status).toBe('reserved');
  });

  it('never auto-flips to active on its own — stays reserved until provisioning activates it', async () => {
    const enrollment = await gdkd.enrollment.enroll({ studentId: student.id, classBatchId: classBatch.id });

    const stillReserved = await testDbBypass((tx) =>
      tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
    );
    expect(stillReserved.status).toBe('reserved');
  });

  it('flips a reserved enrollment to active via the same activation path receiptApprove provisioning uses (ADR-A)', async () => {
    const enrollment = await gdkd.enrollment.enroll({ studentId: student.id, classBatchId: classBatch.id });
    expect(enrollment.status).toBe('reserved');

    const activated = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facility.id,
      studentId: student.id,
      classBatchId: classBatch.id,
    });
    expect(activated.id).toBe(enrollment.id);
    expect(activated.status).toBe('active');

    const persisted = await testDbBypass((tx) =>
      tx.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
    );
    expect(persisted.status).toBe('active');
  });

  it('creates a fresh active enrollment when none exists yet (provisioning for a brand-new class, no prior reserved row)', async () => {
    const activated = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facility.id,
      studentId: student.id,
      classBatchId: classBatch.id,
    });
    expect(activated.status).toBe('active');

    const count = await testDbBypass((tx) =>
      tx.enrollment.count({ where: { studentId: student.id, classBatchId: classBatch.id } }),
    );
    expect(count).toBe(1);
  });

  it('is idempotent: activating an already-active enrollment again does not duplicate or error', async () => {
    const first = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facility.id,
      studentId: student.id,
      classBatchId: classBatch.id,
    });
    const second = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facility.id,
      studentId: student.id,
      classBatchId: classBatch.id,
    });

    expect(second.id).toBe(first.id);
    expect(second.status).toBe('active');
    const count = await testDbBypass((tx) =>
      tx.enrollment.count({ where: { studentId: student.id, classBatchId: classBatch.id } }),
    );
    expect(count).toBe(1);
  });

  it('activates a fresh Enrollment after withdraw -> re-pay, never returning the stale withdrawn row — M8', async () => {
    const activated = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facility.id,
      studentId: student.id,
      classBatchId: classBatch.id,
    });
    expect(activated.status).toBe('active');

    await testDbBypass((tx) =>
      tx.enrollment.update({ where: { id: activated.id }, data: { status: 'withdrawn' } }),
    );

    const reactivated = await activateEnrollmentForReceipt(testDb(), {
      facilityId: facility.id,
      studentId: student.id,
      classBatchId: classBatch.id,
    });

    expect(reactivated.id).not.toBe(activated.id);
    expect(reactivated.status).toBe('active');

    const withdrawnRow = await testDbBypass((tx) =>
      tx.enrollment.findUniqueOrThrow({ where: { id: activated.id } }),
    );
    expect(withdrawnRow.status).toBe('withdrawn');

    const activeCount = await testDbBypass((tx) =>
      tx.enrollment.count({
        where: { studentId: student.id, classBatchId: classBatch.id, status: 'active' },
      }),
    );
    expect(activeCount).toBe(1);
  });

  it('exposes no direct mutation to set an enrollment active — only enroll() (reserved) is on the router', async () => {
    // `appRouter.createCaller` returns a lazy tRPC proxy; every property
    // access resolves to a callable, so the router shape must be asserted by
    // calling and observing "no procedure found", not by property presence.
    const caller = gdkd.enrollment as unknown as Record<string, (input: unknown) => Promise<unknown>>;
    await expect(caller.setActive({ enrollmentId: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(caller.activate({ enrollmentId: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(caller.updateStatus({ enrollmentId: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('forbids a role without enrollment.enroll permission', async () => {
    const teacher = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'teacher-enroll-1', roles: ['giao_vien'] }),
    );
    await expect(
      teacher.enrollment.enroll({ studentId: student.id, classBatchId: classBatch.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects enrolling a student outside the caller facility (RLS)', async () => {
    const otherFacility = await createTestFacility('Other Enrollment Facility');
    const otherGdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'gdkd-other-1', roles: ['giam_doc_kinh_doanh'] }),
    );

    await expect(
      otherGdkd.enrollment.enroll({ studentId: student.id, classBatchId: classBatch.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await cleanupFacility(otherFacility.id);
  });
});
