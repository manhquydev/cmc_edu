// Playwright global setup: spawns the real api server (apps/api/src/server.ts,
// via `tsx` — no prior build required) on an OS-assigned free port, waits for
// it to answer `health`, then bootstraps a dedicated Facility for this run
// via a real `facility.create` call (super_admin bypasses `requireValidFacility`
// — apps/api/src/trpc.ts — which is what makes bootstrapping the very first
// facility possible at all). Returning a function from `globalSetup` makes
// Playwright call it as the matching teardown (kills the server, deletes the
// facility and everything scoped to it) — see https://playwright.dev global
// setup/teardown docs.
//
// `APP_DATABASE_URL` (and `DATABASE_URL`, needed only for the Attendance
// teardown delete — see ../src/db.ts) must already be set in the environment
// this runs in, same as every other integration test in this repo
// (apps/api/src/test/db.ts has the identical expectation) — this file does
// not load a .env file itself, it only forwards `process.env` to the spawned
// server.

import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';
import { cleanupFacility, disconnectDb } from './db.js';
import { findFreePort } from './find-free-port.js';
import { createStaffClient } from './trpc-client.js';

const require = createRequire(import.meta.url);

const HEALTH_TIMEOUT_MS = 20_000;
const HEALTH_POLL_INTERVAL_MS = 200;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required to run @cmc/e2e — set it the same way apps/api's own integration ` +
        `tests expect (see apps/api/src/test/db.ts), then re-run \`pnpm --filter @cmc/e2e test\`.`,
    );
  }
  return value;
}

async function waitForHealth(baseUrl: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`api server exited early (code ${child.exitCode}) before becoming healthy.`);
    }
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
      lastError = new Error(`GET /health returned ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }
  throw new Error(`api server did not become healthy within ${HEALTH_TIMEOUT_MS}ms: ${String(lastError)}`);
}

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const appDatabaseUrl = requireEnv('APP_DATABASE_URL');
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const tsxCli = require.resolve('tsx/cli');
  const serverEntry = fileURLToPath(new URL('../../api/src/server.ts', import.meta.url));

  const child = spawn(process.execPath, [tsxCli, serverEntry], {
    env: { ...process.env, PORT: String(port), APP_DATABASE_URL: appDatabaseUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(`[e2e:api] ${chunk}`));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[e2e:api] ${chunk}`));

  try {
    await waitForHealth(baseUrl, child);
  } catch (error) {
    child.kill();
    throw error;
  }

  // Bootstrap: super_admin's `facilityId` header value is never read for
  // `facility.create` (Facility carries no RLS policy, and the procedure
  // never calls `scoped(ctx)`) — the placeholder below is required only to
  // satisfy the dev-header's schema shape (apps/api/src/context.ts).
  const bootstrapClient = createStaffClient(baseUrl, {
    userId: 'e2e-bootstrap',
    roles: ['super_admin'],
    facilityId: 'bootstrap',
  });
  const facility = await bootstrapClient.facility.create.mutate({
    name: `E2E Run ${new Date().toISOString()}`,
  });

  process.env.E2E_BASE_URL = baseUrl;
  process.env.E2E_FACILITY_ID = facility.id;

  return async () => {
    child.kill();
    try {
      await cleanupFacility(facility.id);
    } finally {
      await disconnectDb();
    }
  };
}
