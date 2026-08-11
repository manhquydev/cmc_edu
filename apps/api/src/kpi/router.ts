// KPI router — HR remediation phase 3 (docs/20, plan.md "KPI auto-score &
// lifecycle"). Auto-scored + lifecycle-gated (draft → submitted → confirmed
// → approved). Anti-self on every transition that could otherwise let a
// person move their own slip forward (red-team #1).
//
//   kpi.refresh    — recomputes + upserts a draft (idempotent, race-safe —
//                     see auto-score.ts's `refreshKpiScore`). Self by
//                     default; another appUserId requires a director role.
//   kpi.submitSlip — owner (sale/GV) submits their OWN draft, from day 3 of
//                     the next ICT month onward. Inline done-evaluates any
//                     of the GV's own overdue sessions (R3-14 — closes the
//                     gap if the sweep worker runs behind), then
//                     auto-refreshes in the SAME tx before flipping to
//                     submitted.
//   kpi.confirm    — direct manager confirms (submitted → confirmed).
//   kpi.override   — director sets `value` directly (submitted|confirmed →
//                     confirmed; `approved` source only for super_admin with
//                     the period's Payslip reopened to draft — R2-11).
//   kpi.bulkApprove — 2 GĐ (branch-scoped by ROLE, not position free-text —
//                     R2-6) tất toán every `confirmed` slip in scope whose
//                     Payslip is already `finalized`, excluding the caller's
//                     own slip. Idempotent (only touches `confirmed` rows).
//   kpi.list       — shared board: directors = branch-scoped by target ROLE;
//                     other staff = self-only rows (resource-centric workspace).
//   kpi.myScore    — self-scoped read, no dedicated permission key
//                     (red-team #20 — same posture as payslip.my).
//   kpi.get        — cold-start form /hr/kpi/:scoreId: owner | manager |
//                     branch director | super_admin.
//
// `kpi.submit` / `kpi.approve` (standalone) / `kpi.getForUser` are REMOVED
// (red-team #10/#11) — `approved` is reachable ONLY via `bulkApprove`.
// KpiScore is append-like: cmc_app has no DELETE grant (migration).

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, forbidden, notFound } from '../errors.js';
import { markSessionDoneIfEligible } from '../class/session-done.js';
import {
  isPrismaErrorCode,
  refreshKpiScore,
  resolveKpiTargetRole,
  submitSlipOpensAt,
} from './auto-score.js';
import { requirePermission, router, scoped, protectedProcedure } from '../trpc.js';

const PERIOD_RE = /^\d{4}-\d{2}$/;
const periodSchema = z.string().regex(PERIOD_RE, 'Expected YYYY-MM');

const DIRECTOR_ROLES = ['super_admin', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'] as const;

function isDirectorRole(roles: readonly string[]): boolean {
  return roles.some((r) => (DIRECTOR_ROLES as readonly string[]).includes(r));
}

/**
 * Branch-scope (R2-6): which target KPI-bucket ROLEs a caller may act on —
 * super_admin any, GĐKD sale-only, GĐĐT giao_vien-only. Same set bulkApprove
 * and list already build inline; override reuses it (red-team follow-up —
 * override previously had no branch check at all).
 */
function allowedKpiTargetRoles(roles: readonly string[]): Set<'sale' | 'giao_vien'> {
  const set = new Set<'sale' | 'giao_vien'>();
  if (roles.includes('super_admin')) {
    set.add('sale');
    set.add('giao_vien');
    return set;
  }
  if (roles.includes('giam_doc_kinh_doanh')) set.add('sale');
  if (roles.includes('giam_doc_dao_tao')) set.add('giao_vien');
  return set;
}

const GD_NO_KPI_MESSAGE = 'Lương giám đốc/super_admin ngoài hệ thống — không có phiếu KPI.';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const refreshInput = z.object({
  period: periodSchema,
  appUserId: z.string().uuid().optional(),
});

const submitSlipInput = z.object({ period: periodSchema });

const confirmInput = z.object({ kpiScoreId: z.string().uuid() });

const overrideInput = z.object({
  kpiScoreId: z.string().uuid(),
  value: z.number().nonnegative(),
  overrideReason: z.string().min(1).max(2000),
});

const bulkApproveInput = z.object({ period: periodSchema });

const listInput = z.object({
  period: periodSchema,
  status: z.enum(['draft', 'submitted', 'confirmed', 'approved']).optional(),
});

const myScoreInput = z.object({ period: periodSchema });

const getInput = z.object({ scoreId: z.string().uuid() });

export const kpiRouter = router({
  // -------------------------------------------------------------------------
  // kpi.refresh — recompute + upsert a draft (self or, for a director, any
  // employee's slip)
  // -------------------------------------------------------------------------
  refresh: requirePermission('kpi', 'refresh')
    .input(refreshInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Caller's own AppUser row (self-target) — may legitimately be absent
        // for a super_admin acting cross-facility with no staff profile, as
        // long as they explicitly target someone else's appUserId below.
        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });

        let targetAppUserId: string;
        if (!input.appUserId) {
          if (!caller) throw forbidden('Staff profile not found in this facility.');
          targetAppUserId = caller.id;
        } else if (input.appUserId === caller?.id) {
          targetAppUserId = input.appUserId;
        } else {
          if (!isDirectorRole(ctx.subject!.roles)) {
            throw forbidden("Only a director can refresh another employee's KPI score.");
          }
          targetAppUserId = input.appUserId;
        }

        const targetAppUser = await tx.appUser.findFirst({
          where: { id: targetAppUserId, facilityId },
        });
        if (!targetAppUser) throw notFound('AppUser not found in this facility.');

        const { score, tierMissing } = await refreshKpiScore(tx, {
          facilityId,
          appUserId: targetAppUser.id,
          roles: targetAppUser.roles,
          period: input.period,
        });

        return { ...score, tierMissing };
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.submitSlip — owner submits their own draft, from day 3 of next ICT
  // month onward. Inline done-evaluate + auto-refresh in the same tx.
  // -------------------------------------------------------------------------
  submitSlip: requirePermission('kpi', 'submitSlip')
    .input(submitSlipInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');

        const targetRole = resolveKpiTargetRole(appUser.roles);
        if (!targetRole) throw badRequest(GD_NO_KPI_MESSAGE);

        const now = new Date();
        if (now < submitSlipOpensAt(input.period)) {
          throw badRequest(
            'Chưa đến ngày 3 tháng kế tiếp — chưa thể nộp phiếu KPI kỳ này.',
          );
        }

        // R3-14: sweep may run behind — inline done-evaluate this GV's own
        // sessions already past endTime before computing their teaching hours.
        if (targetRole === 'giao_vien') {
          const overdue = await tx.classSession.findMany({
            where: {
              facilityId,
              status: { in: ['planned', 'confirmed'] },
              endTime: { lte: now },
              classBatch: { teacherAppUserId: appUser.id },
            },
            select: { id: true },
          });
          for (const session of overdue) {
            await markSessionDoneIfEligible(tx, session.id, now);
          }
        }

        const { tierMissing } = await refreshKpiScore(tx, {
          facilityId,
          appUserId: appUser.id,
          roles: appUser.roles,
          period: input.period,
        });

        const score = await tx.kpiScore.findFirst({
          where: { appUserId: appUser.id, period: input.period },
        });
        if (!score) throw notFound('KpiScore not found after refresh.');
        if (score.status !== 'draft') {
          throw badRequest(`KPI score for this period is already in status '${score.status}'.`);
        }
        if (tierMissing) {
          throw badRequest('Chưa gán bậc lương — không thể nộp phiếu KPI.');
        }

        try {
          return await tx.kpiScore.update({
            where: { id: score.id, status: 'draft' },
            data: { status: 'submitted', submittedBy: ctx.subject!.userId, updatedAt: new Date() },
          });
        } catch (err) {
          if (isPrismaErrorCode(err, 'P2025')) {
            throw badRequest('KPI score changed concurrently; please retry.');
          }
          throw err;
        }
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.confirm — direct manager confirms (submitted → confirmed)
  // -------------------------------------------------------------------------
  confirm: requirePermission('kpi', 'confirm')
    .input(confirmInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const kpiScore = await tx.kpiScore.findFirst({
          where: { id: input.kpiScoreId, facilityId },
        });
        if (!kpiScore) throw notFound('KpiScore not found.');
        if (kpiScore.status !== 'submitted') {
          throw badRequest(
            `KPI score is in status '${kpiScore.status}'; only submitted scores can be confirmed.`,
          );
        }

        // May legitimately be absent (super_admin with no staff profile in
        // this facility) — the manager-match check below fails closed for
        // that case anyway, and a caller with no AppUser can never equal the
        // score owner (anti-self is trivially satisfied).
        const confirmUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });

        // Anti-self (red-team #1): a score owner can never confirm their own slip.
        if (confirmUser && confirmUser.id === kpiScore.appUserId) {
          throw forbidden('Cannot confirm your own KPI score.');
        }

        const scoreOwner = await tx.appUser.findFirst({
          where: { id: kpiScore.appUserId, facilityId },
        });
        if (!scoreOwner) throw notFound('Score owner not found.');

        if (!ctx.subject!.roles.includes('super_admin')) {
          if (!confirmUser || scoreOwner.managerId !== confirmUser.id) {
            throw forbidden('Only the direct manager can confirm this KPI score.');
          }
        }

        const payslip = await tx.payslip.findFirst({
          where: { appUserId: kpiScore.appUserId, period: kpiScore.period },
        });
        if (payslip?.status === 'finalized') {
          throw forbidden('Payslip for this period is finalized — reopen it before confirming.');
        }

        return tx.kpiScore.update({
          where: { id: kpiScore.id },
          data: { status: 'confirmed', confirmedBy: ctx.subject!.userId, updatedAt: new Date() },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.override — director sets value directly (audit: override=true +
  // overrideReason)
  // -------------------------------------------------------------------------
  override: requirePermission('kpi', 'approve')
    .input(overrideInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const kpiScore = await tx.kpiScore.findFirst({
          where: { id: input.kpiScoreId, facilityId },
        });
        if (!kpiScore) throw notFound('KpiScore not found.');

        // Branch-scope (R2-6): director's ROLE must match target's
        // KPI-bucket ROLE — a GĐKD can only override sale slips, a GĐĐT
        // only giao_vien slips; super_admin bypasses (any target).
        if (!ctx.subject!.roles.includes('super_admin')) {
          const scoreOwner = await tx.appUser.findFirst({
            where: { id: kpiScore.appUserId, facilityId },
          });
          if (!scoreOwner) throw notFound('Score owner not found.');
          const targetRole = resolveKpiTargetRole(scoreOwner.roles);
          const allowedRoles = allowedKpiTargetRoles(ctx.subject!.roles);
          if (!targetRole || !allowedRoles.has(targetRole)) {
            throw forbidden('Director branch scope: cannot override a KPI score outside your scope.');
          }
        }

        // May legitimately be absent (super_admin with no staff profile) —
        // a caller with no AppUser can never equal the score owner.
        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });

        // Anti-self (red-team #1).
        if (caller && caller.id === kpiScore.appUserId) {
          throw forbidden('Cannot override your own KPI score.');
        }

        const payslip = await tx.payslip.findFirst({
          where: { appUserId: kpiScore.appUserId, period: kpiScore.period },
        });

        if (kpiScore.status === 'approved') {
          // R2-11: the only van to fix an already-tất-toán slip — super_admin
          // only, AND only while the period's payslip has been reopened to draft.
          if (!ctx.subject!.roles.includes('super_admin')) {
            throw forbidden('Only super_admin can override an already-approved KPI score.');
          }
          if (!payslip || payslip.status !== 'draft') {
            throw badRequest(
              'Payslip kỳ này phải được reopen (draft) trước khi sửa phiếu KPI đã approved.',
            );
          }
        } else if (kpiScore.status === 'submitted' || kpiScore.status === 'confirmed') {
          if (payslip?.status === 'finalized') {
            throw forbidden('Payslip for this period is finalized — reopen it before overriding.');
          }
        } else {
          throw badRequest(`KPI score status '${kpiScore.status}' cannot be overridden.`);
        }

        return tx.kpiScore.update({
          where: { id: kpiScore.id },
          data: {
            value: input.value,
            override: true,
            overrideReason: input.overrideReason,
            confirmedBy: ctx.subject!.userId,
            status: 'confirmed',
            updatedAt: new Date(),
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.bulkApprove — 2 GĐ tất toán, branch-scoped by target ROLE, excludes
  // self, only Payslip-finalized rows, idempotent (touches confirmed only)
  // -------------------------------------------------------------------------
  bulkApprove: requirePermission('kpi', 'bulkApprove')
    .input(bulkApproveInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // May legitimately be absent (super_admin with no staff profile) —
        // self-exclusion below simply never matches for such a caller.
        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });

        const isSuperAdmin = ctx.subject!.roles.includes('super_admin');
        const targetRoles = new Set<'sale' | 'giao_vien'>();
        if (isSuperAdmin) {
          targetRoles.add('sale');
          targetRoles.add('giao_vien');
        } else {
          if (ctx.subject!.roles.includes('giam_doc_dao_tao')) targetRoles.add('giao_vien');
          if (ctx.subject!.roles.includes('giam_doc_kinh_doanh')) targetRoles.add('sale');
        }

        const candidates = await tx.kpiScore.findMany({
          where: { facilityId, period: input.period, status: 'confirmed' },
          include: { appUser: true },
        });

        let approved = 0;
        let skippedSelf = 0;
        const skippedUnfinalized: string[] = [];

        for (const score of candidates) {
          const targetRole = resolveKpiTargetRole(score.appUser.roles);
          if (!targetRole || !targetRoles.has(targetRole)) continue; // out of branch scope

          if (caller && score.appUserId === caller.id) {
            skippedSelf++;
            continue;
          }

          const payslip = await tx.payslip.findFirst({
            where: { appUserId: score.appUserId, period: input.period },
          });
          if (payslip?.status !== 'finalized') {
            skippedUnfinalized.push(score.id);
            continue;
          }

          const result = await tx.kpiScore.updateMany({
            where: { id: score.id, status: 'confirmed' },
            data: { status: 'approved', approvedBy: ctx.subject!.userId, updatedAt: new Date() },
          });
          if (result.count > 0) approved++;
        }

        return { approved, skippedSelf, skippedUnfinalized };
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.get — form cold-start /hr/kpi/:scoreId
  // -------------------------------------------------------------------------
  get: protectedProcedure.input(getInput).query(async ({ ctx, input }) => {
    const { facilityId } = scoped(ctx);
    return withFacility(ctx.db, facilityId, async (tx) => {
      const score = await tx.kpiScore.findFirst({
        where: { id: input.scoreId, facilityId },
        include: {
          appUser: {
            select: {
              id: true,
              fullName: true,
              userId: true,
              managerId: true,
              roles: true,
              position: true,
            },
          },
        },
      });
      if (!score) throw notFound('KpiScore not found.');

      const roles = ctx.subject!.roles;
      const isSuper = roles.includes('super_admin');
      const caller = await tx.appUser.findFirst({
        where: { userId: ctx.subject!.userId, facilityId },
      });
      const isOwner = Boolean(caller && caller.id === score.appUserId);
      const isDirectManager = Boolean(
        caller && score.appUser.managerId && score.appUser.managerId === caller.id,
      );
      const targetRole = resolveKpiTargetRole(score.appUser.roles);
      const branchOk =
        targetRole !== null && allowedKpiTargetRoles(roles).has(targetRole);
      const isBranchDirector =
        !isSuper &&
        branchOk &&
        (roles.includes('giam_doc_dao_tao') || roles.includes('giam_doc_kinh_doanh'));

      if (!isOwner && !isSuper && !isDirectManager && !isBranchDirector) {
        throw forbidden('Not allowed to view this KPI score.');
      }

      return {
        ...score,
        fullName: score.appUser.fullName,
        position: score.appUser.position,
        tierMissing: score.tierIdSnapshot === null,
      };
    });
  }),

  // -------------------------------------------------------------------------
  // kpi.list — shared board: directors = branch scope; staff = self only
  // -------------------------------------------------------------------------
  list: protectedProcedure
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const isSuperAdmin = ctx.subject!.roles.includes('super_admin');
        const isGddt = ctx.subject!.roles.includes('giam_doc_dao_tao');
        const isGdkd = ctx.subject!.roles.includes('giam_doc_kinh_doanh');
        const isDirector = isSuperAdmin || isGddt || isGdkd;

        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });

        if (!isDirector) {
          if (!caller) throw forbidden('Staff profile not found in this facility.');
          const scores = await tx.kpiScore.findMany({
            where: {
              facilityId,
              period: input.period,
              appUserId: caller.id,
              ...(input.status ? { status: input.status } : {}),
            },
            include: { appUser: true },
            orderBy: { updatedAt: 'desc' },
          });
          return scores.map((s) => ({
            ...s,
            fullName: s.appUser.fullName,
            position: s.appUser.position,
            tierMissing: s.tierIdSnapshot === null,
          }));
        }

        const targetRoles = new Set<'sale' | 'giao_vien'>();
        if (isSuperAdmin) {
          targetRoles.add('sale');
          targetRoles.add('giao_vien');
        } else {
          if (isGddt) targetRoles.add('giao_vien');
          if (isGdkd) targetRoles.add('sale');
        }

        const scores = await tx.kpiScore.findMany({
          where: { facilityId, period: input.period, ...(input.status ? { status: input.status } : {}) },
          include: { appUser: true },
          orderBy: { updatedAt: 'desc' },
        });

        return scores
          .filter((s) => {
            const role = resolveKpiTargetRole(s.appUser.roles);
            return role !== null && targetRoles.has(role);
          })
          .map((s) => ({
            ...s,
            fullName: s.appUser.fullName,
            position: s.appUser.position,
            tierMissing: s.tierIdSnapshot === null,
          }));
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.myScore — self-scoped read, no dedicated permission key (red-team #20)
  // -------------------------------------------------------------------------
  myScore: protectedProcedure
    .input(myScoreInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');

        const score = await tx.kpiScore.findFirst({
          where: { appUserId: appUser.id, period: input.period },
        });
        if (!score) return null;

        return { ...score, tierMissing: score.tierIdSnapshot === null };
      });
    }),
});
