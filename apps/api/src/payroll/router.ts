// Payroll router — P3-II (QĐ0025/0012, WF-P3-05/06), salary-tier model
// (HR remediation phase 2, validate session 3/4).
//
// compensation.assignTier — assigns an AppUser (sale/giao_vien ONLY) to a
//   SalaryTier. Target role must be sale|giao_vien (GĐ/super_admin have no
//   payslip, "lương GĐ ngoài hệ thống") and the tier's `type` must match the
//   target's role (GIAO_VIEN tier ↔ giao_vien, KINH_DOANH tier ↔ sale).
//   Perm: key `salaryTier.manage` (giam_doc_kinh_doanh|giam_doc_dao_tao).
//
// compensationPolicy.get/upsert — per-facility late/early penalty rates.
//   Perm: key `compensationPolicy.manage` (super_admin only).
//
// salaryTier.list/create/update — SalaryTier CRUD (audit: updatedById).
//   Perm: key `salaryTier.manage` (giam_doc_kinh_doanh|giam_doc_dao_tao).
//
// payslip.assemble — compute a draft Payslip from live TimePunch + KpiScore
//   + SalaryTier data:
//   - Target role must be sale|giao_vien (GĐ/super_admin excluded, BAD_REQUEST).
//   - Target must have a SalaryTier assigned (SalaryRate.tierId) — FORBIDDEN
//     otherwise (greenfield: no legacy fallback, validate session 4).
//   - baseSalary = the assigned SalaryTier's baseSalary.
//   - kpiPartAmount = KpiScore.value for a period slip in status
//     confirmed|approved, else 0 ("PHẦN NHÂN" — phase 3 computes `value`).
//   - Per-shift late/early penalty (R3-6/R3-7): each ShiftRegistrationEntry
//     of a day is paired against that day's punches via
//     `assignPunchesToShifts` (@cmc/domain-payroll) — punches are not reused
//     across shifts, entries are processed in ShiftTemplate.startTime order.
//     A shift missing either half of its punch pair is "vắng": no wage, no
//     minute penalty, counted into `unpunchedDays`.
//   - A day with an APPROVED ManualAttendanceTicket is fully exempted: every
//     shift registered that day is credited (no unpunched, no penalty),
//     bypassing the punch-pairing pass entirely for that date.
//   - Penalty rates come from the facility's CompensationPolicy row, falling
//     back to 500/1000 VND/minute when none exists.
//   - Calls assembleSlip() from @cmc/domain-payroll for the arithmetic.
//   - Creates or updates a draft Payslip (rejects if currently finalized).
//
// payslip.finalize — locks a draft Payslip (status=finalized).
// payslip.reopen  — reverts finalized → draft; re-derives is done via assemble.
// payslip.getForUser — privacy-gated read (own or director/super_admin).
// payslip.my — self-scoped read (own payslip for a period, null if not assembled).
//
// All writes are facility-scoped via `withFacility` (ADR 0042).
// Payslip is append-like: cmc_app has no DELETE grant.

import { z } from 'zod';
import { withFacility } from '@cmc/db';
import { ictMonthBounds, ictDateOnlyOf, ictToUtc } from '@cmc/domain-time';
import { assembleSlip, assignPunchesToShifts, type ShiftWindow } from '@cmc/domain-payroll';
import { badRequest, forbidden, notFound } from '../errors.js';
import { protectedProcedure, requirePermission, router, scoped } from '../trpc.js';

const PERIOD_RE = /^\d{4}-\d{2}$/;

/** R3-13/docs: named fallback used ONLY when a facility has no CompensationPolicy row. */
const FALLBACK_PENALTY_RATE_PER_LATE_MINUTE = 500;
const FALLBACK_PENALTY_RATE_PER_EARLY_MINUTE = 1000;

/**
 * Payslip/KpiScore/tier target roles (validate session 4 — "lương GĐ ngoài
 * hệ thống"). Deliberately checks `AppUser.roles` (RBAC truth), NOT
 * `AppUser.position` free text — `resolveShiftGroup(position)` from
 * @cmc/domain-time is the WRONG tool for money-scope decisions (R2-6).
 */
function resolvePayrollTargetRole(roles: readonly string[]): 'sale' | 'giao_vien' | null {
  if (roles.includes('sale')) return 'sale';
  if (roles.includes('giao_vien')) return 'giao_vien';
  return null;
}

const GD_OUTSIDE_PAYROLL_MESSAGE =
  'Lương giám đốc/super_admin ngoài hệ thống — chỉ áp dụng cho sale/giáo viên.';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const assignTierInput = z.object({
  appUserId: z.string().uuid(),
  tierId: z.string().uuid(),
});

const policyUpsertInput = z.object({
  penaltyRatePerLateMinute: z.number().nonnegative(),
  penaltyRatePerEarlyMinute: z.number().nonnegative(),
});

const salaryTierCreateInput = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['KINH_DOANH', 'GIAO_VIEN']),
  baseSalary: z.number().nonnegative(),
  unitRate: z.number().nonnegative(),
  requiredShifts: z.number().int().nonnegative(),
  requiredMetric: z.number().nonnegative(),
});

const salaryTierUpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['KINH_DOANH', 'GIAO_VIEN']).optional(),
  baseSalary: z.number().nonnegative().optional(),
  unitRate: z.number().nonnegative().optional(),
  requiredShifts: z.number().int().nonnegative().optional(),
  requiredMetric: z.number().nonnegative().optional(),
});

const assembleInput = z.object({
  appUserId: z.string().uuid(),
  period: z.string().regex(PERIOD_RE, 'Expected YYYY-MM'),
});

const finalizeInput = z.object({
  payslipId: z.string().uuid(),
});

const reopenInput = z.object({
  payslipId: z.string().uuid(),
});

const getForUserInput = z.object({
  appUserId: z.string().uuid(),
  period: z.string().regex(PERIOD_RE, 'Expected YYYY-MM'),
});

const myInput = z.object({
  period: z.string().regex(PERIOD_RE, 'Expected YYYY-MM'),
});

// ---------------------------------------------------------------------------
// Compensation sub-router — tier assignment (upsertRate REMOVED, R3-4)
// ---------------------------------------------------------------------------

export const compensationRouter = router({
  assignTier: requirePermission('salaryTier', 'manage')
    .input(assignTierInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appUser = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!appUser) throw notFound('AppUser not found in this facility.');

        const targetRole = resolvePayrollTargetRole(appUser.roles);
        if (!targetRole) throw badRequest(GD_OUTSIDE_PAYROLL_MESSAGE);

        const tier = await tx.salaryTier.findFirst({
          where: { id: input.tierId, facilityId },
        });
        if (!tier) throw notFound('SalaryTier not found in this facility.');

        const requiredType = targetRole === 'giao_vien' ? 'GIAO_VIEN' : 'KINH_DOANH';
        if (tier.type !== requiredType) {
          throw badRequest(
            `Bậc lương "${tier.name}" (${tier.type}) không khớp vai trò ${targetRole}.`,
          );
        }

        return tx.salaryRate.upsert({
          where: { appUserId: input.appUserId },
          create: {
            facilityId,
            appUserId: input.appUserId,
            tierId: tier.id,
          },
          update: {
            tierId: tier.id,
            updatedAt: new Date(),
          },
        });
      });
    }),
});

// ---------------------------------------------------------------------------
// CompensationPolicy sub-router — per-facility late/early penalty rates
// ---------------------------------------------------------------------------

export const compensationPolicyRouter = router({
  get: requirePermission('compensationPolicy', 'manage')
    .query(async ({ ctx }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.compensationPolicy.findUnique({ where: { facilityId } }),
      );
    }),

  upsert: requirePermission('compensationPolicy', 'manage')
    .input(policyUpsertInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.compensationPolicy.upsert({
          where: { facilityId },
          create: {
            facilityId,
            penaltyRatePerLateMinute: input.penaltyRatePerLateMinute,
            penaltyRatePerEarlyMinute: input.penaltyRatePerEarlyMinute,
          },
          update: {
            penaltyRatePerLateMinute: input.penaltyRatePerLateMinute,
            penaltyRatePerEarlyMinute: input.penaltyRatePerEarlyMinute,
            updatedAt: new Date(),
          },
        }),
      );
    }),
});

// ---------------------------------------------------------------------------
// SalaryTier sub-router — tier CRUD (audit: updatedById)
// ---------------------------------------------------------------------------

export const salaryTierRouter = router({
  list: requirePermission('salaryTier', 'manage')
    .query(async ({ ctx }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, (tx) =>
        tx.salaryTier.findMany({ where: { facilityId }, orderBy: { name: 'asc' } }),
      );
    }),

  create: requirePermission('salaryTier', 'manage')
    .input(salaryTierCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        return tx.salaryTier.create({
          data: {
            facilityId,
            name: input.name,
            type: input.type,
            baseSalary: input.baseSalary,
            unitRate: input.unitRate,
            requiredShifts: input.requiredShifts,
            requiredMetric: input.requiredMetric,
            updatedById: caller?.id ?? null,
          },
        });
      });
    }),

  update: requirePermission('salaryTier', 'manage')
    .input(salaryTierUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const existing = await tx.salaryTier.findFirst({
          where: { id: input.id, facilityId },
        });
        if (!existing) throw notFound('SalaryTier not found in this facility.');

        const caller = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });

        const { id, ...patch } = input;
        return tx.salaryTier.update({
          where: { id },
          data: {
            ...patch,
            updatedById: caller?.id ?? null,
            updatedAt: new Date(),
          },
        });
      });
    }),
});

// ---------------------------------------------------------------------------
// Payslip sub-router
// ---------------------------------------------------------------------------

export const payslipRouter = router({
  // -------------------------------------------------------------------------
  // payslip.assemble — build draft from live TimePunch/KpiScore/tier data
  // -------------------------------------------------------------------------
  assemble: requirePermission('payslip', 'assemble')
    .input(assembleInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Validate target AppUser + role scope (GĐ/super_admin excluded)
        const appUser = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!appUser) throw notFound('AppUser not found in this facility.');
        if (!resolvePayrollTargetRole(appUser.roles)) {
          throw badRequest(GD_OUTSIDE_PAYROLL_MESSAGE);
        }

        // Salary tier must be assigned (greenfield — no legacy fallback)
        const salaryRate = await tx.salaryRate.findUnique({
          where: { appUserId: input.appUserId },
        });
        if (!salaryRate?.tierId) {
          throw forbidden('Chưa gán bậc lương cho nhân viên này.');
        }
        const tier = await tx.salaryTier.findFirst({
          where: { id: salaryRate.tierId, facilityId },
        });
        if (!tier) throw forbidden('Chưa gán bậc lương cho nhân viên này.');

        // Block reassembly of a finalized payslip
        const existing = await tx.payslip.findFirst({
          where: { appUserId: input.appUserId, period: input.period },
        });
        if (existing && existing.status === 'finalized') {
          throw badRequest('Payslip is finalized. Use payslip.reopen first.');
        }

        // Get period bounds in ICT
        const [periodStart, periodEnd] = ictMonthBounds(input.period);

        // Live TimePunches for the period, grouped by ICT calendar date
        const punches = await tx.timePunch.findMany({
          where: {
            appUserId: input.appUserId,
            punchAt: { gte: periodStart, lt: periodEnd },
          },
          orderBy: { punchAt: 'asc' },
        });
        const punchesByDate = new Map<string, Date[]>();
        for (const punch of punches) {
          const dateKey = ictDateOnlyOf(punch.punchAt);
          const list = punchesByDate.get(dateKey);
          if (list) list.push(punch.punchAt);
          else punchesByDate.set(dateKey, [punch.punchAt]);
        }

        // Approved ShiftRegistrationEntries for the period, grouped by ICT
        // date and sorted by ShiftTemplate.startTime ascending (R3-6
        // determinism — pool depletion order).
        const approvedRegs = await tx.shiftRegistration.findMany({
          where: { appUserId: input.appUserId, facilityId, status: 'approved' },
          include: {
            entries: {
              where: { date: { gte: periodStart, lt: periodEnd } },
              include: { shiftTemplate: true },
            },
          },
        });
        const entriesByDate = new Map<
          string,
          { id: string; startTime: string; start: Date; end: Date }[]
        >();
        for (const reg of approvedRegs) {
          for (const entry of reg.entries) {
            const dateKey = ictDateOnlyOf(entry.date);
            const list = entriesByDate.get(dateKey) ?? [];
            list.push({
              id: entry.id,
              startTime: entry.shiftTemplate.startTime,
              start: ictToUtc(dateKey, entry.shiftTemplate.startTime),
              end: ictToUtc(dateKey, entry.shiftTemplate.endTime),
            });
            entriesByDate.set(dateKey, list);
          }
        }
        for (const list of entriesByDate.values()) {
          list.sort((a, b) => a.startTime.localeCompare(b.startTime));
        }

        // Approved ManualAttendanceTicket dates → full exemption for every
        // shift registered that day (bypass unpunched + penalty entirely).
        const approvedTickets = await tx.manualAttendanceTicket.findMany({
          where: {
            appUserId: input.appUserId,
            facilityId,
            status: 'approved',
            ticketDate: { gte: periodStart, lt: periodEnd },
          },
        });
        const exemptDates = new Set(approvedTickets.map((t) => ictDateOnlyOf(t.ticketDate)));

        let lateMinutes = 0;
        let earlyMinutes = 0;
        let unpunchedDays = 0;
        let flaggedPunches = 0;

        for (const [dateKey, entries] of entriesByDate) {
          if (exemptDates.has(dateKey)) continue; // ticket-approved: fully credited

          const dayPunches = punchesByDate.get(dateKey) ?? [];
          const windows: ShiftWindow[] = entries.map((e) => ({
            id: e.id,
            start: e.start,
            end: e.end,
          }));
          const result = assignPunchesToShifts(windows, dayPunches);
          for (const outcome of result.shifts) {
            if (!outcome.present) {
              unpunchedDays++;
            } else {
              lateMinutes += outcome.lateMinutes;
              earlyMinutes += outcome.earlyMinutes;
            }
          }
          flaggedPunches += result.unassignedPunches.length;
        }

        // Punches on days with NO registered shift entry at all → flagged
        // (NOT penalized — same posture as the pre-remediation behavior).
        for (const [dateKey, dayPunches] of punchesByDate) {
          if (!entriesByDate.has(dateKey)) {
            flaggedPunches += dayPunches.length;
          }
        }

        // KpiScore "PHẦN NHÂN" — confirmed|approved slips only.
        const kpiScore = await tx.kpiScore.findFirst({
          where: {
            appUserId: input.appUserId,
            period: input.period,
            status: { in: ['confirmed', 'approved'] },
          },
        });
        const kpiPartAmount = kpiScore ? Number(kpiScore.value) : 0;

        // Penalty rates from CompensationPolicy, fallback 500/1000.
        const policy = await tx.compensationPolicy.findUnique({ where: { facilityId } });
        const penaltyRatePerLateMinute = policy
          ? Number(policy.penaltyRatePerLateMinute)
          : FALLBACK_PENALTY_RATE_PER_LATE_MINUTE;
        const penaltyRatePerEarlyMinute = policy
          ? Number(policy.penaltyRatePerEarlyMinute)
          : FALLBACK_PENALTY_RATE_PER_EARLY_MINUTE;

        // Compute payslip using the pure function
        const slip = assembleSlip({
          baseSalary: Number(tier.baseSalary),
          kpiPartAmount,
          lateMinutes,
          earlyMinutes,
          penaltyRatePerLateMinute,
          penaltyRatePerEarlyMinute,
        });

        // Upsert the Payslip
        if (existing) {
          try {
            return await tx.payslip.update({
              // status:'draft' in WHERE is the TOCTOU guard: if a concurrent
              // finalize committed between our earlier read and this write,
              // Prisma throws P2025 rather than silently overwriting.
              where: { id: existing.id, status: 'draft' },
              data: {
                baseSalary: slip.baseSalary,
                variablePay: slip.variablePay,
                kpiBonus: slip.kpiBonus,
                penaltyAmount: slip.penaltyAmount,
                totalNet: slip.totalNet,
                lateMinutes,
                earlyMinutes,
                unpunchedDays,
                flaggedPunches,
                status: 'draft',
                updatedAt: new Date(),
              },
            });
          } catch (err: unknown) {
            // P2025 = row targeted by updateMany was concurrently finalized.
            if (
              err !== null &&
              typeof err === 'object' &&
              'code' in err &&
              (err as { code: unknown }).code === 'P2025'
            ) {
              throw badRequest('Payslip was finalized concurrently; cannot assemble.');
            }
            throw err;
          }
        }

        return tx.payslip.create({
          data: {
            facilityId,
            appUserId: input.appUserId,
            period: input.period,
            status: 'draft',
            baseSalary: slip.baseSalary,
            variablePay: slip.variablePay,
            kpiBonus: slip.kpiBonus,
            penaltyAmount: slip.penaltyAmount,
            totalNet: slip.totalNet,
            lateMinutes,
            earlyMinutes,
            unpunchedDays,
            flaggedPunches,
          },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // payslip.finalize — lock a draft payslip
  // -------------------------------------------------------------------------
  finalize: requirePermission('payslip', 'finalize')
    .input(finalizeInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const payslip = await tx.payslip.findFirst({
          where: { id: input.payslipId, facilityId },
        });
        if (!payslip) throw notFound('Payslip not found.');
        if (payslip.status === 'finalized') {
          throw badRequest('Payslip is already finalized.');
        }
        return tx.payslip.update({
          where: { id: payslip.id },
          data: { status: 'finalized', updatedAt: new Date() },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // payslip.reopen — revert finalized → draft for reassembly
  // -------------------------------------------------------------------------
  reopen: requirePermission('payslip', 'reopen')
    .input(reopenInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const payslip = await tx.payslip.findFirst({
          where: { id: input.payslipId, facilityId },
        });
        if (!payslip) throw notFound('Payslip not found.');
        if (payslip.status !== 'finalized') {
          throw badRequest('Only finalized payslips can be reopened.');
        }
        return tx.payslip.update({
          where: { id: payslip.id },
          data: { status: 'draft', updatedAt: new Date() },
        });
      });
    }),

  // -------------------------------------------------------------------------
  // payslip.getForUser — privacy-gated read
  // Any authenticated staff can call; privacy is enforced inside:
  //   own payslip OR giam_doc_kinh_doanh/giam_doc_dao_tao/super_admin.
  // -------------------------------------------------------------------------
  getForUser: protectedProcedure
    .input(getForUserInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Resolve the target AppUser to check ownership
        const targetAppUser = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!targetAppUser) throw notFound('AppUser not found in this facility.');

        // Privacy gate: caller must be the owner OR a director
        const callerUserId = ctx.subject!.userId;
        const callerRoles = ctx.subject!.roles;
        const isOwner = targetAppUser.userId === callerUserId;
        const isDirector = callerRoles.some((r) =>
          ['super_admin', 'giam_doc_kinh_doanh', 'giam_doc_dao_tao'].includes(r),
        );
        if (!isOwner && !isDirector) {
          throw forbidden('You can only read your own payslip.');
        }

        const payslip = await tx.payslip.findFirst({
          where: { appUserId: input.appUserId, period: input.period },
        });
        if (!payslip) throw notFound('Payslip not found for this period.');
        return payslip;
      });
    }),

  // -------------------------------------------------------------------------
  // payslip.my — self-scoped read: caller's own payslip for a period, or
  // null if it hasn't been assembled yet. No dedicated permission key.
  // -------------------------------------------------------------------------
  my: protectedProcedure
    .input(myInput)
    .query(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        const appUser = await tx.appUser.findFirst({
          where: { userId: ctx.subject!.userId, facilityId },
        });
        if (!appUser) throw forbidden('Staff profile not found in this facility.');
        return tx.payslip.findFirst({
          where: { appUserId: appUser.id, period: input.period },
        });
      });
    }),
});
