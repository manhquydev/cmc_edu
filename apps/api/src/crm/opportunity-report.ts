// Read-only aggregates for the CRM recruitment report (P1 báo cáo tuyển sinh).
// Pure helpers + typed result shape — the tRPC procedure in router.ts wires
// withFacility / requirePermission / own-only assignee filter.

import type { Prisma } from '@cmc/db';

/** Prisma where-fragment for "not lost" — open (no closedAt) OR won (O5). */
export const NOT_LOST_WHERE: Prisma.OpportunityWhereInput = {
  OR: [{ closedAt: null }, { stage: 'O5_ENROLLED' }],
};

/** Prisma where-fragment for "lost" — closed without enrolling. */
export const LOST_WHERE: Prisma.OpportunityWhereInput = {
  closedAt: { not: null },
  stage: { not: 'O5_ENROLLED' },
};

/** Days after period end still considered "too recent to convert" (right-censor). */
export const RIGHT_CENSOR_DAYS = 14;

export interface OpportunityReportInput {
  from: Date;
  to: Date;
  facilityId: string;
  /** When set, byAssignee is restricted to this AppUser.id (sale own-only). */
  ownAssigneeId: string | null;
  now?: Date;
}

export interface StageCountRow {
  stage: string;
  count: number;
}

export interface ReasonCountRow {
  reason: string;
  count: number;
}

export interface SourceOutcomeRow {
  source: string | null;
  enrolled: number;
  lost: number;
  total: number;
}

export interface AssigneeOutcomeRow {
  assignedToId: string | null;
  fullName: string | null;
  enrolled: number;
  lost: number;
  total: number;
}

export interface OpportunityReportResult {
  funnelSnapshot: {
    /** Time label: always "current snapshot", no date filter. */
    timeLabel: 'current';
    stageCounts: Record<string, number>;
    lostCount: number;
  };
  intakeCohort: {
    timeLabel: 'createdAt';
    from: string;
    to: string;
    totalCreated: number;
    enrolledCount: number;
    lostCount: number;
    openCount: number;
    /** enrolled / totalCreated, 0 when empty. */
    conversionRate: number;
    rightCensoringWarning: boolean;
  };
  closedOutcomes: {
    timeLabel: 'closedAt';
    from: string;
    to: string;
    enrolledCount: number;
    lostCount: number;
    lostByReason: ReasonCountRow[];
    bySource: SourceOutcomeRow[];
    byAssignee: AssigneeOutcomeRow[];
  };
}

export function isRightCensored(periodTo: Date, now: Date, days = RIGHT_CENSOR_DAYS): boolean {
  const ms = days * 24 * 60 * 60 * 1000;
  return periodTo.getTime() > now.getTime() - ms;
}

/**
 * withFacility transaction client surface used by the report. Prisma's groupBy
 * generics are deliberately narrowed so the helper stays readable.
 */
export type OpportunityReportDb = {
  opportunity: {
    // Prisma groupBy is heavily generic; callers pass a real TransactionClient.
    groupBy: (args: {
      by: ('stage' | 'lostReason' | 'source' | 'assignedToId')[];
      where: Prisma.OpportunityWhereInput;
      _count: { _all: true };
    }) => Promise<
      Array<{
        stage?: string;
        lostReason?: string | null;
        source?: string | null;
        assignedToId?: string | null;
        _count: { _all: number };
      }>
    >;
    count: (args: { where: Prisma.OpportunityWhereInput }) => Promise<number>;
  };
  appUser: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; fullName: true };
    }) => Promise<Array<{ id: string; fullName: string }>>;
  };
};

/**
 * Run all report aggregates inside an already-opened withFacility transaction.
 */
export async function buildOpportunityReport(
  tx: OpportunityReportDb,
  input: OpportunityReportInput,
): Promise<OpportunityReportResult> {
  const { facilityId, from, to, ownAssigneeId } = input;
  const now = input.now ?? new Date();
  const facilityWhere: Prisma.OpportunityWhereInput = { facilityId };
  const createdInPeriod: Prisma.OpportunityWhereInput = {
    AND: [facilityWhere, { createdAt: { gte: from, lte: to } }],
  };
  const closedInPeriod: Prisma.OpportunityWhereInput = {
    AND: [facilityWhere, { closedAt: { gte: from, lte: to } }],
  };

  const [
    stageCountRows,
    lostCount,
    totalCreated,
    enrolledInCohort,
    lostInCohort,
    closedEnrolled,
    closedLost,
    lostReasonRows,
    closedBySourceStage,
    closedByAssigneeStage,
  ] = await Promise.all([
    tx.opportunity.groupBy({
      by: ['stage'],
      where: { AND: [facilityWhere, NOT_LOST_WHERE] },
      _count: { _all: true },
    }),
    tx.opportunity.count({ where: { AND: [facilityWhere, LOST_WHERE] } }),
    tx.opportunity.count({ where: createdInPeriod }),
    tx.opportunity.count({
      where: { AND: [createdInPeriod, { stage: 'O5_ENROLLED' }] },
    }),
    tx.opportunity.count({
      where: { AND: [createdInPeriod, LOST_WHERE] },
    }),
    tx.opportunity.count({
      where: { AND: [closedInPeriod, { stage: 'O5_ENROLLED' }] },
    }),
    tx.opportunity.count({
      where: { AND: [closedInPeriod, LOST_WHERE] },
    }),
    tx.opportunity.groupBy({
      by: ['lostReason'],
      where: { AND: [closedInPeriod, LOST_WHERE] },
      _count: { _all: true },
    }),
    tx.opportunity.groupBy({
      by: ['source', 'stage'],
      where: closedInPeriod,
      _count: { _all: true },
    }),
    tx.opportunity.groupBy({
      by: ['assignedToId', 'stage'],
      where: ownAssigneeId
        ? { AND: [closedInPeriod, { assignedToId: ownAssigneeId }] }
        : closedInPeriod,
      _count: { _all: true },
    }),
  ]);

  const stageCounts: Record<string, number> = {};
  for (const row of stageCountRows) {
    if (row.stage) stageCounts[row.stage] = row._count._all;
  }

  const openCount = Math.max(0, totalCreated - enrolledInCohort - lostInCohort);
  const conversionRate = totalCreated > 0 ? enrolledInCohort / totalCreated : 0;

  const lostByReason: ReasonCountRow[] = lostReasonRows
    .filter((r) => r.lostReason != null)
    .map((r) => ({ reason: r.lostReason as string, count: r._count._all }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const bySource = foldOutcomes(
    closedBySourceStage.map((r) => ({
      key: r.source ?? null,
      stage: r.stage ?? '',
      count: r._count._all,
    })),
  ).map((r) => ({
    source: r.key,
    enrolled: r.enrolled,
    lost: r.lost,
    total: r.total,
  }));

  const assigneeFold = foldOutcomes(
    closedByAssigneeStage.map((r) => ({
      key: r.assignedToId ?? null,
      stage: r.stage ?? '',
      count: r._count._all,
    })),
  );

  const assigneeIds = assigneeFold
    .map((r) => r.key)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const owners =
    assigneeIds.length > 0
      ? await tx.appUser.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, fullName: true },
        })
      : [];
  const nameById = new Map(owners.map((o) => [o.id, o.fullName]));

  const byAssignee: AssigneeOutcomeRow[] = assigneeFold
    .map((r) => ({
      assignedToId: r.key,
      fullName: r.key ? (nameById.get(r.key) ?? null) : null,
      enrolled: r.enrolled,
      lost: r.lost,
      total: r.total,
    }))
    .sort((a, b) => b.total - a.total || (a.fullName ?? '').localeCompare(b.fullName ?? ''));

  return {
    funnelSnapshot: {
      timeLabel: 'current',
      stageCounts,
      lostCount,
    },
    intakeCohort: {
      timeLabel: 'createdAt',
      from: from.toISOString(),
      to: to.toISOString(),
      totalCreated,
      enrolledCount: enrolledInCohort,
      lostCount: lostInCohort,
      openCount,
      conversionRate,
      rightCensoringWarning: isRightCensored(to, now),
    },
    closedOutcomes: {
      timeLabel: 'closedAt',
      from: from.toISOString(),
      to: to.toISOString(),
      enrolledCount: closedEnrolled,
      lostCount: closedLost,
      lostByReason,
      bySource,
      byAssignee,
    },
  };
}

function foldOutcomes(
  rows: Array<{ key: string | null; stage: string; count: number }>,
): Array<{ key: string | null; enrolled: number; lost: number; total: number }> {
  const map = new Map<string | null, { enrolled: number; lost: number; total: number }>();
  for (const row of rows) {
    const cur = map.get(row.key) ?? { enrolled: 0, lost: 0, total: 0 };
    cur.total += row.count;
    if (row.stage === 'O5_ENROLLED') cur.enrolled += row.count;
    else if (row.stage !== 'O5_ENROLLED') {
      // Closed-in-period rows are either enrolled or lost (closed without O5).
      // Open stages should not appear because closedAt is set — treat non-O5 as lost.
      cur.lost += row.count;
    }
    map.set(row.key, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.total - a.total);
}
