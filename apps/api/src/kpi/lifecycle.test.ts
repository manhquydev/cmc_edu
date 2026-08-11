// HR remediation phase 3 (docs/20, plan.md "KPI auto-score & lifecycle"):
// integration tests for the kpi router's lifecycle procedures.
//
// Covers:
//   - kpi.refresh: concurrency (double-fire → no 500, never overwrites
//     submitted+); target GĐ/super_admin → BAD_REQUEST
//   - kpi.submitSlip: day-3-of-next-ICT-month boundary (mock clock);
//     tierMissing → BAD_REQUEST
//   - kpi.confirm: anti-self + wrong-manager FORBIDDEN
//   - kpi.override: source/target/anti-self/payslip-finalized gates +
//     super_admin-approved-only-when-reopened van
//   - kpi.bulkApprove: branch-scope by ROLE + exclude self + only-finalized +
//     idempotent
//   - kpi.list: branch-scope filter by target ROLE

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@cmc/auth';
import { ictToUtc } from '@cmc/domain-time';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

function callerFor(facilityId: string, userId: string, roles: Role[]): Caller {
  return appRouter.createCaller(buildStaffContext({ facilityId, userId, roles }));
}

describe('kpi lifecycle (HR remediation phase 3)', () => {
  let facilityId: string;

  afterEach(async () => {
    vi.useRealTimers();
    await cleanupFacility(facilityId);
  });

  // ---------------------------------------------------------------------
  // kpi.refresh
  // ---------------------------------------------------------------------

  describe('kpi.refresh', () => {
    let gvAppUserId: string;
    let gv: Caller;
    let gddt: Caller;

    beforeEach(async () => {
      const facility = await createTestFacility('KpiLifecycle-Refresh-Facility');
      facilityId = facility.id;
      const gvUser = await seedAppUser({ facilityId, userId: 'kpi-lc-refresh-gv-001', position: 'giao_vien' });
      gvAppUserId = gvUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: gvUser.id }, data: { roles: ['giao_vien'] } }));
      gv = callerFor(facilityId, 'kpi-lc-refresh-gv-001', ['giao_vien']);
      gddt = callerFor(facilityId, 'kpi-lc-refresh-gddt-001', ['giam_doc_dao_tao']);
      await seedAppUser({ facilityId, userId: 'kpi-lc-refresh-gddt-001', position: 'giam_doc_dao_tao' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-refresh-gddt-001' }, data: { roles: ['giam_doc_dao_tao'] } }),
      );
    });

    it('double-fire concurrent refresh does not 500 and both resolve to the same draft row', async () => {
      const [a, b] = await Promise.all([
        gv.kpi.refresh({ period: '2099-01' }),
        gv.kpi.refresh({ period: '2099-01' }),
      ]);
      expect(a.id).toBe(b.id);
      expect(a.status).toBe('draft');

      const rows = await testDbBypass((tx) =>
        tx.kpiScore.findMany({ where: { appUserId: gvAppUserId, period: '2099-01' } }),
      );
      expect(rows).toHaveLength(1);
    });

    it('never overwrites a submitted+ score', async () => {
      const seeded = await testDbBypass((tx) =>
        tx.kpiScore.create({
          data: { facilityId, appUserId: gvAppUserId, period: '2099-02', value: 777, status: 'submitted' },
        }),
      );

      const result = await gv.kpi.refresh({ period: '2099-02' });
      expect(result.id).toBe(seeded.id);
      expect(result.status).toBe('submitted');
      expect(Number(result.value)).toBe(777);
    });

    it('appUserId other than caller requires a director role → FORBIDDEN otherwise', async () => {
      const other = await seedAppUser({ facilityId, userId: 'kpi-lc-refresh-other-001', position: 'sale' });
      await testDbBypass((tx) => tx.appUser.update({ where: { id: other.id }, data: { roles: ['sale'] } }));

      await expect(
        gv.kpi.refresh({ period: '2099-03', appUserId: other.id }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const asDirector = await gddt.kpi.refresh({ period: '2099-03', appUserId: other.id });
      expect(asDirector.appUserId).toBe(other.id);
    });

    it('target role GĐ/super_admin → BAD_REQUEST (no KPI slip for directors)', async () => {
      await expect(gddt.kpi.refresh({ period: '2099-04' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  // ---------------------------------------------------------------------
  // kpi.submitSlip
  // ---------------------------------------------------------------------

  describe('kpi.submitSlip', () => {
    let saleAppUserId: string;
    let sale: Caller;
    let gdkd: Caller;
    let tierId: string;

    beforeEach(async () => {
      const facility = await createTestFacility('KpiLifecycle-SubmitSlip-Facility');
      facilityId = facility.id;
      const saleUser = await seedAppUser({ facilityId, userId: 'kpi-lc-submit-sale-001', position: 'sale' });
      saleAppUserId = saleUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: saleUser.id }, data: { roles: ['sale'] } }));
      sale = callerFor(facilityId, 'kpi-lc-submit-sale-001', ['sale']);
      gdkd = callerFor(facilityId, 'kpi-lc-submit-gdkd-001', ['giam_doc_kinh_doanh']);
      await seedAppUser({ facilityId, userId: 'kpi-lc-submit-gdkd-001', position: 'giam_doc_kinh_doanh' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-submit-gdkd-001' }, data: { roles: ['giam_doc_kinh_doanh'] } }),
      );

      const tier = await gdkd.salaryTier.create({
        name: `Bậc Sale Submit ${Math.random().toString(36).slice(2, 8)}`,
        type: 'KINH_DOANH',
        baseSalary: 8_000_000,
        unitRate: 1_000_000,
        requiredShifts: 20,
        requiredMetric: 100_000_000,
      });
      tierId = tier.id;
      await gdkd.compensation.assignTier({ appUserId: saleAppUserId, tierId });
    });

    it('blocked before day 3 of next ICT month, allowed from day 3 onward (boundary)', async () => {
      const period = '2026-07';

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(ictToUtc('2026-08-02', '23:59'));
      await expect(sale.kpi.submitSlip({ period })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      vi.setSystemTime(ictToUtc('2026-08-03', '00:00'));
      const result = await sale.kpi.submitSlip({ period });
      expect(result.status).toBe('submitted');
      vi.useRealTimers();
    });

    it('tierMissing → BAD_REQUEST (cannot submit without an assigned tier)', async () => {
      const noTierUser = await seedAppUser({ facilityId, userId: 'kpi-lc-submit-notier-001', position: 'sale' });
      await testDbBypass((tx) => tx.appUser.update({ where: { id: noTierUser.id }, data: { roles: ['sale'] } }));
      const noTierCaller = callerFor(facilityId, 'kpi-lc-submit-notier-001', ['sale']);

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(ictToUtc('2026-08-03', '00:00'));
      await expect(noTierCaller.kpi.submitSlip({ period: '2026-07' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      vi.useRealTimers();
    });

    it('auto-refreshes in the same call — metricValue reflects live revenue data', async () => {
      await testDbBypass((tx) =>
        tx.receipt.create({
          data: {
            facilityId,
            code: `RCP-SUBMITSLIP-${Math.random().toString(36).slice(2, 8)}`,
            netAmount: 3_000_000,
            status: 'approved',
            parentPhone: '0900000001',
            studentName: 'SubmitSlip Auto Refresh',
            createdById: 'legacy',
            createdByAppUserId: saleAppUserId,
            approvedAt: ictToUtc('2026-07-15', '10:00'),
          },
        }),
      );

      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(ictToUtc('2026-08-03', '00:00'));
      const result = await sale.kpi.submitSlip({ period: '2026-07' });
      vi.useRealTimers();

      expect(Number(result.metricValue)).toBe(3_000_000);
      expect(result.status).toBe('submitted');
    });

    it('cannot resubmit an already-submitted slip', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(ictToUtc('2026-08-03', '00:00'));
      await sale.kpi.submitSlip({ period: '2026-07' });
      await expect(sale.kpi.submitSlip({ period: '2026-07' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      vi.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------
  // kpi.confirm
  // ---------------------------------------------------------------------

  describe('kpi.confirm', () => {
    let gvAppUserId: string;
    let managerAppUserId: string;
    let gv: Caller;
    let manager: Caller;
    let otherDirector: Caller;
    let kpiScoreId: string;

    beforeEach(async () => {
      const facility = await createTestFacility('KpiLifecycle-Confirm-Facility');
      facilityId = facility.id;

      const managerUser = await seedAppUser({ facilityId, userId: 'kpi-lc-confirm-mgr-001', position: 'giam_doc_dao_tao' });
      managerAppUserId = managerUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: managerUser.id }, data: { roles: ['giam_doc_dao_tao'] } }));

      const gvUser = await seedAppUser({
        facilityId,
        userId: 'kpi-lc-confirm-gv-001',
        position: 'giao_vien',
        managerId: managerAppUserId,
      });
      gvAppUserId = gvUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: gvUser.id }, data: { roles: ['giao_vien'] } }));

      await seedAppUser({ facilityId, userId: 'kpi-lc-confirm-other-dir-001', position: 'giam_doc_kinh_doanh' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-confirm-other-dir-001' }, data: { roles: ['giam_doc_kinh_doanh'] } }),
      );

      gv = callerFor(facilityId, 'kpi-lc-confirm-gv-001', ['giao_vien']);
      manager = callerFor(facilityId, 'kpi-lc-confirm-mgr-001', ['giam_doc_dao_tao']);
      otherDirector = callerFor(facilityId, 'kpi-lc-confirm-other-dir-001', ['giam_doc_kinh_doanh']);

      const seeded = await testDbBypass((tx) =>
        tx.kpiScore.create({
          data: { facilityId, appUserId: gvAppUserId, period: '2099-05', value: 1_000_000, status: 'submitted' },
        }),
      );
      kpiScoreId = seeded.id;
    });

    it('direct manager confirms → confirmed', async () => {
      const result = await manager.kpi.confirm({ kpiScoreId });
      expect(result.status).toBe('confirmed');
      expect(result.confirmedBy).toBe('kpi-lc-confirm-mgr-001');
    });

    it('a non-manager director cannot confirm → FORBIDDEN', async () => {
      await expect(otherDirector.kpi.confirm({ kpiScoreId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('anti-self: the score owner cannot confirm their own slip even if managerId points at themselves', async () => {
      await testDbBypass((tx) => tx.appUser.update({ where: { id: gvAppUserId }, data: { managerId: gvAppUserId } }));
      await expect(gv.kpi.confirm({ kpiScoreId })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  // ---------------------------------------------------------------------
  // kpi.override
  // ---------------------------------------------------------------------

  describe('kpi.override', () => {
    let gvAppUserId: string;
    let saleAppUserId: string;
    let gdkd: Caller;
    let gddt: Caller;
    let superAdmin: Caller;
    let gv: Caller;

    // Branch-scope (R2-6, post-audit fix): a director's ROLE must match the
    // target's KPI-bucket ROLE — GĐKD↔sale, GĐĐT↔giao_vien, super_admin↔any.
    // `gvAppUserId`'s correct branch is `gddt`; `saleAppUserId`'s is `gdkd`.
    async function seedScore(
      appUserId: string,
      status: 'draft' | 'submitted' | 'confirmed' | 'approved',
      period: string,
    ): Promise<string> {
      const score = await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId, period, value: 500_000, status } }),
      );
      return score.id;
    }

    beforeEach(async () => {
      const facility = await createTestFacility('KpiLifecycle-Override-Facility');
      facilityId = facility.id;

      const gvUser = await seedAppUser({ facilityId, userId: 'kpi-lc-override-gv-001', position: 'giao_vien' });
      gvAppUserId = gvUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: gvUser.id }, data: { roles: ['giao_vien'] } }));

      const saleUser = await seedAppUser({ facilityId, userId: 'kpi-lc-override-sale-001', position: 'sale' });
      saleAppUserId = saleUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: saleUser.id }, data: { roles: ['sale'] } }));

      await seedAppUser({ facilityId, userId: 'kpi-lc-override-gdkd-001', position: 'giam_doc_kinh_doanh' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-override-gdkd-001' }, data: { roles: ['giam_doc_kinh_doanh'] } }),
      );
      await seedAppUser({ facilityId, userId: 'kpi-lc-override-gddt-001', position: 'giam_doc_dao_tao' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-override-gddt-001' }, data: { roles: ['giam_doc_dao_tao'] } }),
      );

      gdkd = callerFor(facilityId, 'kpi-lc-override-gdkd-001', ['giam_doc_kinh_doanh']);
      gddt = callerFor(facilityId, 'kpi-lc-override-gddt-001', ['giam_doc_dao_tao']);
      superAdmin = callerFor(facilityId, 'kpi-lc-override-superadmin-001', ['super_admin']);
      gv = callerFor(facilityId, 'kpi-lc-override-gv-001', ['giao_vien']);
    });

    it('overrides a submitted score → confirmed, override=true, overrideReason set', async () => {
      const id = await seedScore(gvAppUserId, 'submitted', '2099-06');
      const result = await gddt.kpi.override({ kpiScoreId: id, value: 1_234_000, overrideReason: 'Điều chỉnh' });
      expect(result.status).toBe('confirmed');
      expect(result.override).toBe(true);
      expect(Number(result.value)).toBe(1_234_000);
    });

    it('overrides a confirmed score → stays confirmed with new value', async () => {
      const id = await seedScore(gvAppUserId, 'confirmed', '2099-07');
      const result = await gddt.kpi.override({ kpiScoreId: id, value: 2_000_000, overrideReason: 'Sửa số liệu' });
      expect(result.status).toBe('confirmed');
      expect(Number(result.value)).toBe(2_000_000);
    });

    it('a draft score cannot be overridden', async () => {
      const id = await seedScore(gvAppUserId, 'draft', '2099-08');
      await expect(
        gddt.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('anti-self: the score owner cannot override their own slip', async () => {
      const id = await seedScore(gvAppUserId, 'submitted', '2099-09');
      await expect(
        gv.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('payslip finalized → FORBIDDEN for submitted/confirmed source', async () => {
      const id = await seedScore(gvAppUserId, 'confirmed', '2099-10');
      await testDbBypass((tx) =>
        tx.payslip.create({
          data: {
            facilityId, appUserId: gvAppUserId, period: '2099-10', status: 'finalized',
            baseSalary: 0, variablePay: 0, kpiBonus: 0, penaltyAmount: 0, totalNet: 0,
          },
        }),
      );
      await expect(
        gddt.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('approved source: only super_admin, and only when the payslip has been reopened to draft', async () => {
      const id = await seedScore(gvAppUserId, 'approved', '2099-11');

      // No payslip at all → BAD_REQUEST even for super_admin.
      await expect(
        superAdmin.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      // A non-super_admin director (even in-branch) → FORBIDDEN regardless of payslip state.
      await expect(
        gddt.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const payslip = await testDbBypass((tx) =>
        tx.payslip.create({
          data: {
            facilityId, appUserId: gvAppUserId, period: '2099-11', status: 'finalized',
            baseSalary: 0, variablePay: 0, kpiBonus: 0, penaltyAmount: 0, totalNet: 0,
          },
        }),
      );
      // Finalized (not reopened) → still BAD_REQUEST even for super_admin.
      await expect(
        superAdmin.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      await testDbBypass((tx) => tx.payslip.update({ where: { id: payslip.id }, data: { status: 'draft' } }));
      const result = await superAdmin.kpi.override({ kpiScoreId: id, value: 999_999, overrideReason: 'Sửa sau tất toán' });
      expect(result.status).toBe('confirmed');
      expect(Number(result.value)).toBe(999_999);
    });

    // ---------------------------------------------------------------------
    // Branch-scope (post-audit fix): caller's director ROLE must match the
    // target's KPI-bucket ROLE.
    // ---------------------------------------------------------------------

    it('GĐKD (sale branch) cannot override a giao_vien score → FORBIDDEN', async () => {
      const id = await seedScore(gvAppUserId, 'submitted', '2099-13');
      await expect(
        gdkd.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('GĐĐT (giao_vien branch) cannot override a sale score → FORBIDDEN', async () => {
      const id = await seedScore(saleAppUserId, 'submitted', '2099-14');
      await expect(
        gddt.kpi.override({ kpiScoreId: id, value: 1, overrideReason: 'x' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('super_admin overrides either branch — sale', async () => {
      const id = await seedScore(saleAppUserId, 'submitted', '2099-15');
      const result = await superAdmin.kpi.override({ kpiScoreId: id, value: 1_500_000, overrideReason: 'x' });
      expect(result.status).toBe('confirmed');
      expect(Number(result.value)).toBe(1_500_000);
    });

    it('super_admin overrides either branch — giao_vien', async () => {
      const id = await seedScore(gvAppUserId, 'submitted', '2099-16');
      const result = await superAdmin.kpi.override({ kpiScoreId: id, value: 1_600_000, overrideReason: 'x' });
      expect(result.status).toBe('confirmed');
      expect(Number(result.value)).toBe(1_600_000);
    });
  });

  // ---------------------------------------------------------------------
  // kpi.bulkApprove
  // ---------------------------------------------------------------------

  describe('kpi.bulkApprove', () => {
    const PERIOD = '2099-12';
    let gddt: Caller;
    let gvAppUserId: string;
    let saleAppUserId: string;

    async function finalizePayslip(appUserId: string): Promise<void> {
      await testDbBypass((tx) =>
        tx.payslip.create({
          data: {
            facilityId, appUserId, period: PERIOD, status: 'finalized',
            baseSalary: 0, variablePay: 0, kpiBonus: 0, penaltyAmount: 0, totalNet: 0,
          },
        }),
      );
    }

    beforeEach(async () => {
      const facility = await createTestFacility('KpiLifecycle-BulkApprove-Facility');
      facilityId = facility.id;

      await seedAppUser({ facilityId, userId: 'kpi-lc-bulk-gddt-001', position: 'giam_doc_dao_tao' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-bulk-gddt-001' }, data: { roles: ['giam_doc_dao_tao'] } }),
      );
      gddt = callerFor(facilityId, 'kpi-lc-bulk-gddt-001', ['giam_doc_dao_tao']);

      const gvUser = await seedAppUser({ facilityId, userId: 'kpi-lc-bulk-gv-001', position: 'giao_vien' });
      gvAppUserId = gvUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: gvUser.id }, data: { roles: ['giao_vien'] } }));

      const saleUser = await seedAppUser({ facilityId, userId: 'kpi-lc-bulk-sale-001', position: 'sale' });
      saleAppUserId = saleUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: saleUser.id }, data: { roles: ['sale'] } }));
    });

    it('approves only branch-scoped (giao_vien) confirmed scores with a finalized payslip', async () => {
      await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId: gvAppUserId, period: PERIOD, value: 1, status: 'confirmed' } }),
      );
      await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId: saleAppUserId, period: PERIOD, value: 1, status: 'confirmed' } }),
      );
      await finalizePayslip(gvAppUserId);
      await finalizePayslip(saleAppUserId);

      const result = await gddt.kpi.bulkApprove({ period: PERIOD });
      expect(result.approved).toBe(1); // only the giao_vien row — sale is out of GĐĐT's branch scope

      const gvScore = await testDbBypass((tx) =>
        tx.kpiScore.findFirst({ where: { appUserId: gvAppUserId, period: PERIOD } }),
      );
      const saleScore = await testDbBypass((tx) =>
        tx.kpiScore.findFirst({ where: { appUserId: saleAppUserId, period: PERIOD } }),
      );
      expect(gvScore!.status).toBe('approved');
      expect(saleScore!.status).toBe('confirmed'); // untouched — different branch
    });

    it('skips a confirmed score without a finalized payslip', async () => {
      await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId: gvAppUserId, period: PERIOD, value: 1, status: 'confirmed' } }),
      );
      const result = await gddt.kpi.bulkApprove({ period: PERIOD });
      expect(result.approved).toBe(0);
      expect(result.skippedUnfinalized).toHaveLength(1);
    });

    it('excludes the caller\'s own slip (multi-role GĐĐT+giao_vien edge case)', async () => {
      const selfUser = await seedAppUser({ facilityId, userId: 'kpi-lc-bulk-self-001', position: 'giam_doc_dao_tao' });
      await testDbBypass((tx) =>
        tx.appUser.update({ where: { id: selfUser.id }, data: { roles: ['giam_doc_dao_tao', 'giao_vien'] } }),
      );
      const self = callerFor(facilityId, 'kpi-lc-bulk-self-001', ['giam_doc_dao_tao', 'giao_vien']);

      await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId: selfUser.id, period: PERIOD, value: 1, status: 'confirmed' } }),
      );
      await finalizePayslip(selfUser.id);

      const result = await self.kpi.bulkApprove({ period: PERIOD });
      expect(result.approved).toBe(0);
      expect(result.skippedSelf).toBe(1);

      const score = await testDbBypass((tx) =>
        tx.kpiScore.findFirst({ where: { appUserId: selfUser.id, period: PERIOD } }),
      );
      expect(score!.status).toBe('confirmed');
    });

    it('is idempotent — a second run approves nothing new', async () => {
      await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId: gvAppUserId, period: PERIOD, value: 1, status: 'confirmed' } }),
      );
      await finalizePayslip(gvAppUserId);

      const first = await gddt.kpi.bulkApprove({ period: PERIOD });
      expect(first.approved).toBe(1);

      const second = await gddt.kpi.bulkApprove({ period: PERIOD });
      expect(second.approved).toBe(0);
      expect(second.skippedUnfinalized).toHaveLength(0);
      expect(second.skippedSelf).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // kpi.list
  // ---------------------------------------------------------------------

  describe('kpi.list', () => {
    const PERIOD = '2100-01';
    let gvAppUserId: string;
    let saleAppUserId: string;
    let gddt: Caller;
    let gdkd: Caller;
    let superAdmin: Caller;

    beforeEach(async () => {
      const facility = await createTestFacility('KpiLifecycle-List-Facility');
      facilityId = facility.id;

      const gvUser = await seedAppUser({ facilityId, userId: 'kpi-lc-list-gv-001', position: 'giao_vien' });
      gvAppUserId = gvUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: gvUser.id }, data: { roles: ['giao_vien'] } }));

      const saleUser = await seedAppUser({ facilityId, userId: 'kpi-lc-list-sale-001', position: 'sale' });
      saleAppUserId = saleUser.id;
      await testDbBypass((tx) => tx.appUser.update({ where: { id: saleUser.id }, data: { roles: ['sale'] } }));

      await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId: gvAppUserId, period: PERIOD, value: 1, status: 'submitted' } }),
      );
      await testDbBypass((tx) =>
        tx.kpiScore.create({ data: { facilityId, appUserId: saleAppUserId, period: PERIOD, value: 1, status: 'submitted' } }),
      );

      await seedAppUser({ facilityId, userId: 'kpi-lc-list-gddt-001', position: 'giam_doc_dao_tao' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-list-gddt-001' }, data: { roles: ['giam_doc_dao_tao'] } }),
      );
      await seedAppUser({ facilityId, userId: 'kpi-lc-list-gdkd-001', position: 'giam_doc_kinh_doanh' });
      await testDbBypass((tx) =>
        tx.appUser.updateMany({ where: { userId: 'kpi-lc-list-gdkd-001' }, data: { roles: ['giam_doc_kinh_doanh'] } }),
      );

      gddt = callerFor(facilityId, 'kpi-lc-list-gddt-001', ['giam_doc_dao_tao']);
      gdkd = callerFor(facilityId, 'kpi-lc-list-gdkd-001', ['giam_doc_kinh_doanh']);
      superAdmin = callerFor(facilityId, 'kpi-lc-list-superadmin-001', ['super_admin']);
    });

    it('GĐĐT sees only giao_vien-scoped scores', async () => {
      const result = await gddt.kpi.list({ period: PERIOD });
      expect(result).toHaveLength(1);
      expect(result[0]!.appUserId).toBe(gvAppUserId);
    });

    it('GĐKD sees only sale-scoped scores', async () => {
      const result = await gdkd.kpi.list({ period: PERIOD });
      expect(result).toHaveLength(1);
      expect(result[0]!.appUserId).toBe(saleAppUserId);
    });

    it('super_admin sees both branches', async () => {
      const result = await superAdmin.kpi.list({ period: PERIOD });
      expect(result).toHaveLength(2);
    });

    it('a non-director lists self-only rows (shared board)', async () => {
      const gv = callerFor(facilityId, 'kpi-lc-list-gv-001', ['giao_vien']);
      const result = await gv.kpi.list({ period: PERIOD });
      expect(result).toHaveLength(1);
      expect(result[0]!.appUserId).toBe(gvAppUserId);
    });
  });
});
