// Shift lifecycle e2e (HR remediation phase 6, docs/20 — WF-P3-03/04):
// createGroup/Template (seed) -> sale submits -> GĐKD rejects (reason) ->
// sale sees `rejectReason` via `myRegistrations` -> resubmit -> approve.
// Also asserts the group-type gate (sale registering into a GIAO_VIEN group)
// and the anti-self-review gate (a caller cannot approve/reject their own
// registration even when they hold the reviewer role) + that a `rejected`
// registration frees BOTH the ticket-lock and the overlap guard (neither
// counts `rejected` — only `submitted`/`approved` do, apps/api/src/shift/
// router.ts's `shift.submit`).
//
// API-driven (tRPC), no browser. Uses the ephemeral facility from
// global-setup.ts. `createGroup`/`createTemplate` use random-suffixed names
// (no shared shift catalog seed exists to collide with — see
// apps/e2e/src/db.ts's HR remediation seed-helper section header).

import { test, expect } from '@playwright/test';
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../api/src/router.js';
import { seedAppUser } from '../src/db.js';
import { createE2eStaffClient } from '../src/trpc-client.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

/** A future ICT `YYYY-MM-DD` date `daysAhead` days from now — `shift.submit`
 * requires `fromDate` to be a future ICT date at submission time. */
function futureDateOnly(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

test.describe('shift lifecycle: submit -> reject -> resubmit -> approve', () => {
  test('group-type gate, anti-self, ticket-lock freed after reject', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const gdkd = createE2eStaffClient(baseUrl, {
      userId: `e2e-shift-gdkd-${suffix}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });

    // ---- Seed: KINH_DOANH group/template (+ a GIAO_VIEN group for the
    // group-type gate assertion below) ----
    const saleGroup = await gdkd.shift.createGroup.mutate({
      name: `E2E Sale Shift Group ${suffix}`,
      type: 'KINH_DOANH',
      selectionMode: 'SINGLE',
    });
    const gvGroup = await gdkd.shift.createGroup.mutate({
      name: `E2E GV Shift Group ${suffix}`,
      type: 'GIAO_VIEN',
      selectionMode: 'SINGLE',
    });
    const template = await gdkd.shift.createTemplate.mutate({
      shiftGroupId: saleGroup.id,
      name: `Ca ngày ${suffix}`,
      startTime: '09:00',
      endTime: '17:00',
    });

    // ---- Group-type gate: a `sale` employee cannot register into a
    // GIAO_VIEN-type group ----
    const saleAppUser = await seedAppUser({
      facilityId,
      userId: `e2e-shift-sale-${suffix}`,
      position: 'sale',
    });
    const sale = createE2eStaffClient(baseUrl, {
      userId: `e2e-shift-sale-${suffix}`,
      roles: ['sale'],
      facilityId,
    });

    const gateDate = futureDateOnly(30);
    let gateError: unknown;
    try {
      await sale.shift.submit.mutate({
        shiftGroupId: gvGroup.id,
        fromDate: gateDate,
        toDate: gateDate,
        entries: [{ date: gateDate, shiftTemplateId: template.id }],
      });
    } catch (err) {
      gateError = err;
    }
    expect(gateError).toBeInstanceOf(TRPCClientError);
    expect((gateError as TRPCClientError<AppRouter>).data?.code).toBe('BAD_REQUEST');

    // ---- Anti-self: a multi-role actor (sale + giam_doc_kinh_doanh) cannot
    // reject their own registration, even though they hold the reviewer role ----
    await seedAppUser({
      facilityId,
      userId: `e2e-shift-self-${suffix}`,
      position: 'sale',
    });
    const selfActor = createE2eStaffClient(baseUrl, {
      userId: `e2e-shift-self-${suffix}`,
      roles: ['sale', 'giam_doc_kinh_doanh'],
      facilityId,
    });
    const selfDate = futureDateOnly(60);
    const selfReg = await selfActor.shift.submit.mutate({
      shiftGroupId: saleGroup.id,
      fromDate: selfDate,
      toDate: selfDate,
      entries: [{ date: selfDate, shiftTemplateId: template.id }],
    });
    let selfRejectError: unknown;
    try {
      await selfActor.shift.reject.mutate({ registrationId: selfReg.id, reason: 'tự duyệt' });
    } catch (err) {
      selfRejectError = err;
    }
    expect(selfRejectError).toBeInstanceOf(TRPCClientError);
    expect((selfRejectError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');

    // ---- Main flow: sale submits -> GĐKD rejects (reason) -> sale sees
    // rejectReason via myRegistrations -> resubmit (same range, ticket-lock +
    // overlap both freed by the rejection) -> GĐKD approves ----
    void saleAppUser; // seeded above solely so `shift.submit` can resolve the caller's AppUser
    const mainFrom = futureDateOnly(90);
    const mainTo = futureDateOnly(91);
    const firstReg = await sale.shift.submit.mutate({
      shiftGroupId: saleGroup.id,
      fromDate: mainFrom,
      toDate: mainTo,
      entries: [{ date: mainFrom, shiftTemplateId: template.id }],
    });
    expect(firstReg.status).toBe('submitted');

    const rejected = await gdkd.shift.reject.mutate({
      registrationId: firstReg.id,
      reason: 'Thiếu thông tin ca làm việc',
    });
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectReason).toBe('Thiếu thông tin ca làm việc');

    const afterReject = await sale.shift.myRegistrations.query();
    const seenRejected = afterReject.find((r) => r.id === firstReg.id);
    expect(seenRejected?.status).toBe('rejected');
    expect(seenRejected?.rejectReason).toBe('Thiếu thông tin ca làm việc');

    // Ticket-lock + overlap freed: resubmitting the SAME date range succeeds
    // now that the prior registration is `rejected` (neither guard counts it).
    const secondReg = await sale.shift.submit.mutate({
      shiftGroupId: saleGroup.id,
      fromDate: mainFrom,
      toDate: mainTo,
      entries: [{ date: mainFrom, shiftTemplateId: template.id }],
    });
    expect(secondReg.status).toBe('submitted');
    expect(secondReg.id).not.toBe(firstReg.id);

    const approved = await gdkd.shift.approve.mutate({ registrationId: secondReg.id });
    expect(approved.status).toBe('approved');

    const finalRegistrations = await sale.shift.myRegistrations.query();
    const finalReg = finalRegistrations.find((r) => r.id === secondReg.id);
    expect(finalReg?.status).toBe('approved');
  });
});
