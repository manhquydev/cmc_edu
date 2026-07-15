// Phase 1 (ADR 0043) — schema-shape RED tests for TimePunch.withinNetwork and
// ManualAttendanceTicket.checkInAt/checkOutAt. Written before the migration
// exists; must fail until `packages/db/prisma/schema.prisma` + the new
// migration land.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ictToUtc } from '@cmc/domain-time';
import {
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

describe('Phase 1 (ADR 0043) — schema shape', () => {
  let facilityId: string;

  beforeEach(async () => {
    const f = await createTestFacility('P1 Schema Shape Test');
    facilityId = f.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('TimePunch.withinNetwork can be set to false and read back', async () => {
    const user = await seedAppUser({ facilityId, userId: 'schema-punch-offsite' });
    const punch = await testDbBypass((tx) =>
      tx.timePunch.create({
        data: { facilityId, appUserId: user.id, method: 'ip', withinNetwork: false },
      }),
    );
    const reread = await testDbBypass((tx) =>
      tx.timePunch.findUniqueOrThrow({ where: { id: punch.id } }),
    );
    expect(reread.withinNetwork).toBe(false);
  });

  it('TimePunch.withinNetwork defaults to true when not set', async () => {
    const user = await seedAppUser({ facilityId, userId: 'schema-punch-default' });
    const punch = await testDbBypass((tx) =>
      tx.timePunch.create({ data: { facilityId, appUserId: user.id, method: 'ip' } }),
    );
    expect(punch.withinNetwork).toBe(true);
  });

  it('ManualAttendanceTicket.checkInAt/checkOutAt can be set and read back', async () => {
    const user = await seedAppUser({ facilityId, userId: 'schema-ticket-hours' });
    const checkInAt = new Date('2026-08-01T02:00:00.000Z');
    const checkOutAt = new Date('2026-08-01T11:00:00.000Z');
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: {
          facilityId,
          appUserId: user.id,
          ticketDate: ictToUtc('2026-08-01', '00:00'),
          checkInAt,
          checkOutAt,
        },
      }),
    );
    const reread = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
    );
    expect(reread.checkInAt?.toISOString()).toBe(checkInAt.toISOString());
    expect(reread.checkOutAt?.toISOString()).toBe(checkOutAt.toISOString());
  });

  it('ManualAttendanceTicket.checkInAt/checkOutAt default to null', async () => {
    const user = await seedAppUser({ facilityId, userId: 'schema-ticket-nulls' });
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: { facilityId, appUserId: user.id, ticketDate: ictToUtc('2026-08-02', '00:00') },
      }),
    );
    expect(ticket.checkInAt).toBeNull();
    expect(ticket.checkOutAt).toBeNull();
  });

  it('unique (appUserId, ticketDate): second ticket same day rejected at DB level', async () => {
    const user = await seedAppUser({ facilityId, userId: 'schema-ticket-unique' });
    await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: { facilityId, appUserId: user.id, ticketDate: ictToUtc('2026-08-03', '00:00') },
      }),
    );
    await expect(
      testDbBypass((tx) =>
        tx.manualAttendanceTicket.create({
          data: { facilityId, appUserId: user.id, ticketDate: ictToUtc('2026-08-03', '00:00') },
        }),
      ),
    ).rejects.toThrow();
  });
});
