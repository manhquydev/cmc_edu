// Attendance daily in/out pairing e2e (ADR 0043,
// docs/decisions/0043-attendance-daily-inout-pairing.md — WF-P3-01/02, docs/20
// §1): the one cross-module, multi-actor flow no single-router integration
// test can reach — real HTTP + real IP resolution through
// `checkInOut.punch`, a ticket auto-created from an offsite punch, a second
// actor (GĐ track) reviewing it through the real permission gate, and the
// approved ticket feeding `kpi.refresh`'s day-credit exactly like a real
// punch pair (`resolveDayCredit`, shared by payroll + KPI).
//
// Real 10-second cooldowns are respected with real waits (no mocked clock —
// `checkInOut.punch` reads `Date.now()` directly) — this is why the test
// needs a longer-than-default timeout.
//
// API-driven (tRPC), no browser. Uses the ephemeral facility from
// global-setup.ts, shared with every other spec file in this run — no other
// spec calls `checkInOut.punch`/`manualPunch.*`, so seeding a
// `FacilityNetwork` row here (which flips every subsequent punch on this
// facility to "offsite", loopback never matches it) is safe.

import { test, expect } from '@playwright/test';
import { TRPCClientError } from '@trpc/client';
import { ictDateOnlyOf } from '@cmc/domain-time';
import type { AppRouter } from '../../api/src/router.js';
import {
  seedAppUser,
  seedApprovedShiftRegistration,
  seedFacilityNetwork,
} from '../src/db.js';
import { createE2eStaffClient } from '../src/trpc-client.js';

const baseUrl = process.env.E2E_BASE_URL!;
const facilityId = process.env.E2E_FACILITY_ID!;

const PUNCH_COOLDOWN_WAIT_MS = 11_000; // ADR 0043: 10s cooldown, +1s margin.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.describe('attendance daily in/out pairing lifecycle (ADR 0043)', () => {
  test('within-network punch credits payroll with no ticket; offsite punch requires a ticket the GĐ track reviews; reject -> resubmit -> approve; freeze-on-approve holds', async () => {
    // 3 real cooldown waits below (~33s) plus several real HTTP round trips —
    // comfortably over the suite's 30s default.
    test.setTimeout(120_000);

    const suffix = Math.random().toString(36).slice(2, 8);
    const todayIct = ictDateOnlyOf(new Date());
    const period = todayIct.slice(0, 7);

    const gdkd = createE2eStaffClient(baseUrl, {
      userId: `e2e-att-gdkd-${suffix}`,
      roles: ['giam_doc_kinh_doanh'],
      facilityId,
    });
    const gddt = createE2eStaffClient(baseUrl, {
      userId: `e2e-att-gddt-${suffix}`,
      roles: ['giam_doc_dao_tao'],
      facilityId,
    });

    const shiftGroup = await gdkd.shift.createGroup.mutate({
      name: `E2E ATT Group ${suffix}`,
      type: 'KINH_DOANH',
      selectionMode: 'SINGLE',
    });
    // Full-day window so a real-time punch pair always lands "on time"
    // regardless of when in the day this suite happens to run.
    const shiftTemplate = await gdkd.shift.createTemplate.mutate({
      shiftGroupId: shiftGroup.id,
      name: `Ca cả ngày ${suffix}`,
      startTime: '00:00',
      endTime: '23:59',
    });

    // -------------------------------------------------------------------
    // Scenario A — within-network: no FacilityNetwork row exists yet, so
    // the facility is in "open mode" (every punch's withinNetwork=true).
    // Real check-in + check-out through the actual mutation.
    // -------------------------------------------------------------------
    const saleAAppUser = await seedAppUser({
      facilityId,
      userId: `e2e-att-saleA-${suffix}`,
      position: 'sale',
      roles: ['sale'],
    });
    const saleA = createE2eStaffClient(baseUrl, {
      userId: `e2e-att-saleA-${suffix}`,
      roles: ['sale'],
      facilityId,
    });
    await seedApprovedShiftRegistration({
      facilityId,
      appUserId: saleAAppUser.id,
      shiftGroupId: shiftGroup.id,
      shiftTemplateId: shiftTemplate.id,
      dates: [todayIct],
    });

    await saleA.checkInOut.punch.mutate({});
    await sleep(PUNCH_COOLDOWN_WAIT_MS);
    await saleA.checkInOut.punch.mutate({});

    const saleATickets = await saleA.manualPunch.list.query({ scope: 'mine' });
    expect(saleATickets).toHaveLength(0); // within-network never creates a ticket

    const saleARefresh = await saleA.kpi.refresh.mutate({ period });
    expect(saleARefresh.shiftActual).toBe(1); // full-day window credited, zero penalty

    // -------------------------------------------------------------------
    // Scenario B — offsite: seed an active FacilityNetwork whose CIDR does
    // not match loopback, flipping every subsequent punch in this facility
    // to offsite (this is deliberately AFTER scenario A so it never affects
    // the within-network assertions above).
    // -------------------------------------------------------------------
    await seedFacilityNetwork({ facilityId });

    const saleBAppUser = await seedAppUser({
      facilityId,
      userId: `e2e-att-saleB-${suffix}`,
      position: 'sale',
      roles: ['sale'],
    });
    const saleB = createE2eStaffClient(baseUrl, {
      userId: `e2e-att-saleB-${suffix}`,
      roles: ['sale'],
      facilityId,
    });
    await seedApprovedShiftRegistration({
      facilityId,
      appUserId: saleBAppUser.id,
      shiftGroupId: shiftGroup.id,
      shiftTemplateId: shiftTemplate.id,
      dates: [todayIct],
    });

    // First offsite punch of the day, no reason -> OFFSITE_REASON_REQUIRED,
    // no punch recorded, no ticket created.
    let reasonError: unknown;
    try {
      await saleB.checkInOut.punch.mutate({});
    } catch (error) {
      reasonError = error;
    }
    expect(reasonError).toBeInstanceOf(TRPCClientError);
    expect(((reasonError as TRPCClientError<AppRouter>).data as { appCode?: string } | null)?.appCode).toBe(
      'OFFSITE_REASON_REQUIRED',
    );
    expect(await saleB.manualPunch.list.query({ scope: 'mine' })).toHaveLength(0);

    // With a reason -> punch recorded + a pending ticket auto-created.
    await saleB.checkInOut.punch.mutate({ reason: 'Đi công tác gặp khách' });
    const [pendingTicket] = await saleB.manualPunch.list.query({ scope: 'mine' });
    expect(pendingTicket?.status).toBe('pending');
    expect(pendingTicket?.checkInAt).toBeTruthy();

    // GĐĐT (wrong track — this ticket's owner is `sale`) sees nothing in
    // inbox and cannot approve it.
    const gddtInbox = await gddt.manualPunch.list.query({ scope: 'inbox' });
    expect(gddtInbox.some((t) => t.id === pendingTicket!.id)).toBe(false);
    let wrongTrackError: unknown;
    try {
      await gddt.manualPunch.approve.mutate({ ticketId: pendingTicket!.id });
    } catch (error) {
      wrongTrackError = error;
    }
    expect(wrongTrackError).toBeInstanceOf(TRPCClientError);
    expect((wrongTrackError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');

    // Self-approve blocked.
    let selfApproveError: unknown;
    try {
      await saleB.manualPunch.approve.mutate({ ticketId: pendingTicket!.id });
    } catch (error) {
      selfApproveError = error;
    }
    expect(selfApproveError).toBeInstanceOf(TRPCClientError);
    expect((selfApproveError as TRPCClientError<AppRouter>).data?.code).toBe('FORBIDDEN');

    // GĐKD (correct track) rejects first, to exercise reject -> resubmit ->
    // approve rather than the immediate-approve happy path alone.
    const rejected = await gdkd.manualPunch.reject.mutate({
      ticketId: pendingTicket!.id,
      note: 'Thiếu chứng từ công tác',
    });
    expect(rejected.status).toBe('rejected');

    const resubmitted = await saleB.manualPunch.resubmit.mutate({
      ticketId: pendingTicket!.id,
      reason: 'Đã đính kèm vé xe công tác',
    });
    expect(resubmitted.status).toBe('resubmitted');

    // A punch while `resubmitted` still updates checkInAt/checkOutAt (not
    // frozen until actually approved/rejected).
    await sleep(PUNCH_COOLDOWN_WAIT_MS);
    await saleB.checkInOut.punch.mutate({});
    const [resubmittedTicket] = await saleB.manualPunch.list.query({ scope: 'mine' });
    expect(resubmittedTicket?.checkOutAt).toBeTruthy();

    const approved = await gdkd.manualPunch.approve.mutate({ ticketId: pendingTicket!.id });
    expect(approved.status).toBe('approved');
    const frozenCheckOutAt = approved.checkOutAt;

    // R1 freeze: a further punch today must NOT change the now-approved
    // ticket's checkInAt/checkOutAt (chống gian lận checkin-nhà,
    // checkout-công-ty-sau-khi-đã-duyệt).
    await sleep(PUNCH_COOLDOWN_WAIT_MS);
    await saleB.checkInOut.punch.mutate({});
    const [frozenTicket] = await saleB.manualPunch.list.query({ scope: 'mine' });
    expect(frozenTicket?.checkOutAt).toEqual(frozenCheckOutAt);

    // Approved offsite ticket credits payroll/KPI exactly like a real
    // in-network pair (resolveDayCredit, shared payroll+KPI).
    const saleBRefresh = await saleB.kpi.refresh.mutate({ period });
    expect(saleBRefresh.shiftActual).toBe(1);
  });
});
