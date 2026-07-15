// checkInOut.punch — offsite ghi nhận + phiếu (ADR 0043, phase 3).
// plans/260713-1706-attendance-daily-inout-pairing/phase-03-backend-punch-offsite-reason.md

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { appRouter } from '../router.js';
import {
  buildStaffContext,
  cleanupFacility,
  createTestFacility,
  seedAppUser,
  seedFacilityNetwork,
  testDbBypass,
} from '../test/db.js';

describe('checkInOut.punch — offsite + reason (ADR 0043 phase 3)', () => {
  let facilityId: string;

  const makeCtx = (userId: string, ip: string | null) =>
    buildStaffContext({ facilityId, userId, roles: ['sale'], ip });

  const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

  beforeEach(async () => {
    const f = await createTestFacility('P3 Punch Offsite Test');
    facilityId = f.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  /** Seeds an approved ShiftRegistration + one entry for `dateKey` (ICT). */
  async function seedApprovedShift(appUserId: string, dateKey: string) {
    return testDbBypass(async (tx) => {
      const group = await tx.shiftGroup.create({
        data: { facilityId, name: `Sale ${dateKey}`, type: 'KINH_DOANH', selectionMode: 'SINGLE' },
      });
      const template = await tx.shiftTemplate.create({
        data: { facilityId, shiftGroupId: group.id, name: 'Ca ngày', startTime: '09:00', endTime: '17:00' },
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
        data: { facilityId, shiftRegistrationId: reg.id, date: ictToUtc(dateKey, '00:00'), shiftTemplateId: template.id },
      });
      return reg.id;
    });
  }

  /** Seeds a SUBMITTED (not yet approved) ShiftRegistration + entry for `dateKey`. */
  async function seedSubmittedShift(appUserId: string, dateKey: string) {
    return testDbBypass(async (tx) => {
      const group = await tx.shiftGroup.create({
        data: { facilityId, name: `Sale-sub ${dateKey}`, type: 'KINH_DOANH', selectionMode: 'SINGLE' },
      });
      const template = await tx.shiftTemplate.create({
        data: { facilityId, shiftGroupId: group.id, name: 'Ca ngày', startTime: '09:00', endTime: '17:00' },
      });
      const reg = await tx.shiftRegistration.create({
        data: {
          facilityId,
          appUserId,
          shiftGroupId: group.id,
          fromDate: ictToUtc(dateKey, '00:00'),
          toDate: ictToUtc(dateKey, '00:00'),
          status: 'submitted',
          selectionMode: 'SINGLE',
        },
      });
      await tx.shiftRegistrationEntry.create({
        data: { facilityId, shiftRegistrationId: reg.id, date: ictToUtc(dateKey, '00:00'), shiftTemplateId: template.id },
      });
      return reg.id;
    });
  }

  function todayIctDateKey(): string {
    // The router derives `dateKey` from `ictDateOnlyOf(new Date())` at call
    // time — seeded shifts must land on the SAME real ICT calendar day.
    return ictDateOnlyOf(new Date());
  }

  it('1. punch trong mạng → withinNetwork=true, không tạo phiếu', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-onsite' });
    await seedFacilityNetwork(facilityId, '10.0.0.0/24');
    await seedApprovedShift(user.id, todayIctDateKey());
    const result = await caller(makeCtx('p3-onsite', '10.0.0.55')).checkInOut.punch({});
    expect(result.method).toBe('ip');
    const tickets = await testDbBypass((tx) => tx.manualAttendanceTicket.findMany({ where: { appUserId: user.id } }));
    expect(tickets).toHaveLength(0);
  });

  it('2. offsite lần đầu ngày (có ca), KHÔNG reason → OFFSITE_REASON_REQUIRED, không ghi punch, không phiếu', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-offsite-noreason' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    await seedApprovedShift(user.id, todayIctDateKey());
    await expect(
      caller(makeCtx('p3-offsite-noreason', '10.0.0.1')).checkInOut.punch({}),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', appCode: 'OFFSITE_REASON_REQUIRED' });
    const punches = await testDbBypass((tx) => tx.timePunch.findMany({ where: { appUserId: user.id } }));
    expect(punches).toHaveLength(0);
    const tickets = await testDbBypass((tx) => tx.manualAttendanceTicket.findMany({ where: { appUserId: user.id } }));
    expect(tickets).toHaveLength(0);
  });

  it('3. offsite lần đầu ngày (có ca) + reason → ghi punch withinNetwork=false + tạo phiếu pending checkInAt=punch', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-offsite-reason' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    await seedApprovedShift(user.id, todayIctDateKey());
    const result = await caller(makeCtx('p3-offsite-reason', '10.0.0.1')).checkInOut.punch({
      reason: 'Đi công tác, không vào được mạng công ty',
    });
    expect(result.method).toBe('ip');
    const punch = await testDbBypass((tx) => tx.timePunch.findFirstOrThrow({ where: { appUserId: user.id } }));
    expect(punch.withinNetwork).toBe(false);
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.findFirstOrThrow({ where: { appUserId: user.id } }),
    );
    expect(ticket.status).toBe('pending');
    expect(ticket.note).toBe('Đi công tác, không vào được mạng công ty');
    expect(ticket.checkInAt?.getTime()).toBe(punch.punchAt.getTime());
  });

  it('4. punch thứ 2 cùng ngày (onsite, qua router thật) → phiếu cập nhật checkOutAt=punch2', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-offsite-second' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    await seedApprovedShift(user.id, todayIctDateKey());
    // Seed the state call #1 (offsite + reason) would have produced, far enough
    // in the past to clear the 10s cooldown, so call #2 below is a REAL router
    // call exercising ensureDayTicket's "existing pending ticket" branch.
    const firstPunchAt = new Date(Date.now() - 20_000);
    await testDbBypass((tx) =>
      tx.timePunch.create({
        data: { facilityId, appUserId: user.id, method: 'ip', withinNetwork: false, punchAt: firstPunchAt },
      }),
    );
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: {
          facilityId,
          appUserId: user.id,
          ticketDate: ictToUtc(todayIctDateKey(), '00:00'),
          note: 'first offsite punch',
          checkInAt: firstPunchAt,
        },
      }),
    );
    const result = await caller(makeCtx('p3-offsite-second', '192.168.1.50')).checkInOut.punch({});
    const reread = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
    );
    expect(reread.checkInAt?.getTime()).toBe(firstPunchAt.getTime());
    expect(reread.checkOutAt?.getTime()).toBe(new Date(result.punchAt as unknown as string).getTime());
  });

  it('5. E2 — offsite ngày KHÔNG có đăng ký ca nào → ghi punch, KHÔNG tạo phiếu, KHÔNG bắt reason', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-offsite-noshift' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    // no seedApprovedShift / seedSubmittedShift call — no registration at all.
    const result = await caller(makeCtx('p3-offsite-noshift', '10.0.0.1')).checkInOut.punch({});
    expect(result.method).toBe('ip');
    const punch = await testDbBypass((tx) => tx.timePunch.findFirstOrThrow({ where: { appUserId: user.id } }));
    expect(punch.withinNetwork).toBe(false);
    const tickets = await testDbBypass((tx) => tx.manualAttendanceTicket.findMany({ where: { appUserId: user.id } }));
    expect(tickets).toHaveLength(0);
  });

  it('6. F2 — ngày có ca SUBMITTED (chưa duyệt) + offsite + reason → phiếu vẫn tạo', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-offsite-submitted' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    await seedSubmittedShift(user.id, todayIctDateKey());
    const result = await caller(makeCtx('p3-offsite-submitted', '10.0.0.1')).checkInOut.punch({
      reason: 'ca chưa duyệt nhưng vẫn có đăng ký',
    });
    expect(result.method).toBe('ip');
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.findFirstOrThrow({ where: { appUserId: user.id } }),
    );
    expect(ticket.status).toBe('pending');
  });

  it('7. cơ sở không có FacilityNetwork active → withinNetwork=true (dev-open)', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-open-mode' });
    // no seedFacilityNetwork call.
    const result = await caller(makeCtx('p3-open-mode', '10.0.0.1')).checkInOut.punch({});
    expect(result.method).toBe('ip');
    const punch = await testDbBypass((tx) => tx.timePunch.findFirstOrThrow({ where: { appUserId: user.id } }));
    expect(punch.withinNetwork).toBe(true);
  });

  it('8. staff inactive → FORBIDDEN', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-inactive' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: user.id }, data: { isActive: false } }));
    await expect(caller(makeCtx('p3-inactive', '10.0.0.1')).checkInOut.punch({})).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('9. R1 — phiếu đã approved, punch offsite mới cùng ngày (qua router thật) → checkInAt/checkOutAt phiếu KHÔNG đổi', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-frozen' });
    await seedFacilityNetwork(facilityId, '192.168.1.0/24');
    await seedApprovedShift(user.id, todayIctDateKey());
    // Seed the state an earlier real offsite punch + its ticket would have
    // produced, far enough in the past to clear cooldown.
    const firstPunchAt = new Date(Date.now() - 20_000);
    await testDbBypass((tx) =>
      tx.timePunch.create({
        data: { facilityId, appUserId: user.id, method: 'ip', withinNetwork: false, punchAt: firstPunchAt },
      }),
    );
    const ticket = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: {
          facilityId,
          appUserId: user.id,
          ticketDate: ictToUtc(todayIctDateKey(), '00:00'),
          note: 'first offsite',
          status: 'approved', // a director already reviewed it before the late punch below
          checkInAt: firstPunchAt,
          checkOutAt: firstPunchAt,
        },
      }),
    );
    const frozenCheckIn = ticket.checkInAt;
    const frozenCheckOut = ticket.checkOutAt;
    // A late offsite punch arrives AFTER approval — real router call, no
    // reason needed (ticket already exists), must NOT touch the frozen ticket.
    await caller(makeCtx('p3-frozen', '10.0.0.1')).checkInOut.punch({});
    const reread = await testDbBypass((tx) =>
      tx.manualAttendanceTicket.findUniqueOrThrow({ where: { id: ticket.id } }),
    );
    expect(reread.checkInAt?.getTime()).toBe(frozenCheckIn?.getTime());
    expect(reread.checkOutAt?.getTime()).toBe(frozenCheckOut?.getTime());
    expect(reread.status).toBe('approved');
    // The late punch itself IS recorded (history), just not reflected on the ticket.
    const allPunches = await testDbBypass((tx) => tx.timePunch.findMany({ where: { appUserId: user.id } }));
    expect(allPunches).toHaveLength(2);
  });

  it('10. cooldown 10s: punch lại trong 10s → COOLDOWN', async () => {
    await seedAppUser({ facilityId, userId: 'p3-cooldown10' });
    const ctx = makeCtx('p3-cooldown10', '10.0.0.1');
    await caller(ctx).checkInOut.punch({});
    await expect(caller(ctx).checkInOut.punch({})).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      appCode: 'COOLDOWN',
    });
  });

  it('11. cooldown 10s: punch sau 10.1s (seeded) → thành công', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p3-cooldown10-past' });
    const wellPast = new Date(Date.now() - 10_100);
    await testDbBypass((tx) =>
      tx.timePunch.create({ data: { facilityId, appUserId: user.id, method: 'ip', punchAt: wellPast } }),
    );
    const result = await caller(makeCtx('p3-cooldown10-past', '10.0.0.1')).checkInOut.punch({});
    expect(result.method).toBe('ip');
  });

  it('12. punch không có profile trong facility → FORBIDDEN', async () => {
    await expect(
      caller(makeCtx('p3-no-profile', '10.0.0.1')).checkInOut.punch({}),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
