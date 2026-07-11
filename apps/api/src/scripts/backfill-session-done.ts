#!/usr/bin/env tsx
// HR remediation phase 7 backfill (docs/26 phase-07, R2 #3): one-time script
// for sessions whose `endTime` predates `SESSION_DONE_ACTIVATED_AT` — the
// sweep worker (../worker/session-done-sweep.ts) only evaluates sessions
// going forward from that instant, so historical sessions that already
// satisfied the 3 done-conditions before the engine existed need this
// one-time pass to become `done` (otherwise their teacher's KPI/payroll
// credit for that period is permanently missing — R2-3, plan.md).
//
// Deliberately a SEPARATE script from any `ALTER TYPE ADD VALUE` migration
// (Postgres invariant: an added enum value cannot be used in the same
// transaction that adds it — precedent: migration 20260706160000, R2 #M4).
//
// `doneAt` is still the REAL historical timestamp evaluateSessionDone
// computes (last present markedAt / confirmed / published) — not the
// activation instant. The "pre-activation sessions get full credit
// regardless of lateness" rule (R2 Scope F3) is applied by the KPI/payroll
// reader of `creditFactor`/`doneAt` (phase 3), not written here.
//
// Usage: tsx apps/api/src/scripts/backfill-session-done.ts

import { createPrismaClient, withFacility, type PrismaClient } from '@cmc/db';
import { SESSION_DONE_ACTIVATED_AT } from '@cmc/domain-time';
import { markSessionDoneIfEligible } from '../class/session-done.js';

export interface BackfillSessionDoneResult {
  candidates: number;
  markedDone: number;
}

/**
 * Evaluates the 3 done-conditions for every `planned|confirmed` session whose
 * `endTime` is strictly before `activatedAt`, marking each eligible one
 * `done`. Idempotent — a session already `done` (or otherwise handled) is
 * not a candidate on a re-run.
 */
export async function backfillSessionDone(
  db: PrismaClient,
  activatedAt: Date = SESSION_DONE_ACTIVATED_AT,
): Promise<BackfillSessionDoneResult> {
  const candidates = await withFacility(
    db,
    null,
    (tx) =>
      tx.classSession.findMany({
        where: { status: { in: ['planned', 'confirmed'] }, endTime: { lt: activatedAt } },
        select: { id: true },
      }),
    { bypass: true },
  );

  let markedDone = 0;
  for (const candidate of candidates) {
    // `now` = activatedAt: every candidate's endTime is already < activatedAt
    // (the query filter above), so evaluateSessionDone's time gate always
    // passes here — this just satisfies its signature, not a real "now".
    const result = await withFacility(
      db,
      null,
      (tx) => markSessionDoneIfEligible(tx, candidate.id, activatedAt),
      { bypass: true },
    );
    if (result) markedDone++;
  }
  return { candidates: candidates.length, markedDone };
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const db = createPrismaClient();
  backfillSessionDone(db)
    .then(async (result) => {
      console.log(`[backfill-session-done] candidates=${result.candidates} markedDone=${result.markedDone}`);
      await db.$disconnect();
    })
    .catch(async (err) => {
      console.error('[backfill-session-done] FAILED:', err instanceof Error ? err.message : err);
      await db.$disconnect();
      process.exit(1);
    });
}
