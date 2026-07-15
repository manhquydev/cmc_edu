// manualPunch.approve/reject/list/resubmit — GĐ track authorization
// (ADR 0043 phase 4). Replaces managerId-based approval.
// plans/260713-1706-attendance-daily-inout-pairing/phase-04-backend-ticket-approval-track.md

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@cmc/auth';
import { ictToUtc } from '@cmc/domain-time';
import { appRouter } from '../router.js';
import { buildStaffContext, cleanupFacility, createTestFacility, seedAppUser, testDbBypass } from '../test/db.js';

describe('manualPunch.approve/reject/list/resubmit — GĐ track (ADR 0043 phase 4)', () => {
  let facilityId: string;

  const ctxFor = (userId: string, roles: Role[]) => buildStaffContext({ facilityId, userId, roles });
  const caller = (ctx: ReturnType<typeof buildStaffContext>) => appRouter.createCaller(ctx);

  beforeEach(async () => {
    const f = await createTestFacility('P4 Approval Track Test');
    facilityId = f.id;
  });

  afterEach(async () => {
    await cleanupFacility(facilityId);
  });

  async function seedTicket(appUserId: string, dateKey: string, status = 'pending') {
    return testDbBypass((tx) =>
      tx.manualAttendanceTicket.create({
        data: { facilityId, appUserId, ticketDate: ictToUtc(dateKey, '00:00'), status, note: 'offsite' },
      }),
    );
  }

  it('1. sale phiếu → GĐKD approve OK; GĐĐT approve → FORBIDDEN', async () => {
    const sale = await seedAppUser({ facilityId, userId: 'p4-sale-1' });
    const ticket = await seedTicket(sale.id, '2026-08-01');
    await testDbBypass((tx) => tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }));

    const gddt = ctxFor('p4-gddt-wrong', ['giam_doc_dao_tao']);
    await expect(caller(gddt).manualPunch.approve({ ticketId: ticket.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const gdkd = ctxFor('p4-gdkd-right', ['giam_doc_kinh_doanh']);
    const approved = await caller(gdkd).manualPunch.approve({ ticketId: ticket.id });
    expect(approved.status).toBe('approved');
  });

  it('2. giáo viên phiếu → GĐĐT approve OK; GĐKD approve → FORBIDDEN', async () => {
    const gv = await seedAppUser({ facilityId, userId: 'p4-gv-1' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: gv.id }, data: { roles: ['giao_vien'] } }));
    const ticket = await seedTicket(gv.id, '2026-08-02');

    const gdkd = ctxFor('p4-gdkd-wrong', ['giam_doc_kinh_doanh']);
    await expect(caller(gdkd).manualPunch.reject({ ticketId: ticket.id, note: 'no' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const gddt = ctxFor('p4-gddt-right', ['giam_doc_dao_tao']);
    const rejected = await caller(gddt).manualPunch.reject({ ticketId: ticket.id, note: 'thiếu chứng từ' });
    expect(rejected.status).toBe('rejected');
  });

  it('3. anti-self: người vừa sale vừa GĐKD không duyệt phiếu của chính mình', async () => {
    const user = await seedAppUser({ facilityId, userId: 'p4-self' });
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: user.id }, data: { roles: ['sale', 'giam_doc_kinh_doanh'] } }),
    );
    const ticket = await seedTicket(user.id, '2026-08-03');
    const ctx = ctxFor('p4-self', ['sale', 'giam_doc_kinh_doanh']);
    await expect(caller(ctx).manualPunch.approve({ ticketId: ticket.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('4. super_admin approve mọi phiếu OK (kể cả track khác)', async () => {
    const gv = await seedAppUser({ facilityId, userId: 'p4-gv-super' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: gv.id }, data: { roles: ['giao_vien'] } }));
    const ticket = await seedTicket(gv.id, '2026-08-04');
    const superCtx = ctxFor('p4-super', ['super_admin']);
    const approved = await caller(superCtx).manualPunch.approve({ ticketId: ticket.id });
    expect(approved.status).toBe('approved');
  });

  it('5. approve phiếu không pending/resubmitted → BAD_REQUEST', async () => {
    const sale = await seedAppUser({ facilityId, userId: 'p4-notpending' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }));
    const ticket = await seedTicket(sale.id, '2026-08-05', 'approved');
    const gdkd = ctxFor('p4-gdkd-notpending', ['giam_doc_kinh_doanh']);
    await expect(caller(gdkd).manualPunch.approve({ ticketId: ticket.id })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('6. reject → rejected; resubmit(reason) bởi chủ phiếu → resubmitted, note đổi', async () => {
    const sale = await seedAppUser({ facilityId, userId: 'p4-resubmit-owner' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }));
    const ticket = await seedTicket(sale.id, '2026-08-06');
    const gdkd = ctxFor('p4-gdkd-reject', ['giam_doc_kinh_doanh']);
    await caller(gdkd).manualPunch.reject({ ticketId: ticket.id, note: 'thiếu' });

    const ownerCtx = ctxFor('p4-resubmit-owner', ['sale']);
    const resubmitted = await caller(ownerCtx).manualPunch.resubmit({
      ticketId: ticket.id,
      reason: 'đã bổ sung minh chứng',
    });
    expect(resubmitted.status).toBe('resubmitted');
    expect(resubmitted.note).toBe('đã bổ sung minh chứng');
  });

  it('6b. resubmit bởi người khác (không phải chủ phiếu) → FORBIDDEN', async () => {
    const sale = await seedAppUser({ facilityId, userId: 'p4-resubmit-owner2' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }));
    const ticket = await seedTicket(sale.id, '2026-08-07', 'rejected');
    const otherCtx = ctxFor('p4-resubmit-other', ['sale']);
    await expect(
      caller(otherCtx).manualPunch.resubmit({ ticketId: ticket.id, reason: 'not mine' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('6c. resubmit phiếu không rejected → BAD_REQUEST', async () => {
    const sale = await seedAppUser({ facilityId, userId: 'p4-resubmit-notrejected' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }));
    const ticket = await seedTicket(sale.id, '2026-08-08', 'pending');
    const ownerCtx = ctxFor('p4-resubmit-notrejected', ['sale']);
    await expect(
      caller(ownerCtx).manualPunch.resubmit({ ticketId: ticket.id, reason: 'x' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('7. manualPunch.create không còn tồn tại', () => {
    expect((appRouter.manualPunch as unknown as Record<string, unknown>)['create']).toBeUndefined();
  });

  it('8. inbox: GĐKD chỉ thấy phiếu chủ là sale; GĐĐT chỉ thấy phiếu chủ là giáo viên; super_admin thấy tất cả', async () => {
    const sale = await seedAppUser({ facilityId, userId: 'p4-inbox-sale' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }));
    const gv = await seedAppUser({ facilityId, userId: 'p4-inbox-gv' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: gv.id }, data: { roles: ['giao_vien'] } }));
    await seedTicket(sale.id, '2026-08-09');
    await seedTicket(gv.id, '2026-08-09');

    const gdkdInbox = await caller(ctxFor('p4-inbox-gdkd', ['giam_doc_kinh_doanh'])).manualPunch.list({
      scope: 'inbox',
    });
    expect(gdkdInbox).toHaveLength(1);
    expect((gdkdInbox[0] as { appUserId: string }).appUserId).toBe(sale.id);

    const gddtInbox = await caller(ctxFor('p4-inbox-gddt', ['giam_doc_dao_tao'])).manualPunch.list({
      scope: 'inbox',
    });
    expect(gddtInbox).toHaveLength(1);
    expect((gddtInbox[0] as { appUserId: string }).appUserId).toBe(gv.id);

    const superInbox = await caller(ctxFor('p4-inbox-super', ['super_admin'])).manualPunch.list({
      scope: 'inbox',
    });
    expect(superInbox.length).toBeGreaterThanOrEqual(2);
  });

  it('9. TOCTOU: 2 GĐ approve cùng phiếu đồng thời → 1 OK, 1 BAD_REQUEST', async () => {
    const sale = await seedAppUser({ facilityId, userId: 'p4-toctou' });
    await testDbBypass((tx) => tx.appUser.update({ where: { id: sale.id }, data: { roles: ['sale'] } }));
    const ticket = await seedTicket(sale.id, '2026-08-10');
    const gdkd1 = ctxFor('p4-toctou-gdkd1', ['giam_doc_kinh_doanh']);
    const gdkd2 = ctxFor('p4-toctou-gdkd2', ['giam_doc_kinh_doanh']);
    const results = await Promise.allSettled([
      caller(gdkd1).manualPunch.approve({ ticketId: ticket.id }),
      caller(gdkd2).manualPunch.approve({ ticketId: ticket.id }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it('10. chủ phiếu role null (không sale/giao_vien) → chỉ super_admin duyệt được', async () => {
    const director = await seedAppUser({ facilityId, userId: 'p4-director-owner' });
    await testDbBypass((tx) =>
      tx.appUser.update({ where: { id: director.id }, data: { roles: ['giam_doc_kinh_doanh'] } }),
    );
    const ticket = await seedTicket(director.id, '2026-08-11');

    const gddtCtx = ctxFor('p4-director-gddt', ['giam_doc_dao_tao']);
    await expect(caller(gddtCtx).manualPunch.approve({ ticketId: ticket.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    const superCtx = ctxFor('p4-director-super', ['super_admin']);
    const approved = await caller(superCtx).manualPunch.approve({ ticketId: ticket.id });
    expect(approved.status).toBe('approved');
  });
});
