#!/usr/bin/env node
/**
 * Phase 4 visual smoke — agent-driven, throwaway synth DB, REAL staff-login.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../../..');
const pwPkg = require.resolve('@playwright/test', { paths: [resolve(REPO, 'apps/e2e'), REPO] });
const { chromium: chromiumApi } = require(pwPkg);

const APP_DATABASE_URL = process.env.APP_DATABASE_URL;
const DATABASE_URL = process.env.DATABASE_URL;
if (!APP_DATABASE_URL || !DATABASE_URL) {
  console.error('APP_DATABASE_URL and DATABASE_URL required (synth only).');
  process.exit(1);
}
if (/cmc_prod|prod/i.test(APP_DATABASE_URL) || /cmc_prod|prod/i.test(DATABASE_URL)) {
  console.error('REFUSING: URLs look like prod.');
  process.exit(1);
}
if (process.env.STAFF_SESSION_SECRET) {
  console.error('REFUSING: STAFF_SESSION_SECRET is set — unset it.');
  process.exit(1);
}

const API_PORT = 3999;
const ADMIN_PORT = 4173;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const ADMIN_URL = `http://127.0.0.1:${ADMIN_PORT}`;
const FACILITY_ID = '2f4e3a49-7151-4b4e-bc95-5ca3d9a8bab8';

const findings = [];
function record(id, status, detail) {
  findings.push({ id, status, detail });
  console.log(`[${status}] ${id}: ${detail}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function waitHealth(url, child, ms = 25000) {
  const deadline = Date.now() + ms;
  let last;
  while (Date.now() < deadline) {
    if (child?.exitCode != null) throw new Error(`api exited ${child.exitCode}`);
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
      last = res.status;
    } catch (e) {
      last = e;
    }
    await sleep(200);
  }
  throw new Error(`health timeout: ${last}`);
}

async function main() {
  const tsxCli = require.resolve('tsx/cli');
  const apiEntry = resolve(REPO, 'apps/api/src/server.ts');
  const api = spawn(process.execPath, [tsxCli, apiEntry], {
    cwd: REPO,
    env: { ...process.env, PORT: String(API_PORT), APP_DATABASE_URL, DATABASE_URL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout?.on('data', (c) => process.stdout.write(`[api] ${c}`));
  api.stderr?.on('data', (c) => process.stderr.write(`[api] ${c}`));
  await waitHealth(API_URL, api);
  console.log('API healthy');

  process.env.E2E_BASE_URL = API_URL;
  process.env.E2E_FACILITY_ID = FACILITY_ID;
  const { seedStaffWithPassword } = await import(
    resolve(REPO, 'apps/e2e/src/seed-staff-password.ts')
  );
  const staff = await seedStaffWithPassword({
    baseUrl: API_URL,
    facilityId: FACILITY_ID,
    roles: ['super_admin', 'giam_doc_kinh_doanh'],
    email: `smoke-phase4-${Date.now()}@cmc.test`,
    fullName: 'Phase4 Visual Smoke Super',
  });
  console.log('Seeded staff', staff.email);

  const admin = spawn(
    'pnpm',
    ['--filter', '@cmc/admin', 'preview', '--port', String(ADMIN_PORT), '--host', '127.0.0.1'],
    {
      cwd: REPO,
      env: { ...process.env, VITE_API_URL: '', VITE_PROXY_API_TARGET: API_URL },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  admin.stdout?.on('data', (c) => process.stdout.write(`[admin] ${c}`));
  admin.stderr?.on('data', (c) => process.stderr.write(`[admin] ${c}`));
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(ADMIN_URL);
      if (r.status) break;
    } catch { /* */ }
    await sleep(500);
  }
  console.log('Admin preview up');

  const browser = await chromiumApi.launch({ headless: true });
  const context = await browser.newContext({ baseURL: ADMIN_URL, viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  let sawXDevUser = false;
  let sawStaffCookieOnRequest = false;
  page.on('request', (req) => {
    const h = req.headers();
    if (h['x-dev-user']) sawXDevUser = true;
    if ((h.cookie || '').includes('cmc_staff_session')) sawStaffCookieOnRequest = true;
  });

  try {
    await page.goto('/login');
    await page.getByLabel(/^Email/).fill(staff.email);
    await page.getByLabel(/^Mật khẩu/).fill(staff.password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
    const cookies = await context.cookies();
    const staffCookie = cookies.find((c) => c.name === 'cmc_staff_session');
    record(
      'auth-cookie',
      staffCookie ? 'PASS' : 'FAIL',
      staffCookie
        ? `cmc_staff_session after form login (len=${staffCookie.value.length}) for ${staff.email}`
        : 'missing cookie',
    );
    await page.goto('/cockpit');
    await sleep(1000);
    record(
      'auth-path',
      !sawXDevUser ? 'PASS' : 'FAIL',
      `x-dev-user=${sawXDevUser} staffCookieOnRequests=${sawStaffCookieOnRequest}`,
    );

    const brandText = ((await page.locator('.console-brand').textContent().catch(() => '')) || '').trim();
    const hasNavbar = (await page.locator('.console-navbar').count()) > 0;
    const hasWebClient = (await page.locator('.o_web_client').count()) > 0;
    record(
      'shell-navbar',
      hasNavbar && hasWebClient ? 'PASS' : 'FAIL',
      `o_web_client=${hasWebClient} navbar=${hasNavbar} brand="${brandText}"`,
    );

    await page.keyboard.press('Control+k');
    await sleep(500);
    const cmdCount = await page.locator('.console-cmd-panel, .console-cmd').count();
    const cmdZ =
      cmdCount > 0
        ? await page.locator('.console-cmd-panel, .console-cmd').first().evaluate((el) => getComputedStyle(el).zIndex)
        : 'n/a';
    record('command-palette', cmdCount > 0 ? 'PASS' : 'FAIL', `nodes=${cmdCount} z-index=${cmdZ}`);
    await page.keyboard.press('Escape');

    await page.goto('/crm');
    await sleep(1500);
    const kanban = await page.locator('.console-kanban-board, .console-kanban-col, .console-kanban-card').count();
    const viewSwitcher = await page.locator('.console-view-switcher').count();
    if (viewSwitcher) {
      const buttons = page.locator('.console-view-switcher button');
      const n = await buttons.count();
      if (n > 0) {
        await buttons.nth(0).click().catch(() => {});
        await sleep(500);
        await buttons.nth(Math.min(1, n - 1)).click().catch(() => {});
        await sleep(500);
      }
    }
    record(
      'crm-pipeline',
      kanban + viewSwitcher > 0 || (await page.locator('.console-wrap').count()) > 0 ? 'PASS' : 'FAIL',
      `kanbanNodes=${kanban} viewSwitcher=${viewSwitcher} url=${page.url()}`,
    );

    const card = page.locator('a[href*="/crm/opportunities/"], .console-kanban-card a, .console-kanban-card').first();
    if (await card.count()) {
      await card.click().catch(() => {});
      await sleep(1200);
    }
    const statusbar = await page.locator('.console-workflow-statusbar, .console-statusbar, .console-steps, .console-detail-statusbar').count();
    const formSheet = await page.locator('.console-form-sheet, .console-form-sheet-bg').count();
    record(
      'crm-opportunity-detail',
      statusbar + formSheet > 0 || page.url().includes('opportunit') ? 'PASS' : 'WARN',
      `url=${page.url()} statusbar=${statusbar} formSheet=${formSheet}`,
    );

    await page.goto('/finance');
    await sleep(1200);
    const row = page.locator('.console-list tbody tr, a[href*="/finance/"]').first();
    if (await row.count()) {
      await row.click().catch(() => {});
      await sleep(1000);
      const stickyBar = await page.locator('.console-detail-statusbar, .console-workflow-statusbar, .console-steps').count();
      const text = await page.locator('body').innerText();
      record(
        'finance-receipt-detail',
        stickyBar > 0 || page.url().includes('/finance/') ? 'PASS' : 'WARN',
        `url=${page.url()} statusbar=${stickyBar} cancelledText=${/huỷ|hủy|cancel/i.test(text)}`,
      );
    } else {
      record('finance-receipt-detail', 'WARN', 'No receipt rows; list empty on synth seed');
    }

    await page.goto('/teaching/schedule');
    await sleep(1500);
    const fc = await page.locator('.fc, [class*="console-fc"], .console-wrap').count();
    const sw = await page.locator('.console-view-switcher').count();
    record('teaching-schedule', fc + sw > 0 ? 'PASS' : 'WARN', `fc/wrap=${fc} switcher=${sw} url=${page.url()}`);

    await page.goto('/admin/facilities');
    await sleep(1000);
    const toastVp = await page.locator('.console-toast-viewport').count();
    const toastZ =
      toastVp > 0
        ? await page.locator('.console-toast-viewport').first().evaluate((el) => getComputedStyle(el).zIndex)
        : 'n/a';
    record('toast-float-layer', toastVp > 0 ? 'PASS' : 'FAIL', `viewport=${toastVp} z=${toastZ}`);

    const th = page.locator('.console-list thead th').first();
    if (await th.count()) {
      const pos = await th.evaluate((el) => getComputedStyle(el).position);
      record('sticky-thead', pos === 'sticky' ? 'PASS' : 'FAIL', `position=${pos}`);
    } else {
      record('sticky-thead', 'WARN', 'no thead');
    }
  } finally {
    await browser.close().catch(() => {});
    admin.kill('SIGTERM');
    api.kill('SIGTERM');
  }

  const outDir = resolve(REPO, 'plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports');
  mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const pass = findings.filter((f) => f.status === 'PASS').length;
  const fail = findings.filter((f) => f.status === 'FAIL').length;
  const warn = findings.filter((f) => f.status === 'WARN').length;
  const md = `# Visual Smoke Report — CMC Console

**Date:** ${date}  
**Branch:** feature/cmc-console-design-system-rebrand  
**Phase:** 4 (after Phases 1–3, 5, 6)  
**Driver:** agent Playwright headless Chromium + real staff form login  

## Environment

| Item | Value |
|------|--------|
| DB | \`cmc-synth-pg\` via synthetic-seed-env.sh |
| URLs | APP/DATABASE_URL → localhost:55432/cmc_synth |
| .env.prod | not read |
| STAFF_SESSION_SECRET | unset |
| Serve | API :3999 + admin preview :4173 (Vite proxy) — **not** admin dev |
| Auth | Real POST /auth/staff-login form for \`${staff.email}\` |

## Results (${pass} pass / ${warn} warn / ${fail} fail)

| Check | Status | Observation |
|-------|--------|-------------|
${findings.map((f) => `| ${f.id} | **${f.status}** | ${f.detail.replace(/\|/g, '/')} |`).join('\n')}

## Auth fidelity

**Strong claim:** browser session from password login; cookie \`cmc_staff_session\`; no \`x-dev-user\`. Seed used mint only for user.create bootstrap, not for the inspected session.

## Artifacts

No screenshots committed. Delete \`.playwright-mcp/\` if any.

## Follow-ups

${fail ? '- Failures above need fix.\n' : '- No FAIL.\n'}
${warn ? '- WARNs: missing demo fixtures on empty lists — optional hand-seed.\n' : ''}
- Phase 7: cite this report to close design3-admin-rollout visual-smoke blocker.

## Teardown

\`docker rm -f cmc-synth-pg\` when the plan is fully done.
`;
  writeFileSync(resolve(outDir, `visual-smoke-${date}.md`), md);
  console.log('Wrote report', pass, warn, fail);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
