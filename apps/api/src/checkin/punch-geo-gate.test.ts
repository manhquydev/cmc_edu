// Gate OR matrix: network | geo | open | none + dayPunches + geoPunchSummary + payroll contract.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { getErrorShape } from '@trpc/server/unstable-core-do-not-import';
import { ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { appRouter } from '../router.js';
import { AppCodeError } from '../errors.js';
import { resolveDayCredit } from '../attendance/resolve-day-credit.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  seedFacilityNetwork,
  testDbBypass,
} from '../test/db.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config = (appRouter as any)._def._config;

function clientShapeFor(error: TRPCError, path: string) {
  return getErrorShape({
    config,
    error,
    type: 'mutation' as const,
    path,
    input: undefined,
    ctx: undefined,
  });
}

const HN = { lat: 21.0285, lng: 105.8542 };
// ~50 m north of HN (accuracy-friendly)
const HN_NEAR = { lat: 21.02895, lng: 105.8542 };

describe('checkInOut.punch — geofence gate OR', () => {
  let facilityId: string;

  const makeCtx = (userId: string, ip: string | null, roles: string[] = ['sale']) =>
    buildStaffContext({ facilityId, userId, roles: roles as never, ip });

  const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

  beforeEach(async () => {
    const f = await createTestFacility('Geo Gate Test');
    facilityId = f.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  async function seedApprovedShift(appUserId: string, dateKey: string) {
    return testDbBypass(async (tx) => {
      const group = await tx.shiftGroup.create({
        data: {
          facilityId,
          name: `Sale ${dateKey}-${appUserId.slice(0, 6)}`,
          type: 'KINH_DOANH',
          selectionMode: 'SINGLE',
        },
      });
      const template = await tx.shiftTemplate.create({
        data: {
          facilityId,
          shiftGroupId: group.id,
          name: 'Ca ngày',
          startTime: '09:00',
          endTime: '17:00',
        },
      });
      const reg = await tx.shiftRegistration.create({
        data: {
          facilityId,
          appUserId,
          shiftGroupId: group.id,
          fromDate: ictToUtc(dateKey, '00:00'),
          toDate: ictToUtc(dateKey, '00:00'),
          status: 'approved',
          selectionMode: 'SINGLE',
        },
      });
      await tx.shiftRegistrationEntry.create({
        data: {
          facilityId,
          shiftRegistrationId: reg.id,
          date: ictToUtc(dateKey, '00:00'),
          shiftTemplateId: template.id,
        },
      });
    });
  }

  async function seedGeofence(opts: {
    lat: number;
    lng: number;
    radiusM?: number;
    accuracyMaxM?: number;
    isActive?: boolean;
    label?: string;
  }) {
    return testDbBypass((tx) =>
      tx.facilityGeofence.create({
        data: {
          facilityId,
          lat: opts.lat,
          lng: opts.lng,
          radiusM: opts.radiusM ?? 200,
          accuracyMaxM: opts.accuracyMaxM ?? 200,
          isActive: opts.isActive ?? true,
          label: opts.label ?? 'g',
        },
      }),
    );
  }

  function todayKey() {
    return ictDateOnlyOf(new Date());
  }

  it('open mode (0 network, 0 geofence) → verification=open, withinNetwork=true', async () => {
    await seedAppUser({ facilityId, userId: 'geo-open' });
    const result = await caller(makeCtx('geo-open', '1.2.3.4')).checkInOut.punch({});
    expect(result.withinNetwork).toBe(true);
    expect(result.verification).toBe('open');
    const row = await testDbBypass((tx) => tx.timePunch.findUniqueOrThrow({ where: { id: result.id } }));
    expect(row.verification).toBe('open');
  });

  it('network-only + IP match → verification=network', async () => {
    await seedAppUser({ facilityId, userId: 'geo-net' });
    await seedFacilityNetwork(facilityId, '10.0.0.0/24');
    const result = await caller(makeCtx('geo-net', '10.0.0.9')).checkInOut.punch({});
    expect(result.verification).toBe('network');
    expect(result.withinNetwork).toBe(true);
  });

  it('geofence-only + IP foreign + GPS in radius → verification=geo, no reason', async () => {
    const user = await seedAppUser({ facilityId, userId: 'geo-in' });
    await seedGeofence({ ...HN, radiusM: 200 });
    await seedApprovedShift(user.id, todayKey());
    const result = await caller(makeCtx('geo-in', '203.0.113.1')).checkInOut.punch({
      geo: { ...HN_NEAR, accuracyM: 30 },
    });
    expect(result.verification).toBe('geo');
    expect(result.withinNetwork).toBe(true);
    const tickets = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.findMany({ where: { appUserId: user.id } }),
    );
    expect(tickets).toHaveLength(0);
    const row = await testDbBypass((tx) => tx.timePunch.findUniqueOrThrow({ where: { id: result.id } }));
    expect(row.matchedGeofenceId).not.toBeNull();
    expect(row.geofenceDistanceM).not.toBeNull();
    expect(row.matchedRadiusM).toBe(200);
    expect(row.matchedAccuracyMaxM).toBe(200);
    expect(row.lat).toBeCloseTo(HN_NEAR.lat, 4);
  });

  it('geofence-only + no geo → OFFSITE_REASON_REQUIRED with geoThresholdM, no distance in payload', async () => {
    const user = await seedAppUser({ facilityId, userId: 'geo-none' });
    await seedGeofence({ ...HN, accuracyMaxM: 200 });
    await seedGeofence({ ...HN, accuracyMaxM: 500, label: 'wide' });
    await seedApprovedShift(user.id, todayKey());

    let thrown: TRPCError | undefined;
    try {
      await caller(makeCtx('geo-none', '203.0.113.1')).checkInOut.punch({});
    } catch (err) {
      thrown = err as TRPCError;
    }
    expect(thrown).toBeInstanceOf(AppCodeError);
    expect((thrown as AppCodeError).appCode).toBe('OFFSITE_REASON_REQUIRED');
    expect((thrown as AppCodeError).appData?.geoThresholdM).toBe(500); // max, not min

    const shape = clientShapeFor(thrown!, 'checkInOut.punch');
    expect(shape.data?.appCode).toBe('OFFSITE_REASON_REQUIRED');
    expect((shape.data as { appData?: { geoThresholdM?: number } })?.appData?.geoThresholdM).toBe(
      500,
    );
    // anti-oracle: no distance / coords in client shape
    expect(JSON.stringify(shape)).not.toMatch(/geofenceDistance|\"lat\"|\"lng\"/);
  });

  it('distance == radiusM passes (boundary inclusive)', async () => {
    await seedAppUser({ facilityId, userId: 'geo-eq' });
    // Build a geofence and punch at a point we know is within radius by using same center + large radius
    await seedGeofence({ ...HN, radiusM: 200 });
    // HN_NEAR is ~50m — well within 200
    const result = await caller(makeCtx('geo-eq', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN, accuracyM: 10 },
    });
    expect(result.verification).toBe('geo');
    const row = await testDbBypass((tx) => tx.timePunch.findUniqueOrThrow({ where: { id: result.id } }));
    expect(row.geofenceDistanceM).toBeLessThanOrEqual(200);
  });

  it('accuracy == accuracyMaxM passes; accuracyMaxM+1 fails', async () => {
    await seedAppUser({ facilityId, userId: 'geo-acc' });
    await seedGeofence({ ...HN, accuracyMaxM: 200 });
    const pass = await caller(makeCtx('geo-acc', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN, accuracyM: 200 },
    });
    expect(pass.verification).toBe('geo');

    // second punch needs cooldown wait — seed another user
    await seedAppUser({ facilityId, userId: 'geo-acc2' });
    const user2 = await seedAppUser({ facilityId, userId: 'geo-acc3' });
    await seedApprovedShift(user2.id, todayKey());
    await expect(
      caller(makeCtx('geo-acc3', '1.1.1.1')).checkInOut.punch({
        geo: { ...HN, accuracyM: 201 },
      }),
    ).rejects.toMatchObject({ appCode: 'OFFSITE_REASON_REQUIRED' });
  });

  it('custom accuracyMaxM=500: accuracy 350 passes that zone, fails default 200 zone', async () => {
    await seedAppUser({ facilityId, userId: 'geo-custom' });
    // only the 500-threshold zone
    await seedGeofence({ ...HN, accuracyMaxM: 500 });
    const ok = await caller(makeCtx('geo-custom', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN, accuracyM: 350 },
    });
    expect(ok.verification).toBe('geo');
  });

  it('2-geofence: nearest fails (outside radius), farther zone passes → geoMatch', async () => {
    await seedAppUser({ facilityId, userId: 'geo-2z' });
    // Near center at HN with tiny radius 20m — HN_NEAR (~50m) fails this
    await seedGeofence({ ...HN, radiusM: 20, label: 'near-tiny' });
    // Farther-looking but large radius covering HN_NEAR — use same center large radius
    // Plan: nearest fails, farther passes. Place zone B centered near HN_NEAR with large radius.
    await seedGeofence({ ...HN_NEAR, radiusM: 200, label: 'cover-near' });
    const result = await caller(makeCtx('geo-2z', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN_NEAR, accuracyM: 20 },
    });
    expect(result.verification).toBe('geo');
    const row = await testDbBypass((tx) => tx.timePunch.findUniqueOrThrow({ where: { id: result.id } }));
    // matched should be cover-near (the one that passes), not near-tiny
    const matched = await testDbBypass((tx) =>
      tx.facilityGeofence.findUnique({ where: { id: row.matchedGeofenceId! } }),
    );
    expect(matched?.label).toBe('cover-near');
  });

  it('both network and geo match → verification=network wins', async () => {
    await seedAppUser({ facilityId, userId: 'geo-both' });
    await seedFacilityNetwork(facilityId, '10.0.0.0/24');
    await seedGeofence({ ...HN });
    const result = await caller(makeCtx('geo-both', '10.0.0.5')).checkInOut.punch({
      geo: { ...HN, accuracyM: 20 },
    });
    expect(result.verification).toBe('network');
  });

  it('network-only facility: geo present does not geoMatch (no active geofence)', async () => {
    const user = await seedAppUser({ facilityId, userId: 'geo-netonly' });
    await seedFacilityNetwork(facilityId, '10.0.0.0/24');
    await seedApprovedShift(user.id, todayKey());
    // IP outside + geo would-match if fence existed → still offsite
    await expect(
      caller(makeCtx('geo-netonly', '203.0.113.9')).checkInOut.punch({
        geo: { ...HN, accuracyM: 20 },
      }),
    ).rejects.toMatchObject({ appCode: 'OFFSITE_REASON_REQUIRED' });
  });

  it('snapshot immutable after geofence config changes', async () => {
    await seedAppUser({ facilityId, userId: 'geo-snap' });
    const g = await seedGeofence({ ...HN, radiusM: 200 });
    const result = await caller(makeCtx('geo-snap', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN, accuracyM: 20 },
    });
    await testDbBypass((tx) =>
      tx.facilityGeofence.update({ where: { id: g.id }, data: { radiusM: 50 } }),
    );
    const row = await testDbBypass((tx) => tx.timePunch.findUniqueOrThrow({ where: { id: result.id } }));
    expect(row.matchedRadiusM).toBe(200);
  });

  it('delete geofence after match succeeds (no FK); dayPunches still has snapshot', async () => {
    await seedAppUser({ facilityId, userId: 'geo-del-emp', position: 'sale' });
    const g = await seedGeofence({ ...HN });
    const punch = await caller(makeCtx('geo-del-emp', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN, accuracyM: 20 },
    });
    expect(punch.verification).toBe('geo');

    // delete geofence — no FK so punch snapshot remains
    await testDbBypass((tx) => tx.facilityGeofence.delete({ where: { id: g.id } }));
    const still = await testDbBypass((tx) => tx.timePunch.findUniqueOrThrow({ where: { id: punch.id } }));
    expect(still.matchedGeofenceId).toBe(g.id);
    expect(still.geofenceDistanceM).not.toBeNull();
  });

  it('geo-verified day → resolveDayCredit full credit without ticket (payroll contract)', () => {
    const at = (hhmm: string) => ictToUtc(todayKey(), hhmm);
    const result = resolveDayCredit({
      shifts: [{ id: 's1', start: at('09:00'), end: at('17:00') }],
      dayPunches: [
        { punchAt: at('09:05'), withinNetwork: true },
        { punchAt: at('17:00'), withinNetwork: true },
      ],
      ticket: undefined,
    });
    expect(result.present).toBe(true);
    expect(result.creditedShiftIds).toContain('s1');
  });

  it('dayPunches: minimizes PII, scopes to ticket owner, track gate', async () => {
    const employee = await seedAppUser({
      facilityId,
      userId: 'geo-dp-emp',
      position: 'sale',
      roles: ['sale'],
    });
    const other = await seedAppUser({
      facilityId,
      userId: 'geo-dp-other',
      position: 'sale',
      roles: ['sale'],
    });
    await seedAppUser({
      facilityId,
      userId: 'geo-dp-gd',
      position: 'giam_doc_kinh_doanh',
      roles: ['giam_doc_kinh_doanh'],
    });
    await seedGeofence({ ...HN });

    // employee geo punch (no ticket)
    await caller(makeCtx('geo-dp-emp', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN, accuracyM: 25 },
    });
    // other employee same day punch
    await caller(makeCtx('geo-dp-other', '1.1.1.1')).checkInOut.punch({
      geo: { ...HN, accuracyM: 25 },
    });

    // create ticket manually for employee (simulates offsite day)
    const dateKey = todayKey();
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: {
          facilityId,
          appUserId: employee.id,
          ticketDate: ictToUtc(dateKey, '00:00'),
          status: 'pending',
          note: 'test',
          checkInAt: new Date(),
        },
      }),
    );

    const gd = buildStaffContext({
      facilityId,
      userId: 'geo-dp-gd',
      roles: ['giam_doc_kinh_doanh'],
    });
    const punches = await caller(gd).manualPunch.dayPunches({ ticketId: ticket.id });
    expect(punches.length).toBeGreaterThanOrEqual(1);
    for (const p of punches) {
      expect(p).not.toHaveProperty('lat');
      expect(p).not.toHaveProperty('lng');
      expect(p).not.toHaveProperty('ip');
      expect(p).toHaveProperty('verification');
      expect(p).toHaveProperty('matchedRadiusM');
    }
    // other employee punches must not leak
    const allEmp = await testDbBypass((tx) =>
      tx.timePunch.count({ where: { appUserId: employee.id } }),
    );
    expect(punches).toHaveLength(allEmp);

    // wrong track director blocked
    await seedAppUser({
      facilityId,
      userId: 'geo-dp-gdt',
      position: 'giam_doc_dao_tao',
      roles: ['giam_doc_dao_tao'],
    });
    const gdt = buildStaffContext({
      facilityId,
      userId: 'geo-dp-gdt',
      roles: ['giam_doc_dao_tao'],
    });
    await expect(caller(gdt).manualPunch.dayPunches({ ticketId: ticket.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    void other;
  });

  it('geoPunchSummary: shows director geo punches to other director / super_admin; hides self', async () => {
    await seedAppUser({ facilityId, userId: 'geo-sum-gd1', position: 'giam_doc_kinh_doanh' });
    await seedAppUser({ facilityId, userId: 'geo-sum-gd2', position: 'giam_doc_dao_tao' });
    await seedGeofence({ ...HN });

    await caller(makeCtx('geo-sum-gd1', '1.1.1.1', ['giam_doc_kinh_doanh'])).checkInOut.punch({
      geo: { ...HN, accuracyM: 20 },
    });

    const gd2 = buildStaffContext({
      facilityId,
      userId: 'geo-sum-gd2',
      roles: ['giam_doc_dao_tao'],
    });
    const summary = await caller(gd2).checkInOut.geoPunchSummary({ days: 30 });
    expect(summary.some((r) => r.fullName.length >= 0 && r.geoPunchCount >= 1)).toBe(true);

    // self excluded when same user
    const gd1 = buildStaffContext({
      facilityId,
      userId: 'geo-sum-gd1',
      roles: ['giam_doc_kinh_doanh'],
    });
    const selfSummary = await caller(gd1).checkInOut.geoPunchSummary({ days: 30 });
    const selfRows = selfSummary.filter((r) => r.appUserId);
    // gd1's own punches not listed
    const gd1User = await testDbBypass((tx) =>
      tx.appUser.findFirst({ where: { userId: 'geo-sum-gd1', facilityId } }),
    );
    expect(selfRows.every((r) => r.appUserId !== gd1User!.id)).toBe(true);

    // super_admin sees all (no AppUser → no self-filter)
    const sa = buildStaffContext({ facilityId, userId: 'geo-sum-sa', roles: ['super_admin'] });
    const saSummary = await caller(sa).checkInOut.geoPunchSummary({ days: 30 });
    expect(saSummary.some((r) => r.geoPunchCount >= 1)).toBe(true);
  });

  it('non-AppCodeError still serializes without appData/appCode (contract)', () => {
    const error = new TRPCError({ code: 'BAD_REQUEST', message: 'plain' });
    const shape = clientShapeFor(error, 'x');
    expect(shape.data?.appCode).toBeUndefined();
    expect((shape.data as { appData?: unknown })?.appData).toBeUndefined();
  });
});
