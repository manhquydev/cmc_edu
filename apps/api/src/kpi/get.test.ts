// TDD: kpi.get — cold-start form /hr/kpi/:scoreId
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@cmc/auth';
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

describe('kpi.get', () => {
  let facilityId: string;
  let scoreId: string;
  let saleAppUserId: string;

  beforeEach(async () => {
    facilityId = (await createTestFacility('KpiGet-Fac')).id;

    const mgr = await seedAppUser({
      facilityId,
      userId: 'kpi-get-mgr',
      position: 'giam_doc_kinh_doanh',
    });
    await testDbBypass((tx) =>
      tx.appUser.update({
        where: { id: mgr.id },
        data: { roles: ['giam_doc_kinh_doanh'] },
      }),
    );

    const sale = await seedAppUser({
      facilityId,
      userId: 'kpi-get-sale',
      position: 'sale',
      managerId: mgr.id,
    });
    saleAppUserId = sale.id;
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }),
    );

    await seedAppUser({
      facilityId,
      userId: 'kpi-get-peer',
      position: 'sale',
    });
    await testDbBypass((tx) =>
      tx.appUser.updateMany({
        where: { userId: 'kpi-get-peer' },
        data: { roles: ['sale'] },
      }),
    );

    await seedAppUser({
      facilityId,
      userId: 'kpi-get-gddt',
      position: 'giam_doc_dao_tao',
    });
    await testDbBypass((tx) =>
      tx.appUser.updateMany({
        where: { userId: 'kpi-get-gddt' },
        data: { roles: ['giam_doc_dao_tao'] },
      }),
    );

    const score = await testDbBypass((tx) =>
      tx.kpiScore.create({
        data: {
          facilityId,
          appUserId: saleAppUserId,
          period: '2099-06',
          status: 'submitted',
          value: 1_000_000,
        },
      }),
    );
    scoreId = score.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  it('owner can load own score with appUser', async () => {
    const row = await callerFor(facilityId, 'kpi-get-sale', ['sale']).kpi.get({
      scoreId,
    });
    expect(row.id).toBe(scoreId);
    expect(row.status).toBe('submitted');
    expect(row.appUser.fullName).toBeTruthy();
    expect(row.fullName).toBeTruthy();
  });

  it('direct manager can load', async () => {
    const row = await callerFor(facilityId, 'kpi-get-mgr', [
      'giam_doc_kinh_doanh',
    ]).kpi.get({ scoreId });
    expect(row.id).toBe(scoreId);
  });

  it('matching-track director (GĐKD) can load sale score even if not manager', async () => {
    await seedAppUser({
      facilityId,
      userId: 'kpi-get-gdkd-2',
      position: 'giam_doc_kinh_doanh',
    });
    await testDbBypass((tx) =>
      tx.appUser.updateMany({
        where: { userId: 'kpi-get-gdkd-2' },
        data: { roles: ['giam_doc_kinh_doanh'] },
      }),
    );
    const row = await callerFor(facilityId, 'kpi-get-gdkd-2', [
      'giam_doc_kinh_doanh',
    ]).kpi.get({ scoreId });
    expect(row.id).toBe(scoreId);
  });

  it('wrong-track director (GĐĐT) cannot load sale score', async () => {
    await expect(
      callerFor(facilityId, 'kpi-get-gddt', ['giam_doc_dao_tao']).kpi.get({
        scoreId,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('peer employee cannot load', async () => {
    await expect(
      callerFor(facilityId, 'kpi-get-peer', ['sale']).kpi.get({ scoreId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('unknown id → NOT_FOUND', async () => {
    await expect(
      callerFor(facilityId, 'kpi-get-sale', ['sale']).kpi.get({
        scoreId: '00000000-0000-4000-8000-000000000099',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
