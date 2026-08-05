// facilityGeofence CRUD + testMyPosition.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

describe('facilityGeofence CRUD', () => {
  let facilityId: string;

  const superCtx = (userId: string) =>
    buildStaffContext({ facilityId, userId, roles: ['super_admin'] });

  const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

  beforeEach(async () => {
    const f = await createTestFacility('Geofence Router Test');
    facilityId = f.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('create defaults isActive=false and writes audit log', async () => {
    const created = await caller(superCtx('admin-geo-create')).facilityGeofence.create({
      lat: 21.0285,
      lng: 105.8542,
      radiusM: 200,
      accuracyMaxM: 200,
      label: 'HQ',
    });
    expect(created.isActive).toBe(false);
    expect(created.radiusM).toBe(200);
    expect(created.accuracyMaxM).toBe(200);

    const row = await testDbBypass((tx) =>
      tx.facilityGeofence.findUniqueOrThrow({ where: { id: created.id } }),
    );
    expect(row.label).toBe('HQ');

    const audit = await testDbBypass((tx) =>
      tx.auditLog.findFirst({
        where: {
          entity: 'FacilityGeofence',
          entityId: created.id,
          action: 'facilityGeofence.create',
        },
      }),
    );
    expect(audit).not.toBeNull();
  });

  it('rejects non-manage roles', async () => {
    await seedAppUser({ facilityId, userId: 'sale-no-geo', position: 'sale' });
    const sale = buildStaffContext({ facilityId, userId: 'sale-no-geo', roles: ['sale'] });
    await expect(
      caller(sale).facilityGeofence.create({
        lat: 21,
        lng: 105,
        radiusM: 200,
        label: '',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller(sale).facilityGeofence.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('list/update/delete + audit', async () => {
    const created = await caller(superCtx('admin-geo-upd')).facilityGeofence.create({
      lat: 21.0,
      lng: 105.8,
      radiusM: 300,
      label: 'A',
    });
    const list = await caller(superCtx('admin-geo-upd')).facilityGeofence.list();
    expect(list.some((g) => g.id === created.id)).toBe(true);

    const updated = await caller(superCtx('admin-geo-upd')).facilityGeofence.update({
      id: created.id,
      isActive: true,
      accuracyMaxM: 500,
    });
    expect(updated.isActive).toBe(true);
    expect(updated.accuracyMaxM).toBe(500);

    await caller(superCtx('admin-geo-upd')).facilityGeofence.delete({ id: created.id });
    const gone = await testDbBypass((tx) => tx.facilityGeofence.findUnique({ where: { id: created.id } }));
    expect(gone).toBeNull();

    const delAudit = await testDbBypass((tx) =>
      tx.auditLog.findFirst({
        where: { entityId: created.id, action: 'facilityGeofence.delete' },
      }),
    );
    expect(delAudit).not.toBeNull();
  });

  it('RLS: cmc_app cannot update/delete geofence of another facility (cross-facility)', async () => {
    const other = await createTestFacility('Geofence Other Fac');
    try {
      const geo = await testDbBypass((tx) =>
        tx.facilityGeofence.create({
          data: {
            facilityId: other.id,
            lat: 21,
            lng: 105,
            radiusM: 200,
            label: 'other-fac',
            isActive: false,
          },
        }),
      );

      // Through tRPC scoped to facility A, update by id of B must not find the row
      // (Prisma P2025 / not found under RLS + facility where).
      await expect(
        caller(superCtx('admin-geo-rls')).facilityGeofence.update({
          id: geo.id,
          isActive: true,
        }),
      ).rejects.toBeTruthy();

      const still = await testDbBypass((tx) =>
        tx.facilityGeofence.findUnique({ where: { id: geo.id } }),
      );
      expect(still?.isActive).toBe(false);
      expect(still?.facilityId).toBe(other.id);
    } finally {
      await cleanupFacility(other.id);
    }
  });

  it('testMyPosition uses distance AND accuracy predicate', async () => {
    const created = await caller(superCtx('admin-geo-test')).facilityGeofence.create({
      lat: 21.0285,
      lng: 105.8542,
      radiusM: 200,
      accuracyMaxM: 100,
      label: 'strict',
    });
    // ~0 distance but accuracy 400 > 100 → accuracyOk false, within false
    const results = await caller(superCtx('admin-geo-test')).facilityGeofence.testMyPosition({
      lat: 21.0285,
      lng: 105.8542,
      accuracyM: 400,
    });
    const row = results.find((r) => r.id === created.id);
    expect(row).toBeDefined();
    expect(row!.distanceM).toBeLessThan(1);
    expect(row!.accuracyOk).toBe(false);
    expect(row!.within).toBe(false);

    // good accuracy → within
    const ok = await caller(superCtx('admin-geo-test')).facilityGeofence.testMyPosition({
      lat: 21.0285,
      lng: 105.8542,
      accuracyM: 30,
    });
    expect(ok.find((r) => r.id === created.id)!.within).toBe(true);
  });
});
