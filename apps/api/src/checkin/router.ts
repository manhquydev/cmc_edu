// Checkin router — P3-I HR/time-punch (US-021, WF-P3-01), rewritten for the
// daily in/out pairing model (ADR 0043, docs/decisions/0043-attendance-daily-inout-pairing.md).
//
// checkInOut.punch     — clock in/out (appended as TimePunch).
//   - Resolves AppUser by ctx.subject.userId + facilityId.
//   - Computes `withinNetwork`: true if no active FacilityNetwork rows exist
//     (open/dev mode) OR caller IP matches one. Offsite is NO LONGER
//     rejected (pre-0043 behavior) — the punch is always recorded.
//   - 10-second cooldown (was 5 minutes) prevents accidental double-taps.
//   - If today (ICT) has any registered shift (submitted OR approved — F2:
//     approved-only would lose credit for a shift the director approves
//     AFTER the employee already punched) AND any offsite punch exists for
//     the day, `ensureDayTicket` creates-or-updates a `pending`
//     ManualAttendanceTicket carrying the day's first/last punch as
//     checkInAt/checkOutAt. The FIRST offsite punch of a day with no
//     existing ticket requires `reason` (appCode OFFSITE_REASON_REQUIRED if
//     missing) — subsequent punches that day never require it again.
//   - R1 (freeze on review): once a ticket leaves pending/resubmitted
//     (approved/rejected), `ensureDayTicket` updates it conditionally
//     (`WHERE status IN (pending,resubmitted)`) so a later punch can never
//     retroactively change a reviewed ticket's checkInAt/checkOutAt — the
//     punch itself still gets recorded, just not reflected on the ticket.
//   - Cooldown/offsite-reason errors carry `appCode` (COOLDOWN /
//     OFFSITE_REASON_REQUIRED) via `AppCodeError` — trpc.ts's errorFormatter
//     copies it onto `shape.data` so a UI can branch without string-matching
//     `message`.
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
// manualPunch.get      — cold-start form by UUID (owner OR GĐ-track reviewer /
//   super_admin); includes appUser for EntityHeader.
// manualPunch.list     — `{scope:'inbox'|'mine', status?}`. `inbox` returns
//   tickets of the caller's direct reports (or all, for super_admin); `mine`
//   returns the caller's own tickets. Both are self-scoped reads, no
//   dedicated permission key (any active staff session).
//
// All writes are facility-scoped via `withFacility` (ADR 0042).
// TimePunch is append-only: cmc_app has no DELETE/UPDATE grant (migration).

import { z } from 'zod';
import { withFacility, type Prisma } from '@cmc/db';
import { ipMatchesCidr } from '@cmc/domain-identity';
import { addDaysToDateOnly, ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { resolveTargetRole, trackDirectorRole } from '../attendance/resolve-target-role.js';
import { AppCodeError, badRequest, forbidden, notFound } from '../errors.js';
import { protectedProcedure, requirePermission, router, scoped } from '../trpc.js';
import { haversineDistanceM } from './geo-distance.js';

const PUNCH_COOLDOWN_MS = 10 * 1000; // ADR 0043: 10 seconds (was 5 minutes)

const geoInput = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().min(0).max(100_000),
  })
  .optional();

const punchInput = z
  .object({
    /** Required only for the first offsite punch of a day that has no ticket yet. */
    reason: z.string().max(2000).optional(),
    /** Optional GPS capture — never required; denied/timeout omit this field. */
    geo: geoInput,
  })
  .default({});

/**
 * ADR 0043 — after a punch is recorded, checks whether today needs a
 * ManualAttendanceTicket and creates/updates it. Runs inside the same
 * transaction as the punch write, under the AppUser row lock already taken
 * by the caller, so it observes a consistent view of the day's punches.
 *
 * `hasShift` is computed ONCE by the caller (`checkInOutRouter.punch`) and
 * threaded through here rather than re-queried — code-review finding (b):
 * two independent reads of the same shift-registration state within one
 * transaction left a (narrow, READ COMMITTED) window where a shift
 * committed between the reads could desync the pre-write reason gate from
 * this function's ticket-creation decision. A single shared read closes it.
 */
async function ensureDayTicket(
  tx: Prisma.TransactionClient,
  params: { facilityId: string; appUserId: string; dateKey: string; hasShift: boolean; reason: string | undefined },
): Promise<void> {
  const { facilityId, appUserId, dateKey, hasShift, reason } = params;
  if (!hasShift) return; // E2: no registered shift today → punch stands alone, no ticket.

  const dayStart = ictToUtc(dateKey, '00:00');
  const dayEnd = ictToUtc(addDaysToDateOnly(dateKey, 1), '00:00');

  const dayPunches = await tx.timePunch.findMany({
    where: { appUserId, punchAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { punchAt: 'asc' },
  });
  const anyOffsite = dayPunches.some((p) => !p.withinNetwork);
  if (!anyOffsite) return;

  const checkInAt = dayPunches[0]!.punchAt;
  const checkOutAt = dayPunches.length >= 2 ? dayPunches[dayPunches.length - 1]!.punchAt : null;

  const existing = await tx.manualAttendanceTicket.findUnique({
    where: { appUserId_ticketDate: { appUserId, ticketDate: dayStart } },
  });

  if (!existing) {
    // Code-review note (transitional, self-resolving at phase 4): a genuinely
    // concurrent `manualPunch.create` call for the same (appUserId, date) can
    // still race this insert on the unique(appUserId,ticketDate) constraint
    // (P2002) — narrow window, both writers targeting the exact same day.
    // Not caught here because `manualPunch.create` (the only other writer to
    // this table) is REMOVED entirely in phase 4 of this same plan, closing
    // the race at its source rather than papering over it with savepoint
    // handling for a window that stops existing in the next phase.
    await tx.manualAttendanceTicket.create({
      data: { facilityId, appUserId, ticketDate: dayStart, note: reason ?? '', checkInAt, checkOutAt },
    });
    return;
  }

  // R1: only update while still under review — a punch arriving after the
  // ticket left pending/resubmitted must never retroactively change it.
  await tx.manualAttendanceTicket.updateMany({
    where: { id: existing.id, status: { in: ['pending', 'resubmitted'] } },
    data: { checkInAt, checkOutAt },
  });
}

const reviewInput = z.object({
  ticketId: z.string().uuid(),
  note: z.string().max(2000).default(''),
});

const resubmitInput = z.object({
  ticketId: z.string().uuid(),
  reason: z.string().min(1).max(2000),
});

const listInput = z.object({
  scope: z.enum(['inbox', 'mine']),
  status: z.string().optional(),
});

/**
 * Boolean form of the ticket review gate (no throw). Used by dayPunches so a
 * denied read keeps a FORBIDDEN message about read access, not approve/reject.
 */
function canReviewTicket(params: {
  reviewerId: string | undefined;
  reviewerRoles: readonly string[];
  ownerId: string;
  ownerRoles: readonly string[];
}): boolean {
  const { reviewerId, reviewerRoles, ownerId, ownerRoles } = params;
  if (reviewerId === ownerId) return false;
  if (reviewerRoles.includes('super_admin')) return true;
  const requiredDirectorRole = trackDirectorRole(resolveTargetRole(ownerRoles));
  return requiredDirectorRole !== null && reviewerRoles.includes(requiredDirectorRole);
}

/**
 * ADR 0043 phase 4 — anti-self + GĐ-track authorization for reviewing a
 * ManualAttendanceTicket. Replaces the pre-0043 `managerId`-based gate.
 * `super_admin` bypasses; a track-less owner (director/super_admin, no
 * sale/giao_vien role) can then ONLY be reviewed by `super_admin` — same
 * "otherwise nobody could ever review it" rationale the old managerId gate
 * used for a manager-less owner (HR remediation phase 4, R2 #H2).
 */
function assertCanReviewTicket(params: {
  reviewerId: string | undefined;
  reviewerRoles: readonly string[];
  ownerId: string;
  ownerRoles: readonly string[];
  action: 'approve' | 'reject';
}): void {
  const { reviewerId, reviewerRoles, ownerId, ownerRoles, action } = params;
  if (reviewerId === ownerId) {
    throw forbidden(`Cannot ${action} your own manual attendance ticket.`);
  }
  if (reviewerRoles.includes('super_admin')) return;
  const requiredDirectorRole = trackDirectorRole(resolveTargetRole(ownerRoles));
  if (requiredDirectorRole === null || !reviewerRoles.includes(requiredDirectorRole)) {
    throw forbidden(`Director branch scope: cannot ${action} a ticket outside your track.`);
  }
}

export const checkInOutRouter = router({
  punch: requirePermission('checkIn', 'punch')
    .input(punchInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Resolve AppUser from auth userId + facility
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');
        if (!appUser.isActive) throw forbidden('Staff account is deactivated.');

        // Serialize concurrent punches per user: lock the AppUser row so two
        // concurrent requests for the same user both see the same state and
        // the second one waits until the first commits (READ COMMITTED default
        // would otherwise let both read "no recent punch" before either writes).
        await tx.$executeRaw`SELECT 1 FROM "AppUser" WHERE id = ${appUser.id} FOR UPDATE`;

        // Cooldown: prevent accidental double-taps within 10 seconds.
        const recentCutoff = new Date(Date.now() - PUNCH_COOLDOWN_MS);
        const recent = await tx.timePunch.findFirst({
          where: { appUserId: appUser.id, punchAt: { gte: recentCutoff } },
          orderBy: { punchAt: 'desc' },
        });
        if (recent) {
          throw new AppCodeError({
            code: 'BAD_REQUEST',
            appCode: 'COOLDOWN',
            message: 'Cooldown: last punch was less than 10 seconds ago.',
          });
        }

        // Gate OR per configured branch (geofence GPS plan):
        // openMode = 0 network active AND 0 geofence active → within (legacy open).
        // Network branch only when ≥1 active network; geo only when ≥1 active geofence.
        const networks = await tx.facilityNetwork.findMany({
          where: { facilityId, isActive: true },
        });
        const geofences = await tx.facilityGeofence.findMany({
          where: { facilityId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        const openMode = networks.length === 0 && geofences.length === 0;
        const callerIp = ctx.ip ?? '';
        const ipMatch =
          networks.length > 0 && networks.some((n) => ipMatchesCidr(callerIp, n.cidr));

        type Snapshot = {
          matchedGeofenceId: string | null;
          geofenceDistanceM: number | null;
          matchedRadiusM: number | null;
          matchedAccuracyMaxM: number | null;
        };
        let snapshot: Snapshot = {
          matchedGeofenceId: null,
          geofenceDistanceM: null,
          matchedRadiusM: null,
          matchedAccuracyMaxM: null,
        };
        if (input.geo && geofences.length > 0) {
          const withDist = geofences.map((g) => ({
            g,
            d: haversineDistanceM(input.geo!, { lat: g.lat, lng: g.lng }),
          }));
          const matched = withDist.find(
            ({ g, d }) => d <= g.radiusM && input.geo!.accuracyM <= g.accuracyMaxM,
          );
          const chosen = matched ?? withDist.reduce((a, b) => (a.d <= b.d ? a : b));
          snapshot = {
            matchedGeofenceId: matched ? matched.g.id : null,
            geofenceDistanceM: chosen.d,
            matchedRadiusM: chosen.g.radiusM,
            matchedAccuracyMaxM: chosen.g.accuracyMaxM,
          };
        }
        const geoMatch = snapshot.matchedGeofenceId !== null;
        const withinNetwork = openMode || ipMatch || geoMatch;
        // Network wins over geo when both match; open ≠ network (no claim of proof).
        const verification = ipMatch
          ? 'network'
          : geoMatch
            ? 'geo'
            : openMode
              ? 'open'
              : 'none';

        const now = new Date();
        const dateKey = ictDateOnlyOf(now);
        const dayStart = ictToUtc(dateKey, '00:00');

        // Computed ONCE and shared with ensureDayTicket below (code-review
        // finding (b) — a second independent read of the same state could
        // desync from this gate's decision within the same transaction).
        const hasShiftToday = await tx.shiftRegistrationEntry.findFirst({
          where: {
            facilityId,
            date: dayStart,
            shiftRegistration: { appUserId: appUser.id, status: { in: ['submitted', 'approved'] } },
          },
          select: { id: true },
        });
        const hasShift = hasShiftToday !== null;

        // Pre-write reason gate: only the first OFFSITE punch of a day that
        // (a) has a registered shift and (b) has no ticket yet requires a
        // reason. Checked BEFORE creating the punch so a missing reason never
        // leaves an orphaned TimePunch behind.
        // appData.geoThresholdM only — never distance/coords (anti-oracle).
        if (!withinNetwork && !input.reason && hasShift) {
          const existingTicket = await tx.manualAttendanceTicket.findUnique({
            where: { appUserId_ticketDate: { appUserId: appUser.id, ticketDate: dayStart } },
          });
          if (!existingTicket) {
            const geoThresholdM =
              geofences.length > 0
                ? Math.max(...geofences.map((g) => g.accuracyMaxM))
                : undefined;
            throw new AppCodeError({
              code: 'BAD_REQUEST',
              appCode: 'OFFSITE_REASON_REQUIRED',
              message: 'Ngoài mạng cơ sở — cần nhập lý do cho lần chấm công đầu tiên trong ngày.',
              ...(geoThresholdM !== undefined ? { appData: { geoThresholdM } } : {}),
            });
          }
        }

        const punch = await tx.timePunch.create({
          data: {
            facilityId,
            appUserId: appUser.id,
            // Capture channel is secondary; admission path is `verification`.
            method: ipMatch ? 'ip' : geoMatch ? 'geo' : 'ip',
            ip: ctx.ip ?? null,
            withinNetwork,
            verification,
            lat: input.geo?.lat ?? null,
            lng: input.geo?.lng ?? null,
            accuracyM: input.geo?.accuracyM ?? null,
            matchedGeofenceId: snapshot.matchedGeofenceId,
            geofenceDistanceM: snapshot.geofenceDistanceM,
            matchedRadiusM: snapshot.matchedRadiusM,
            matchedAccuracyMaxM: snapshot.matchedAccuracyMaxM,
          },
        });

        await ensureDayTicket(tx, { facilityId, appUserId: appUser.id, dateKey, hasShift, reason: input.reason });

        return {
          id: punch.id,
          punchAt: punch.punchAt,
          method: punch.method,
          verification: punch.verification,
          withinNetwork: punch.withinNetwork,
        };
      });
    }),

  /**
   * Count geo-labeled punches per staff over N days — surface for all-geo days
   * that never produce a ticket (reviewers with manualPunch.approve).
   * No role filter on staff; excludes the caller's own AppUser row when present.
   */
  geoPunchSummary: requirePermission('manualPunch', 'approve')
    .input(z.object({ days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const cutoff = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
          select: { id: true },
        });

        const punches = await tx.timePunch.findMany({
          where: {
            facilityId,
            verification: 'geo',
            punchAt: { gte: cutoff },
            ...(caller ? { appUserId: { not: caller.id } } : {}),
          },
          select: { appUserId: true, punchAt: true },
          orderBy: { punchAt: 'desc' },
        });

        const byUser = new Map<string, { geoPunchCount: number; lastGeoPunchAt: Date }>();
        for (const p of punches) {
          const existing = byUser.get(p.appUserId);
          if (!existing) {
            byUser.set(p.appUserId, { geoPunchCount: 1, lastGeoPunchAt: p.punchAt });
          } else {
            existing.geoPunchCount += 1;
          }
        }

        if (byUser.size === 0) return [];

        const users = await tx.appUser.findMany({
          where: { id: { in: [...byUser.keys()] }, facilityId },
          select: { id: true, fullName: true },
        });
        const nameById = new Map(users.map((u) => [u.id, u.fullName]));

        return [...byUser.entries()]
          .map(([appUserId, stats]) => ({
            appUserId,
            fullName: nameById.get(appUserId) ?? '',
            geoPunchCount: stats.geoPunchCount,
            lastGeoPunchAt: stats.lastGeoPunchAt,
          }))
          .sort((a, b) => b.geoPunchCount - a.geoPunchCount);
      });
    }),
});

export const manualPunchRouter = router({
  // manualPunch.create was REMOVED in ADR 0043 phase 4: tickets are now only
  // ever created automatically by checkInOut.punch's ensureDayTicket (an
  // offsite punch on a day with a registered shift) — there is no more
  // "chấm bù ngày quên" path (ADR 0043 §10 quyết định). A rejected ticket is
  // corrected via manualPunch.resubmit instead of creating a second row.

  approve: requirePermission('manualPunch', 'approve')
    .input(reviewInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const ticket = await tx.manualAttendanceTicket.findFirst({
          where: { id: input.ticketId, facilityId },
        });
        if (!ticket) throw notFound('Ticket not found.');

        const reviewer = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        const owner = await tx.appUser.findFirst({ where: { id: ticket.appUserId, facilityId } });
        if (!owner) throw notFound('Ticket owner not found.');
        assertCanReviewTicket({
          reviewerId: reviewer?.id,
          reviewerRoles: ctx.subject!.roles,
          ownerId: owner.id,
          ownerRoles: owner.roles,
          action: 'approve',
        });

        // TOCTOU guard (red-team, phase 4): conditional UPDATE instead of a
        // read-then-write — a concurrent second approve/reject on the same
        // ticket matches 0 rows here instead of double-applying.
        const result = await tx.manualAttendanceTicket.updateMany({
          where: { id: ticket.id, facilityId, status: { in: ['pending', 'resubmitted'] } },
          data: {
            status: 'approved',
            reviewedById: reviewer?.id ?? null,
            reviewedAt: new Date(),
            note: input.note || ticket.note,
          },
        });
        if (result.count === 0) throw badRequest('Ticket is not pending.');
        const updated = await tx.manualAttendanceTicket.findUniqueOrThrow({ where: { id: ticket.id } });

        const warnings: string[] = [];

        // Red-team #13 (pre-0043, unchanged): warn (do not block) when this
        // ticket's period was already finalized — the payslip is NOT
        // recomputed here.
        const period = ictDateOnlyOf(ticket.ticketDate).slice(0, 7);
        const finalizedPayslip = await tx.payslip.findFirst({
          where: { appUserId: ticket.appUserId, period, status: 'finalized' },
          select: { id: true },
        });
        if (finalizedPayslip) warnings.push('PAYSLIP_FINALIZED');

        // C2 (scenario audit, 2026-07-15): a single-punch ticket (checkOutAt
        // still null) is approved as-is — resolveDayCredit's 0-credit rule
        // for this case is intentional (ADR 0043) and stays unchanged. This
        // only signals the reviewer that "approved" here does NOT mean the
        // day earns credit.
        if (updated.checkOutAt === null) warnings.push('SINGLE_PUNCH_NO_CREDIT');

        return { ...updated, warnings };
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

        const reviewer = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        const owner = await tx.appUser.findFirst({ where: { id: ticket.appUserId, facilityId } });
        if (!owner) throw notFound('Ticket owner not found.');
        assertCanReviewTicket({
          reviewerId: reviewer?.id,
          reviewerRoles: ctx.subject!.roles,
          ownerId: owner.id,
          ownerRoles: owner.roles,
          action: 'reject',
        });

        const result = await tx.manualAttendanceTicket.updateMany({
          where: { id: ticket.id, facilityId, status: { in: ['pending', 'resubmitted'] } },
          data: {
            status: 'rejected',
            reviewedById: reviewer?.id ?? null,
            reviewedAt: new Date(),
            note: input.note || ticket.note,
          },
        });
        if (result.count === 0) throw badRequest('Ticket is not pending.');
        return tx.manualAttendanceTicket.findUniqueOrThrow({ where: { id: ticket.id } });
      });
    }),

  // -------------------------------------------------------------------------
  // manualPunch.resubmit — owner corrects a rejected ticket's reason and
  // re-enters the review queue (replaces the pre-0043 "create a second row"
  // resubmit pattern, now structurally impossible under the phase-1 unique
  // (appUserId, ticketDate) constraint).
  // -------------------------------------------------------------------------
  resubmit: protectedProcedure
    .input(resubmitInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const ticket = await tx.manualAttendanceTicket.findFirst({
          where: { id: input.ticketId, facilityId },
        });
        if (!ticket) throw notFound('Ticket not found.');

        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!caller || caller.id !== ticket.appUserId) {
          throw forbidden('Only the ticket owner can resubmit it.');
        }

        const result = await tx.manualAttendanceTicket.updateMany({
          where: { id: ticket.id, facilityId, status: 'rejected' },
          data: { status: 'resubmitted', note: input.reason },
        });
        if (result.count === 0) throw badRequest('Ticket is not rejected.');
        return tx.manualAttendanceTicket.findUniqueOrThrow({ where: { id: ticket.id } });
      });
    }),

  // -------------------------------------------------------------------------
  // manualPunch.get — cold-start form by UUID (owner OR track reviewer)
  // -------------------------------------------------------------------------
  get: protectedProcedure
    .input(z.object({ ticketId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const ticket = await tx.manualAttendanceTicket.findFirst({
          where: { id: input.ticketId, facilityId },
          include: { appUser: { select: { id: true, fullName: true, userId: true, roles: true } } },
        });
        if (!ticket) throw notFound('Ticket not found.');

        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        const isOwner = Boolean(caller && caller.id === ticket.appUserId);
        const canReview = canReviewTicket({
          reviewerId: caller?.id,
          reviewerRoles: ctx.subject!.roles,
          ownerId: ticket.appUserId,
          ownerRoles: ticket.appUser.roles,
        });
        if (!isOwner && !canReview) {
          throw forbidden('You cannot view this manual attendance ticket.');
        }

        return ticket;
      });
    }),

  // -------------------------------------------------------------------------
  // manualPunch.list — inbox (tickets of AppUsers in the caller's GĐ track)
  // or mine (own tickets)
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

        // inbox: super_admin sees every ticket; a director sees only tickets
        // of AppUsers in their own track (sale→GĐKD, giao_vien→GĐĐT).
        const isSuperAdmin = ctx.subject!.roles.includes('super_admin');
        if (isSuperAdmin) {
          return tx.manualAttendanceTicket.findMany({
            where: { facilityId, ...statusFilter },
            include: { appUser: { select: { fullName: true } } },
            orderBy: { createdAt: 'desc' },
          });
        }

        const ownedTracks = (['giam_doc_kinh_doanh', 'giam_doc_dao_tao'] as const).filter((role) =>
          ctx.subject!.roles.includes(role),
        );
        const trackRoles = ownedTracks.map((director) =>
          director === 'giam_doc_kinh_doanh' ? 'sale' : 'giao_vien',
        );
        if (trackRoles.length === 0) return [];

        return tx.manualAttendanceTicket.findMany({
          where: { facilityId, ...statusFilter, appUser: { roles: { hasSome: trackRoles } } },
          include: { appUser: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        });
      });
    }),

  /**
   * Reviewer surface: minimized day punches for a ticket (no raw lat/lng/ip).
   * Scoped to the ticket owner + ICT day — never facility-wide.
   */
  dayPunches: requirePermission('manualPunch', 'approve')
    .input(z.object({ ticketId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const ticket = await tx.manualAttendanceTicket.findFirst({
          where: { id: input.ticketId, facilityId },
        });
        if (!ticket) throw notFound('Ticket not found.');

        const reviewer = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        const owner = await tx.appUser.findFirst({ where: { id: ticket.appUserId, facilityId } });
        if (!owner) throw notFound('Ticket owner not found.');

        if (
          !canReviewTicket({
            reviewerId: reviewer?.id,
            reviewerRoles: ctx.subject!.roles,
            ownerId: owner.id,
            ownerRoles: owner.roles,
          })
        ) {
          throw forbidden('Cannot read punches for a ticket outside your review scope.');
        }

        const dateKey = ictDateOnlyOf(ticket.ticketDate);
        const dayStart = ictToUtc(dateKey, '00:00');
        const dayEnd = ictToUtc(addDaysToDateOnly(dateKey, 1), '00:00');

        const punches = await tx.timePunch.findMany({
          where: {
            facilityId,
            appUserId: ticket.appUserId,
            punchAt: { gte: dayStart, lt: dayEnd },
          },
          orderBy: { punchAt: 'asc' },
          select: {
            punchAt: true,
            verification: true,
            accuracyM: true,
            geofenceDistanceM: true,
            matchedRadiusM: true,
          },
        });

        return punches;
      });
    }),
});
