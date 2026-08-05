// HR remediation phase 4 (red-team #5): errorFormatter — asserts the actual
// CLIENT-VISIBLE shape (via `getErrorShape`, the exact function the HTTP
// adapters call to build the wire response — `createCaller` bypasses it, so
// server-side `.rejects.toMatchObject({code})` assertions alone don't prove
// anything about what a browser client actually receives).
//
// Covers: `data.appCode` appears for AppCodeError (OFFSITE_REASON_REQUIRED,
// COOLDOWN); the base shape (message/code/httpStatus/path) is unchanged; and
// — the negative test the phase spec requires — a raw/unknown cause (e.g. a
// rethrown Prisma error) never leaks an appCode.
//
// ADR 0043 (attendance daily in/out pairing) removed `IP_NOT_ALLOWED`
// entirely — an offsite punch is recorded (never rejected); the only
// `checkInOut.punch` appCode error left is `OFFSITE_REASON_REQUIRED` (first
// offsite punch of a day with a registered shift, no reason given).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { getErrorShape, getTRPCErrorFromUnknown } from '@trpc/server/unstable-core-do-not-import';
import { ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { appRouter } from './router.js';
import { AppCodeError } from './errors.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  seedFacilityNetwork,
  testDbBypass,
} from './test/db.js';

// `appRouter._def._config` is the same RootConfig the HTTP adapters read to
// call `getErrorShape` — not part of the public TS surface, hence the cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config = (appRouter as any)._def._config;

function clientShapeFor(error: TRPCError, path: string) {
  return getErrorShape({ config, error, type: 'mutation' as const, path, input: undefined, ctx: undefined });
}

const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

describe('trpc.ts errorFormatter — client-visible shape', () => {
  it('AppCodeError → shape.data.appCode is set, base fields unchanged', () => {
    const error = new AppCodeError({ code: 'BAD_REQUEST', appCode: 'OFFSITE_REASON_REQUIRED', message: 'blocked' });
    const shape = clientShapeFor(error, 'checkInOut.punch');

    expect(shape.data?.appCode).toBe('OFFSITE_REASON_REQUIRED');
    expect(shape.data?.code).toBe('BAD_REQUEST');
    expect(shape.data?.path).toBe('checkInOut.punch');
    expect(shape.message).toBe('blocked');
  });

  it('AppCodeError with appData → shape.data.appData copied (allowlist only)', () => {
    const error = new AppCodeError({
      code: 'BAD_REQUEST',
      appCode: 'OFFSITE_REASON_REQUIRED',
      message: 'blocked',
      appData: { geoThresholdM: 500 },
    });
    const shape = clientShapeFor(error, 'checkInOut.punch');
    expect((shape.data as { appData?: { geoThresholdM?: number } })?.appData?.geoThresholdM).toBe(500);
  });

  it('AppCodeError without appData → shape.data.appData absent', () => {
    const error = new AppCodeError({
      code: 'BAD_REQUEST',
      appCode: 'COOLDOWN',
      message: 'wait',
    });
    const shape = clientShapeFor(error, 'checkInOut.punch');
    expect((shape.data as { appData?: unknown })?.appData).toBeUndefined();
  });

  it('plain TRPCError (no AppCodeError) → shape.data.appCode is undefined', () => {
    const error = new TRPCError({ code: 'BAD_REQUEST', message: 'ordinary business error' });
    const shape = clientShapeFor(error, 'shift.submit');

    expect(shape.data?.appCode).toBeUndefined();
    expect(shape.data?.code).toBe('BAD_REQUEST');
    expect(shape.message).toBe('ordinary business error');
  });

  it('negative: a raw/unknown cause (e.g. rethrown Prisma P2xxx) never leaks appCode', () => {
    // Mirrors payroll/router.ts's `throw err` for a non-P2025 Prisma error —
    // `getTRPCErrorFromUnknown` wraps it as INTERNAL_SERVER_ERROR with the
    // raw error as `.cause`. The formatter must NOT copy `cause.code` even
    // though it superficially looks like our `appCode` field.
    const rawPrismaLikeError = { code: 'P2002', message: 'Unique constraint failed' };
    const wrapped = getTRPCErrorFromUnknown(rawPrismaLikeError);
    const shape = clientShapeFor(wrapped, 'payslip.assemble');

    expect(shape.data?.appCode).toBeUndefined();
    expect(shape.data?.code).toBe('INTERNAL_SERVER_ERROR');
  });

  // ---- Real procedure round-trip: the actual error thrown by checkInOut.punch ----

  describe('checkInOut.punch — real thrown errors carry appCode in the client shape', () => {
    let facilityId: string;

    beforeEach(async () => {
      const facility = await createTestFacility('ErrFormatter-Facility');
      facilityId = facility.id;
    });

    afterEach(async () => {
      await cleanupFacility(facilityId);
    });

    it('offsite + registered shift + no reason → appCode OFFSITE_REASON_REQUIRED, message unchanged (ADR 0043)', async () => {
      const appUser = await seedAppUser({ facilityId, userId: 'errfmt-offsite-user' });
      await seedFacilityNetwork(facilityId, '192.168.1.0/24');
      const dateKey = ictDateOnlyOf(new Date());
      await testDbBypass(async (tx) => {
        const group = await tx.shiftGroup.create({
          data: { facilityId, name: 'ErrFmt Shift Group', type: 'KINH_DOANH', selectionMode: 'SINGLE' },
        });
        const template = await tx.shiftTemplate.create({
          data: { facilityId, shiftGroupId: group.id, name: 'Ca ngày', startTime: '09:00', endTime: '17:00' },
        });
        const reg = await tx.shiftRegistration.create({
          data: {
            facilityId,
            appUserId: appUser.id,
            shiftGroupId: group.id,
            fromDate: ictToUtc(dateKey, '00:00'),
            toDate: ictToUtc(dateKey, '00:00'),
            status: 'approved',
            selectionMode: 'SINGLE',
          },
        });
        await tx.shiftRegistrationEntry.create({
          data: { facilityId, shiftRegistrationId: reg.id, date: ictToUtc(dateKey, '00:00'), shiftTemplateId: template.id },
        });
      });
      const ctx = buildStaffContext({
        facilityId,
        userId: 'errfmt-offsite-user',
        roles: ['sale'],
        ip: '10.0.0.1', // outside the seeded 192.168.1.0/24 FacilityNetwork
      });

      let thrown: TRPCError | undefined;
      try {
        await caller(ctx).checkInOut.punch({});
      } catch (err) {
        thrown = err as TRPCError;
      }
      expect(thrown).toBeInstanceOf(TRPCError);

      const shape = clientShapeFor(thrown!, 'checkInOut.punch');
      expect(shape.data?.appCode).toBe('OFFSITE_REASON_REQUIRED');
      expect(shape.message).toBe('Ngoài mạng cơ sở — cần nhập lý do cho lần chấm công đầu tiên trong ngày.');
    });

    it('cooldown → appCode COOLDOWN, message unchanged (ADR 0043: 10s, not 5min)', async () => {
      await seedAppUser({ facilityId, userId: 'errfmt-cooldown-user' });
      const ctx = buildStaffContext({ facilityId, userId: 'errfmt-cooldown-user', roles: ['sale'] });
      await caller(ctx).checkInOut.punch({});

      let thrown: TRPCError | undefined;
      try {
        await caller(ctx).checkInOut.punch({});
      } catch (err) {
        thrown = err as TRPCError;
      }
      expect(thrown).toBeInstanceOf(TRPCError);

      const shape = clientShapeFor(thrown!, 'checkInOut.punch');
      expect(shape.data?.appCode).toBe('COOLDOWN');
      expect(shape.message).toBe('Cooldown: last punch was less than 10 seconds ago.');
    });

    it('unrelated FORBIDDEN error (no AppUser row) → appCode stays undefined', async () => {
      const ctx = buildStaffContext({ facilityId, userId: 'errfmt-no-appuser', roles: ['sale'] });

      let thrown: TRPCError | undefined;
      try {
        await caller(ctx).checkInOut.punch();
      } catch (err) {
        thrown = err as TRPCError;
      }
      expect(thrown).toBeInstanceOf(TRPCError);

      const shape = clientShapeFor(thrown!, 'checkInOut.punch');
      expect(shape.data?.appCode).toBeUndefined();
    });
  });

  // ---- Real procedure round-trip: payslip.getForUser (post-audit fix — was
  // a plain notFound(), now carries a machine-readable appCode) ----

  describe('payslip.getForUser — real thrown errors carry appCode in the client shape', () => {
    let facilityId: string;
    let employeeAppUserId: string;

    beforeEach(async () => {
      const facility = await createTestFacility('ErrFormatter-Payslip-Facility');
      facilityId = facility.id;
      const employee = await seedAppUser({ facilityId, userId: 'errfmt-payslip-employee', position: 'giao_vien' });
      employeeAppUserId = employee.id;
    });

    afterEach(async () => {
      await cleanupFacility(facilityId);
    });

    it('unknown appUserId → appCode APP_USER_NOT_FOUND', async () => {
      const ctx = buildStaffContext({ facilityId, userId: 'errfmt-payslip-employee', roles: ['giao_vien'] });

      let thrown: TRPCError | undefined;
      try {
        await caller(ctx).payslip.getForUser({
          appUserId: '00000000-0000-0000-0000-000000000000',
          period: '2099-01',
        });
      } catch (err) {
        thrown = err as TRPCError;
      }
      expect(thrown).toBeInstanceOf(TRPCError);

      const shape = clientShapeFor(thrown!, 'payslip.getForUser');
      expect(shape.data?.appCode).toBe('APP_USER_NOT_FOUND');
      expect(shape.data?.code).toBe('NOT_FOUND');
    });

    it("own appUserId, no payslip assembled yet → appCode PAYSLIP_NOT_FOUND", async () => {
      const ctx = buildStaffContext({ facilityId, userId: 'errfmt-payslip-employee', roles: ['giao_vien'] });

      let thrown: TRPCError | undefined;
      try {
        await caller(ctx).payslip.getForUser({ appUserId: employeeAppUserId, period: '2099-01' });
      } catch (err) {
        thrown = err as TRPCError;
      }
      expect(thrown).toBeInstanceOf(TRPCError);

      const shape = clientShapeFor(thrown!, 'payslip.getForUser');
      expect(shape.data?.appCode).toBe('PAYSLIP_NOT_FOUND');
      expect(shape.data?.code).toBe('NOT_FOUND');
    });
  });
});
