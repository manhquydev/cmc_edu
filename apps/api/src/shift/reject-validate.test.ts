// HR remediation phase 4: `shift.submit` validation tests — entry-date range,
// cross-group overlap (submitted|approved), and MULTIPLE-mode duplicate
// (date, shiftTemplateId) entries. Reject-flow behavior itself is covered in
// register-approve.test.ts; this file is purely the new submit guards.

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
let employeeAppUserId: string;
let shiftGroupId: string; // SINGLE mode (GIAO_VIEN)
let shiftTemplateId: string;
let mkShiftGroupId: string; // MULTIPLE mode (KINH_DOANH)
let mkTemplateAId: string;
let mkTemplateBId: string;

const EMPLOYEE_USER_ID = 'reject-validate-employee-001';
const SALE_USER_ID = 'reject-validate-sale-001';

const FROM = '2099-02-10';
const TO = '2099-02-14';
const INSIDE = '2099-02-12';
const OUTSIDE = '2099-02-20';

const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

beforeEach(async () => {
  const facility = await createTestFacility('ShiftValidate-Facility');
  facilityId = facility.id;

  const employee = await seedAppUser({
    facilityId,
    userId: EMPLOYEE_USER_ID,
    fullName: 'Nguyễn Giáo Viên',
    position: 'giao_vien',
  });
  employeeAppUserId = employee.id;

  await seedAppUser({
    facilityId,
    userId: SALE_USER_ID,
    fullName: 'Lê Sale',
    position: 'sale',
  });

  const group = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: { facilityId, name: 'Ca Giáo Viên', type: 'GIAO_VIEN', selectionMode: 'SINGLE' },
    }),
  );
  shiftGroupId = group.id;
  const template = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: { facilityId, shiftGroupId, name: 'Ca Sáng', startTime: '09:00', endTime: '17:00' },
    }),
  );
  shiftTemplateId = template.id;

  const mkGroup = await testDbBypass((tx) =>
    tx.shiftGroup.create({
      data: { facilityId, name: 'Ca Kinh Doanh', type: 'KINH_DOANH', selectionMode: 'MULTIPLE' },
    }),
  );
  mkShiftGroupId = mkGroup.id;
  const tA = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: { facilityId, shiftGroupId: mkGroup.id, name: 'Ca A', startTime: '08:00', endTime: '12:00' },
    }),
  );
  mkTemplateAId = tA.id;
  const tB = await testDbBypass((tx) =>
    tx.shiftTemplate.create({
      data: { facilityId, shiftGroupId: mkGroup.id, name: 'Ca B', startTime: '13:00', endTime: '17:00' },
    }),
  );
  mkTemplateBId = tB.id;
});

afterEach(async () => {
  await cleanupFacility(facilityId);
});

function employeeCtx() {
  return buildStaffContext({ facilityId, userId: EMPLOYEE_USER_ID, roles: ['giao_vien'] });
}

function saleCtx() {
  return buildStaffContext({ facilityId, userId: SALE_USER_ID, roles: ['sale'] });
}

describe('shift.submit — entry date range', () => {
  it('rejects an entry date outside [fromDate, toDate]', async () => {
    await expect(
      caller(employeeCtx()).shift.submit({
        shiftGroupId,
        fromDate: FROM,
        toDate: TO,
        entries: [{ date: OUTSIDE, shiftTemplateId }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('accepts an entry date inside [fromDate, toDate]', async () => {
    const result = await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FROM,
      toDate: TO,
      entries: [{ date: INSIDE, shiftTemplateId }],
    });
    expect(result.status).toBe('submitted');
  });
});

describe('shift.submit — overlap (submitted|approved, cross-group)', () => {
  it('CONFLICT when an approved registration overlaps the new date range (different group)', async () => {
    // First: submit + approve a GIAO_VIEN registration for [FROM, TO]
    const reg = await caller(employeeCtx()).shift.submit({
      shiftGroupId,
      fromDate: FROM,
      toDate: TO,
      entries: [{ date: INSIDE, shiftTemplateId }],
    });
    const managerCtx = buildStaffContext({
      facilityId,
      userId: 'reject-validate-manager-001',
      roles: ['giam_doc_dao_tao'],
    });
    await caller(managerCtx).shift.approve({ registrationId: reg.id });

    // Second: employee (now also KINH_DOANH-eligible via a second AppUser) tries
    // to submit a KINH_DOANH registration overlapping the same date range.
    // Overlap is checked "regardless of shift group" — same appUser, any group.
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: employeeAppUserId }, data: { position: 'sale' } }),
    );
    await expect(
      caller(employeeCtx()).shift.submit({
        shiftGroupId: mkShiftGroupId,
        fromDate: FROM,
        toDate: TO,
        entries: [{ date: INSIDE, shiftTemplateId: mkTemplateAId }],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('does not block a non-overlapping date range', async () => {
    const reg = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: FROM,
      toDate: TO,
      entries: [{ date: INSIDE, shiftTemplateId: mkTemplateAId }],
    });
    const managerCtx = buildStaffContext({
      facilityId,
      userId: 'reject-validate-kdmgr-001',
      roles: ['giam_doc_kinh_doanh'],
    });
    await caller(managerCtx).shift.approve({ registrationId: reg.id });

    const LATER_FROM = '2099-03-01';
    const LATER_TO = '2099-03-05';
    const result = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: LATER_FROM,
      toDate: LATER_TO,
      entries: [{ date: '2099-03-02', shiftTemplateId: mkTemplateAId }],
    });
    expect(result.status).toBe('submitted');
  });

  it('a rejected registration does not block an overlapping new submission', async () => {
    const reg = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: FROM,
      toDate: TO,
      entries: [{ date: INSIDE, shiftTemplateId: mkTemplateAId }],
    });
    const managerCtx = buildStaffContext({
      facilityId,
      userId: 'reject-validate-kdmgr-002',
      roles: ['giam_doc_kinh_doanh'],
    });
    await caller(managerCtx).shift.reject({ registrationId: reg.id, reason: 'Không hợp lệ.' });

    const result = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: FROM,
      toDate: TO,
      entries: [{ date: INSIDE, shiftTemplateId: mkTemplateAId }],
    });
    expect(result.status).toBe('submitted');
  });

  it('CONFLICT when new submission touches existing approved registration on the same day (inclusive boundary)', async () => {
    // First: submit + approve a registration with toDate = '2099-02-10'
    const reg = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: '2099-02-08',
      toDate: '2099-02-10', // ends on Feb 10
      entries: [{ date: '2099-02-10', shiftTemplateId: mkTemplateAId }],
    });
    const managerCtx = buildStaffContext({
      facilityId,
      userId: 'reject-validate-kdmgr-003',
      roles: ['giam_doc_kinh_doanh'],
    });
    await caller(managerCtx).shift.approve({ registrationId: reg.id });

    // Second: employee tries to submit a registration starting on '2099-02-10' (same day).
    // This should CONFLICT because the overlap check is inclusive on both ends.
    await expect(
      caller(saleCtx()).shift.submit({
        shiftGroupId: mkShiftGroupId,
        fromDate: '2099-02-10', // starts on Feb 10 — same day as existing toDate
        toDate: '2099-02-12',
        entries: [{ date: '2099-02-10', shiftTemplateId: mkTemplateAId }],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('succeeds when new submission starts the day after existing approved registration ends (no boundary touch)', async () => {
    // First: submit + approve a registration with toDate = '2099-02-10'
    const reg = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: '2099-02-08',
      toDate: '2099-02-10',
      entries: [{ date: '2099-02-10', shiftTemplateId: mkTemplateAId }],
    });
    const managerCtx = buildStaffContext({
      facilityId,
      userId: 'reject-validate-kdmgr-004',
      roles: ['giam_doc_kinh_doanh'],
    });
    await caller(managerCtx).shift.approve({ registrationId: reg.id });

    // Second: employee submits a registration starting on '2099-02-11' (day after).
    // This should succeed — no overlap because 2099-02-11 is strictly after 2099-02-10.
    const result = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: '2099-02-11', // day after existing toDate
      toDate: '2099-02-13',
      entries: [{ date: '2099-02-11', shiftTemplateId: mkTemplateAId }],
    });
    expect(result.status).toBe('submitted');
  });
});

describe('shift.submit — MULTIPLE mode duplicate (date, shiftTemplateId)', () => {
  it('rejects a duplicate (date, shiftTemplateId) pair in the same registration', async () => {
    await expect(
      caller(saleCtx()).shift.submit({
        shiftGroupId: mkShiftGroupId,
        fromDate: FROM,
        toDate: TO,
        entries: [
          { date: INSIDE, shiftTemplateId: mkTemplateAId },
          { date: INSIDE, shiftTemplateId: mkTemplateAId },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('allows two different templates on the same date (no duplicate pair)', async () => {
    const result = await caller(saleCtx()).shift.submit({
      shiftGroupId: mkShiftGroupId,
      fromDate: FROM,
      toDate: TO,
      entries: [
        { date: INSIDE, shiftTemplateId: mkTemplateAId },
        { date: INSIDE, shiftTemplateId: mkTemplateBId },
      ],
    });
    expect(result.status).toBe('submitted');
  });
});
