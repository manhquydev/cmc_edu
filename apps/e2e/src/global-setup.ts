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
import { mintStaffCookie } from './session-injection.js';
import { createSignedStaffClient, createStaffClient } from './trpc-client.js';

const require = createRequire(import.meta.url);

const HEALTH_TIMEOUT_MS = 20_000;
const HEALTH_POLL_INTERVAL_MS = 200;

// UI-mode (PLAYWRIGHT_UI=1) runs the api server on a FIXED port instead of an
// OS-assigned free one. admin/lms's `ui-chromium` preview servers are static
// builds with VITE_API_URL baked in at build time (Vite replaces
// import.meta.env at build time, not at request time) — playwright.config.ts
// rebuilds both apps with VITE_API_URL pointed at this exact port before
// starting `preview`, so the fixed port has to match here. Not used for the
// `api` project (API-driven specs talk to the server directly, no static
// build in between, so a free port is fine and avoids collisions with a
// developer's already-running local stack on 3000/3999).
const UI_MODE_API_PORT = 3999;

/** Real pilot DB name (docs/runbook-deploy.md) — the local-sim stack's
 * `cmc_prod` seeds a real super_admin. e2e must never run destructive
 * facility.create/cleanupFacility writes against it. Fail-closed: any parse
 * failure or a match on this name aborts before the server is even spawned
 * (gap-closure 260710-0005 Phase 3, red-team F6). This guard is the single
 * shared checkpoint — apps/api/src/test/db.ts integration tests rely on the
 * same env-var convention but don't share this file. */
const FORBIDDEN_DATABASE_NAME = 'cmc_prod';

function assertNotProdDatabase(databaseUrl: string): void {
  let dbName: string;
  try {
    dbName = new URL(databaseUrl).pathname.replace(/^\//, '');
  } catch {
    throw new Error(`APP_DATABASE_URL is not a valid URL — refusing to run e2e (fail-closed): ${databaseUrl}`);
  }
  if (dbName === FORBIDDEN_DATABASE_NAME) {
    throw new Error(
      `@cmc/e2e refuses to run against database "${FORBIDDEN_DATABASE_NAME}" — this is the real pilot ` +
        `database, not a throwaway. Point APP_DATABASE_URL/DATABASE_URL at a throwaway DB (e.g. ` +
        `"cmc_staging") before running \`pnpm --filter @cmc/e2e test\`.`,
    );
  }
}

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
  assertNotProdDatabase(appDatabaseUrl);
  const port = process.env['PLAYWRIGHT_UI'] ? UI_MODE_API_PORT : await findFreePort();
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

  // Bootstrap: create a facility using the appropriate auth mode.
  // Mode-A (dev-header, NODE_ENV !== 'production'): x-dev-user JSON header.
  // Mode-B (signed cookie, NODE_ENV = 'production'): mintStaffCookie — uses
  // STAFF_SESSION_SECRET from env (same secret as the running API stack).
  // The facilityId in bootstrap claims is a placeholder — facility.create
  // ignores it (no RLS policy on Facility table).
  const isProdMode = process.env['NODE_ENV'] === 'production';
  const bootstrapClient = isProdMode
    ? createSignedStaffClient(
        baseUrl,
        mintStaffCookie({ userId: 'e2e-bootstrap', roles: ['super_admin'], facilityId: 'bootstrap' }),
      )
    : createStaffClient(baseUrl, { userId: 'e2e-bootstrap', roles: ['super_admin'], facilityId: 'bootstrap' });
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
