// Payroll router — P3-II (QĐ0025/0012, WF-P3-05/06).
//
// compensation.upsertRate — set/update a staff member's SalaryRate.
//   - Perm: giam_doc_kinh_doanh | giam_doc_dao_tao | super_admin.
//
// payslip.assemble — compute a draft Payslip from live TimePunch data.
//   - Reads approved ShiftRegistrationEntries + ShiftTemplates for the period.
//   - Pairs punches by ICT day (first=clock-in, last=clock-out).
//   - lateMinutes: clock-in > shift startTime; earlyMinutes: clock-out < endTime.
//   - unpunchedDays: approved shift entry with no punch that day.
//   - flaggedPunches: punch day with NO approved shift entry (NOT penalized).
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
import { assembleSlip } from '@cmc/domain-payroll';
import { badRequest, forbidden, notFound } from '../errors.js';
import { protectedProcedure, requirePermission, router, scoped } from '../trpc.js';

const PERIOD_RE = /^\d{4}-\d{2}$/;

const upsertRateInput = z.object({
  appUserId: z.string().uuid(),
  baseSalary: z.number().nonnegative(),
  /** 0–1 multiplier: variablePay = baseSalary × variablePayRate */
  variablePayRate: z.number().min(0).max(1),
  kpiMax: z.number().nonnegative(),
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
// Compensation sub-router
// ---------------------------------------------------------------------------

export const compensationRouter = router({
  upsertRate: requirePermission('compensation', 'upsertRate')
    .input(upsertRateInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Validate the target AppUser belongs to this facility
        const appUser = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!appUser) throw notFound('AppUser not found in this facility.');

        return tx.salaryRate.upsert({
          where: { appUserId: input.appUserId },
          create: {
            facilityId,
            appUserId: input.appUserId,
            baseSalary: input.baseSalary,
            variablePayRate: input.variablePayRate,
            kpiMax: input.kpiMax,
          },
          update: {
            baseSalary: input.baseSalary,
            variablePayRate: input.variablePayRate,
            kpiMax: input.kpiMax,
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
  // payslip.assemble — build draft from live TimePunch data
  // -------------------------------------------------------------------------
  assemble: requirePermission('payslip', 'assemble')
    .input(assembleInput)
    .mutation(async ({ ctx, input }) => {
      const { facilityId } = scoped(ctx);
      return withFacility(ctx.db, facilityId, async (tx) => {
        // Validate target AppUser
        const appUser = await tx.appUser.findFirst({
          where: { id: input.appUserId, facilityId },
        });
        if (!appUser) throw notFound('AppUser not found in this facility.');

        // Salary configuration must exist
        const salaryRate = await tx.salaryRate.findUnique({
          where: { appUserId: input.appUserId },
        });
        if (!salaryRate) throw notFound('SalaryRate not configured for this user.');

        // Block reassembly of a finalized payslip
        const existing = await tx.payslip.findFirst({
          where: { appUserId: input.appUserId, period: input.period },
        });
        if (existing && existing.status === 'finalized') {
          throw badRequest('Payslip is finalized. Use payslip.reopen first.');
        }

        // Get period bounds in ICT
        const [periodStart, periodEnd] = ictMonthBounds(input.period);

        // Get all TimePunches for this user in the period
        const punches = await tx.timePunch.findMany({
          where: {
            appUserId: input.appUserId,
            punchAt: { gte: periodStart, lt: periodEnd },
          },
          orderBy: { punchAt: 'asc' },
        });

        // Get approved ShiftRegistrations for this user (any that have entries in period)
        const approvedRegs = await tx.shiftRegistration.findMany({
          where: { appUserId: input.appUserId, facilityId, status: 'approved' },
          include: {
            entries: {
              where: { date: { gte: periodStart, lt: periodEnd } },
              include: { shiftTemplate: true },
            },
          },
        });

        // Build map: ICT date string → { startTime, endTime } from approved entries
        const entryByDate = new Map<string, { startTime: string; endTime: string }>();
        for (const reg of approvedRegs) {
          for (const entry of reg.entries) {
            const dateKey = ictDateOnlyOf(entry.date);
            // Last-write: if multiple entries for same date (MULTIPLE mode), use first
            if (!entryByDate.has(dateKey)) {
              entryByDate.set(dateKey, {
                startTime: entry.shiftTemplate.startTime,
                endTime: entry.shiftTemplate.endTime,
              });
            }
          }
        }

        // Build map: ICT date string → sorted punches
        const punchesByDate = new Map<string, Date[]>();
        for (const punch of punches) {
          const dateKey = ictDateOnlyOf(punch.punchAt);
          if (!punchesByDate.has(dateKey)) punchesByDate.set(dateKey, []);
          punchesByDate.get(dateKey)!.push(punch.punchAt);
        }

        let lateMinutes = 0;
        let earlyMinutes = 0;
        let unpunchedDays = 0;
        let flaggedPunches = 0;

        // Process each approved entry date
        for (const [dateKey, shift] of entryByDate) {
          const dayPunches = punchesByDate.get(dateKey);
          if (!dayPunches || dayPunches.length === 0) {
            unpunchedDays++;
          } else {
            const shiftStart = ictToUtc(dateKey, shift.startTime);
            const shiftEnd = ictToUtc(dateKey, shift.endTime);
            const clockIn = dayPunches[0];
            const clockOut = dayPunches[dayPunches.length - 1];

            // Late: clock-in after shift start
            if (clockIn.getTime() > shiftStart.getTime()) {
              lateMinutes += Math.round(
                (clockIn.getTime() - shiftStart.getTime()) / 60_000,
              );
            }
            // Early departure: only if there are at least 2 punches (in + out)
            if (dayPunches.length > 1 && clockOut.getTime() < shiftEnd.getTime()) {
              earlyMinutes += Math.round(
                (shiftEnd.getTime() - clockOut.getTime()) / 60_000,
              );
            }
          }
        }

        // Count punch days without an approved entry → flagged (NOT penalized)
        for (const [dateKey, dayPunches] of punchesByDate) {
          if (!entryByDate.has(dateKey)) {
            flaggedPunches += dayPunches.length;
          }
        }

        // Get approved KPI bonus for this period (0 if none or not yet approved)
        const kpiScore = await tx.kpiScore.findFirst({
          where: { appUserId: input.appUserId, period: input.period, status: 'approved' },
        });
        const kpiBonus = kpiScore ? Number(kpiScore.value) : 0;

        // Compute payslip using pure function
        const slip = assembleSlip({
          baseSalary: Number(salaryRate.baseSalary),
          variablePayRate: Number(salaryRate.variablePayRate),
          kpiBonus,
          lateMinutes,
          earlyMinutes,
          penaltyRatePerLateMinute: 500,
          penaltyRatePerEarlyMinute: 1000,
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
