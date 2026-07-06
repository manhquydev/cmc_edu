// KPI router — P3-II (QĐ0011, WF-P3-05).
//
// kpi.submit    — employee submits their own KPI score for a period.
//   - Creates KpiScore draft→submitted (upserts if draft exists).
//   - Caps value at SalaryRate.kpiMax.
// kpi.confirm   — direct manager confirms (submitted→confirmed).
//   - Validates caller's AppUser.id === target appUser.managerId.
// kpi.approve   — GĐKD/GĐĐT approves (confirmed→approved).
// kpi.override  — GĐKD/GĐĐT overrides value from any state.
//   - Sets override=true and overrideReason for audit.
// kpi.getForUser — privacy-gated read (own or director).
//
// KpiScore is append-like: cmc_app has no DELETE grant (migration).

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { badRequest, forbidden, notFound } from '../errors.js';
import { requirePermission, router, scoped } from '../trpc.js';

const PERIOD_RE = /^\d{4}-\d{2}$/;

const submitInput = z.object({
  period: z.string().regex(PERIOD_RE, 'Expected YYYY-MM'),
  value: z.number().nonnegative(),
});

const confirmInput = z.object({
  kpiScoreId: z.string().uuid(),
});

const approveInput = z.object({
  kpiScoreId: z.string().uuid(),
});

const overrideInput = z.object({
  kpiScoreId: z.string().uuid(),
  value: z.number().nonnegative(),
  overrideReason: z.string().min(1).max(2000),
});

const getForUserInput = z.object({
  appUserId: z.string().uuid(),
  period: z.string().regex(PERIOD_RE, 'Expected YYYY-MM'),
});

export const kpiRouter = router({
  // -------------------------------------------------------------------------
  // kpi.submit — employee submits their own KPI score
  // -------------------------------------------------------------------------
  submit: requirePermission('kpi', 'submit')
    .input(submitInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Resolve the caller's AppUser (they submit for themselves)
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');

        // SalaryRate must be configured before a KPI score can be submitted.
        const salaryRate = await tx.salaryRate.findUnique({
          where: { appUserId: appUser.id },
        });
        if (!salaryRate) {
          throw badRequest('SalaryRate not configured for this employee. Set a rate first.');
        }
        const kpiMax = Number(salaryRate.kpiMax);

        if (input.value > kpiMax) {
          throw badRequest(`KPI value ${input.value} exceeds kpiMax ${kpiMax}.`);
        }

        // Upsert: create draft→submitted, or update existing draft to submitted
        const existing = await tx.kpiScore.findFirst({
          where: { appUserId: appUser.id, period: input.period },
        });

        if (existing) {
          if (existing.status !== 'draft') {
            throw badRequest(
              `KPI score for this period is already in status '${existing.status}'.`,
            );
          }
          return tx.kpiScore.update({
            where: { id: existing.id },
            data: {
              value: input.value,
              kpiMax: salaryRate.kpiMax,
              status: 'submitted',
              submittedBy: ctx.subject!.userId,
              updatedAt: new Date(),
            },
          });
        }

        return tx.kpiScore.create({
          data: {
            facilityId,
            appUserId: appUser.id,
            period: input.period,
            value: input.value,
            kpiMax: salaryRate.kpiMax,
            status: 'submitted',
            submittedBy: ctx.subject!.userId,
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.confirm — direct manager confirms submitted score
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
          throw badRequest(`KPI score is in status '${kpiScore.status}'; only submitted scores can be confirmed.`);
        }

        // Validate: caller is the direct manager of the score owner
        const confirmUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!confirmUser) throw forbidden('Staff profile not found in this facility.');

        const scoreOwner = await tx.appUser.findFirst({
          where: { id: kpiScore.appUserId, facilityId },
        });
        if (!scoreOwner) throw notFound('Score owner not found.');

        // super_admin bypasses manager check
        if (!ctx.subject!.roles.includes('super_admin')) {
          if (scoreOwner.managerId !== confirmUser.id) {
            throw forbidden('Only the direct manager can confirm this KPI score.');
          }
        }

        return tx.kpiScore.update({
          where: { id: kpiScore.id },
          data: {
            status: 'confirmed',
            confirmedBy: ctx.subject!.userId,
            updatedAt: new Date(),
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.approve — GĐKD/GĐĐT approves a confirmed score
  // -------------------------------------------------------------------------
  approve: requirePermission('kpi', 'approve')
    .input(approveInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const kpiScore = await tx.kpiScore.findFirst({
          where: { id: input.kpiScoreId, facilityId },
        });
        if (!kpiScore) throw notFound('KpiScore not found.');
        if (kpiScore.status !== 'confirmed') {
          throw badRequest(`KPI score is in status '${kpiScore.status}'; only confirmed scores can be approved.`);
        }

        return tx.kpiScore.update({
          where: { id: kpiScore.id },
          data: {
            status: 'approved',
            approvedBy: ctx.subject!.userId,
            updatedAt: new Date(),
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.override — GĐKD/GĐĐT overrides value from any state (audit trail)
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

        if (input.value > Number(kpiScore.kpiMax)) {
          throw badRequest(`Override value ${input.value} exceeds kpiMax ${kpiScore.kpiMax}.`);
        }

        return tx.kpiScore.update({
          where: { id: kpiScore.id },
          data: {
            value: input.value,
            override: true,
            overrideReason: input.overrideReason,
            approvedBy: ctx.subject!.userId,
            // Ensure overridden scores are visible to payslip.assemble
            // which filters status:'approved'.
            status: 'approved',
            updatedAt: new Date(),
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // kpi.getForUser — privacy-gated read (own or director)
  // -------------------------------------------------------------------------
  getForUser: requirePermission('kpi', 'submit')
    .input(getForUserInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Resolve target AppUser
        const targetAppUser = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!targetAppUser) throw notFound('AppUser not found in this facility.');

        // Privacy gate: own or director
        const callerUserId = ctx.subject!.userId;
        const callerRoles = ctx.subject!.roles;
        const isOwner = targetAppUser.userId === callerUserId;
        const isDirector = callerRoles.some((r) =>
          ['super_admin', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'].includes(r),
        );
        if (!isOwner && !isDirector) {
          throw forbidden('You can only read your own KPI score.');
        }

        const kpiScore = await tx.kpiScore.findFirst({
          where: { appUserId: input.appUserId, period: input.period },
        });
        if (!kpiScore) throw notFound('KpiScore not found for this period.');
        return kpiScore;
      });
    }),
});
