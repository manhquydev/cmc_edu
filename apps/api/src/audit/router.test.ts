// audit.list — super_admin-gated read of the global AuditLog (phase-04
// super-admin-completion). AuditLog carries no facilityId/RLS (platform-
// level, not itself facility-scoped) — plain ctx.db calls, not withFacility.

import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, seedAppUser, testDb } from '../test/db.js';

describe('audit.list (phase-04)', () => {
  // These tests each seed their own Facility. Without teardown every run left
  // four of them behind for good on whatever database the suite ran against.
  const seededFacilityIds: string[] = [];

  async function seedFacility(name: string) {
    const facility = await createTestFacility(name);
    seededFacilityIds.push(facility.id);
    return facility;
  }

  afterEach(async () => {
    for (const id of seededFacilityIds.splice(0)) {
      await cleanupFacility(id);
    }
  });
  it('super_admin can list AuditLog rows, newest first', async () => {
    const facility = await seedFacility('Audit List Test Facility');
    const actor = `audit-list-${randomUUID()}`;
    await testDb().auditLog.create({
      data: { actor, action: 'test.first', entity: 'Test', entityId: 'a1', createdAt: new Date('2026-01-01') },
    });
    await testDb().auditLog.create({
      data: { actor, action: 'test.second', entity: 'Test', entityId: 'a2', createdAt: new Date('2026-02-01') },
    });

    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-list-admin', roles: ['super_admin'] }),
    );
    const { items, total } = await admin.audit.list({ actor, page: 1, pageSize: 10 });
    expect(total).toBe(2);
    expect(items.map((i) => i.action)).toEqual(['test.second', 'test.first']);
  });

  it('filters by action, entity, and createdAt range', async () => {
    const facility = await seedFacility('Audit List Filter Facility');
    const actor = `audit-list-filter-${randomUUID()}`;
    await testDb().auditLog.create({
      data: { actor, action: 'facility.update', entity: 'Facility', entityId: 'f1', createdAt: new Date('2026-03-01') },
    });
    await testDb().auditLog.create({
      data: { actor, action: 'user.updateRoles', entity: 'AppUser', entityId: 'u1', createdAt: new Date('2026-03-15') },
    });

    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-list-admin-2', roles: ['super_admin'] }),
    );

    const byAction = await admin.audit.list({ actor, action: 'facility.update', page: 1, pageSize: 10 });
    expect(byAction.items).toHaveLength(1);
    expect(byAction.items[0]?.entity).toBe('Facility');

    const byEntity = await admin.audit.list({ actor, entity: 'AppUser', page: 1, pageSize: 10 });
    expect(byEntity.items).toHaveLength(1);

    const byDateRange = await admin.audit.list({
      actor,
      createdFrom: new Date('2026-03-10').toISOString(),
      createdTo: new Date('2026-03-20').toISOString(),
      page: 1,
      pageSize: 10,
    });
    expect(byDateRange.items).toHaveLength(1);
    expect(byDateRange.items[0]?.action).toBe('user.updateRoles');
  });

  it('paginates', async () => {
    const facility = await seedFacility('Audit List Paginate Facility');
    const actor = `audit-list-paginate-${randomUUID()}`;
    for (let i = 0; i < 3; i += 1) {
      await testDb().auditLog.create({
        data: { actor, action: `test.page.${i}`, entity: 'Test', entityId: `p${i}` },
      });
    }

    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-list-admin-3', roles: ['super_admin'] }),
    );
    const page1 = await admin.audit.list({ actor, page: 1, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    const page2 = await admin.audit.list({ actor, page: 2, pageSize: 2 });
    expect(page2.items).toHaveLength(1);
  });

  it('is FORBIDDEN for a non-super_admin role', async () => {
    const facility = await seedFacility('Audit List Forbidden Facility');
    const gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-list-gdkd', roles: ['giam_doc_kinh_doanh'] }),
    );
    await expect(gdkd.audit.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // Phase 4B: entityId filter + server-proven safe detail links.
  it('filters by entityId', async () => {
    const facility = await seedFacility('Audit EntityId Filter Facility');
    const actor = `audit-eid-${randomUUID()}`;
    await testDb().auditLog.create({
      data: { actor, action: 'user.update', entity: 'user', entityId: 'target-1' },
    });
    await testDb().auditLog.create({
      data: { actor, action: 'user.update', entity: 'user', entityId: 'target-2' },
    });

    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-eid-admin', roles: ['super_admin'] }),
    );
    const { items, total } = await admin.audit.list({ actor, entityId: 'target-1', page: 1, pageSize: 10 });
    expect(total).toBe(1);
    expect(items[0].entityId).toBe('target-1');
  });

  it('sets linkEntity only for targets resolvable in the caller facility', async () => {
    const facility = await seedFacility('Audit Link Facility A');
    const otherFacility = await seedFacility('Audit Link Facility B');
    const actor = `audit-link-${randomUUID()}`;

    const sameFacilityStaff = await seedAppUser({
      facilityId: facility.id,
      userId: 'audit-link-staff-1',
      fullName: 'Link Staff A',
      roles: ['sale'],
    });
    const otherFacilityStaff = await seedAppUser({
      facilityId: otherFacility.id,
      userId: 'audit-link-staff-2',
      fullName: 'Link Staff B',
      roles: ['sale'],
    });

    await testDb().auditLog.create({
      data: { actor, action: 'user.update', entity: 'user', entityId: sameFacilityStaff.id },
    });
    await testDb().auditLog.create({
      data: { actor, action: 'user.update', entity: 'user', entityId: otherFacilityStaff.id },
    });
    // Unknown entity + non-UUID id: never linked.
    await testDb().auditLog.create({
      data: { actor, action: 'legacy.thing', entity: 'legacy', entityId: 'not-a-uuid' },
    });

    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-link-admin', roles: ['super_admin'] }),
    );
    const { items } = await admin.audit.list({ actor, page: 1, pageSize: 10 });

    const byEntityId = new Map(items.map((r) => [r.entityId, r]));
    expect(byEntityId.get(sameFacilityStaff.id)?.linkEntity).toBe('staff');
    // Other-facility target exists globally but not in the caller's facility.
    expect(byEntityId.get(otherFacilityStaff.id)?.linkEntity).toBeNull();
    expect(byEntityId.get('not-a-uuid')?.linkEntity).toBeNull();
  });

  it('targets that no longer (or never) existed get no link — resolvability is proven per read', async () => {
    const facility = await seedFacility('Audit Link Deleted Facility');
    const actor = `audit-link-del-${randomUUID()}`;
    const staff = await seedAppUser({
      facilityId: facility.id,
      userId: 'audit-link-staff-live',
      fullName: 'Live Staff',
      roles: ['sale'],
    });
    // AppUser DELETE is revoked for every app-side role (ledger hardening),
    // so a deleted record is represented by a well-formed UUID that maps to
    // no row — the enrichment path is identical.
    const vanishedId = randomUUID();
    await testDb().auditLog.create({
      data: { actor, action: 'user.update', entity: 'user', entityId: staff.id },
    });
    await testDb().auditLog.create({
      data: { actor, action: 'user.update', entity: 'user', entityId: vanishedId },
    });

    const admin = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-link-del-admin', roles: ['super_admin'] }),
    );
    const { items } = await admin.audit.list({ actor, page: 1, pageSize: 10 });
    const byEntityId = new Map(items.map((r) => [r.entityId, r]));
    expect(byEntityId.get(staff.id)?.linkEntity).toBe('staff');
    expect(byEntityId.get(vanishedId)?.linkEntity).toBeNull();
  });
});
