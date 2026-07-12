// HR remediation phase 1: schema-only acceptance tests for CompensationPolicy
// and SalaryTier — no router exists for either yet (phase 2 owns the
// procedures), so these tests exercise Postgres RLS + the unique constraints
// directly via `withFacility()`/`testDbBypass()`, same pattern as
// ../security/rls-enforcement.test.ts.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withFacility } from '@cmc/db';
import { cleanupFacility, createTestFacility, testDb, testDbBypass } from '../test/db.js';

describe('CompensationPolicy (HR remediation phase 1 schema)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };

  beforeEach(async () => {
    facilityA = await createTestFacility('CompPolicy Facility A');
    facilityB = await createTestFacility('CompPolicy Facility B');
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('is unique per facility: a second row for the same facilityId is rejected', async () => {
    await testDbBypass((tx) =>
      tx.compensationPolicy.create({
        data: { facilityId: facilityA.id, penaltyRatePerLateMinute: 500, penaltyRatePerEarlyMinute: 1000 },
      }),
    );

    await expect(
      testDbBypass((tx) =>
        tx.compensationPolicy.create({
          data: { facilityId: facilityA.id, penaltyRatePerLateMinute: 700, penaltyRatePerEarlyMinute: 1200 },
        }),
      ),
    ).rejects.toThrow();
  });

  it('defaults penalty rates to 500/1000 when not supplied', async () => {
    const created = await testDbBypass((tx) => tx.compensationPolicy.create({ data: { facilityId: facilityA.id } }));
    expect(created.penaltyRatePerLateMinute.toNumber()).toBe(500);
    expect(created.penaltyRatePerEarlyMinute.toNumber()).toBe(1000);
  });

  it('RLS: a caller scoped to facility A cannot read facility B\'s policy row', async () => {
    await testDbBypass((tx) =>
      tx.compensationPolicy.create({ data: { facilityId: facilityB.id, penaltyRatePerLateMinute: 999 } }),
    );

    const rows = await withFacility(testDb(), facilityA.id, (tx) => tx.compensationPolicy.findMany({}));
    expect(rows).toHaveLength(0);
  });

  it('RLS: a caller scoped to facility A cannot write a policy row for facility B', async () => {
    await expect(
      withFacility(testDb(), facilityA.id, (tx) =>
        tx.compensationPolicy.create({ data: { facilityId: facilityB.id, penaltyRatePerLateMinute: 1 } }),
      ),
    ).rejects.toThrow();
  });

  it('the audited bypass GUC sees policy rows across facilities', async () => {
    await testDbBypass((tx) =>
      Promise.all([
        tx.compensationPolicy.create({ data: { facilityId: facilityA.id } }),
        tx.compensationPolicy.create({ data: { facilityId: facilityB.id } }),
      ]),
    );

    const rows = await withFacility(
      testDb(),
      null,
      (tx) => tx.compensationPolicy.findMany({ where: { facilityId: { in: [facilityA.id, facilityB.id] } } }),
      { bypass: true },
    );
    expect(rows).toHaveLength(2);
  });
});

describe('SalaryTier (HR remediation phase 1 schema)', () => {
  let facilityA: { id: string };
  let facilityB: { id: string };

  beforeEach(async () => {
    facilityA = await createTestFacility('SalaryTier Facility A');
    facilityB = await createTestFacility('SalaryTier Facility B');
  });

  afterEach(async () => {
    await cleanupFacility(facilityA.id);
    await cleanupFacility(facilityB.id);
  });

  it('is unique per (facilityId, name): a duplicate tier name in the same facility is rejected', async () => {
    await testDbBypass((tx) =>
      tx.salaryTier.create({
        data: {
          facilityId: facilityA.id,
          name: 'Bậc 1',
          type: 'GIAO_VIEN',
          baseSalary: 8_000_000,
          unitRate: 100_000,
          requiredShifts: 20,
          requiredMetric: 120,
        },
      }),
    );

    await expect(
      testDbBypass((tx) =>
        tx.salaryTier.create({
          data: {
            facilityId: facilityA.id,
            name: 'Bậc 1',
            type: 'GIAO_VIEN',
            baseSalary: 9_000_000,
            unitRate: 110_000,
            requiredShifts: 22,
            requiredMetric: 130,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('allows the same tier name in two different facilities', async () => {
    const [tierA, tierB] = await testDbBypass((tx) =>
      Promise.all([
        tx.salaryTier.create({
          data: {
            facilityId: facilityA.id,
            name: 'Bậc 1',
            type: 'KINH_DOANH',
            baseSalary: 8_000_000,
            unitRate: 50_000,
            requiredShifts: 22,
            requiredMetric: 100_000_000,
          },
        }),
        tx.salaryTier.create({
          data: {
            facilityId: facilityB.id,
            name: 'Bậc 1',
            type: 'KINH_DOANH',
            baseSalary: 8_500_000,
            unitRate: 55_000,
            requiredShifts: 22,
            requiredMetric: 100_000_000,
          },
        }),
      ]),
    );
    expect(tierA.name).toBe('Bậc 1');
    expect(tierB.name).toBe('Bậc 1');
    expect(tierA.facilityId).not.toBe(tierB.facilityId);
  });

  it('RLS: a caller scoped to facility A cannot read facility B\'s tiers', async () => {
    await testDbBypass((tx) =>
      tx.salaryTier.create({
        data: {
          facilityId: facilityB.id,
          name: 'Bậc B',
          type: 'GIAO_VIEN',
          baseSalary: 1,
          unitRate: 1,
          requiredShifts: 1,
          requiredMetric: 1,
        },
      }),
    );

    const rows = await withFacility(testDb(), facilityA.id, (tx) => tx.salaryTier.findMany({}));
    expect(rows).toHaveLength(0);
  });

  it('SalaryRate.tierId can be assigned to a tier and is nullable when not set', async () => {
    const appUser = await testDbBypass((tx) =>
      tx.appUser.create({
        data: {
          facilityId: facilityA.id,
          userId: 'salary-tier-appuser-1',
          fullName: 'GV Test',
          employeeCode: 'CMC9001',
        },
      }),
    );
    const tier = await testDbBypass((tx) =>
      tx.salaryTier.create({
        data: {
          facilityId: facilityA.id,
          name: 'Bậc GV 1',
          type: 'GIAO_VIEN',
          baseSalary: 8_000_000,
          unitRate: 100_000,
          requiredShifts: 20,
          requiredMetric: 120,
        },
      }),
    );

    const rate = await testDbBypass((tx) =>
      tx.salaryRate.create({
        data: { facilityId: facilityA.id, appUserId: appUser.id, tierId: tier.id },
      }),
    );
    expect(rate.tierId).toBe(tier.id);
    expect(rate.baseSalary).toBeNull();
  });
});
