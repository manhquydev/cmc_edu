// Two project types share this config:
//
//   api          — existing API-driven specs (*.spec.ts). No browser launched.
//                  globalSetup spawns the real API server + ephemeral Facility.
//
//   ui-chromium  — future UI-driven specs (*.ui.spec.ts). Uses Chromium + preview
//                  servers for apps/admin (port 4173) and apps/lms (port 4174).
//                  Run with: PLAYWRIGHT_UI=1 pnpm test --project=ui-chromium
//
// globalSetup (API server + Facility bootstrap) runs for both project types because
// UI specs also hit the real API.
//
// Both the ui-chromium PROJECT and its preview webServers only register when
// PLAYWRIGHT_UI=1. A plain `playwright test` (the default CI e2e job) is therefore
// API-only: registering ui-chromium unconditionally would make CI try to launch a
// browser it never installed and connect to preview servers that never started,
// failing every UI spec. UI specs run via the documented command instead:
//   PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium

import { execFileSync } from 'node:child_process';

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

// Commit the run was executed at, stamped into the report so the acceptance
// ledger can refuse results produced against different code. CI passes it in
// (the checkout there may be detached); locally it is read from git.
function gitSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

// A commit alone does not identify what actually ran: with uncommitted changes
// in the tree, the code under test is not the code at that commit. Recording it
// lets the ledger say so instead of quietly attributing the result to HEAD.
function gitDirty(): boolean {
  try {
    return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
  } catch {
    return false;
  }
}

// The json report is what scripts/acceptance-report ingests to decide which
// flows are "đã chứng minh chạy". Two separate protections keep an API-only run
// from destroying that evidence, because they fail differently:
//
//  1. The reporter is registered ONLY under PLAYWRIGHT_UI — the same gate as
//     the ui-chromium project below. Otherwise a plain API run (which matches
//     no UI specs at all) would rewrite the file with a report containing none
//     of the journey specs, and every flow would silently drop to unproven.
//  2. It is written OUTSIDE `test-results/`. Playwright wipes its outputDir at
//     the start of every run, so a file kept there is deleted by the next API
//     run whatever the reporter does — verified: an api-project run removed it.
const reporter = process.env.PLAYWRIGHT_UI
  ? ([['list'], ['json', { outputFile: 'acceptance-results/journeys.json' }]] as const)
  : process.env.CI
    ? 'github'
    : 'list';

// Must match UI_MODE_API_PORT in src/global-setup.ts. admin/lms bake
// VITE_API_URL into the bundle at build time (Vite replaces import.meta.env
// statically — not readable at request time), so the preview servers below
// rebuild fresh with matching env before every run instead of using
// whatever happened to be in .env. reuseExistingServer: false (even
// locally) so a stale build can never silently serve wrong API calls.
//
// VITE_API_URL is set to '' (relative), NOT the api server's URL directly —
// apps/api/src/server.ts has no CORS support, so a direct cross-origin
// browser call from :4173/:4174 to :3999 would have its response silently
// blocked. VITE_PROXY_API_TARGET instead configures each app's Vite preview
// proxy (vite.config.ts) to forward /trpc, /upload, /auth, /health to the
// real api server, keeping every browser request same-origin.
const UI_API_URL = 'http://127.0.0.1:3999';
const ERP_MOBILE_AUDIT_SPEC = /erp-mobile-viewport-audit\.ui\.spec\.ts$/;

const uiServers = process.env.PLAYWRIGHT_UI
  ? [
      {
        command: 'pnpm --filter @cmc/admin build && pnpm --filter @cmc/admin preview --port 4173',
        port: 4173,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { VITE_API_URL: '', VITE_PROXY_API_TARGET: UI_API_URL },
      },
      {
        command: 'pnpm --filter @cmc/lms build && pnpm --filter @cmc/lms preview --port 4174',
        port: 4174,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { VITE_API_URL: '', VITE_PROXY_API_TARGET: UI_API_URL },
      },
    ]
  : [];

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: reporter as PlaywrightTestConfig['reporter'],
  metadata: { gitSha: gitSha(), gitDirty: gitDirty() },
  timeout: 30_000,
  globalSetup: './src/global-setup.ts',

  projects: [
    {
      name: 'api',
      testMatch: /(?<!\.ui)\.spec\.ts$/,
      testIgnore: /\/live\//,
    },
    // ui-chromium registers only under PLAYWRIGHT_UI=1 (same gate as uiServers
    // above) so the default API-only CI run never picks up browser specs.
    ...(process.env.PLAYWRIGHT_UI
      ? [
          {
            name: 'ui-chromium',
            use: {
              ...devices['Desktop Chrome'],
              baseURL: 'http://localhost:4174',
            },
            testMatch: /\.ui\.spec\.ts$/,
            // ERP mobile audit owns explicit Admin-origin projects below. The
            // legacy project remains LMS-default for its existing broad suite.
            testIgnore: ERP_MOBILE_AUDIT_SPEC,
          },
          {
            name: 'erp-admin-mobile-320',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173', viewport: { width: 320, height: 568 } },
            testMatch: ERP_MOBILE_AUDIT_SPEC,
          },
          {
            name: 'erp-admin-mobile-390',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173', viewport: { width: 390, height: 844 } },
            testMatch: ERP_MOBILE_AUDIT_SPEC,
          },
          {
            name: 'erp-admin-tablet-768',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173', viewport: { width: 768, height: 1024 } },
            testMatch: ERP_MOBILE_AUDIT_SPEC,
          },
          {
            name: 'erp-admin-desktop-1280',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173', viewport: { width: 1280, height: 900 } },
            testMatch: ERP_MOBILE_AUDIT_SPEC,
          },
        ]
      : []),
  ],

  webServer: uiServers,
});
