// Post-review remediation: `salaryTier.create`/`update` previously had NO
// branch-scope check — only `compensation.assignTier` enforced it (R2-6).
// A director could create/edit a tier of the OTHER branch's type. Mirrors
// the assignTier branch-scope tests in penalty-posttax.test.ts.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility } from '../test/db.js';

let facilityId: string;

const gdkdCaller = () =>
  appRouter.createCaller(
    buildStaffContext({ facilityId, userId: 'tier-scope-gdkd', roles: ['giam_doc_kinh_doanh'] }),
  );
const gddtCaller = () =>
  appRouter.createCaller(
    buildStaffContext({ facilityId, userId: 'tier-scope-gddt', roles: ['giam_doc_dao_tao'] }),
  );
const superAdminCaller = () =>
  appRouter.createCaller(
    buildStaffContext({ facilityId, userId: 'tier-scope-superadmin', roles: ['super_admin'] }),
  );

const TIER_BASE = {
  baseSalary: 5_000_000,
  unitRate: 50_000,
  requiredShifts: 20,
  requiredMetric: 100,
};

beforeEach(async () => {
  const facility = await createTestFacility('SalaryTierScope Facility');
  facilityId = facility.id;
});

afterEach(async () => {
  await cleanupFacility(facilityId);
});

describe('salaryTier.create branch-scope (R2-6)', () => {
  it('GĐKD creating a KINH_DOANH tier succeeds', async () => {
    const tier = await gdkdCaller().salaryTier.create({ name: 'Sale OK', type: 'KINH_DOANH', ...TIER_BASE });
    expect(tier.type).toBe('KINH_DOANH');
  });

  it('GĐKD creating a GIAO_VIEN tier → FORBIDDEN', async () => {
    await expect(
      gdkdCaller().salaryTier.create({ name: 'GV Rogue', type: 'GIAO_VIEN', ...TIER_BASE }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('GĐĐT creating a GIAO_VIEN tier succeeds', async () => {
    const tier = await gddtCaller().salaryTier.create({ name: 'GV OK', type: 'GIAO_VIEN', ...TIER_BASE });
    expect(tier.type).toBe('GIAO_VIEN');
  });

  it('GĐĐT creating a KINH_DOANH tier → FORBIDDEN', async () => {
    await expect(
      gddtCaller().salaryTier.create({ name: 'Sale Rogue', type: 'KINH_DOANH', ...TIER_BASE }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('super_admin can create either tier type', async () => {
    const gv = await superAdminCaller().salaryTier.create({ name: 'GV Admin', type: 'GIAO_VIEN', ...TIER_BASE });
    const kd = await superAdminCaller().salaryTier.create({ name: 'KD Admin', type: 'KINH_DOANH', ...TIER_BASE });
    expect(gv.type).toBe('GIAO_VIEN');
    expect(kd.type).toBe('KINH_DOANH');
  });
});

describe('salaryTier.update branch-scope (R2-6)', () => {
  it('GĐĐT editing baseSalary on their own GIAO_VIEN tier succeeds', async () => {
    const tier = await gddtCaller().salaryTier.create({ name: 'GV Edit', type: 'GIAO_VIEN', ...TIER_BASE });
    const updated = await gddtCaller().salaryTier.update({ id: tier.id, baseSalary: 6_000_000 });
    expect(Number(updated.baseSalary)).toBe(6_000_000);
  });

  it('GĐKD editing a GIAO_VIEN tier (even just baseSalary, no type change) → FORBIDDEN', async () => {
    const tier = await superAdminCaller().salaryTier.create({ name: 'GV Locked', type: 'GIAO_VIEN', ...TIER_BASE });
    await expect(
      gdkdCaller().salaryTier.update({ id: tier.id, baseSalary: 999 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('GĐKD moving their own KINH_DOANH tier to GIAO_VIEN type → FORBIDDEN', async () => {
    const tier = await gdkdCaller().salaryTier.create({ name: 'Sale Moving', type: 'KINH_DOANH', ...TIER_BASE });
    await expect(
      gdkdCaller().salaryTier.update({ id: tier.id, type: 'GIAO_VIEN' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('super_admin can edit either tier type', async () => {
    const tier = await gddtCaller().salaryTier.create({ name: 'GV SA Edit', type: 'GIAO_VIEN', ...TIER_BASE });
    const updated = await superAdminCaller().salaryTier.update({ id: tier.id, baseSalary: 7_000_000 });
    expect(Number(updated.baseSalary)).toBe(7_000_000);
  });
});
