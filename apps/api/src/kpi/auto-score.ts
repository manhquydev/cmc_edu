// KPI auto-score — HR remediation phase 3 (docs/20, plan.md "KPI auto-score
// & lifecycle"). Pure/tx-scoped building blocks the kpi router composes:
//
//   computeKpiValue      — pure "PHẦN NHÂN" formula (no DB access).
//   collectSaleRevenue   — SUM(Receipt.netAmount) approved this ICT period,
//                          attributed via `createdByAppUserId` (NOT the
//                          legacy `createdById` userId namespace — R2 #2).
//   collectTeacherHours  — Σ(endTime−startTime)×creditFactor for `done`
//                          sessions this ICT month, teacherAppUserId-scoped.
//   collectActualShifts  — DISTINCT (date, shiftTemplateId) công ca thực,
//                          reusing @cmc/domain-payroll's `assignPunchesToShifts`
//                          (single source of truth with phase 2's per-shift
//                          penalty pairing, R3-6/R3-7).
//   refreshKpiScore      — orchestrates the 3 collectors + the tier lookup
//                          into a concurrency-safe draft upsert (R2 #8: never
//                          overwrites submitted+, P2002/P2025 race-safe).
//
// `tierMissing` is an informational flag surfaced on the mutation RESPONSE
// only — KpiScore carries no dedicated column for it (phase 1's migration
// did not add one; schema.prisma is outside this phase's file ownership).
// Always re-derivable from `tierIdSnapshot === null` on any already-
// persisted row.
//
// ADR 0043 phase 6: `shortSpanShifts` REMOVED entirely (the span-based
// anti-gaming flag had no equivalent in the day-level in/out pairing model
// — see plan.md Validation Log #6 / Edge Case Ledger). `resolveKpiTargetRole`
// re-exports the shared attendance resolver (R3 dedup — was duplicated with
// payroll/router.ts's own copy, now a single implementation both import).

import type { Prisma } from '@cmc/db';
import {
  addDaysToDateOnly,
  creditFactor,
  ictDateOnlyOf,
  ictMonthBounds,
  ictToUtc,
  SESSION_DONE_ACTIVATED_AT,
} from '@cmc/domain-time';
import { roundVnd, type ShiftWindow } from '@cmc/domain-payroll';
import { resolveDayCredit, type DayPunch, type DayTicket } from '../attendance/resolve-day-credit.js';
import { resolveTargetRole } from '../attendance/resolve-target-role.js';
import { badRequest } from '../errors.js';

const PERIOD_RE = /^(\d{4})-(\d{2})$/;

/** Re-exported under its original name — kpi/router.ts's 4 call sites and
 * this module's own callers are unaffected by the R3 dedup. */
export const resolveKpiTargetRole = resolveTargetRole;

/** Narrow Prisma error-code check (same inline shape payroll/router.ts uses for P2025). */
export function isPrismaErrorCode(err: unknown, code: string): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === code;
}

// ---------------------------------------------------------------------------
// computeKpiValue — pure "PHẦN NHÂN" formula
// ---------------------------------------------------------------------------

export interface ComputeKpiValueInput {
  shiftActual: number;
  shiftRequired: number;
  metricValue: number;
  metricRequired: number;
  unitRate: number;
}

/**
 * `value = min(1, shiftActual/shiftRequired) × min(1, metricValue/metricRequired) × unitRate`
 * (validate s3 formula, cap 100% on BOTH percentages). `shiftRequired`/
 * `metricRequired` of 0 or missing → that percentage is 0 (never divide by
 * zero, never treat "no requirement" as 100%). Number-coerced (R3-13 — Prisma
 * Decimal inputs come through `Number(tier.field)` at the call site, but this
 * function re-coerces defensively) and rounded half-up to whole VND via
 * `@cmc/domain-payroll`'s `roundVnd` (single source of truth with the payslip
 * rounding contract).
 */
export function computeKpiValue(input: ComputeKpiValueInput): number {
  const shiftActual = Math.max(0, Number(input.shiftActual) || 0);
  const shiftRequired = Number(input.shiftRequired) || 0;
  const metricValue = Math.max(0, Number(input.metricValue) || 0);
  const metricRequired = Number(input.metricRequired) || 0;
  const unitRate = Number(input.unitRate) || 0;

  const shiftPct = shiftRequired > 0 ? Math.min(1, shiftActual / shiftRequired) : 0;
  const metricPct = metricRequired > 0 ? Math.min(1, metricValue / metricRequired) : 0;

  return roundVnd(shiftPct * metricPct * unitRate);
}

// ---------------------------------------------------------------------------
// collectSaleRevenue — SUM(Receipt.netAmount) approved this ICT period
// ---------------------------------------------------------------------------

/**
 * Sale metric: SUM `Receipt.netAmount` WHERE status='approved' AND
 * `approvedAt` falls in the ICT calendar month AND `createdByAppUserId`
 * matches — the P3-I AppUser-FK namespace (backfilled phase 1), NEVER the
 * legacy `createdById` userId scalar (R2 #2 — a different namespace
 * entirely; coalescing the two would silently misattribute revenue).
 */
export async function collectSaleRevenue(
  tx: Prisma.TransactionClient,
  facilityId: string,
  appUserId: string,
  period: string,
): Promise<number> {
  const [periodStart, periodEnd] = ictMonthBounds(period);
  const result = await tx.receipt.aggregate({
    where: {
      facilityId,
      status: 'approved',
      createdByAppUserId: appUserId,
      approvedAt: { gte: periodStart, lt: periodEnd },
    },
    _sum: { netAmount: true },
  });
  return Number(result._sum.netAmount ?? 0);
}

// ---------------------------------------------------------------------------
// collectTeacherHours — Σ(endTime−startTime)×creditFactor for done sessions
// ---------------------------------------------------------------------------

/**
 * GV metric: total teaching HOURS across `done` sessions this ICT month
 * (bucketed by `sessionDate`), weighted by `creditFactor(doneAt, endTime)`
 * (phase 7 24h/48h decay). Sessions whose `endTime` predates
 * `SESSION_DONE_ACTIVATED_AT` are pre-activation — phase 7's backfill script
 * marks them `done` using their real historical `doneAt`, but the "full
 * credit regardless of lateness" rule (R2 Scope F3) is applied HERE by the
 * KPI reader, not at backfill time — hence the explicit activation check
 * rather than trusting `creditFactor` alone.
 */
export async function collectTeacherHours(
  tx: Prisma.TransactionClient,
  facilityId: string,
  appUserId: string,
  period: string,
): Promise<number> {
  const [periodStart, periodEnd] = ictMonthBounds(period);
  const sessions = await tx.classSession.findMany({
    where: {
      facilityId,
      status: 'done',
      sessionDate: { gte: periodStart, lt: periodEnd },
      classBatch: { teacherAppUserId: appUserId },
    },
    select: { startTime: true, endTime: true, doneAt: true },
  });

  let hours = 0;
  for (const session of sessions) {
    if (!session.doneAt) continue; // defensive — a `done` session always carries doneAt
    const durationHours = (session.endTime.getTime() - session.startTime.getTime()) / 3_600_000;
    const factor =
      session.endTime.getTime() < SESSION_DONE_ACTIVATED_AT.getTime()
        ? 1.0
        : creditFactor(session.doneAt, session.endTime);
    hours += durationHours * factor;
  }
  return hours;
}

// ---------------------------------------------------------------------------
// collectActualShifts — DISTINCT (date, shiftTemplateId) công ca thực
// ---------------------------------------------------------------------------

export interface CollectActualShiftsResult {
  shiftActual: number;
}

/**
 * Công ca thực (ADR 0043 phase 6): DISTINCT (date, shiftTemplateId) pairs
 * from `approved` ShiftRegistration entries this ICT period, credited via
 * `resolveDayCredit` (apps/api/src/attendance/resolve-day-credit.ts) — the
 * SAME shared helper phase 5's payroll penalty uses, so payroll and KPI can
 * never disagree on which days/shifts count (red-team R2). A day only
 * credits the shifts whose window overlaps the day's [checkin,checkout)
 * pair (E3) — live punches when every punch that day is within network, or
 * the FROZEN checkInAt/checkOutAt of an approved ManualAttendanceTicket
 * otherwise (R1). Duplicate entries for the same (date, shiftTemplateId) —
 * across registrations or within one — are collapsed to a single shift
 * window before crediting (R3-8: no double count).
 */
export async function collectActualShifts(
  tx: Prisma.TransactionClient,
  facilityId: string,
  appUserId: string,
  period: string,
): Promise<CollectActualShiftsResult> {
  const [periodStart, periodEnd] = ictMonthBounds(period);

  const approvedRegs = await tx.shiftRegistration.findMany({
    where: { appUserId, facilityId, status: 'approved' },
    include: {
      entries: {
        where: { date: { gte: periodStart, lt: periodEnd } },
        include: { shiftTemplate: true },
      },
    },
  });

  // DISTINCT (date, shiftTemplateId) — collapse duplicate entries (R3-8).
  const entriesByDate = new Map<
    string,
    Map<string, { start: Date; end: Date; startTime: string }>
  >();
  for (const reg of approvedRegs) {
    for (const entry of reg.entries) {
      const dateKey = ictDateOnlyOf(entry.date);
      let byTemplate = entriesByDate.get(dateKey);
      if (!byTemplate) {
        byTemplate = new Map();
        entriesByDate.set(dateKey, byTemplate);
      }
      if (!byTemplate.has(entry.shiftTemplateId)) {
        byTemplate.set(entry.shiftTemplateId, {
          start: ictToUtc(dateKey, entry.shiftTemplate.startTime),
          end: ictToUtc(dateKey, entry.shiftTemplate.endTime),
          startTime: entry.shiftTemplate.startTime,
        });
      }
    }
  }

  if (entriesByDate.size === 0) return { shiftActual: 0 };

  const punches = await tx.timePunch.findMany({
    where: { appUserId, facilityId, punchAt: { gte: periodStart, lt: periodEnd } },
    orderBy: { punchAt: 'asc' },
  });
  const punchesByDate = new Map<string, DayPunch[]>();
  for (const punch of punches) {
    const dateKey = ictDateOnlyOf(punch.punchAt);
    const entry: DayPunch = { punchAt: punch.punchAt, withinNetwork: punch.withinNetwork };
    const list = punchesByDate.get(dateKey);
    if (list) list.push(entry);
    else punchesByDate.set(dateKey, [entry]);
  }

  const tickets = await tx.manualAttendanceTicket.findMany({
    where: { appUserId, facilityId, ticketDate: { gte: periodStart, lt: periodEnd } },
  });
  const ticketByDate = new Map<string, DayTicket>();
  for (const t of tickets) {
    ticketByDate.set(ictDateOnlyOf(t.ticketDate), { status: t.status, checkInAt: t.checkInAt, checkOutAt: t.checkOutAt });
  }

  let shiftActual = 0;

  for (const [dateKey, byTemplate] of entriesByDate) {
    const windows: ShiftWindow[] = [...byTemplate.entries()].map(([templateId, w]) => ({
      id: templateId,
      start: w.start,
      end: w.end,
    }));
    const credit = resolveDayCredit({
      shifts: windows,
      dayPunches: punchesByDate.get(dateKey) ?? [],
      ticket: ticketByDate.get(dateKey),
    });
    shiftActual += credit.creditedShiftIds.length;
  }

  return { shiftActual };
}

// ---------------------------------------------------------------------------
// submitSlipOpensAt — guard boundary (validate s3: NGÀY 3 tháng kế tiếp ICT)
// ---------------------------------------------------------------------------

/** The instant `kpi.submitSlip` opens for `period`: 00:00 ICT of the 3rd day
 * of the FOLLOWING calendar month (the 48h creditFactor window has always
 * closed by then, so a period's numbers are final once this gate opens). */
export function submitSlipOpensAt(period: string): Date {
  const match = period.match(PERIOD_RE);
  if (!match) throw new RangeError(`Expected YYYY-MM, got "${period}".`);
  const [, y, m] = match as [string, string, string];
  const year = Number(y);
  const month = Number(m);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthFirst = `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
  const guardDateOnly = addDaysToDateOnly(nextMonthFirst, 2); // day 1 + 2 = day 3
  return ictToUtc(guardDateOnly, '00:00');
}

// ---------------------------------------------------------------------------
// refreshKpiScore — orchestration + concurrency-safe draft upsert
// ---------------------------------------------------------------------------

export interface RefreshKpiScoreParams {
  facilityId: string;
  appUserId: string;
  roles: readonly string[];
  period: string;
}

export interface RefreshKpiScoreResult {
  score: Prisma.KpiScoreGetPayload<Record<string, never>>;
  tierMissing: boolean;
}

/**
 * Recomputes and upserts a `draft` KpiScore. Never overwrites a
 * submitted/confirmed/approved row (R2 #4) — a non-draft existing row is
 * returned untouched. Concurrency-safe (R2 #8): a race between two
 * simultaneous refreshes (both see no existing row, both attempt `create`)
 * resolves via a P2002 catch + conditional `WHERE status='draft'` update, and
 * a race against a concurrent `submitSlip` (draft→submitted mid-refresh)
 * resolves via a P2025 catch that just re-reads the now-current row — no
 * caller-visible 500 either way. Target role GĐ/super_admin (no KPI slip in
 * this system, validate s4) throws BAD_REQUEST.
 */
export async function refreshKpiScore(
  tx: Prisma.TransactionClient,
  params: RefreshKpiScoreParams,
): Promise<RefreshKpiScoreResult> {
  const { facilityId, appUserId, roles, period } = params;
  const targetRole = resolveKpiTargetRole(roles);
  if (!targetRole) {
    throw badRequest('Lương giám đốc/super_admin ngoài hệ thống — không có phiếu KPI.');
  }

  const salaryRate = await tx.salaryRate.findUnique({ where: { appUserId } });
  const tier = salaryRate?.tierId
    ? await tx.salaryTier.findFirst({ where: { id: salaryRate.tierId, facilityId } })
    : null;
  const tierMissing = !tier;

  const [metricValue, shiftResult] = await Promise.all([
    targetRole === 'sale'
      ? collectSaleRevenue(tx, facilityId, appUserId, period)
      : collectTeacherHours(tx, facilityId, appUserId, period),
    collectActualShifts(tx, facilityId, appUserId, period),
  ]);

  const value = tier
    ? computeKpiValue({
        shiftActual: shiftResult.shiftActual,
        shiftRequired: tier.requiredShifts,
        metricValue,
        metricRequired: Number(tier.requiredMetric),
        unitRate: Number(tier.unitRate),
      })
    : 0;

  const snapshot = {
    value,
    metricValue,
    quotaSnapshot: tier ? tier.requiredMetric : null,
    shiftActual: shiftResult.shiftActual,
    shiftRequired: tier ? tier.requiredShifts : null,
    unitRateSnapshot: tier ? tier.unitRate : null,
    tierIdSnapshot: tier ? tier.id : null,
  };

  const existing = await tx.kpiScore.findFirst({ where: { appUserId, period } });

  let score: Prisma.KpiScoreGetPayload<Record<string, never>>;
  if (!existing) {
    try {
      score = await tx.kpiScore.create({
        data: { facilityId, appUserId, period, status: 'draft', ...snapshot },
      });
    } catch (err) {
      if (!isPrismaErrorCode(err, 'P2002')) throw err;
      // Concurrent create won the [appUserId, period] unique race — fall
      // through to the same draft-only update guard as the "existing" branch.
      const raced = await tx.kpiScore.findFirstOrThrow({ where: { appUserId, period } });
      score = raced.status === 'draft' ? await draftUpdateOrCurrent(tx, raced.id, snapshot) : raced;
    }
  } else if (existing.status === 'draft') {
    score = await draftUpdateOrCurrent(tx, existing.id, snapshot);
  } else {
    score = existing; // never overwrite submitted+
  }

  return { score, tierMissing };
}

async function draftUpdateOrCurrent(
  tx: Prisma.TransactionClient,
  id: string,
  data: Record<string, unknown>,
): Promise<Prisma.KpiScoreGetPayload<Record<string, never>>> {
  try {
    return await tx.kpiScore.update({
      where: { id, status: 'draft' },
      data: { ...data, updatedAt: new Date() },
    });
  } catch (err) {
    if (!isPrismaErrorCode(err, 'P2025')) throw err;
    // Raced with a concurrent status change (e.g. submitSlip) between our
    // read and this write — return the row as it now stands, untouched.
    return tx.kpiScore.findFirstOrThrow({ where: { id } });
  }
}
