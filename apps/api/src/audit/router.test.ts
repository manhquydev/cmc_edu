// audit.list — super_admin-gated read of the global AuditLog (phase-04
// super-admin-completion). AuditLog carries no facilityId/RLS (platform-
// level, not itself facility-scoped) — plain ctx.db calls, not withFacility.

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, createTestFacility, testDb } from '../test/db.js';

describe('audit.list (phase-04)', () => {
  it('super_admin can list AuditLog rows, newest first', async () => {
    const facility = await createTestFacility('Audit List Test Facility');
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
    const facility = await createTestFacility('Audit List Filter Facility');
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
    const facility = await createTestFacility('Audit List Paginate Facility');
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
    const facility = await createTestFacility('Audit List Forbidden Facility');
    const gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'audit-list-gdkd', roles: ['giam_doc_kinh_doanh'] }),
    );
    await expect(gdkd.audit.list({ page: 1, pageSize: 10 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
