#!/usr/bin/env node
/**
 * Headless Chromium audit of the running local-sim (self-signed TLS).
 * Independent of CI ui-chromium / journeys.json.
 *
 * Usage:
 *   LOCAL_SIM_LIVE=1 node scripts/live-sim-browser-audit.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requireFromE2e = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/e2e/package.json'),
);
const { chromium } = requireFromE2e('@playwright/test');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ERP = process.env.LOCAL_SIM_BASE ?? 'https://erp.localhost';
const OUT = path.join(root, 'plans/reports/live-sim-audit');
const ACCOUNTS = path.join(root, '.env.local-sim-accounts');

if (process.env.LOCAL_SIM_LIVE !== '1') {
  throw new Error('Set LOCAL_SIM_LIVE=1 to confirm you are driving the local-sim browser.');
}

function account(email) {
  const map = {};
  for (const line of readFileSync(ACCOUNTS, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    map[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  const password = map[email];
  if (!password) throw new Error(`Missing ${email} in .env.local-sim-accounts`);
  return { email, password };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const findings = [];
  const gddt = account('gddt@cmcvn.edu.vn');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1400, height: 900 },
    locale: 'vi-VN',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file });
    return file;
  };

  await page.goto(`${ERP}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
  await shot('01-login');
  const bodyText = await page.locator('body').innerText();
  if (/Đăng nhập \(Dev\)/i.test(bodyText)) findings.push({ sev: 'critical', msg: 'Dev login visible' });
  const loginBtn = page.getByRole('button', { name: 'Đăng nhập', exact: true });
  if (!(await loginBtn.isVisible())) findings.push({ sev: 'critical', msg: 'Missing Đăng nhập button' });

  await page.locator('input[type="email"]').fill(gddt.email);
  await page.locator('input[type="password"]').fill(gddt.password);
  await loginBtn.click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await shot('02-after-login');
  if (page.url().includes('/login')) findings.push({ sev: 'critical', msg: 'Still on /login after submit' });

  await page.goto(`${ERP}/design`, { waitUntil: 'networkidle', timeout: 30_000 });
  await shot('03-design-gallery');
  const galleryText = await page.locator('body').innerText();
  if (!/FilterBar|StatCard|StatusBadge|EmptyState|họ|gallery|Thiết kế|Console/i.test(galleryText)) {
    findings.push({ sev: 'warn', msg: `gallery copy mismatch at ${page.url()}` });
  }

  await page.goto(`${ERP}/teaching`, { waitUntil: 'networkidle', timeout: 30_000 });
  await shot('04-teaching');
  const teachingUrl = page.url();
  const teachingText = await page.locator('body').innerText();

  await browser.close();

  const blockingConsole = consoleErrors.filter((t) => !/401 \(Unauthorized\)/.test(t));
  const report = {
    generatedAt: new Date().toISOString(),
    target: ERP,
    role: 'giam_doc_dao_tao',
    teachingUrl,
    teachingHasContent: teachingText.trim().length > 40,
    consoleErrors,
    findings,
    screenshots: ['01-login.png', '02-after-login.png', '03-design-gallery.png', '04-teaching.png'],
    ok: findings.every((f) => f.sev !== 'critical') && blockingConsole.length === 0,
  };
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`live-sim-browser-audit  ${report.ok ? 'ok' : 'FAIL'}  findings=${findings.length} consoleErrors=${consoleErrors.length}`);
  for (const f of findings) console.log(`  [${f.sev}] ${f.msg}`);
  if (consoleErrors.length) console.log(`  console: ${consoleErrors.slice(0, 5).join(' | ')}`);
  console.log(`  -> ${OUT}`);
  process.exitCode = report.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
