// P3-I tests — ipMatchesCidr (unit) + checkInOut/manualPunch (integration).
//
// Unit: pure function tests for the CIDR IP gate (@cmc/domain-identity).
// Integration: TimePunch creation, cooldown, IP gate, manual punch lifecycle,
//   manager-only approve/reject, anti-self-approve.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ipMatchesCidr } from '@cmc/domain-identity';
import { ictToUtc } from '@cmc/domain-time';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  seedFacilityNetwork,
  testDbBypass,
} from '../test/db.js';

// ---------------------------------------------------------------------------
// Pure unit tests — ipMatchesCidr
// ---------------------------------------------------------------------------

describe('ipMatchesCidr — pure unit tests', () => {
  it('exact IP match via single-IP string (no slash)', () => {
    expect(ipMatchesCidr('10.0.0.5', '10.0.0.5')).toBe(true);
  });

  it('single IP non-match', () => {
    expect(ipMatchesCidr('10.0.0.6', '10.0.0.5')).toBe(false);
  });

  it('/24 subnet match', () => {
    expect(ipMatchesCidr('192.168.1.100', '192.168.1.0/24')).toBe(true);
  });

  it('/24 subnet non-match (different /24)', () => {
    expect(ipMatchesCidr('192.168.2.1', '192.168.1.0/24')).toBe(false);
  });

  it('/32 exact match', () => {
    expect(ipMatchesCidr('172.16.0.1', '172.16.0.1/32')).toBe(true);
  });

  it('/32 non-match', () => {
    expect(ipMatchesCidr('172.16.0.2', '172.16.0.1/32')).toBe(false);
  });

  it('/0 matches every IP', () => {
    expect(ipMatchesCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
    expect(ipMatchesCidr('255.255.255.255', '0.0.0.0/0')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — checkInOut.punch + manualPunch.*
// ---------------------------------------------------------------------------

describe('checkInOut + manualPunch (P3-I integration)', () => {
  let facilityId: string;

  const makeSuperCtx = (userId: string, ip: string | null = '10.0.0.1') =>
    buildStaffContext({ facilityId, userId, roles: ['super_admin'], ip });

  const makeSaleCtx = (userId: string, ip: string | null = '10.0.0.1') =>
    buildStaffContext({ facilityId, userId, roles: ['sale'], ip });

  const caller = (ctx: ReturnType<typeof buildStaffContext>) =>
    appRouter.createCaller(ctx);

  beforeEach(async () => {
    const f = await createTestFacility('P3-I Checkin Test');
    facilityId = f.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  // ---- checkInOut.punch ----

  it('punch succeeds in open mode (no FacilityNetwork rows)', async () => {
    await seedAppUser({ facilityId, userId: 'punch-open-user' });
    const result = await caller(makeSuperCtx('punch-open-user')).checkInOut.punch();
    expect(result.method).toBe('ip');
    expect(result.punchAt).toBeInstanceOf(Date);
  });

  it('punch succeeds when caller IP is in an active network', async () => {
    await seedAppUser({ facilityId, userId: 'punch-ip-user' });
    await seedFacilityNetwork(facilityId, '10.0.0.0/24');
    const result = await caller(makeSuperCtx('punch-ip-user', '10.0.0.55')).checkInOut.punch();
    expect(result.method).toBe('ip');
  });

  it('punch fails when IP is not in any active network', async () => {
    await seedAppUser({ facilityId, userId: 'punch-badip-user' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    await expect(
      caller(makeSuperCtx('punch-badip-user', '10.0.0.1')).checkInOut.punch(),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('punch fails on cooldown (second punch within 5 minutes)', async () => {
    await seedAppUser({ facilityId, userId: 'punch-cooldown-user' });
    const ctx = makeSuperCtx('punch-cooldown-user');
    await caller(ctx).checkInOut.punch();
    await expect(caller(ctx).checkInOut.punch()).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('punch fails when no AppUser row in facility', async () => {
    await expect(
      caller(makeSuperCtx('no-app-user-here')).checkInOut.punch(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  // ---- manualPunch.create ----

  it('manualPunch.create — creates a pending ticket', async () => {
    await seedAppUser({ facilityId, userId: 'mp-create-user' });
    const result = await caller(makeSaleCtx('mp-create-user')).manualPunch.create({
      ticketDate: '2026-07-01',
      note: 'Was in office, forgot to punch',
    });
    expect(result.status).toBe('pending');
    expect(result.note).toBe('Was in office, forgot to punch');
  });

  it('manualPunch.create — creates resubmitted ticket after rejection', async () => {
    const user = await seedAppUser({ facilityId, userId: 'mp-resubmit-user' });
    // Seed a rejected ticket directly (bypass RLS) to simulate prior rejection
    await testDbBypass(async (tx) => {
      await tx.manualAttendanceTicket.create({
        data: {
          facilityId,
          appUserId: user.id,
          ticketDate: ictToUtc('2026-07-02', '00:00'),
          status: 'rejected',
          note: 'first attempt',
        },
      });
    });
    const result = await caller(makeSaleCtx('mp-resubmit-user')).manualPunch.create({
      ticketDate: '2026-07-02',
    });
    expect(result.status).toBe('resubmitted');
  });

  it('manualPunch.create — BAD_REQUEST when pending already exists for date', async () => {
    await seedAppUser({ facilityId, userId: 'mp-dup-user' });
    const ctx = makeSaleCtx('mp-dup-user');
    await caller(ctx).manualPunch.create({ ticketDate: '2026-07-03' });
    await expect(
      caller(ctx).manualPunch.create({ ticketDate: '2026-07-03' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  // ---- manualPunch.approve / reject ----

  it('manualPunch.approve — direct manager approves ticket', async () => {
    const mgr = await seedAppUser({ facilityId, userId: 'mp-mgr-approve' });
    await seedAppUser({ facilityId, userId: 'mp-emp-approve', managerId: mgr.id });

    const ticket = await caller(makeSaleCtx('mp-emp-approve')).manualPunch.create({
      ticketDate: '2026-07-04',
    });
    const approved = await caller(makeSuperCtx('mp-mgr-approve')).manualPunch.approve({
      ticketId: ticket.id,
      note: 'approved',
    });
    expect(approved.status).toBe('approved');
    expect(approved.reviewedById).toBe(mgr.id);
  });

  it('manualPunch.approve — FORBIDDEN for non-manager', async () => {
    const mgr = await seedAppUser({ facilityId, userId: 'mp-nonmgr-mgr' });
    await seedAppUser({ facilityId, userId: 'mp-nonmgr-emp', managerId: mgr.id });
    await seedAppUser({ facilityId, userId: 'mp-nonmgr-other' });

    const ticket = await caller(makeSaleCtx('mp-nonmgr-emp')).manualPunch.create({
      ticketDate: '2026-07-05',
    });
    // `other` is not the direct manager of `emp`
    await expect(
      caller(makeSuperCtx('mp-nonmgr-other')).manualPunch.approve({ ticketId: ticket.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('manualPunch.approve — FORBIDDEN for self-approve (no manager assigned)', async () => {
    // emp has no managerId → owner.managerId is null, never equals reviewer.id
    await seedAppUser({ facilityId, userId: 'mp-selfapprove-emp' });
    const ctx = makeSaleCtx('mp-selfapprove-emp');
    const ticket = await caller(ctx).manualPunch.create({ ticketDate: '2026-07-06' });
    await expect(
      caller(ctx).manualPunch.approve({ ticketId: ticket.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('manualPunch.reject — direct manager rejects ticket', async () => {
    const mgr = await seedAppUser({ facilityId, userId: 'mp-mgr-reject' });
    await seedAppUser({ facilityId, userId: 'mp-emp-reject', managerId: mgr.id });

    const ticket = await caller(makeSaleCtx('mp-emp-reject')).manualPunch.create({
      ticketDate: '2026-07-07',
    });
    const rejected = await caller(makeSuperCtx('mp-mgr-reject')).manualPunch.reject({
      ticketId: ticket.id,
      note: 'not valid',
    });
    expect(rejected.status).toBe('rejected');
  });
});
