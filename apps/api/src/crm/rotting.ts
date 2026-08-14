// Derived "rotting" flag for open opportunities (P2).
// Computed at read time — no worker, no flag table.
//
// Open (not lost, not O5) and stage clock older than the per-stage
// threshold. Future nextActionAt means actively worked — not rotting.

import type { Prisma } from '@cmc/db';

type OpportunityStage = Prisma.OpportunityGetPayload<object>['stage'];

export const ROTTING_THRESHOLD_DAYS_BY_STAGE = {
  O1_LEAD: 7,
  O2_CONTACTED: 7,
  O3_TEST_SCHEDULED: 14,
  O4_TESTED: 7,
  O5_ENROLLED: Number.POSITIVE_INFINITY,
} as const satisfies Record<OpportunityStage, number>;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RottingShape {
  stage: string;
  closedAt: Date | null;
  stageChangedAt: Date | null;
  createdAt: Date;
  /** When set and in the future, the opp is actively worked (P4) — not rotting. */
  nextActionAt?: Date | null;
}

function thresholdDaysFor(stage: string): number {
  if (stage in ROTTING_THRESHOLD_DAYS_BY_STAGE) {
    return ROTTING_THRESHOLD_DAYS_BY_STAGE[stage as OpportunityStage];
  }
  return Number.POSITIVE_INFINITY;
}

function isExcludedFromRotting(opp: RottingShape, now: Date): boolean {
  if (opp.stage === 'O5_ENROLLED') return true;
  if (opp.closedAt != null) return true;
  if (opp.nextActionAt != null && opp.nextActionAt.getTime() > now.getTime()) {
    return true;
  }
  return false;
}

function stageAgeMs(opp: RottingShape, now: Date): number {
  const anchor = opp.stageChangedAt ?? opp.createdAt;
  return now.getTime() - anchor.getTime();
}

/**
 * Whole days the stage clock has been idle, or `null` when the row is not
 * rotting (O5 / lost / future next-action / still inside the threshold).
 */
export function rottingAgeDays(opp: RottingShape, now: Date = new Date()): number | null {
  if (isExcludedFromRotting(opp, now)) return null;
  const ageMs = stageAgeMs(opp, now);
  const thresholdMs = thresholdDaysFor(opp.stage) * DAY_MS;
  if (!(ageMs > thresholdMs)) return null;
  return Math.floor(ageMs / DAY_MS);
}

/**
 * True when the opportunity is open and its stage clock is older than the
 * per-stage threshold. Boundary: rotting when age > threshold (strictly older).
 */
export function isOpportunityRotting(opp: RottingShape, now: Date = new Date()): boolean {
  return rottingAgeDays(opp, now) != null;
}
