// Checkin router — P3-I HR/time-punch (US-021, WF-P3-01).
//
// checkInOut.punch     — clock in/out (appended as TimePunch).
//   - Resolves AppUser by ctx.subject.userId + facilityId.
//   - If active FacilityNetwork rows exist, caller IP must match one; else
//     open mode (no networks → any IP allowed, useful for dev).
//   - 5-minute cooldown prevents double-punches.
//   - IP-mismatch / cooldown errors carry `appCode` (IP_NOT_ALLOWED /
//     COOLDOWN) via `AppCodeError` — trpc.ts's errorFormatter copies it onto
//     `shape.data` so a UI can branch without string-matching `message`.
//
// manualPunch.create   — submit a manual punch ticket for a calendar date.
// manualPunch.approve  — direct manager approves (anti-self-approve); also
//   allows super_admin to review ANY ticket (HR remediation phase 4, R2 #H2)
//   — otherwise a ticket whose owner has no manager (e.g. a director) could
//   never be approved by anyone. HR remediation phase 2 (red-team #13): if
//   the ticket's own ICT-month period already has a FINALIZED Payslip, the
//   ticket is still approved (a late-arriving correction should not be
//   silently dropped) but the response carries `warning: 'PAYSLIP_FINALIZED'`
//   so the UI can prompt a director to reopen the period if they want the
//   penalty recomputed — approving here does NOT itself touch the payslip.
// manualPunch.reject   — same gate as approve.
// manualPunch.list     — `{scope:'inbox'|'mine', status?}`. `inbox` returns
//   tickets of the caller's direct reports (or all, for super_admin); `mine`
//   returns the caller's own tickets. Both are self-scoped reads, no
//   dedicated permission key (any active staff session).
//
// All writes are facility-scoped via `withFacility` (ADR 0042).
// TimePunch is append-only: cmc_app has no DELETE/UPDATE grant (migration).

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { ipMatchesCidr } from '@cmc/domain-identity';
import { ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { AppCodeError, badRequest, forbidden, notFound } from '../errors.js';
import { protectedProcedure, requirePermission, router, scoped } from '../trpc.js';

const PUNCH_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const manualPunchCreateInput = z.object({
  ticketDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  note: z.string().max(2000).default(''),
});

const reviewInput = z.object({
  ticketId: z.string().uuid(),
  note: z.string().max(2000).default(''),
});

const listInput = z.object({
  scope: z.enum(['inbox', 'mine']),
  status: z.string().optional(),
});

export const checkInOutRouter = router({
  punch: requirePermission('checkIn', 'punch')
    .mutation(async ({ ctx }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Resolve AppUser from auth userId + facility
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');
        if (!appUser.isActive) throw forbidden('Staff account is deactivated.');

        // IP gate: if any active FacilityNetwork rows exist, caller IP must match
        const networks = await tx.facilityNetwork.findMany({
          where: { facilityId, isActive: true },
        });
        if (networks.length > 0) {
          const callerIp = ctx.ip ?? '';
          const matched = networks.some((n) => ipMatchesCidr(callerIp, n.cidr));
          if (!matched) {
            throw new AppCodeError({
              code: 'FORBIDDEN',
              appCode: 'IP_NOT_ALLOWED',
              message:
                'IP address not in any authorized network. Submit a manual punch request instead.',
            });
          }
        }
        // method is always 'ip' in this implementation; 'manual' means the
        // ticket flow (manualPunch.create), not a punch method.
        const method = 'ip';

        // Serialize concurrent punches per user: lock the AppUser row so two
        // concurrent requests for the same user both see the same state and
        // the second one waits until the first commits (READ COMMITTED default
        // would otherwise let both read "no recent punch" before either writes).
        await tx.$executeRaw`SELECT 1 FROM "AppUser" WHERE id = ${appUser.id} FOR UPDATE`;

        // Cooldown: prevent double-punching within 5 minutes
        const recentCutoff = new Date(Date.now() - PUNCH_COOLDOWN_MS);
        const recent = await tx.timePunch.findFirst({
          where: { appUserId: appUser.id, punchAt: { gte: recentCutoff } },
          orderBy: { punchAt: 'desc' },
        });
        if (recent) {
          throw new AppCodeError({
            code: 'BAD_REQUEST',
            appCode: 'COOLDOWN',
            message: 'Cooldown: last punch was less than 5 minutes ago.',
          });
        }

        const punch = await tx.timePunch.create({
          data: {
            facilityId,
            appUserId: appUser.id,
            method,
            ip: ctx.ip ?? null,
          },
        });
        return { id: punch.id, punchAt: punch.punchAt, method: punch.method };
      });
    }),
});

export const manualPunchRouter = router({
  create: requirePermission('manualPunch', 'create')
    .input(manualPunchCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');

        const ticketDateUtc = ictToUtc(input.ticketDate, '00:00');

        // Upsert semantics: if last ticket for (appUserId, ticketDate) was
        // rejected, this creates a `resubmitted` ticket; if it was pending,
        // it's a duplicate (reject with BAD_REQUEST); otherwise create fresh.
        const existing = await tx.manualAttendanceTicket.findFirst({
          where: { appUserId: appUser.id, ticketDate: ticketDateUtc },
          orderBy: { createdAt: 'desc' },
        });
        if (existing && existing.status === 'pending') {
          throw badRequest('A pending ticket already exists for this date.');
        }
        const ticket = await tx.manualAttendanceTicket.create({
          data: {
            facilityId,
            appUserId: appUser.id,
            ticketDate: ticketDateUtc,
            status:
              existing && existing.status === 'rejected' ? 'resubmitted' : 'pending',
            note: input.note,
          },
        });
        return ticket;
      });
    }),

  approve: requirePermission('manualPunch', 'approve')
    .input(reviewInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const ticket = await tx.manualAttendanceTicket.findFirst({
          where: { id: input.ticketId, facilityId },
        });
        if (!ticket) throw notFound('Ticket not found.');
        if (ticket.status !== 'pending' && ticket.status !== 'resubmitted') {
          throw badRequest('Ticket is not pending.');
        }

        // Only the ticket owner's direct manager may approve (anti-self-approve),
        // OR super_admin (R2 #H2: otherwise a ticket whose owner has no manager
        // — e.g. a director — could never be approved by anyone).
        const reviewer = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        const isSuperAdmin = ctx.subject!.roles.includes('super_admin');
        const owner = await tx.appUser.findFirst({ where: { id: ticket.appUserId, facilityId } });
        if (!owner) throw notFound('Ticket owner not found.');
        if (owner.managerId !== reviewer?.id && !isSuperAdmin) {
          throw forbidden('Only the direct manager can approve this ticket.');
        }

        const updated = await tx.manualAttendanceTicket.update({
          where: { id: ticket.id },
          data: {
            status: 'approved',
            reviewedById: reviewer?.id ?? null,
            reviewedAt: new Date(),
            note: input.note || ticket.note,
          },
        });

        // Red-team #13: warn (do not block) when this ticket's period was
        // already finalized — the payslip is NOT recomputed here.
        const period = ictDateOnlyOf(ticket.ticketDate).slice(0, 7);
        const finalizedPayslip = await tx.payslip.findFirst({
          where: { appUserId: ticket.appUserId, period, status: 'finalized' },
          select: { id: true },
        });
        if (finalizedPayslip) {
          return { ...updated, warning: 'PAYSLIP_FINALIZED' as const };
        }
        return updated;
      });
    }),

  reject: requirePermission('manualPunch', 'approve')
    .input(reviewInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const ticket = await tx.manualAttendanceTicket.findFirst({
          where: { id: input.ticketId, facilityId },
        });
        if (!ticket) throw notFound('Ticket not found.');
        if (ticket.status !== 'pending' && ticket.status !== 'resubmitted') {
          throw badRequest('Ticket is not pending.');
        }

        const reviewer = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        const isSuperAdmin = ctx.subject!.roles.includes('super_admin');
        const owner = await tx.appUser.findFirst({ where: { id: ticket.appUserId, facilityId } });
        if (!owner) throw notFound('Ticket owner not found.');
        if (owner.managerId !== reviewer?.id && !isSuperAdmin) {
          throw forbidden('Only the direct manager can reject this ticket.');
        }

        return tx.manualAttendanceTicket.update({
          where: { id: ticket.id },
          data: {
            status: 'rejected',
            reviewedById: reviewer?.id ?? null,
            reviewedAt: new Date(),
            note: input.note || ticket.note,
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // manualPunch.list — inbox (direct reports' tickets) or mine (own tickets)
  // -------------------------------------------------------------------------
  list: protectedProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        const statusFilter = input.status ? { status: input.status } : {};

        if (input.scope === 'mine') {
          if (!caller) throw forbidden('Staff profile not found in this facility.');
          return tx.manualAttendanceTicket.findMany({
            where: { facilityId, appUserId: caller.id, ...statusFilter },
            orderBy: { createdAt: 'desc' },
          });
        }

        // inbox: super_admin sees every ticket; everyone else sees only
        // their direct reports' tickets (same gate as approve/reject).
        const isSuperAdmin = ctx.subject!.roles.includes('super_admin');
        if (!isSuperAdmin && !caller) throw forbidden('Staff profile not found in this facility.');
        return tx.manualAttendanceTicket.findMany({
          where: {
            facilityId,
            ...statusFilter,
            ...(isSuperAdmin ? {} : { appUser: { managerId: caller!.id } }),
          },
          include: { appUser: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        });
      });
    }),
});
