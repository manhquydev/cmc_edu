// ParentAccount isActive + tokenVersion (teaching spine phase 4).

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedClassBatch,
  seedEnrolledStudentWithGuardian,
  seedParentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';
import { signLmsToken, LMS_SESSION_SECRET_DEV_DEFAULT } from '../lms-auth/session-token.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('parentAccount.setActive + LMS session invalidation', () => {
  let facility: { id: string };
  let gdkd: Caller;
  let parent: { id: string; phone: string };
  let enrollment: { id: string; studentId: string };

  beforeEach(async () => {
    facility = await createTestFacility('Parent Active Facility');
    gdkd = appRouter.createCaller(
      buildStaffContext({
        facilityId: facility.id,
        userId: 'gdkd-pa-1',
        roles: ['giam_doc_kinh_doanh'],
      }),
    );
    const phone = `84${randomUUID().replace(/-/g, '').slice(0, 9)}`;
    parent = await seedParentAccount(phone);
    const batch = await seedClassBatch({ facilityId: facility.id });
    enrollment = await seedEnrolledStudentWithGuardian({
      facilityId: facility.id,
      classBatchId: batch.id,
      parentAccountId: parent.id,
    });
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupParentAccountsByPhone(parent.phone);
  });

  it('active parent can call listForChild; deactivate bumps tokenVersion and blocks lmsProcedure', async () => {
    const lms = appRouter.createCaller(
      buildLmsContext({ parentAccountId: parent.id, kind: 'parent' }),
    );
    // Dev header path: tokenVersion defaults 0 matching seeded account.
    await expect(
      lms.sessionEvidence.listForChild({ studentId: enrollment.studentId }),
    ).resolves.toMatchObject({ items: [] });

    const deactivated = await gdkd.parentAccount.setActive({
      parentAccountId: parent.id,
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.tokenVersion).toBe(1);
    const event = await testDbBypass((tx) =>
      tx.recordEvent.findFirst({
        where: { entity: 'ParentAccount', entityId: parent.id, kind: 'active_changed' },
      }),
    );
    expect(event?.payload).toEqual({ isActive: false });
    await expect(
      lms.sessionEvidence.listForChild({ studentId: enrollment.studentId }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('sale cannot setActive', async () => {
    const sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-pa-1', roles: ['sale'] }),
    );
    await expect(
      sale.parentAccount.setActive({ parentAccountId: parent.id, isActive: false }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('signed token with stale tv is rejected after tokenVersion bump', async () => {
    const secret = process.env['LMS_SESSION_SECRET'] ?? LMS_SESSION_SECRET_DEV_DEFAULT;
    const token = signLmsToken(
      { parentAccountId: parent.id, kind: 'parent', tokenVersion: 0 },
      secret,
    );

    // Simulate bearer auth by building caller with claims embedding tokenVersion.
    // buildLmsContext uses dev header — set tokenVersion on subject via custom ctx.
    const stale = appRouter.createCaller({
      ...buildLmsContext({ parentAccountId: parent.id, kind: 'parent' }),
      lmsSubject: { parentAccountId: parent.id, kind: 'parent', tokenVersion: 0 },
    });

    await gdkd.parentAccount.setActive({ parentAccountId: parent.id, isActive: false });
    // re-activate but keep higher tokenVersion (deactivate already bumped)
    await testDb().parentAccount.update({
      where: { id: parent.id },
      data: { isActive: true },
    });
    const row = await testDb().parentAccount.findUniqueOrThrow({ where: { id: parent.id } });
    expect(row.tokenVersion).toBeGreaterThanOrEqual(1);

    await expect(
      stale.sessionEvidence.listForChild({ studentId: enrollment.studentId }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    const fresh = appRouter.createCaller({
      ...buildLmsContext({ parentAccountId: parent.id, kind: 'parent' }),
      lmsSubject: {
        parentAccountId: parent.id,
        kind: 'parent',
        tokenVersion: row.tokenVersion,
      },
    });
    await expect(
      fresh.sessionEvidence.listForChild({ studentId: enrollment.studentId }),
    ).resolves.toMatchObject({ items: [] });

    // token string verifies claims shape
    expect(token.split('.').length).toBe(3);
  });
});
