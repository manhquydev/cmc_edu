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
// webServer preview servers only start when PLAYWRIGHT_UI=1, preventing spurious
// build-artifact failures on API-only CI runs.

import { defineConfig, devices } from '@playwright/test';

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
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  globalSetup: './src/global-setup.ts',

  projects: [
    {
      name: 'api',
      testMatch: /(?<!\.ui)\.spec\.ts$/,
    },
    {
      name: 'ui-chromium',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4174',
      },
      testMatch: /\.ui\.spec\.ts$/,
    },
  ],

  webServer: uiServers,
});
