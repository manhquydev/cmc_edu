// HR remediation phase 1 (finding #16): ManualAttendanceTicket.status CHECK
// constraint acceptance test — the first CHECK ever added for this table's
// status column (NOT VALID + VALIDATE, migration
// 20260712000000_hr_remediation_policy_quota_reject_done).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupFacility, createTestFacility, seedAppUser, testDbBypass } from '../test/db.js';

describe('ManualAttendanceTicket.status CHECK constraint (HR remediation phase 1)', () => {
  let facilityId: string;
  let appUserId: string;

  beforeEach(async () => {
    const facility = await createTestFacility('TicketStatusCheck-Facility');
    facilityId = facility.id;

    const appUser = await seedAppUser({ facilityId, userId: 'ticket-status-check-employee-001' });
    appUserId = appUser.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  function baseData(status: string) {
    return {
      facilityId,
      appUserId,
      ticketDate: new Date('2026-07-01T00:00:00.000Z'),
      status,
    };
  }

  it('accepts every documented status value', async () => {
    for (const status of ['pending', 'approved', 'rejected', 'resubmitted']) {
      const row = await testDbBypass((tx) => tx.manualAttendanceTicket.create({ data: baseData(status) }));
      expect(row.status).toBe(status);
    }
  });

  it('rejects a garbage status value at the DB layer', async () => {
    await expect(
      testDbBypass((tx) => tx.manualAttendanceTicket.create({ data: baseData('bogus_status') })),
    ).rejects.toThrow();
  });

  it('rejects an update that flips an existing row to a garbage status', async () => {
    const row = await testDbBypass((tx) => tx.manualAttendanceTicket.create({ data: baseData('pending') }));
    await expect(
      testDbBypass((tx) => tx.manualAttendanceTicket.update({ where: { id: row.id }, data: { status: 'archived' } })),
    ).rejects.toThrow();
  });
});
