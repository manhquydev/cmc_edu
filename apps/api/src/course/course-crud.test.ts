// Test backfill (gap-closure 260710-0005 Phase 3): course.create/list. Lean
// CRUD coverage — happy path + permission gate (registry: 'course.manage' →
// giam_doc_dao_tao only, packages/auth/src/index.ts).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('course.create / course.list (test backfill)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let sale: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('Course CRUD Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-course-1', roles: ['giam_doc_dao_tao'] }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-course-1', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('creates a course and lists it back, facility-scoped', async () => {
    const created = await gddt.course.create({ program: 'UCREA', name: 'UCREA Level 2' });
    expect(created.id).toEqual(expect.any(String));
    expect(created.program).toBe('UCREA');
    expect(created.name).toBe('UCREA Level 2');

    const { items, total } = await gddt.course.list({});
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items.some((c) => c.id === created.id)).toBe(true);
  });

  it('course.list search and program filter narrow the catalog', async () => {
    const a = await gddt.course.create({ program: 'UCREA', name: 'Search Alpha Course' });
    const b = await gddt.course.create({ program: 'BRIGHT_IG', name: 'Search Beta Course' });

    const byName = await gddt.course.list({ search: 'Alpha' });
    expect(byName.items.some((c) => c.id === a.id)).toBe(true);
    expect(byName.items.every((c) => c.id !== b.id)).toBe(true);

    const byProgram = await gddt.course.list({ program: 'BRIGHT_IG' });
    expect(byProgram.items.some((c) => c.id === b.id)).toBe(true);
    expect(byProgram.items.every((c) => c.program === 'BRIGHT_IG')).toBe(true);
  });

  it('forbids a role without course.manage permission from creating', async () => {
    await expect(sale.course.create({ program: 'UCREA', name: 'No Access' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('forbids a role without course.manage permission from listing', async () => {
    await expect(sale.course.list({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not expose a course created in a different facility', async () => {
    const otherFacility = await createTestFacility('Course CRUD Facility (other)');
    try {
      const otherGddt = appRouter.createCaller(
        buildStaffContext({ facilityId: otherFacility.id, userId: 'gddt-course-2', roles: ['giam_doc_dao_tao'] }),
      );
      const created = await gddt.course.create({ program: 'UCREA', name: 'Facility A Course' });

      const { items, total } = await otherGddt.course.list({});
      expect(items.some((c) => c.id === created.id)).toBe(false);
      expect(total).toBe(0);
    } finally {
      await cleanupFacility(otherFacility.id);
    }
  });
});
