// Live-domain (REAL ENVIRONMENT) Playwright config — a SEPARATE config from
// playwright.config.ts, targeting the production stack served at
//   admin ERP: https://erp.clawcmc.io.vn
//   LMS      : https://hoc.clawcmc.io.vn
// (Cloudflare → Caddy → tunnel → local nginx; the API is same-origin under
// /trpc and /auth on both domains — infra/nginx/api-locations.conf).
//
// WHY THIS FILE EXISTS SEPARATELY (do not merge into playwright.config.ts):
//  1. The existing globalSetup (src/global-setup.ts) FAILS CLOSED on the
//     literal DB name cmc_prod (src/assert-not-prod.ts) and would spawn a
//     second API + delete a run facility on teardown. The live suite must
//     never touch the live DB (except read-only EmailOutbox OTP reads via
//     docker exec psql) and must never tear down anything.
//  2. baseURLs point at live domains, not local preview servers; there is no
//     webServer (the live stack is already up) and no DB bootstrap.
//  3. The existing json reporter writes acceptance-results/journeys.json
//     which the acceptance ledger refuses on gitSha mismatch — live evidence
//     goes to plans/reports/uat-live-<ts>/ instead (src/live/live-evidence.ts).
//
// SAFETY GATE: like the main config's PLAYWRIGHT_UI gate, this config only
// registers its projects when PLAYWRIGHT_LIVE=1. Running the config without
// the gate throws a clear error instead of accidentally driving real logins
// against the production domains.

import { execFileSync } from 'node:child_process';

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const GATE = 'PLAYWRIGHT_LIVE';
if (process.env[GATE] !== '1') {
  throw new Error(
    `This config targets the LIVE production domains and is gated: set ${GATE}=1 to run it. ` +
      'Example: PLAYWRIGHT_LIVE=1 pnpm --filter @cmc/e2e test --config=playwright.live.config.ts',
  );
}

function gitSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function gitDirty(): boolean {
  if (process.env.GIT_SHA) return false;
  try {
    return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
  } catch {
    return false;
  }
}

export const LIVE_ADMIN_ORIGIN = 'https://erp.clawcmc.io.vn';
export const LIVE_LMS_ORIGIN = 'https://hoc.clawcmc.io.vn';

// The LMS-parent spec is the ONLY live spec that runs against the LMS origin.
const LMS_PARENT_SPEC = /04-parent-otp\.spec\.ts$/;

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  workers: 1, // rate-limit pacing: one browser flow at a time
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 180_000,
  reporter: (process.env.CI ? 'github' : 'list') as PlaywrightTestConfig['reporter'],
  metadata: { gitSha: gitSha(), gitDirty: gitDirty(), live: true },
  // Health-check only — never spawns a server, never touches the DB.
  globalSetup: './src/live/live-global-setup.ts',

  use: {
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    // ignoreHTTPSErrors is NOT set: the live stack is behind real public TLS.
  },

  outputDir: 'test-results-live',

  projects: [
    {
      name: 'live-admin',
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_ADMIN_ORIGIN },
      testMatch: /\.spec\.ts$/,
      testIgnore: LMS_PARENT_SPEC,
    },
    {
      name: 'live-lms',
      use: { ...devices['Desktop Chrome'], baseURL: LIVE_LMS_ORIGIN },
      testMatch: LMS_PARENT_SPEC,
    },
  ],
});