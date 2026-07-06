// K8 remediation integration tests: `enrollment.blockLms` is the missing
// writer for `StudentLifecycle.blocked_lms` (docs/19 §2). The read-side gate
// (`getApprovedChildren` excluding `blocked_lms`) already existed and was
// already tested (lms-auth/login.test.ts) — but nothing in the repo could
// ever reach that state (deep-review K8, confirmed: grep for a writer found
// none). This file proves the writer exists, is permission-gated, and
// actually blocks the LMS read path end-to-end.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedGuardianLink,
  seedParentAccount,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('enrollment.blockLms (K8)', () => {
  let facility: { id: string };
  let gdkd: Caller;
  let sale: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Block LMS Facility');
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-block-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-block-1', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  it('sets StudentLifecycle to blocked_lms and blocks the LMS read gate (enrollment.mine)', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Blockable Student' } }),
    );
    await testDbBypass((tx) =>
      tx.enrollment.create({
        data: { facilityId: facility.id, studentId: student.id, classBatchId: 'class-batch-block-1' },
      }),
    );
    const phone = normalizeLoginPhone('0999000001');
    phonesToClean.push(phone);
    const parentAccount = await seedParentAccount(phone);
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });
    const parent = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));

    const mineBeforeBlock = await parent.enrollment.mine();
    expect(mineBeforeBlock.some((e) => e.studentId === student.id)).toBe(true);

    const result = await gdkd.enrollment.blockLms({ studentId: student.id });
    expect(result.lifecycle).toBe('blocked_lms');

    const updated = await testDbBypass((tx) => tx.student.findUniqueOrThrow({ where: { id: student.id } }));
    expect(updated.lifecycle).toBe('blocked_lms');

    const mineAfterBlock = await parent.enrollment.mine();
    expect(mineAfterBlock.some((e) => e.studentId === student.id)).toBe(false);
  });

  it('forbids a role without enrollment.blockLms permission', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Sale-Blocked Attempt' } }),
    );

    await expect(sale.enrollment.blockLms({ studentId: student.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects blocking a student outside the caller facility (RLS)', async () => {
    const otherFacility = await createTestFacility('Other Block LMS Facility');
    const otherGdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'gdkd-block-other-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Cross Facility Student' } }),
    );

    await expect(otherGdkd.enrollment.blockLms({ studentId: student.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    await cleanupFacility(otherFacility.id);
  });
});
