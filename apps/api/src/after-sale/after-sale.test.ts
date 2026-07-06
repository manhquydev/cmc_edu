// P4 integration tests — afterSale lifecycle (WF-P4-05).
//
// create → advance (idempotent) → resolve (requires resolution) → close.
// resolve without resolution → BAD_REQUEST.
// non-sale → FORBIDDEN on create.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  testDbBypass,
} from '../test/db.js';

type Caller = ReturnType<(typeof appRouter)['createCaller']>;

describe('afterSale lifecycle (P4)', () => {
  let facility: { id: string };
  let sale: Caller;
  let gdkd: Caller;
  let hr: Caller;
  let studentId: string;

  beforeEach(async () => {
    facility = await createTestFacility('AfterSale Facility');
    sale = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'sale-as-1', roles: ['sale'] }),
    );
    gdkd = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'gdkd-as-1', roles: ['giam_doc_kinh_doanh'] }),
    );
    hr = appRouter.createCaller(
      buildStaffContext({ facilityId: facility.id, userId: 'hr-as-1', roles: ['hr'] }),
    );

    const s = await testDbBypass((tx) =>
      tx.student.create({ data: { facilityId: facility.id, fullName: 'AfterSale Student' } }),
    );
    studentId = s.id;
  });

  afterEach(async () => {
    await cleanupFacility(facility.id);
  });

  it('full lifecycle: create → advance → resolve → close', async () => {
    const kase = await sale.afterSale.create({ studentId, description: 'Student unhappy with schedule.' });
    expect(kase.status).toBe('open');

    const advanced = await sale.afterSale.advance({ caseId: kase.id });
    expect(advanced.status).toBe('in_progress');

    const resolved = await sale.afterSale.resolve({ caseId: kase.id, resolution: 'Rescheduled to a new slot.' });
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolution).toBe('Rescheduled to a new slot.');
    expect(resolved.resolvedAt).not.toBeNull();

    const closed = await sale.afterSale.close({ caseId: kase.id });
    expect(closed.status).toBe('closed');
  });

  it('advance is idempotent: in_progress → advance stays in_progress without error', async () => {
    const kase = await sale.afterSale.create({ studentId, description: 'Test idempotent.' });
    await sale.afterSale.advance({ caseId: kase.id }); // open → in_progress

    // Second advance should return in_progress, not error.
    const second = await sale.afterSale.advance({ caseId: kase.id });
    expect(second.status).toBe('in_progress');
  });

  it('resolve without resolution → BAD_REQUEST (zod min(1))', async () => {
    const kase = await sale.afterSale.create({ studentId, description: 'Needs resolution.' });
    await expect(
      sale.afterSale.resolve({ caseId: kase.id, resolution: '' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('close a non-resolved case → BAD_REQUEST', async () => {
    const kase = await sale.afterSale.create({ studentId, description: 'Try close early.' });
    await expect(sale.afterSale.close({ caseId: kase.id })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('advance a resolved case → BAD_REQUEST', async () => {
    const kase = await sale.afterSale.create({ studentId, description: 'Advance after resolve.' });
    await sale.afterSale.resolve({ caseId: kase.id, resolution: 'Done.' });

    await expect(sale.afterSale.advance({ caseId: kase.id })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('hr role cannot create after-sale case (FORBIDDEN — not in afterSale.manage)', async () => {
    await expect(
      hr.afterSale.create({ studentId, description: 'HR attempt.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('gdkd can create and resolve a case', async () => {
    const kase = await gdkd.afterSale.create({ studentId, description: 'Director case.' });
    expect(kase.status).toBe('open');

    const resolved = await gdkd.afterSale.resolve({ caseId: kase.id, resolution: 'Director resolved.' });
    expect(resolved.status).toBe('resolved');
  });

  it('create stores the createdById from the caller userId', async () => {
    const kase = await sale.afterSale.create({ studentId, description: 'Audit check.' });
    expect(kase.createdById).toBe('sale-as-1');
  });
});
