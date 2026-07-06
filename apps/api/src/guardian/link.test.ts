// WF-P1-06 integration tests: parent-requested guardian link, staff-reviewed.
// Covers the child-data boundary (docs/08 §7): a parent must see NO child
// data while a link is `pending`/`rejected`, and gains access only after
// `approveLink`. Also covers the staff-only gate on approve/reject.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedParentAccount,
  testDb,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('guardian.requestLink / approveLink / rejectLink (WF-P1-06)', () => {
  let facility: { id: string };
  let sale: Caller;
  let hr: Caller;
  let student: { id: string };
  let parentAccount: { id: string; phone: string };
  let parent: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Guardian Link Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-link-1', roles: ['sale'] }),
    );
    hr = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'hr-link-1', roles: ['hr'] }),
    );
    student = await testDb().student.create({
      data: { facilityId: facility.id, fullName: 'Guardian Link Student' },
    });

    const phone = normalizeLoginPhone('0991000001');
    phonesToClean.push(phone);
    parentAccount = await seedParentAccount(phone);
    parent = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  it('requestLink creates a pending GuardianLinkRequest', async () => {
    const result = await parent.guardian.requestLink({ studentRef: student.id });
    expect(result.status).toBe('created');

    const requestId = result.status === 'created' ? result.requestId : undefined;
    const row = await testDb().guardianLinkRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(row.status).toBe('pending');
    expect(row.parentAccountId).toBe(parentAccount.id);
    expect(row.facilityId).toBe(facility.id);
  });

  it('parent cannot see child data while the link is pending', async () => {
    await sale.enrollment.enroll({ studentId: student.id, classBatchId: 'class-batch-link-1' });
    await parent.guardian.requestLink({ studentRef: student.id });

    const mine = await parent.enrollment.mine();
    expect(mine).toEqual([]);
  });

  it('staff approve creates a Guardian row and the parent then sees the child', async () => {
    const enrollment = await sale.enrollment.enroll({
      studentId: student.id,
      classBatchId: 'class-batch-link-2',
    });
    const requested = await parent.guardian.requestLink({ studentRef: student.id });
    const requestId = requested.status === 'created' ? requested.requestId : undefined;

    const approved = await sale.guardian.approveLink({ requestId: requestId!, relation: 'mother' });
    expect(approved.status).toBe('approved');

    const guardian = await testDb().guardian.findUniqueOrThrow({
      where: { parentAccountId_studentId: { parentAccountId: parentAccount.id, studentId: student.id } },
    });
    expect(guardian.relation).toBe('mother');

    const mine = await parent.enrollment.mine();
    expect(mine).toHaveLength(1);
    expect(mine[0]!.id).toBe(enrollment.id);
    expect(mine[0]!.studentId).toBe(student.id);
  });

  it('reject leaves the parent with no access', async () => {
    await sale.enrollment.enroll({ studentId: student.id, classBatchId: 'class-batch-link-3' });
    const requested = await parent.guardian.requestLink({ studentRef: student.id });
    const requestId = requested.status === 'created' ? requested.requestId : undefined;

    const rejected = await sale.guardian.rejectLink({ requestId: requestId! });
    expect(rejected.status).toBe('rejected');

    const mine = await parent.enrollment.mine();
    expect(mine).toEqual([]);

    const guardian = await testDb().guardian.findUnique({
      where: { parentAccountId_studentId: { parentAccountId: parentAccount.id, studentId: student.id } },
    });
    expect(guardian).toBeNull();
  });

  it('approveLink is staff-only: an LMS/parent caller is UNAUTHORIZED, a staff role without the permission is FORBIDDEN', async () => {
    const requested = await parent.guardian.requestLink({ studentRef: student.id });
    const requestId = requested.status === 'created' ? requested.requestId : undefined;

    await expect(
      // `parent` has no staff session at all (`ctx.subject === null`).
      parent.guardian.approveLink({ requestId: requestId!, relation: 'mother' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    await expect(
      // `hr` is a real staff session but excluded from `guardian.approveLink` (packages/auth registry).
      hr.guardian.approveLink({ requestId: requestId!, relation: 'mother' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('already-linked requestLink is a no-op (no new pending request, no duplicate Guardian)', async () => {
    const first = await parent.guardian.requestLink({ studentRef: student.id });
    const requestId = first.status === 'created' ? first.requestId : undefined;
    await sale.guardian.approveLink({ requestId: requestId!, relation: 'father' });

    const second = await parent.guardian.requestLink({ studentRef: student.id });
    expect(second.status).toBe('already_linked');

    const guardianCount = await testDb().guardian.count({
      where: { parentAccountId: parentAccount.id, studentId: student.id },
    });
    expect(guardianCount).toBe(1);
  });

  it('a duplicate pending requestLink is a no-op (reuses the existing pending request)', async () => {
    const first = await parent.guardian.requestLink({ studentRef: student.id });
    const second = await parent.guardian.requestLink({ studentRef: student.id });

    expect(first.status).toBe('created');
    expect(second.status).toBe('already_pending');

    const pendingCount = await testDb().guardianLinkRequest.count({
      where: { parentAccountId: parentAccount.id, studentRef: student.id, status: 'pending' },
    });
    expect(pendingCount).toBe(1);
  });
});
