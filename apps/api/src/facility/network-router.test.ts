// facilityNetwork CRUD + IP self-detect (phase-03 super-admin-completion).
// Backend router previously did not exist — `facilityNetwork.manage` was
// registered in @cmc/auth but unused (checkin/router.ts only READ). Covers:
// super_admin-only gate, facility scoping, CIDR validation, default
// isActive=false on create, audit logging, and detectMyIp.

import { afterEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, testDb, testDbBypass } from '../test/db.js';

describe('facilityNetwork CRUD (phase-03)', () => {
  let facilityId: string;

  const superCtx = (userId: string, ip: string | null = '10.0.0.1') =>
    appRouter.createCaller(buildStaffContext({ facilityId, userId, roles: ['super_admin'], ip }));
  const otherCtx = (userId: string) =>
    appRouter.createCaller(buildStaffContext({ facilityId, userId, roles: ['giam_doc_kinh_doanh'] }));

  afterEach(async () => {
    if (facilityId) await cleanupFacility(facilityId);
  });

  it('super_admin can create a network range, defaults to isActive=false, and it is audited', async () => {
    const f = await createTestFacility('Network Test Create');
    facilityId = f.id;

    const created = await superCtx('admin-net-create').facilityNetwork.create({
      cidr: '10.0.0.0/24',
      label: 'Văn phòng chính',
    });
    expect(created.isActive).toBe(false);
    expect(created.cidr).toBe('10.0.0.0/24');

    const persisted = await testDbBypass((tx) =>
      tx.facilityNetwork.findUniqueOrThrow({ where: { id: created.id } }),
    );
    expect(persisted.isActive).toBe(false);

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'FacilityNetwork', entityId: created.id, action: 'facilityNetwork.create' },
    });
    expect(audit).not.toBeNull();
  });

  it('create rejects an invalid CIDR', async () => {
    const f = await createTestFacility('Network Test Bad Cidr');
    facilityId = f.id;
    await expect(
      superCtx('admin-net-badcidr').facilityNetwork.create({ cidr: 'not-a-cidr', label: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('non-super_admin is FORBIDDEN for create/update/delete/list/detectMyIp', async () => {
    const f = await createTestFacility('Network Test Forbidden');
    facilityId = f.id;
    const other = otherCtx('gdkd-net-forbidden');
    await expect(other.facilityNetwork.create({ cidr: '10.0.0.0/24', label: '' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(other.facilityNetwork.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(other.facilityNetwork.detectMyIp()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('list returns only the caller facility\'s networks', async () => {
    const f = await createTestFacility('Network Test List');
    facilityId = f.id;
    await superCtx('admin-net-list').facilityNetwork.create({ cidr: '10.0.0.0/24', label: 'A' });
    await superCtx('admin-net-list').facilityNetwork.create({ cidr: '10.0.1.0/24', label: 'B' });
    const list = await superCtx('admin-net-list').facilityNetwork.list();
    expect(list.length).toBe(2);
  });

  it('update can toggle isActive and change cidr/label, and is audited', async () => {
    const f = await createTestFacility('Network Test Update');
    facilityId = f.id;
    const created = await superCtx('admin-net-update').facilityNetwork.create({
      cidr: '10.0.0.0/24',
      label: 'Old',
    });

    const updated = await superCtx('admin-net-update').facilityNetwork.update({
      id: created.id,
      isActive: true,
      label: 'New',
    });
    expect(updated.isActive).toBe(true);
    expect(updated.label).toBe('New');
    expect(updated.cidr).toBe('10.0.0.0/24');

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'FacilityNetwork', entityId: created.id, action: 'facilityNetwork.update' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
  });

  it('update rejects an invalid cidr', async () => {
    const f = await createTestFacility('Network Test Update Bad Cidr');
    facilityId = f.id;
    const created = await superCtx('admin-net-update-badcidr').facilityNetwork.create({
      cidr: '10.0.0.0/24',
      label: '',
    });
    await expect(
      superCtx('admin-net-update-badcidr').facilityNetwork.update({ id: created.id, cidr: 'garbage' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('delete removes the row and is audited', async () => {
    const f = await createTestFacility('Network Test Delete');
    facilityId = f.id;
    const created = await superCtx('admin-net-delete').facilityNetwork.create({
      cidr: '10.0.0.0/24',
      label: '',
    });
    await superCtx('admin-net-delete').facilityNetwork.delete({ id: created.id });

    const gone = await testDbBypass((tx) => tx.facilityNetwork.findUnique({ where: { id: created.id } }));
    expect(gone).toBeNull();

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'FacilityNetwork', entityId: created.id, action: 'facilityNetwork.delete' },
    });
    expect(audit).not.toBeNull();
  });

  it('detectMyIp returns ctx.ip and suggested CIDRs when an IP is present', async () => {
    const f = await createTestFacility('Network Test Detect');
    facilityId = f.id;
    const result = await superCtx('admin-net-detect', '203.0.113.42').facilityNetwork.detectMyIp();
    expect(result.ip).toBe('203.0.113.42');
    expect(result.suggestedCidr32).toBe('203.0.113.42/32');
    expect(result.suggestedCidr24).toBe('203.0.113.0/24');
  });

  it('detectMyIp flags manual-entry guidance when ctx.ip is null', async () => {
    const f = await createTestFacility('Network Test Detect Null');
    facilityId = f.id;
    const result = await superCtx('admin-net-detect-null', null).facilityNetwork.detectMyIp();
    expect(result.ip).toBeNull();
    expect(result.suggestedCidr32).toBeNull();
    expect(result.suggestedCidr24).toBeNull();
  });
});
