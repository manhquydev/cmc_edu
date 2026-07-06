// API-driven e2e config — no browser is ever launched (no spec uses the
// `page`/`browser` fixtures), so this is Playwright-as-test-runner only.
// `globalSetup` spawns the real api server + bootstraps a per-run Facility
// (./src/global-setup.ts) and its returned teardown tears both down.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  globalSetup: './src/global-setup.ts',
});
