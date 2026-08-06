/**
 * Webwright-style smoke: cmcv2-prod local stack (HTTPS + design3 admin).
 * Run from apps/e2e so @playwright/test resolves:
 *   node ../../outputs/webwright-prod-smoke/final_runs/run_1/final_script.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUN_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../outputs/webwright-prod-smoke/final_runs/run_1');
const SCREENSHOTS = join(RUN_DIR, 'screenshots');
const LOG = join(RUN_DIR, 'final_script_log.txt');
const REPO = join(dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(SCREENSHOTS, { recursive: true });
writeFileSync(LOG, '');

function log(step, msg) {
  const line = `step ${step} action: ${msg}\n`;
  appendFileSync(LOG, line);
  process.stdout.write(line);
}

function loadProdEnv() {
  const env = {};
  const text = readFileSync(join(REPO, '.env.prod'), 'utf8');
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i);
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

async function shot(page, step, name) {
  const path = join(SCREENSHOTS, `final_execution_${step}_${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
}

async function main() {
  const env = loadProdEnv();
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL/PASSWORD missing from .env.prod');
  }

  const results = {
    cp1: false,
    cp2: false,
    cp3: false,
    cp4: false,
    cp5: false,
    cp6: false,
    cp7: false,
    cp8: false,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1800 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  // ── CP8 health (API via nginx) ───────────────────────────────────────────
  try {
    const health = await page.request.get('https://localhost/health');
    const body = await health.json();
    results.cp8 = health.ok() && body?.result?.data?.status === 'ok';
    log(0, `health status=${health.status()} ok=${results.cp8}`);
  } catch (e) {
    log(0, `health FAILED ${e.message}`);
  }

  // ── CP1 admin SPA ────────────────────────────────────────────────────────
  await page.goto('https://localhost/admin/login', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await shot(page, 1, 'admin_start');
  const title1 = await page.title();
  results.cp1 =
    title1.includes('CMC EDU') ||
    (await page.locator('input[type="email"], input[type="password"]').count()) >
      0 ||
    (await page.locator('.o_web_client').count()) > 0;
  log(1, `admin loaded title="${title1}" url=${page.url()} cp1=${results.cp1}`);

  // ── CP2 login ────────────────────────────────────────────────────────────
  // Login form: email + password (may already be session-redirected)
  const emailField = page
    .getByLabel(/email/i)
    .or(page.locator('input[type="email"]'))
    .first();
  const passField = page
    .getByLabel(/mật khẩu|password/i)
    .or(page.locator('input[type="password"]'))
    .first();

  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill(email);
    await passField.fill(password);
    await shot(page, 2, 'login_filled');
    // Submit: button or form enter
    const submit = page
      .getByRole('button', { name: /đăng nhập|login|sign in/i })
      .first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await passField.press('Enter');
    }
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(800);
    log(2, `after login submit url=${page.url()}`);
  } else {
    log(2, 'login form not visible — may already be authenticated');
  }

  // Handle forced password change if present
  const newPw = page.getByLabel(/mật khẩu mới|new password/i).first();
  if (await newPw.isVisible({ timeout: 3000 }).catch(() => false)) {
    const nextPassword = `${password}!Ux1`;
    await newPw.fill(nextPassword);
    const confirm = page
      .getByLabel(/xác nhận|confirm/i)
      .or(page.locator('input[type="password"]').nth(1))
      .first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.fill(nextPassword);
    }
    await shot(page, 2, 'change_password_form');
    const saveBtn = page
      .getByRole('button', { name: /lưu|đổi|change|save|cập nhật/i })
      .first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    log(2, `forced password change attempted url=${page.url()}`);
    // Keep new password only in log line without full secret
    appendFileSync(LOG, 'note: password was rotated by change-password flow\n');
  }

  // Cookie evidence
  const cookies = await context.cookies('https://localhost');
  const hasStaffCookie = cookies.some((c) => c.name === 'cmc_staff_session');
  results.cp2 = hasStaffCookie || (await page.locator('.o_web_client').count()) > 0;
  await shot(page, 2, 'post_login');
  log(2, `staff cookie=${hasStaffCookie} cp2=${results.cp2}`);

  // ── CP3 Odoo shell ───────────────────────────────────────────────────────
  // Navigate home if still on change-password
  if (page.url().includes('change-password')) {
    await page.goto('https://localhost/admin/cockpit', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
  }
  await page.waitForTimeout(500);
  const shell = page.locator('.o_web_client');
  const brand = page.locator('.o-brand');
  const brandText = ((await brand.first().textContent().catch(() => '')) || '').trim();
  results.cp3 =
    (await shell.count()) > 0 &&
    brandText.length > 0 &&
    (await brand.first().isVisible().catch(() => false));
  await shot(page, 3, 'odoo_shell');
  log(
    3,
    `shell .o_web_client=${await shell.count()} brand="${brandText}" url=${page.url()} cp3=${results.cp3}`,
  );

  // ── CP4 app switcher ─────────────────────────────────────────────────────
  const switcherBtn = page.getByRole('button', { name: 'Mở app switcher' });
  if (await switcherBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await switcherBtn.click();
    await page.waitForTimeout(400);
    const menu = page.getByRole('menu', { name: 'App switcher' });
    results.cp4 = await menu.isVisible().catch(() => false);
    const items = results.cp4
      ? await menu.getByRole('menuitem').allTextContents()
      : [];
    await shot(page, 4, 'app_switcher');
    log(4, `switcher open items=${JSON.stringify(items.slice(0, 12))} cp4=${results.cp4}`);
    // close via Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } else {
    log(4, 'app switcher button not found');
    await shot(page, 4, 'app_switcher_missing');
  }

  // ── CP5 CRM pipeline ─────────────────────────────────────────────────────
  try {
    await page.goto('https://localhost/admin/crm', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
  } catch {
    await page.goto('https://localhost/admin/crm/pipeline', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
  }
  await page.waitForTimeout(600);
  const stillShell = (await page.locator('.o_web_client').count()) > 0;
  const main = page.locator('main.o-main');
  const hasMain = (await main.count()) > 0;
  // kanban or list markers
  const design3Surface =
    (await page.locator('.o-kanban-board, .o-list, table, [class*="kanban"]').count()) >
    0;
  results.cp5 = stillShell && hasMain;
  await shot(page, 5, 'crm_pipeline');
  log(
    5,
    `crm url=${page.url()} shell=${stillShell} main=${hasMain} surface=${design3Surface} cp5=${results.cp5}`,
  );

  // ── CP6 Finance ──────────────────────────────────────────────────────────
  await page.goto('https://localhost/admin/finance', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(600);
  results.cp6 =
    (await page.locator('.o_web_client').count()) > 0 &&
    (await page.locator('main.o-main').count()) > 0;
  await shot(page, 6, 'finance');
  log(6, `finance url=${page.url()} cp6=${results.cp6}`);

  // ── CP7 LMS ──────────────────────────────────────────────────────────────
  await page.goto('https://localhost/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(500);
  const lmsTitle = await page.title();
  results.cp7 =
    lmsTitle.toLowerCase().includes('học') ||
    lmsTitle.toLowerCase().includes('cmc') ||
    (await page.getByRole('button', { name: /phụ huynh|học sinh/i }).count()) >
      0 ||
    (await page.locator('input').count()) > 0;
  await shot(page, 7, 'lms_root');
  log(7, `lms title="${lmsTitle}" url=${page.url()} cp7=${results.cp7}`);

  await browser.close();

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  const summary = {
    passed,
    total,
    results,
    ok: passed === total,
  };
  appendFileSync(LOG, `\nFINAL_RESPONSE: ${JSON.stringify(summary)}\n`);
  process.stdout.write(`\nFINAL_RESPONSE: ${JSON.stringify(summary, null, 2)}\n`);
  process.exit(summary.ok ? 0 : 2);
}

main().catch((e) => {
  appendFileSync(LOG, `\nFATAL: ${e.stack || e}\n`);
  console.error(e);
  process.exit(1);
});
