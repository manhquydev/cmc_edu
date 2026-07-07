// Standalone worker entrypoint (K2/K6 remediation) — the "Outbox Worker"
// docs/09 (C4) already draws but that never existed in the repo. Runs as a
// separate process from the tRPC HTTP server (`server.ts`), on an interval,
// draining both `reconcileOrphanedReceipts` (money-orphan recovery) and
// `relayEmailOutbox` (notification delivery).
//
// The loop itself is deliberately thin: all real logic lives in the two pure,
// independently-testable drain functions this file imports. Tests call those
// functions directly — never this timer.
//
// RT-8 prod guard: when NODE_ENV=production this file instantiates the real
// transport implementations (BrevoEmailTransport / GraphEmailTransport).
// Their constructors throw immediately if any required env var is absent —
// the worker crashes fast rather than silently failing to deliver emails.
// ConsoleEmailTransport is refused in production.

import { createPrismaClient } from '@cmc/db';
import { reconcileOrphanedReceipts } from './reconcile-orphaned-receipts.js';
import { relayEmailOutbox, CONSOLE_TRANSPORT_PROD_FORBIDDEN } from './relay-email-outbox.js';
import {
  BrevoEmailTransport,
  ConsoleEmailTransport,
  GraphEmailTransport,
  type EmailTransport,
} from './email-transport.js';

/** No decision doc pins a concrete poll interval — 30s is a placeholder
 * (same caveat as the other placeholder constants in this codebase, e.g.
 * `finance/router.ts`'s `APPROVAL_SECOND_EYE_THRESHOLD`), configurable via
 * env for ops tuning without a code change. */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the transport map for the current environment.
 *
 * Production: real transports whose constructors throw immediately on missing
 * env vars (fail-fast). GraphEmailTransport throws on `send()` for now —
 * its real implementation lands in the Entra SSO phase — but the constructor
 * validates env vars so misconfiguration is caught at startup.
 *
 * Non-production (dev/CI): ConsoleEmailTransport for every transport key so
 * outbox rows are drained without actually sending email. The
 * CONSOLE_TRANSPORT_PROD_FORBIDDEN flag documents why this branch must never
 * execute in production.
 */
function buildTransportMap(): Record<string, EmailTransport> {
  if (process.env.NODE_ENV === 'production') {
    // CONSOLE_TRANSPORT_PROD_FORBIDDEN is checked here as a self-documenting
    // assertion — it is always true; its purpose is to make the guard reason
    // visible in code review and grep results.
    if (!CONSOLE_TRANSPORT_PROD_FORBIDDEN) {
      throw new Error('[worker] internal error: CONSOLE_TRANSPORT_PROD_FORBIDDEN must be true');
    }
    // Constructors throw if required env vars are absent — worker exits before
    // the first drain cycle rather than silently dead-lettering every row.
    return {
      brevo: new BrevoEmailTransport(),
      graph: new GraphEmailTransport(),
    };
  }

  // Development / CI: log instead of sending.
  // eslint-disable-next-line no-console
  console.log('[worker] non-production env — using ConsoleEmailTransport for all transports');
  const stub = new ConsoleEmailTransport();
  return { brevo: stub, graph: stub };
}

/** One drain cycle: reconcile orphaned receipts, then relay outbox email.
 * Exported for tests — asserts both drains run without needing the timer. */
export async function drainOnce(
  db: ReturnType<typeof createPrismaClient>,
  transportMap: Record<string, EmailTransport> = {},
): Promise<void> {
  await reconcileOrphanedReceipts(db);
  await relayEmailOutbox(db, transportMap);
}

async function runForever(): Promise<never> {
  const db = createPrismaClient();
  const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);

  // Build once at startup — constructors validate env vars here so a
  // misconfigured production deployment fails immediately, not mid-cycle.
  const transportMap = buildTransportMap();

  for (;;) {
    try {
      await drainOnce(db, transportMap);
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
