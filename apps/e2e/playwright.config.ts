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

const uiServers = process.env.PLAYWRIGHT_UI
  ? [
      {
        command: 'pnpm --filter @cmc/admin preview --port 4173',
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
      {
        command: 'pnpm --filter @cmc/lms preview --port 4174',
        port: 4174,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
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
