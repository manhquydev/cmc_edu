// student.lookup integration tests (K4 remediation, deep-review consolidated
// report): before this, no procedure let staff resolve a `Student.id` from a
// parent phone or name — `finance.receiptCreate` renewals and
// `enrollment.enroll` both needed a studentId no legitimate caller could
// produce. Covers: phone lookup via the approved Guardian link, name lookup,
// facility scoping, the staff-only gate, and the docs/08 §7 access audit.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedGuardianLink,
  seedParentAccount,
  testDb,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('student.lookup (K4)', () => {
  let facility: { id: string };
  let otherFacility: { id: string };
  let sale: Caller;
  let saleOther: Caller;
  let giaoVien: Caller;
  let cskh: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Student Lookup Facility');
    otherFacility = await createTestFacility('Student Lookup Facility B');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-lookup-1', roles: ['sale'] }),
    );
    saleOther = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'sale-lookup-b-1', roles: ['sale'] }),
    );
    giaoVien = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gv-lookup-1', roles: ['giao_vien'] }),
    );
    cskh = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'cskh-lookup-1', roles: ['cskh'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupFacility(otherFacility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  it('finds a student by parent phone, facility-scoped, and returns basic identity', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Lookup Student One' } }),
    );
    const phone = normalizeLoginPhone('0993000101');
    phonesToClean.push(phone);
    const parentAccount = await seedParentAccount(phone);
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });

    const found = await sale.student.lookup({ phone: '0993000101' });
    expect(found).toHaveLength(1);
    expect(found[0]).toEqual({ id: student.id, fullName: student.fullName, lifecycle: 'active' });
  });

  it('returns an empty list for an unknown phone', async () => {
    const found = await sale.student.lookup({ phone: '0993000199' });
    expect(found).toEqual([]);
  });

  it('finds a student by (partial, case-insensitive) name', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Nguyen Van Lookup' } }),
    );

    const found = await sale.student.lookup({ name: 'van lookup' });
    expect(found.some((s) => s.id === student.id)).toBe(true);
  });

  it('is facility-scoped: a staff member in another facility never finds the student', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Cross Facility Lookup' } }),
    );
    const phone = normalizeLoginPhone('0993000102');
    phonesToClean.push(phone);
    const parentAccount = await seedParentAccount(phone);
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });

    const foundOther = await saleOther.student.lookup({ phone: '0993000102' });
    expect(foundOther).toEqual([]);
    const foundOtherByName = await saleOther.student.lookup({ name: 'Cross Facility Lookup' });
    expect(foundOtherByName).toEqual([]);
  });

  it('rejects a call with neither phone nor name', async () => {
    await expect(sale.student.lookup({})).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects a malformed phone with BAD_REQUEST, not a 500', async () => {
    await expect(sale.student.lookup({ phone: 'not-a-phone' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('giao_vien has student.lookup permission for attendance name resolution (K4)', async () => {
    const result = await giaoVien.student.lookup({ name: 'anything' });
    expect(Array.isArray(result)).toBe(true);
  });

  it('forbids a role without student.lookup permission (K4 — cskh excluded)', async () => {
    await expect(cskh.student.lookup({ name: 'anything' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('audits a non-empty disclosure to the staff actor (docs/08 §7)', async () => {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'Audited Lookup Student' } }),
    );
    const phone = normalizeLoginPhone('0993000103');
    phonesToClean.push(phone);
    const parentAccount = await seedParentAccount(phone);
    await seedGuardianLink({
      facilityId: facility.id,
      parentAccountId: parentAccount.id,
      studentId: student.id,
      status: 'approved',
    });

    await sale.student.lookup({ phone: '0993000103' });

    const audit = await testDb().auditLog.findFirst({
      where: { entity: 'Student', entityId: student.id, action: 'student.lookup' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actor).toBe('sale-lookup-1');
  });
});
