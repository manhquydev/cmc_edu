/**
 * Design3: open seeded finance/CRM detail pages via real list click UX.
 * Used by Playwright contract + ops smoke-statusbar (no a[href] scraping).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

import { findInList } from '../journey/find-in-list.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

const RECEIPT_PATH_RE =
  /\/finance\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPPORTUNITY_PATH_RE =
  /\/crm\/opportunities\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeededDetailKind = 'receipt' | 'opportunity';

export interface OpenSeededDetailOptions {
  /** Prefer a row/card whose visible text matches (CI fixtures). */
  matchText?: string | RegExp;
  timeoutMs?: number;
}

export interface DetailStatusbarMeasure {
  ok: boolean;
  reason?: string;
  statusbarPosition?: string;
  summaryPosition?: string | null;
  path?: string;
  brand?: string;
}

export function loadProdEnv(envPath = join(REPO_ROOT, '.env.prod')): Record<string, string> {
  const env: Record<string, string> = {};
  const text = readFileSync(envPath, 'utf8');
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

export async function loginAsSuperAdmin(
  page: Page,
  env: Record<string, string>,
  options?: { loginUrl?: string },
): Promise<void> {
  const email = env.SUPER_ADMIN_EMAIL || env.E2E_SUPER_ADMIN_EMAIL || '';
  const password = env.SUPER_ADMIN_PASSWORD || env.E2E_SUPER_ADMIN_PASSWORD || '';
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD missing from env');
  }
  const loginUrl = options?.loginUrl ?? '/login';
  await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 60_000 });

  const emailField = page
    .getByLabel(/email/i)
    .or(page.locator('input[type="email"]'))
    .first();
  const passField = page
    .getByLabel(/mật khẩu|password/i)
    .or(page.locator('input[type="password"]'))
    .first();

  if (await emailField.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await emailField.fill(email);
    await passField.fill(password);
    const submit = page.getByRole('button', { name: /đăng nhập|login|sign in/i }).first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await passField.press('Enter');
    }
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(600);
  }

  const newPw = page.getByLabel(/mật khẩu mới|new password/i).first();
  if (await newPw.isVisible({ timeout: 2_500 }).catch(() => false)) {
    const nextPassword = `${password}!Ux1`;
    await newPw.fill(nextPassword);
    const confirm = page
      .getByLabel(/xác nhận|confirm/i)
      .or(page.locator('input[type="password"]').nth(1))
      .first();
    if (await confirm.isVisible().catch(() => false)) await confirm.fill(nextPassword);
    const saveBtn = page
      .getByRole('button', { name: /lưu|đổi|change|save|cập nhật/i })
      .first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
  }
}

function textMatcher(matchText?: string | RegExp): (visibleText: string) => boolean {
  if (matchText == null) {
    return (t) => t.trim().length > 0;
  }
  if (typeof matchText === 'string') {
    return (t) => t.includes(matchText);
  }
  return (t) => matchText.test(t);
}

async function openReceipt(page: Page, opts: OpenSeededDetailOptions): Promise<{ path: string }> {
  await page.goto('/finance', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const match = textMatcher(opts.matchText);
  try {
    const row = await findInList(page, match, {
      rowSelector: 'table tbody tr, [role="row"]',
      timeoutMs: opts.timeoutMs ?? 15_000,
    });
    await row.click();
  } catch (err) {
    throw new Error(
      `openSeededDetail(receipt): no seeded receipt row on /finance — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  await page.waitForURL(RECEIPT_PATH_RE, { timeout: opts.timeoutMs ?? 15_000 });
  const path = new URL(page.url()).pathname.replace(/^\/admin/, '') || '/';
  if (!RECEIPT_PATH_RE.test(path) && !RECEIPT_PATH_RE.test(page.url())) {
    throw new Error(`openSeededDetail(receipt): unexpected URL ${page.url()}`);
  }
  return { path: path.startsWith('/finance') ? path : new URL(page.url()).pathname };
}

async function openOpportunity(
  page: Page,
  opts: OpenSeededDetailOptions,
): Promise<{ path: string }> {
  await page.goto('/crm', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const match = textMatcher(opts.matchText);

  // Prefer the card shell (`role=button` wrapping `.console-kanban-card`), click the
  // top-left so we do not hit inner action buttons (Chuyển lên / Ghi danh).
  const cardShell = page.locator('.console-kanban-col-body > [role="button"]');
  const deadline = Date.now() + Math.min(timeoutMs, 10_000);
  let clicked = false;
  while (Date.now() < deadline && !clicked) {
    const count = await cardShell.count();
    for (let i = 0; i < count; i += 1) {
      const card = cardShell.nth(i);
      const text = (await card.innerText()).trim();
      if (!match(text)) continue;
      await card.click({ position: { x: 12, y: 12 } });
      clicked = true;
      break;
    }
    if (!clicked) await page.waitForTimeout(200);
  }

  if (!clicked) {
    await page.goto('/crm?view=table', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    try {
      const row = await findInList(page, match, {
        rowSelector: 'table tbody tr, [role="row"]',
        timeoutMs,
      });
      await row.click();
    } catch (err) {
      throw new Error(
        `openSeededDetail(opportunity): no seeded opportunity card/row on /crm — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  await page.waitForURL(OPPORTUNITY_PATH_RE, { timeout: timeoutMs });
  const path = new URL(page.url()).pathname.replace(/^\/admin/, '') || '/';
  return { path: path.includes('/crm/opportunities/') ? path : new URL(page.url()).pathname };
}

export async function openSeededDetail(
  page: Page,
  kind: SeededDetailKind,
  opts: OpenSeededDetailOptions = {},
): Promise<{ path: string }> {
  if (kind === 'receipt') return openReceipt(page, opts);
  return openOpportunity(page, opts);
}

/** Computed-style proof for thin statusbar sticky (md+ viewport). */
export async function measureDetailStatusbar(page: Page): Promise<DetailStatusbarMeasure> {
  await page.waitForTimeout(400);
  // String form keeps e2e tsconfig (no DOM lib) happy while running in browser.
  return page.evaluate(`(() => {
    const bar = document.querySelector('.console-detail-statusbar');
    const sum = document.querySelector('.console-detail-summary');
    if (!bar) return { ok: false, reason: 'no .console-detail-statusbar' };
    const main = document.querySelector('main.console-main');
    if (main) main.scrollTop = 200;
    const cs = getComputedStyle(bar);
    return {
      ok: true,
      statusbarPosition: cs.position,
      summaryPosition: sum ? getComputedStyle(sum).position : null,
      path: location.pathname,
      brand: (document.querySelector('.console-brand')?.textContent || '').trim(),
    };
  })()`) as Promise<DetailStatusbarMeasure>;
}

export function assertStickyStatusbar(m: DetailStatusbarMeasure): void {
  if (!m.ok) throw new Error(m.reason || 'statusbar measure failed');
  if (m.statusbarPosition !== 'sticky') {
    throw new Error(`expected statusbar position sticky, got ${m.statusbarPosition}`);
  }
  if (m.summaryPosition === 'sticky') {
    throw new Error('summary must not be sticky');
  }
}
