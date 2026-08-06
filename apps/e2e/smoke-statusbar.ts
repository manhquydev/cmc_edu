/**
 * Ops smoke: DetailPage thin statusbar sticky after admin rebuild.
 * Usage (from apps/e2e): pnpm exec tsx smoke-statusbar.ts
 */
import { chromium } from '@playwright/test';

import {
  assertStickyStatusbar,
  loadProdEnv,
  loginAsSuperAdmin,
  measureDetailStatusbar,
  openSeededDetail,
} from './src/design3/open-seeded-detail.js';

const BASE = 'https://localhost/admin';

const env = loadProdEnv();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  baseURL: BASE,
});
const page = await context.newPage();

try {
  await loginAsSuperAdmin(page, env, { loginUrl: `${BASE}/login` });
} catch (err) {
  console.error(JSON.stringify({ pass: false, stage: 'login', error: String(err) }, null, 2));
  await browser.close();
  process.exit(2);
}

const out: Record<string, unknown> = {};

try {
  const r = await openSeededDetail(page, 'receipt');
  out.receiptPath = r.path;
  const m = await measureDetailStatusbar(page);
  assertStickyStatusbar(m);
  out.receipt = m;
} catch (err) {
  out.receipt = { ok: false, reason: String(err) };
}

try {
  const r = await openSeededDetail(page, 'opportunity');
  out.crmPath = r.path;
  const m = await measureDetailStatusbar(page);
  assertStickyStatusbar(m);
  out.crm = m;
} catch (err) {
  out.crm = { ok: false, reason: String(err) };
}

const receipt = out.receipt as { ok?: boolean; statusbarPosition?: string; summaryPosition?: string };
const crm = out.crm as { ok?: boolean; statusbarPosition?: string; summaryPosition?: string };
const pass =
  !!receipt?.ok &&
  receipt.statusbarPosition === 'sticky' &&
  receipt.summaryPosition !== 'sticky' &&
  !!crm?.ok &&
  crm.statusbarPosition === 'sticky' &&
  crm.summaryPosition !== 'sticky';

console.log(JSON.stringify({ pass, ...out }, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);
