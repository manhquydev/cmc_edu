// ADR 0042 acceptance test: Postgres Row-Level Security must block a
// cross-facility read/write at the DATABASE layer even when the app-level
// `scoped(ctx)` filter is completely absent from the query — this is the
// specific guarantee the ADR exists for (a forgotten `where facilityId` or a
// raw query must not leak across facilities). It also proves the narrow,
// audited `bypass_rls` escape hatch (super_admin/director cross-facility
// reads) actually works, and that omitting the GUC entirely fails CLOSED
// (0 rows), not open (unrestricted access).
//
// Uses `withFacility()` directly (not a tRPC caller) so these assertions
// target the RLS policies themselves, independent of any app-level filter.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withFacility } from '@cmc/db';
import { cleanupFacility, createTestFacility, testDb, testDbBypass } from '../test/db.js';

describe('Postgres RLS enforcement (ADR 0042 acceptance)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };
  let contactA: { id: string };
  let contactB: { id: string };
  let studentB: { id: string; fullName: string };

  beforeEach(async () => {
    facilityA = await createTestFacility('RLS Facility A');
    facilityB = await createTestFacility('RLS Facility B');

    [contactA, contactB, studentB] = await testDbBypass((tx) =>
      Promise.all([
        tx.contact.create({ data: { facilityId: facilityA.id, name: 'Contact A', phone: '0900000101' } }),
        tx.contact.create({ data: { facilityId: facilityB.id, name: 'Contact B', phone: '0900000102' } }),
        tx.student.create({ data: { facilityId: facilityB.id, fullName: 'Student B (facility B only)' } }),
      ]),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('blocks an unscoped read: querying with NO facilityId filter under facility A only ever sees facility A rows', async () => {
    // Deliberately omits `where: { facilityId }` — exactly the mistake H4/the
    // cross-audit found in application code. RLS must still narrow this.
    const rows = await withFacility(testDb(), facilityA.id, (tx) => tx.contact.findMany({}));
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(contactA.id);
    expect(ids).not.toContain(contactB.id);
  });

  it('blocks a direct-by-id raw query for a foreign facility row, with no facilityId predicate anywhere in the SQL', async () => {
    const foreign = await withFacility(testDb(), facilityA.id, (tx) =>
      tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Contact" WHERE id = ${contactB.id}`,
    );
    expect(foreign).toHaveLength(0);

    const own = await withFacility(testDb(), facilityA.id, (tx) =>
      tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Contact" WHERE id = ${contactA.id}`,
    );
    expect(own).toHaveLength(1);
  });

  it('blocks a cross-facility write (WITH CHECK): updating a foreign facility row by id fails even with no facilityId in the query', async () => {
    await expect(
      withFacility(testDb(), facilityA.id, (tx) =>
        tx.contact.update({ where: { id: contactB.id }, data: { name: 'hacked from facility A' } }),
      ),
    ).rejects.toThrow();

    // The row is untouched — RLS rejected the write, not a silent no-op.
    const unchanged = await testDbBypass((tx) => tx.contact.findUniqueOrThrow({ where: { id: contactB.id } }));
    expect(unchanged.name).toBe('Contact B');
  });

  it('blocks cross-facility children data (Student) the same way — the ADR\'s primary motivation', async () => {
    const rows = await withFacility(testDb(), facilityA.id, (tx) =>
      tx.student.findMany({ where: { id: studentB.id } }),
    );
    expect(rows).toHaveLength(0);
  });

  it('the audited bypass GUC (super_admin/director executive read) returns rows across facilities', async () => {
    const rows = await withFacility(
      testDb(),
      null,
      (tx) => tx.contact.findMany({ where: { id: { in: [contactA.id, contactB.id] } } }),
      { bypass: true },
    );
    expect(rows.map((r) => r.id).sort()).toEqual([contactA.id, contactB.id].sort());
  });

  it('fails CLOSED, not open: a query issued with no GUC set at all sees zero rows on a facility-scoped table', async () => {
    // No `withFacility()` wrapper at all — `set_config` was never called on
    // this connection for this query, so both GUCs read as unset (null).
    const rows = await testDb().$queryRaw<{ id: string }[]>`SELECT id FROM "Contact" WHERE id = ${contactA.id}`;
    expect(rows).toHaveLength(0);
  });

  it('withFacility() refuses to run without a facilityId unless bypass is explicitly set', async () => {
    await expect(withFacility(testDb(), null, async (tx) => tx.contact.findMany({}))).rejects.toThrow(
      /requires a facilityId/,
    );
  });
});
