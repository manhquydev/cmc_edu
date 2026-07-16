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

import { createServer } from 'node:http';
import { createPrismaClient } from '@cmc/db';
import { reconcileOrphanedReceipts, reconcileCancelledButProvisioned } from './reconcile-orphaned-receipts.js';
import { relayEmailOutbox, CONSOLE_TRANSPORT_PROD_FORBIDDEN } from './relay-email-outbox.js';
import { runCancelSweep, runDoneSweep } from './session-done-sweep.js';
import {
  BrevoEmailTransport,
  ConsoleEmailTransport,
  GraphEmailTransport,
  type EmailTransport,
} from './email-transport.js';
import {
  assertAllowDevAuthNotInProd,
  assertCmcAppNotSuperuser,
  assertCmcAppRole,
  assertLmsSecretConfiguredForProd,
} from '../boot-checks.js';

/** No decision doc pins a concrete poll interval — 30s is a placeholder
 * (same caveat as the other placeholder constants in this codebase, e.g.
 * `finance/router.ts`'s `APPROVAL_SECOND_EYE_THRESHOLD`), configurable via
 * env for ops tuning without a code change. */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

// RT-9: Track consecutive drain failures for the health endpoint.
// Resets to 0 on any successful drain; Docker HEALTHCHECK polls the HTTP endpoint.
const MAX_CONSECUTIVE_DRAIN_FAILURES = Number(process.env['WORKER_MAX_DRAIN_FAILURES'] ?? 5);
let consecutiveDrainFailures = 0;

/** Exported for tests — allows asserting health state without starting the server. */
export function isWorkerHealthy(): boolean {
  return consecutiveDrainFailures < MAX_CONSECUTIVE_DRAIN_FAILURES;
}

function startHealthServer(): void {
  const port = Number(process.env['WORKER_HEALTH_PORT'] ?? 3001);
  createServer((_req, res) => {
    if (isWorkerHealthy()) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    } else {
      res.writeHead(503, { 'content-type': 'text/plain' });
      res.end(`fail: ${consecutiveDrainFailures} consecutive drain failures`);
    }
  }).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[worker] health endpoint listening on http://0.0.0.0:${port}/`);
  });
}

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
    const map: Record<string, EmailTransport> = { brevo: new BrevoEmailTransport() };
    // Graph is included only when its env vars are configured — its constructor
    // throws on missing vars (fail-fast), so gating here keeps the worker
    // bootable in Brevo-only deployments. A 'graph' outbox row without Graph
    // configured dead-letters with "no transport configured for: graph" (the
    // correct visible-failure mode) rather than crashing the worker.
    if (process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID &&
        process.env.GRAPH_CLIENT_SECRET && process.env.GRAPH_SENDER_EMAIL) {
      map.graph = new GraphEmailTransport();
    }
    return map;
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
  // Post-implementation hardening (H2): this backstop (C1 layer 2) was built
  // and unit-tested via direct calls only — never wired into the real drain
  // cycle, so it was dead code in production. See drain-once.test.ts.
  await reconcileCancelledButProvisioned(db);
  await relayEmailOutbox(db, transportMap);
  await runDoneSweep(db);
  await runCancelSweep(db);
}

async function runForever(): Promise<never> {
  const db = createPrismaClient();

  // RT-9: Full boot-check suite before entering the drain loop.
  // Worker writes data (reconcile + outbox); wrong URL → RLS bypass.
  assertAllowDevAuthNotInProd();
  assertLmsSecretConfiguredForProd();
  await assertCmcAppNotSuperuser(db);
  await assertCmcAppRole(db);

  const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? DEFAULT_POLL_INTERVAL_MS);

  // Build once at startup — constructors validate env vars here so a
  // misconfigured production deployment fails immediately, not mid-cycle.
  const transportMap = buildTransportMap();

  startHealthServer();

  for (;;) {
    try {
      await drainOnce(db, transportMap);
      // RT-9: heartbeat advances only on successful drain.
      consecutiveDrainFailures = 0;
    } catch (error) {
      consecutiveDrainFailures += 1;
      // eslint-disable-next-line no-console
      console.error(
        `[worker] drain cycle failed (${consecutiveDrainFailures}/${MAX_CONSECUTIVE_DRAIN_FAILURES} consecutive)`,
        error,
      );
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
