// guardian.listPendingLinks integration tests (K3 remediation, deep-review
// consolidated report): before this, `approveLink`/`rejectLink` existed but
// staff had no way to discover which `GuardianLinkRequest` rows were waiting.
// Covers: default `pending`-only filter, facility scoping, and the staff-only
// gate (same roster as `approveLink`).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeLoginPhone } from '@cmc/domain-identity';
import { appRouter } from '../router.js';
import {
  buildLmsContext,
  buildStaffContext,
  cleanupFacility,
  cleanupParentAccountsByPhone,
  createTestFacility,
  seedParentAccount,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('guardian.listPendingLinks (K3)', () => {
  let facility: { id: string };
  let otherFacility: { id: string };
  let sale: Caller;
  let saleOther: Caller;
  let hr: Caller;
  const phonesToClean: string[] = [];

  beforeEach(async () => {
    facility = await createTestFacility('Pending Links Facility');
    otherFacility = await createTestFacility('Pending Links Facility B');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-pending-1', roles: ['sale'] }),
    );
    saleOther = appRouter.createCaller(
      buildStaffContext({ facilityId: otherFacility.id, userId: 'sale-pending-b-1', roles: ['sale'] }),
    );
    hr = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'hr-pending-1', roles: ['hr'] }),
    );
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
    await cleanupFacility(otherFacility.id);
    await cleanupParentAccountsByPhone(...phonesToClean);
    phonesToClean.length = 0;
  });

  async function seedPendingRequest(facilityId: string, phoneSuffix: string) {
    const student = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId, fullName: `Pending Student ${phoneSuffix}` } }),
    );
    const phone = normalizeLoginPhone(`09910002${phoneSuffix}`);
    phonesToClean.push(phone);
    const parentAccount = await seedParentAccount(phone);
    const parentCaller = appRouter.createCaller(buildLmsContext({ parentAccountId: parentAccount.id }));
    const requested = await parentCaller.guardian.requestLink({ studentRef: student.id });
    const requestId = requested.status === 'created' ? requested.requestId : undefined;
    return { student, parentAccount, requestId: requestId! };
  }

  it('lists pending requests by default, facility-scoped, with student name + parent phone', async () => {
    const { student, parentAccount, requestId } = await seedPendingRequest(facility.id, '01');

    const { items, total, page, pageSize } = await sale.guardian.listPendingLinks({});
    expect(page).toBe(1);
    expect(pageSize).toBe(20);
    expect(total).toBeGreaterThanOrEqual(1);

    const match = items.find((r) => r.id === requestId);
    expect(match).toBeDefined();
    expect(match!.studentId).toBe(student.id);
    expect(match!.studentName).toBe(student.fullName);
    expect(match!.parentAccountId).toBe(parentAccount.id);
    expect(match!.parentPhone).toBe(parentAccount.phone);
    expect(match!.status).toBe('pending');
  });

  it('excludes approved/rejected requests from the default pending queue', async () => {
    const { requestId } = await seedPendingRequest(facility.id, '02');
    await sale.guardian.approveLink({ requestId, relation: 'mother' });

    const pending = await sale.guardian.listPendingLinks({});
    expect(pending.items.some((r) => r.id === requestId)).toBe(false);

    const approved = await sale.guardian.listPendingLinks({ status: 'approved' });
    expect(approved.items.some((r) => r.id === requestId)).toBe(true);
  });

  it('is facility-scoped: a request in another facility never appears', async () => {
    const { requestId: otherRequestId } = await seedPendingRequest(otherFacility.id, '03');
    await seedPendingRequest(facility.id, '04');

    const listForFacility = await sale.guardian.listPendingLinks({});
    expect(listForFacility.items.some((r) => r.id === otherRequestId)).toBe(false);

    const listForOther = await saleOther.guardian.listPendingLinks({});
    expect(listForOther.items.some((r) => r.id === otherRequestId)).toBe(true);
  });

  it('forbids a role without guardian.listPendingLinks permission', async () => {
    await expect(hr.guardian.listPendingLinks({})).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
