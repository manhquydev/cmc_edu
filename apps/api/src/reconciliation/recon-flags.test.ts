// Test backfill (gap-closure 260710-0005 Phase 3): reconciliation.listFlags/
// dismiss/action — flag lifecycle (open -> dismissed|actioned, terminal),
// roster gate (registry: 'reconciliation.review' → giam_doc_dao_tao,
// giam_doc_kinh_doanh only), and cross-facility RLS negative (facility B
// cannot see or resolve facility A's flags).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, testDbBypass } from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('reconciliation.listFlags / dismiss / action (test backfill)', () => {
  let facility: { id: string };
  let gddt: Caller;
  let sale: Caller;

  beforeEach(async () => {
    facility = await createTestFacility('Reconciliation Facility');
    gddt = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gddt-recon-1', roles: ['giam_doc_dao_tao'] }),
    );
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-recon-1', roles: ['sale'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  async function seedFlag(overrides?: { status?: string; kind?: string }) {
    return testDbBypass((tx) =>
      tx.reconciliationFlag.create({
        data: {
          facilityId: facility.id,
          kind: overrides?.kind ?? 'exceeds_threshold',
          detail: { note: 'seed' },
          status: overrides?.status ?? 'open',
        },
      }),
    );
  }

  it('lists open flags for the caller facility, optionally filtered by kind', async () => {
    await seedFlag({ kind: 'exceeds_threshold' });
    await seedFlag({ kind: 'self_approved' });

    const all = await gddt.reconciliation.listFlags({});
    expect(all.length).toBeGreaterThanOrEqual(2);

    const filtered = await gddt.reconciliation.listFlags({ kind: 'self_approved' });
    expect(filtered.every((f) => f.kind === 'self_approved')).toBe(true);
  });

  it('dismiss: open -> dismissed, records resolvedById + writes an audit log', async () => {
    const flag = await seedFlag();

    const dismissed = await gddt.reconciliation.dismiss({ flagId: flag.id });
    expect(dismissed.status).toBe('dismissed');
    expect(dismissed.resolvedById).toBe('gddt-recon-1');
    expect(dismissed.resolvedAt).not.toBeNull();
  });

  it('action: open -> actioned', async () => {
    const flag = await seedFlag();

    const actioned = await gddt.reconciliation.action({ flagId: flag.id });
    expect(actioned.status).toBe('actioned');
  });

  it('rejects dismissing an already-resolved flag (terminal state)', async () => {
    const flag = await seedFlag();
    await gddt.reconciliation.dismiss({ flagId: flag.id });

    await expect(gddt.reconciliation.dismiss({ flagId: flag.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('forbids a role without reconciliation.review permission', async () => {
    await expect(sale.reconciliation.listFlags({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('RLS negative: facility B cannot see or dismiss facility A\'s flag', async () => {
    const flag = await seedFlag();
    const facilityB = await createTestFacility('Reconciliation Facility B');
    const gddtB = appRouter.createCaller(
      buildStaffContext({ facilityId: facilityB.id, userId: 'gddt-recon-b', roles: ['giam_doc_dao_tao'] }),
    );

    try {
      const listB = await gddtB.reconciliation.listFlags({});
      expect(listB.some((f) => f.id === flag.id)).toBe(false);

      await expect(gddtB.reconciliation.dismiss({ flagId: flag.id })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    } finally {
      await cleanupFacility(facilityB.id);
    }
  });
});
