// Teacher class-scoping remediation (scenario audit H1+H2, 2026-07-15):
// unit coverage for the shared ownership gate — director bypass, non-teacher
// bypass, correct-class pass, wrong-class FORBIDDEN, missing-AppUser
// fail-closed, and unassigned-class (teacherAppUserId=null) FORBIDDEN (PO
// decision: only a director may act on a class with no assigned teacher).
//
// Every call runs inside `withFacility(testDb(), facility.id, ...)` — the
// SAME RLS-scoped transaction pattern every real router procedure uses
// (`withFacility(ctx.db, facilityId, (tx) => ...)`), so this test exercises
// the helper exactly as production calls it, not a bare unscoped client.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuthSubject } from '@cmc/auth';
import { withFacility } from '@cmc/db';
import { assertTeacherOwnsClass } from './assert-teacher-owns-class.js';
import { cleanupFacility, createTestFacility, seedAppUser, seedClassBatch, testDb, testDbBypass } from '../test/db.js';

describe('assertTeacherOwnsClass', () => {
  let facility: { id: string };
  let classBatch: { id: string };

  beforeEach(async () => {
    facility = await createTestFacility('Teacher Scope Facility');
    classBatch = await seedClassBatch({ facilityId: facility.id });
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  function assertAsSubject(subject: AuthSubject, batchId = classBatch.id) {
    return withFacility(testDb(), facility.id, (tx) => assertTeacherOwnsClass(tx, facility.id, subject, batchId));
  }

  it('bypasses the check for a director role (super_admin/GĐĐT/GĐKD)', async () => {
    await expect(assertAsSubject({ userId: 'gd-1', roles: ['giam_doc_dao_tao'] })).resolves.toBeUndefined();
  });

  it('bypasses the check for a non-teacher role (nothing to scope)', async () => {
    await expect(assertAsSubject({ userId: 'sale-1', roles: ['sale'] })).resolves.toBeUndefined();
  });

  it('passes when the teacher is assigned to the class', async () => {
    const teacher = await seedAppUser({ facilityId: facility.id, userId: 'gv-owner-1' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: teacher.id } }),
    );

    await expect(assertAsSubject({ userId: 'gv-owner-1', roles: ['giao_vien'] })).resolves.toBeUndefined();
  });

  it('rejects a teacher assigned to a DIFFERENT class (FORBIDDEN)', async () => {
    const owner = await seedAppUser({ facilityId: facility.id, userId: 'gv-owner-2' });
    await seedAppUser({ facilityId: facility.id, userId: 'gv-other-2' });
    await testDbBypass((tx) =>
      tx.classBatch.update({ where: { id: classBatch.id }, data: { teacherAppUserId: owner.id } }),
    );

    await expect(assertAsSubject({ userId: 'gv-other-2', roles: ['giao_vien'] })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('fail-closed: rejects a teacher whose AppUser profile cannot be resolved', async () => {
    await expect(assertAsSubject({ userId: 'gv-no-profile', roles: ['giao_vien'] })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('PO decision: rejects a teacher on a class with no assigned teacher (teacherAppUserId=null)', async () => {
    await seedAppUser({ facilityId: facility.id, userId: 'gv-unassigned-1' });
    // classBatch.teacherAppUserId is null by default (seedClassBatch does not set it).

    await expect(assertAsSubject({ userId: 'gv-unassigned-1', roles: ['giao_vien'] })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
