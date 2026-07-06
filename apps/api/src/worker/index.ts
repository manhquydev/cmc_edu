// Standalone worker entrypoint (K2/K6 remediation) — the "Outbox Worker"
// docs/09 (C4) already draws but that never existed in the repo. Runs as a
// separate process from the tRPC HTTP server (`server.ts`), on an interval,
// draining both `reconcileOrphanedReceipts` (money-orphan recovery) and
// `relayEmailOutbox` (notification delivery).
//
// The loop itself is deliberately thin: all real logic lives in the two pure,
// independently-testable drain functions this file imports. Tests call those
// functions directly — never this timer.

import { createPrismaClient } from '@cmc/db';
import { reconcileOrphanedReceipts } from './reconcile-orphaned-receipts.js';
import { relayEmailOutbox } from './relay-email-outbox.js';

/** No decision doc pins a concrete poll interval — 30s is a placeholder
 * (same caveat as the other placeholder constants in this codebase, e.g.
 * `finance/router.ts`'s `APPROVAL_SECOND_EYE_THRESHOLD`), configurable via
 * env for ops tuning without a code change. */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One drain cycle: reconcile orphaned receipts, then relay outbox email.
 * Exported for tests — asserts both drains run without needing the timer. */
export async function drainOnce(db: ReturnType<typeof createPrismaClient>): Promise<void> {
  await reconcileOrphanedReceipts(db);
  await relayEmailOutbox(db);
}

async function runForever(): Promise<never> {
  const db = createPrismaClient();
  const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);

  for (;;) {
    try {
      await drainOnce(db);
    } catch (error) {
      // A drain cycle failing must not kill the worker process — log and
      // retry on the next tick.
      // eslint-disable-next-line no-console
      console.error('[worker] drain cycle failed', error);
    }
    await sleep(pollIntervalMs);
  }
}

// Only start the loop when this file is executed directly (`node
// dist/worker/index.js` / `tsx src/worker/index.ts`), never on import — so
// tests and other modules can import `drainOnce`/the individual drain
// functions without side effects.
const isMainModule = process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  void runForever();
}
