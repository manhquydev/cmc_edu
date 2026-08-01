// HR remediation phase 1 (finding #16): ShiftRegistration.status CHECK
// constraint acceptance test. `shift.reject` (the actual writer that sets
// status='rejected') lands in phase 4 — this test exercises the DB-layer
// constraint directly (DROP + ADD NOT VALID + VALIDATE in the migration),
// same pattern as ../security/rls-enforcement.test.ts.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupFacility, createTestFacility, seedAppUser, testDbBypass } from '../test/db.js';

describe('ShiftRegistration.status CHECK constraint (HR remediation phase 1)', () => {
  let facilityId: string;
  let appUserId: string;
  let shiftGroupId: string;

  beforeEach(async () => {
    const facility = await createTestFacility('ShiftStatusCheck-Facility');
    facilityId = facility.id;

    const appUser = await seedAppUser({
      facilityId,
      userId: 'shift-status-check-employee-001',
      position: 'giao_vien',

      // Roles decide the shift track (resolveShiftGroup); the job title does not.

      roles: ['giao_vien'],
    });
    appUserId = appUser.id;

    const group = await testDbBypass((tx) =>
      tx.shiftGroup.create({
        data: { facilityId, name: 'Ca Giáo Viên (status-check)', type: 'GIAO_VIEN', selectionMode: 'SINGLE' },
      }),
    );
    shiftGroupId = group.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  function baseData(status: string) {
    return {
      facilityId,
      appUserId,
      shiftGroupId,
      fromDate: new Date('2099-01-15T00:00:00.000Z'),
      toDate: new Date('2099-01-15T00:00:00.000Z'),
      status,
      selectionMode: 'SINGLE',
    };
  }

  it('accepts the new "rejected" status value (finding #16 / #7)', async () => {
    const row = await testDbBypass((tx) => tx.shiftRegistration.create({ data: baseData('rejected') }));
    expect(row.status).toBe('rejected');
  });

  it('still accepts every pre-existing status value', async () => {
    for (const status of ['draft', 'submitted', 'approved', 'cancelled']) {
      const row = await testDbBypass((tx) => tx.shiftRegistration.create({ data: baseData(status) }));
      expect(row.status).toBe(status);
    }
  });

  it('rejects a garbage status value at the DB layer', async () => {
    await expect(testDbBypass((tx) => tx.shiftRegistration.create({ data: baseData('bogus_status') }))).rejects.toThrow();
  });

  it('rejectReason column accepts a value and defaults to null', async () => {
    const withReason = await testDbBypass((tx) =>
      tx.shiftRegistration.create({ data: { ...baseData('rejected'), rejectReason: 'Trùng lịch dạy.' } }),
    );
    expect(withReason.rejectReason).toBe('Trùng lịch dạy.');

    const withoutReason = await testDbBypass((tx) => tx.shiftRegistration.create({ data: baseData('draft') }));
    expect(withoutReason.rejectReason).toBeNull();
  });
});
