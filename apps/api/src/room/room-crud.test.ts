// Test backfill (gap-closure 260710-0005 Phase 3): room.create/list. Lean
// CRUD coverage — happy path + permission gate (registry: 'room.manage' →
// giam_doc_dao_tao only, packages/auth/src/index.ts).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('room.create / room.list (test backfill)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let sale: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('Room CRUD Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-room-1', roles: ['giam_doc_dao_tao'] }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-room-1', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('creates a room and lists it back, facility-scoped', async () => {
    const created = await gddt.room.create({ code: 'R101', name: 'Room 101' });
    expect(created.id).toEqual(expect.any(String));
    expect(created.code).toBe('R101');
    expect(created.isActive).toBe(true);

    const { items, total } = await gddt.room.list({});
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items.some((r) => r.id === created.id)).toBe(true);
  });

  it('forbids a role without room.manage permission from creating', async () => {
    await expect(sale.room.create({ code: 'R102', name: 'No Access' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('forbids a role without room.manage permission from listing', async () => {
    await expect(sale.room.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
