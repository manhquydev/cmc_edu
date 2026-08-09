// Derived "rotting" flag for open opportunities (P2).
// Computed at read time — no worker, no flag table.
//
// Definition (v1 / P2-only): open (not lost, not O5) and stage clock older
// than ROTTING_THRESHOLD_DAYS. P4 will also exclude rows with nextActionAt > now.

export const DEFAULT_ROTTING_THRESHOLD_DAYS = 7;

export function getRottingThresholdDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.ROTTING_THRESHOLD_DAYS;
  if (raw === undefined || raw === '') return DEFAULT_ROTTING_THRESHOLD_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ROTTING_THRESHOLD_DAYS;
}

export interface RottingShape {
  stage: string;
  closedAt: Date | null;
  stageChangedAt: Date | null;
  createdAt: Date;
  /** When set and in the future, the opp is actively worked (P4) — not rotting. */
  nextActionAt?: Date | null;
}

/**
 * True when the opportunity is open and its stage clock is older than the
 * threshold. Boundary: rotting when anchor < now - threshold (strictly older
 * than threshold days — age > threshold).
 */
export function isOpportunityRotting(
  opp: RottingShape,
  now: Date = new Date(),
  thresholdDays: number = getRottingThresholdDays(),
): boolean {
  if (opp.stage === 'O5_ENROLLED') return false;
  // Lost (or any non-O5 close) — not "open" for rotting purposes.
  if (opp.closedAt != null) return false;
  // P4 coordination: future next-action means actively worked.
  if (opp.nextActionAt != null && opp.nextActionAt.getTime() > now.getTime()) {
    return false;
  }
  const anchor = opp.stageChangedAt ?? opp.createdAt;
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return anchor.getTime() < now.getTime() - thresholdMs;
}
