// Phase 4A: AppUser record event emission and operational staff timeline tests.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';
import {
  labelForStaffRecordEventKind,
  STAFF_RECORD_EVENT_HISTORY_SINCE,
  staffEventPayloadLeaksSecret,
} from './record-event.js';

describe('AppUser record events & timeline (Phase 4A)', () => {
  let facilityA: { id: string; code: string };
  let facilityB: { id: string; code: string };
  let superAdminCtxA: ReturnType<typeof buildStaffContext>;
  let directorCtxA: ReturnType<typeof buildStaffContext>;
  let saleCtxA: ReturnType<typeof buildStaffContext>;
  let directorCtxB: ReturnType<typeof buildStaffContext>;

  const caller = (ctx: ReturnType<typeof buildStaffContext>) =>
    appRouter.createCaller(ctx);

  beforeEach(async () => {
    facilityA = await createTestFacility('Timeline Facility A');
    facilityB = await createTestFacility('Timeline Facility B');

    await seedAppUser({
      facilityId: facilityA.id,
      userId: 'super-admin-a',
      fullName: 'Super Admin A',
      roles: ['super_admin'],
    });
    await seedAppUser({
      facilityId: facilityA.id,
      userId: 'director-a',
      fullName: 'Director A',
      roles: ['giam_doc_kinh_doanh'],
    });
    await seedAppUser({
      facilityId: facilityA.id,
      userId: 'sale-a',
      fullName: 'Sale A',
      roles: ['sale'],
    });
    await seedAppUser({
      facilityId: facilityB.id,
      userId: 'director-b',
      fullName: 'Director B',
      roles: ['giam_doc_kinh_doanh'],
    });

    superAdminCtxA = buildStaffContext({
      facilityId: facilityA.id,
      userId: 'super-admin-a',
      roles: ['super_admin'],
    });
    directorCtxA = buildStaffContext({
      facilityId: facilityA.id,
      userId: 'director-a',
      roles: ['giam_doc_kinh_doanh'],
    });
    saleCtxA = buildStaffContext({
      facilityId: facilityA.id,
      userId: 'sale-a',
      roles: ['sale'],
    });
    directorCtxB = buildStaffContext({
      facilityId: facilityB.id,
      userId: 'director-b',
      roles: ['giam_doc_kinh_doanh'],
    });
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('user.create — emits created event (and roles_updated, password_reset when provided)', async () => {
    const created = await caller(directorCtxA).user.create({
      userId: 'staff-new-1',
      email: 'staffnew1@cmc.test',
      fullName: 'Staff New 1',
      position: 'teacher',
      roles: ['giao_vien'],
      tempPassword: 'temporaryPassword123',
    });

    const events = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId: facilityA.id, entity: 'AppUser', entityId: created.id },
        orderBy: { createdAt: 'asc' },
      }),
    );

    expect(events.map((e) => e.kind)).toEqual(['created', 'roles_updated', 'password_reset']);
    expect(events[0]?.payload).toBeNull();
    expect(events[1]?.payload).toEqual({ roles: ['giao_vien'] });
    expect(events[2]?.payload).toBeNull();

    // Assert no secret leakage in payload
    for (const ev of events) {
      expect(staffEventPayloadLeaksSecret(ev.payload)).toBe(false);
    }
  });

  it('user.update — emits profile_updated only when profile fields change', async () => {
    const user = await caller(directorCtxA).user.create({
      userId: 'staff-update-1',
      email: 'staffup1@cmc.test',
      fullName: 'Staff Up 1',
      position: 'teacher',
    });

    // Update fullName and position
    await caller(directorCtxA).user.update({
      appUserId: user.id,
      fullName: 'Staff Up 1 Renamed',
      position: 'lead teacher',
    });

    const events = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId: facilityA.id, entity: 'AppUser', entityId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    );

    const latest = events[0];
    expect(latest?.kind).toBe('profile_updated');
    expect(latest?.payload).toEqual({ fields: ['fullName', 'position'] });
    // Payload should never store old/new values
    expect(JSON.stringify(latest?.payload)).not.toContain('Staff Up 1');
  });

  it('user.update — emits manager_changed and activated/deactivated', async () => {
    const mgr = await seedAppUser({
      facilityId: facilityA.id,
      userId: 'mgr-test',
      fullName: 'Manager Test',
    });
    const user = await caller(directorCtxA).user.create({
      userId: 'staff-mgr-1',
      email: 'staffmgr1@cmc.test',
      fullName: 'Staff Mgr 1',
      position: 'sale',
    });

    // Change manager
    await caller(directorCtxA).user.update({
      appUserId: user.id,
      managerId: mgr.id,
    });

    // Deactivate
    await caller(directorCtxA).user.update({
      appUserId: user.id,
      isActive: false,
    });

    // Reactivate
    await caller(directorCtxA).user.update({
      appUserId: user.id,
      isActive: true,
    });

    const events = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId: facilityA.id, entity: 'AppUser', entityId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
    );

    const kinds = events.map((e) => e.kind);
    expect(kinds.slice(0, 3)).toEqual(['activated', 'deactivated', 'manager_changed']);
    const mgrEvent = events.find((e) => e.kind === 'manager_changed');
    expect(mgrEvent?.payload).toEqual({ managerId: mgr.id });
  });

  it('user.updateRoles — emits roles_updated on actual change and skips on no-op', async () => {
    const user = await caller(directorCtxA).user.create({
      userId: 'staff-roles-1',
      email: 'staffroles1@cmc.test',
      fullName: 'Staff Roles 1',
      position: 'sale',
      roles: ['sale'],
    });

    // Update to giao_vien
    await caller(directorCtxA).user.updateRoles({
      appUserId: user.id,
      roles: ['giao_vien'],
    });

    // No-op update with same roles
    await caller(directorCtxA).user.updateRoles({
      appUserId: user.id,
      roles: ['giao_vien'],
    });

    const events = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId: facilityA.id, entity: 'AppUser', entityId: user.id, kind: 'roles_updated' },
        orderBy: { createdAt: 'asc' },
      }),
    );

    // One from create, one from update; no-op emitted none
    expect(events).toHaveLength(2);
    expect(events[1]?.payload).toEqual({ roles: ['giao_vien'] });
  });

  it('user.resetPassword — emits password_reset without secrets', async () => {
    const user = await caller(directorCtxA).user.create({
      userId: 'staff-reset-1',
      email: 'staffreset1@cmc.test',
      fullName: 'Staff Reset 1',
      position: 'sale',
    });

    await caller(directorCtxA).user.resetPassword({
      appUserId: user.id,
      tempPassword: 'newTempPassword456',
    });

    const events = await testDbBypass((tx) =>
      tx.recordEvent.findMany({
        where: { facilityId: facilityA.id, entity: 'AppUser', entityId: user.id, kind: 'password_reset' },
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toBeNull();
    const rawString = JSON.stringify(events[0]);
    expect(rawString).not.toContain('newTempPassword456');
    expect(staffEventPayloadLeaksSecret(events[0]?.payload)).toBe(false);
  });

  it('user.timeline — director can view timeline with safe actor projection for super_admin', async () => {
    // Created by super_admin
    const user = await caller(superAdminCtxA).user.create({
      userId: 'staff-actor-test',
      email: 'actor@cmc.test',
      fullName: 'Actor Test',
      position: 'teacher',
    });

    // Director reads timeline
    const tl = await caller(directorCtxA).user.timeline({
      appUserId: user.id,
    });

    expect(tl.items).toHaveLength(1);
    expect(tl.items[0]?.kind).toBe('created');
    expect(tl.items[0]?.label).toBe(labelForStaffRecordEventKind('created'));
    // Director caller sees projected label "Quản trị hệ thống" for super_admin actor
    expect(tl.items[0]?.actor).toBe('Quản trị hệ thống');
    expect(tl.items[0]?.actor).not.toBe('super-admin-a');

    // Super admin caller sees actual identity/name
    const tlAdmin = await caller(superAdminCtxA).user.timeline({
      appUserId: user.id,
    });
    expect(tlAdmin.items[0]?.actor).toBe('Super Admin A');
  });

  it('user.timeline — rejects cross-facility reads with NOT_FOUND', async () => {
    const userA = await caller(directorCtxA).user.create({
      userId: 'staff-fac-a',
      email: 'faca@cmc.test',
      fullName: 'Fac A User',
      position: 'teacher',
    });

    await expect(
      caller(directorCtxB).user.timeline({ appUserId: userA.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('user.timeline — rejects unauthorized role with FORBIDDEN', async () => {
    const userA = await caller(directorCtxA).user.create({
      userId: 'staff-sale-read',
      email: 'saleread@cmc.test',
      fullName: 'Sale Read User',
      position: 'teacher',
    });

    await expect(
      caller(saleCtxA).user.timeline({ appUserId: userA.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('user.timeline — cursor pagination works correctly', async () => {
    const user = await caller(directorCtxA).user.create({
      userId: 'staff-pag-1',
      email: 'staffpag1@cmc.test',
      fullName: 'Staff Pag 1',
      position: 'teacher',
    });

    // Generate 3 mutations
    await caller(directorCtxA).user.update({ appUserId: user.id, fullName: 'Pag 1 A' });
    await caller(directorCtxA).user.update({ appUserId: user.id, fullName: 'Pag 1 B' });
    await caller(directorCtxA).user.update({ appUserId: user.id, fullName: 'Pag 1 C' });

    const page1 = await caller(directorCtxA).user.timeline({
      appUserId: user.id,
      take: 2,
    });

    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller(directorCtxA).user.timeline({
      appUserId: user.id,
      cursor: page1.nextCursor!,
      take: 2,
    });

    expect(page2.items).toHaveLength(2);
    // Page 1 and Page 2 items must not overlap
    const page1Ids = new Set(page1.items.map((i) => i.id));
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }
  });

  it('user.timeline — returns historySince when created event is absent', async () => {
    const seeded = await seedAppUser({
      facilityId: facilityA.id,
      userId: 'staff-legacy',
      fullName: 'Staff Legacy',
    });

    const tl = await caller(directorCtxA).user.timeline({
      appUserId: seeded.id,
    });

    expect(tl.items).toHaveLength(0);
    expect(tl.historySince).toEqual(STAFF_RECORD_EVENT_HISTORY_SINCE);
  });
});
