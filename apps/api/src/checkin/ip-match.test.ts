// P3-I tests — ipMatchesCidr (unit) + checkInOut/manualPunch (integration).
//
// Unit: pure function tests for the CIDR IP gate (@cmc/domain-identity).
// Integration: TimePunch creation, cooldown, IP gate, manual punch lifecycle,
//   manager-only approve/reject, anti-self-approve.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ipMatchesCidr, isValidCidr } from '@cmc/domain-identity';
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

describe('isValidCidr — pure unit tests', () => {
  it('accepts a plain IPv4 (no prefix)', () => {
    expect(isValidCidr('10.0.0.5')).toBe(true);
  });

  it('accepts a valid CIDR block', () => {
    expect(isValidCidr('192.168.1.0/24')).toBe(true);
    expect(isValidCidr('10.0.0.0/8')).toBe(true);
    expect(isValidCidr('1.2.3.4/32')).toBe(true);
    expect(isValidCidr('0.0.0.0/0')).toBe(true);
  });

  it('rejects an out-of-range prefix', () => {
    expect(isValidCidr('10.0.0.0/33')).toBe(false);
    expect(isValidCidr('10.0.0.0/-1')).toBe(false);
  });

  it('rejects a malformed octet', () => {
    expect(isValidCidr('10.0.0.256')).toBe(false);
    expect(isValidCidr('10.0.0')).toBe(false);
    expect(isValidCidr('10.0.0.0.0')).toBe(false);
  });

  it('rejects non-IPv4 input (IPv6, empty, garbage)', () => {
    expect(isValidCidr('::1')).toBe(false);
    expect(isValidCidr('')).toBe(false);
    expect(isValidCidr('not-an-ip')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration tests — checkInOut.punch + manualPunch.*
// ---------------------------------------------------------------------------

describe('checkInOut + manualPunch (P3-I integration)', () => {
  let facilityId: string;

  const makeSuperCtx = (userId: string, ip: string | null = '10.0.0.1') =>
    buildStaffContext({ facilityId, userId, roles: ['super_admin'], ip });

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

  // ADR 0043: offsite punches are no longer rejected (IP_NOT_ALLOWED is gone) —
  // they're recorded with withinNetwork=false. With no shift registered this
  // day (E2), no ticket/reason is involved either. See
  // src/checkin/punch-offsite.test.ts for the full offsite+reason/ticket
  // matrix, including the exact-10s cooldown boundary (tests 10-11 there
  // supersede this file's old 5-minute boundary tests).
  it('punch succeeds when IP is not in any active network (offsite, no shift today → no ticket)', async () => {
    const user = await seedAppUser({ facilityId, userId: 'punch-badip-user' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    const result = await caller(makeSuperCtx('punch-badip-user', '10.0.0.1')).checkInOut.punch();
    expect(result.method).toBe('ip');
    const punch = await testDbBypass((tx) => tx.timePunch.findFirstOrThrow({ where: { appUserId: user.id } }));
    expect(punch.withinNetwork).toBe(false);
  });

  it('punch fails on cooldown (second punch within 10 seconds)', async () => {
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

  // manualPunch.create/approve/reject/list (managerId-gated) tests formerly
  // here are REMOVED — ADR 0043 phase 4 deleted `manualPunch.create` entirely
  // and replaced the managerId-based approve/reject/list gate with GĐ-track
  // authorization. Full replacement coverage (create-via-punch, track
  // approve/reject, anti-self, super_admin bypass, TOCTOU, resubmit,
  // track-filtered inbox) lives in
  // src/checkin/manual-punch-approval-track.test.ts.
});
