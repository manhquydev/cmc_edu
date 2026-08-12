// TDD: shift.get — cold-start form load for /hr/shifts/:registrationId
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  testDbBypass,
} from '../test/db.js';

let facilityId: string;
let otherFacilityId: string;
let shiftGroupId: string;
let shiftTemplateId: string;
let registrationId: string;

const EMPLOYEE = 'shift-get-employee';
const OTHER_EMP = 'shift-get-other-emp';
const GV_MANAGER = 'shift-get-gv-mgr';
const KD_MANAGER = 'shift-get-kd-mgr';
const FUTURE = '2099-06-15';

const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

beforeEach(async () => {
  facilityId = (await createTestFacility('ShiftGet-Fac')).id;
  otherFacilityId = (await createTestFacility('ShiftGet-Other')).id;

  await seedAppUser({ facilityId, userId: EMPLOYEE, position: 'giao_vien', roles: ['giao_vien'] });
  await seedAppUser({ facilityId, userId: OTHER_EMP, position: 'giao_vien', roles: ['giao_vien'] });
  await seedAppUser({ facilityId, userId: GV_MANAGER, position: 'giam_doc_dao_tao' });
  await seedAppUser({ facilityId, userId: KD_MANAGER, position: 'giam_doc_kinh_doanh' });

  const group = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: {
        facilityId,
        name: 'GV Get',
        type: 'GIAO_VIEN',
        selectionMode: 'MULTIPLE',
      },
    }),
  );
  shiftGroupId = group.id;
  const template = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: {
        facilityId,
        shiftGroupId,
        name: 'Ca 1',
        startTime: '08:00',
        endTime: '12:00',
      },
    }),
  );
  shiftTemplateId = template.id;

  const reg = await caller(
    buildStaffContext({ facilityId, userId: EMPLOYEE, roles: ['giao_vien'] }),
  ).shift.submit({
    shiftGroupId,
    fromDate: FUTURE,
    toDate: FUTURE,
    entries: [{ date: FUTURE, shiftTemplateId }],
  });
  registrationId = reg.id;
});

afterEach(async () => {
  await cleanupFacility(facilityId);
  await cleanupFacility(otherFacilityId);
});

describe('shift.get', () => {
  it('owner can load own registration with entries + group + templates', async () => {
    const row = await caller(
      buildStaffContext({ facilityId, userId: EMPLOYEE, roles: ['giao_vien'] }),
    ).shift.get({ registrationId });

    expect(row.id).toBe(registrationId);
    expect(row.status).toBe('submitted');
    expect(row.entries).toHaveLength(1);
    expect(row.shiftGroup.id).toBe(shiftGroupId);
    expect(row.shiftGroup.templates.some((t) => t.id === shiftTemplateId)).toBe(true);
    expect(row.appUser.fullName).toBeTruthy();
  });

  it('matching-track director (GĐĐT) can load GIAO_VIEN registration', async () => {
    const row = await caller(
      buildStaffContext({ facilityId, userId: GV_MANAGER, roles: ['giam_doc_dao_tao'] }),
    ).shift.get({ registrationId });
    expect(row.id).toBe(registrationId);
  });

  it('wrong-track director (GĐKD) cannot load GIAO_VIEN registration', async () => {
    await expect(
      caller(
        buildStaffContext({ facilityId, userId: KD_MANAGER, roles: ['giam_doc_kinh_doanh'] }),
      ).shift.get({ registrationId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('peer employee cannot load another staff registration', async () => {
    await expect(
      caller(
        buildStaffContext({ facilityId, userId: OTHER_EMP, roles: ['giao_vien'] }),
      ).shift.get({ registrationId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('unknown id → NOT_FOUND', async () => {
    await expect(
      caller(
        buildStaffContext({ facilityId, userId: EMPLOYEE, roles: ['giao_vien'] }),
      ).shift.get({ registrationId: '00000000-0000-4000-8000-000000000099' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('other facility caller cannot load registration (facility isolation)', async () => {
    await seedAppUser({
      facilityId: otherFacilityId,
      userId: 'shift-get-other-fac-emp',
      position: 'giao_vien',
      roles: ['giao_vien'],
    });
    await expect(
      caller(
        buildStaffContext({
          facilityId: otherFacilityId,
          userId: 'shift-get-other-fac-emp',
          roles: ['giao_vien'],
        }),
      ).shift.get({ registrationId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
