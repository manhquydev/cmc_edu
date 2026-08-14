#!/usr/bin/env node
/**
 * Full live UI audit of local-sim admin vs OPENEDUCAT-VISUAL-CONTRACT.
 * Measures computed styles + screenshots across list / form / kanban / ops.
 *
 * Usage:
 *   LOCAL_SIM_LIVE=1 node scripts/live-openeducat-ui-audit.mjs
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
const STAMP = '260814-0945';
const OUT = path.join(root, `plans/reports/live-ui-audit-${STAMP}`);
const ACCOUNTS = path.join(root, '.env.local-sim-accounts');

if (process.env.LOCAL_SIM_LIVE !== '1') {
  throw new Error('Set LOCAL_SIM_LIVE=1 to confirm you are driving the local-sim browser.');
}

const PURPLE = { r: 113, g: 99, b: 158 }; // #71639e
const LAVENDER = { r: 224, g: 217, b: 241 }; // #e0d9f1
const APPLE_BLUE = { r: 0, g: 113, b: 227 }; // #0071e3

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

function parseRgb(s) {
  if (!s || s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return null;
  const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

function near(a, b, tol = 18) {
  if (!a || !b) return false;
  return Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;
}

function isAppleBlue(rgb) {
  return near(rgb, APPLE_BLUE, 40) || (rgb && rgb.b > 180 && rgb.r < 80 && rgb.g > 90 && rgb.g < 170);
}

const PAGES = [
  { id: 'cockpit', path: '/cockpit', kind: 'dash' },
  { id: 'students-list', path: '/admin/students', kind: 'list', pack: '03' },
  { id: 'courses-list', path: '/admin/courses', kind: 'list', pack: '09' },
  { id: 'classes-list', path: '/admin/classes', kind: 'list' },
  { id: 'parents-list', path: '/admin/parents', kind: 'list', pack: '07' },
  { id: 'users-list', path: '/admin/users', kind: 'list', pack: '34' },
  { id: 'crm-pipeline', path: '/crm', kind: 'kanban' },
  { id: 'finance-list', path: '/finance', kind: 'list' },
  { id: 'schedule', path: '/teaching/schedule', kind: 'calendar', pack: '17' },
  { id: 'attendance', path: '/teaching/attendance', kind: 'ops', pack: '21' },
  { id: 'exercises', path: '/teaching/exercises', kind: 'list', pack: '23' },
  { id: 'audit-log', path: '/admin/audit-log', kind: 'list' },
  { id: 'hr-shifts', path: '/hr/shifts', kind: 'list' },
  { id: 'hr-payroll', path: '/hr/payroll', kind: 'list' },
  { id: 'design', path: '/design', kind: 'lab' },
];

async function measurePage(page) {
  return page.evaluate(
    ({ PURPLE, LAVENDER }) => {
      const rgb = (s) => {
        if (!s || s === 'transparent' || s === 'rgba(0, 0, 0, 0)') return null;
        const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
      };
      const near = (a, b, tol = 18) =>
        a && b && Math.abs(a.r - b.r) <= tol && Math.abs(a.g - b.g) <= tol && Math.abs(a.b - b.b) <= tol;
      const isBlue = (c) =>
        near(c, { r: 0, g: 113, b: 227 }, 40) ||
        (c && c.b > 180 && c.r < 80 && c.g > 90 && c.g < 170);

      const navbar = document.querySelector('.console-navbar, .o_main_navbar, nav.console-navbar');
      const nb = navbar ? navbar.getBoundingClientRect() : null;
      const nbBg = navbar ? rgb(getComputedStyle(navbar).backgroundColor) : null;

      const cp =
        document.querySelector('.console-control-bar') ||
        document.querySelector('.console-page-header') ||
        document.querySelector('[class*="control-panel"]');
      const cpRect = cp ? cp.getBoundingClientRect() : null;

      const search =
        document.querySelector('.console-search input, .console-search-bar input, input[placeholder*="Search"], input[placeholder*="Tìm"]') ||
        document.querySelector('.console-control-bar input[type="search"], .console-control-bar input[type="text"]');
      let searchH = null;
      let searchRadius = null;
      if (search) {
        const box = search.closest('.console-search, .console-search-bar') || search;
        const cs = getComputedStyle(box);
        searchH = Math.round(box.getBoundingClientRect().height);
        searchRadius = cs.borderRadius;
      }

      const viewSwitcher = document.querySelector('.console-view-switcher, [class*="view-switcher"]');
      const pager = document.querySelector('.console-pager, [class*="pager"]');

      const sheet = document.querySelector('.console-form-sheet');
      const statusbar = document.querySelector('.console-detail-statusbar, .console-steps');
      const statusbarParent = statusbar?.closest('.console-form-sheet, .console-form-sheet-bg')?.className || null;
      const currentBtn = document.querySelector('.console-steps-item.is-current .console-steps-btn');
      const currentBg = currentBtn ? rgb(getComputedStyle(currentBtn).backgroundColor) : null;
      const stepsH = document.querySelector('.console-steps')
        ? Math.round(document.querySelector('.console-steps').getBoundingClientRect().height)
        : null;

      const table = document.querySelector('table.console-list, .console-list table, table');
      let rowH = null;
      let theadBg = null;
      if (table) {
        const tr = table.querySelector('tbody tr') || table.querySelector('tr');
        if (tr) rowH = Math.round(tr.getBoundingClientRect().height);
        const th = table.querySelector('thead');
        if (th) theadBg = rgb(getComputedStyle(th).backgroundColor);
      }

      const kanban = document.querySelector('.console-kanban-board, .console-kanban-grid, [class*="kanban"]');
      const kanbanCards = kanban ? kanban.querySelectorAll('[class*="kanban-card"], [class*="KanbanCard"]').length : 0;

      const blueButtons = [];
      for (const el of document.querySelectorAll('button, a.console-btn, .console-btn')) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const bg = rgb(getComputedStyle(el).backgroundColor);
        const color = rgb(getComputedStyle(el).color);
        if (isBlue(bg) || (bg && bg.r === 0 && bg.g === 0 && bg.b === 0 && isBlue(color))) {
          // solid blue fill OR (rare) transparent with blue text only if looks primary
          if (isBlue(bg)) {
            blueButtons.push({
              text: (el.textContent || '').trim().slice(0, 40),
              bg,
            });
          }
        }
      }

      const primaryCandidates = [];
      for (const el of document.querySelectorAll('button')) {
        const t = (el.textContent || '').trim();
        if (!/^(New|\+|Tạo|Thêm|Gửi|Lưu|Submit)/i.test(t) && !/Tạo |Thêm /.test(t)) continue;
        const bg = rgb(getComputedStyle(el).backgroundColor);
        primaryCandidates.push({ text: t.slice(0, 40), bg, isPurple: near(bg, PURPLE, 25), isBlue: isBlue(bg) });
      }

      const tabActive = document.querySelector('.console-notebook [aria-selected="true"], .console-tabs [aria-selected="true"], [role="tab"][aria-selected="true"]');
      let tabUnderline = null;
      if (tabActive) {
        const cs = getComputedStyle(tabActive);
        tabUnderline = {
          borderBottom: cs.borderBottom,
          color: rgb(cs.color),
          boxShadow: cs.boxShadow,
        };
      }

      return {
        url: location.pathname + location.search,
        title: document.title,
        hasOWebClient: !!document.querySelector('.o_web_client'),
        navbar: nb
          ? { h: Math.round(nb.height), bg: nbBg, isPurple: near(nbBg, PURPLE, 20) }
          : null,
        controlPanel: cpRect
          ? {
              h: Math.round(cpRect.height),
              y: Math.round(cpRect.top),
              selector: cp.className?.slice?.(0, 80) || null,
            }
          : null,
        search: search ? { h: searchH, radius: searchRadius } : null,
        viewSwitcher: !!viewSwitcher,
        pager: !!pager,
        sheet: !!sheet,
        statusbar: statusbar
          ? {
              parent: statusbarParent,
              insideSheet: !!statusbar.closest('.console-form-sheet'),
              height: stepsH,
              currentBg,
              currentIsLavender: near(currentBg, LAVENDER, 20),
            }
          : null,
        list: table ? { rowH, theadBg } : null,
        kanban: kanban ? { cards: kanbanCards } : null,
        blueButtons: blueButtons.slice(0, 12),
        primaryCandidates: primaryCandidates.slice(0, 8),
        tabActive: tabUnderline,
        bodyTextLen: (document.body?.innerText || '').length,
      };
    },
    { PURPLE, LAVENDER },
  );
}

function findingsFor(id, kind, m) {
  const out = [];
  if (!m.hasOWebClient) out.push({ sev: 'critical', id, msg: 'missing .o_web_client shell' });
  if (m.navbar && !m.navbar.isPurple) out.push({ sev: 'P0', id, msg: `navbar bg not Community purple: ${JSON.stringify(m.navbar.bg)}` });
  if (m.navbar && Math.abs(m.navbar.h - 46) > 4) out.push({ sev: 'P1', id, msg: `navbar height ${m.navbar.h}px (want 46)` });

  if (kind === 'list' || kind === 'kanban') {
    if (!m.controlPanel) out.push({ sev: 'P0', id, msg: 'no control panel / page header found' });
    else if (m.controlPanel.h > 70) out.push({ sev: 'P0', id, msg: `CP height ${m.controlPanel.h}px (pack ~58)` });
    if (m.search && m.search.h && Math.abs(m.search.h - 35) > 6) {
      out.push({ sev: 'P1', id, msg: `search height ${m.search.h}px (want 35)` });
    }
    if (m.search && m.search.radius && !/999|50%|9999/.test(m.search.radius) && !/^1e\+/.test(m.search.radius)) {
      // pill often computed as 999px or huge px
      const n = parseFloat(m.search.radius);
      if (!Number.isNaN(n) && n < 20) out.push({ sev: 'P1', id, msg: `search radius ${m.search.radius} (want pill 999px)` });
    }
    if (m.list?.rowH && Math.abs(m.list.rowH - 40) > 8) {
      out.push({ sev: 'P1', id, msg: `list row ${m.list.rowH}px (want ~40)` });
    }
  }

  if (m.statusbar) {
    if (!m.statusbar.insideSheet) out.push({ sev: 'P0', id, msg: 'statusbar NOT inside .console-form-sheet' });
    if (m.statusbar.height && Math.abs(m.statusbar.height - 33) > 4) {
      out.push({ sev: 'P1', id, msg: `statusbar height ${m.statusbar.height}px (want 33)` });
    }
    if (m.statusbar.currentBg && !m.statusbar.currentIsLavender) {
      out.push({ sev: 'P0', id, msg: `statusbar current not lavender #e0d9f1: ${JSON.stringify(m.statusbar.currentBg)}` });
    }
  }

  for (const b of m.blueButtons || []) {
    out.push({ sev: 'P0', id, msg: `Apple-blue primary button: "${b.text}"` });
  }
  for (const p of m.primaryCandidates || []) {
    if (p.isBlue && !p.isPurple) out.push({ sev: 'P0', id, msg: `primary CTA blue not purple: "${p.text}"` });
  }

  return out;
}

async function openFirstDetail(page, listPath, linkPattern) {
  await page.goto(`${ERP}${listPath}`, { waitUntil: 'networkidle', timeout: 45_000 });
  const link = page.locator(`a[href*="${linkPattern}"]`).first();
  if ((await link.count()) === 0) return null;
  await link.click();
  await page.waitForLoadState('networkidle');
  return page.url();
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const admin = account('admin@cmcvn.edu.vn');
  const findings = [];
  const pages = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    locale: 'vi-VN',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto(`${ERP}/login`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.screenshot({ path: path.join(OUT, 'shots', '00-login.png'), fullPage: false });
  await page.locator('input[type="email"]').fill(admin.email);
  await page.locator('input[type="password"]').fill(admin.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await page.waitForLoadState('networkidle');

  for (const p of PAGES) {
    try {
      await page.goto(`${ERP}${p.path}`, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForTimeout(400);
      const m = await measurePage(page);
      const shot = `shots/${p.id}.png`;
      await page.screenshot({ path: path.join(OUT, shot), fullPage: false });
      const f = findingsFor(p.id, p.kind, m);
      findings.push(...f);
      pages.push({ ...p, measure: m, shot, findings: f });
      console.log(`ok  ${p.id}  h_cp=${m.controlPanel?.h ?? '-'}  blue=${m.blueButtons?.length ?? 0}  findings=${f.length}`);
    } catch (err) {
      findings.push({ sev: 'critical', id: p.id, msg: String(err instanceof Error ? err.message : err) });
      pages.push({ ...p, error: String(err), findings: [] });
      console.log(`FAIL ${p.id}: ${err}`);
    }
  }

  // Detail forms with statusbar
  const detailTargets = [
    { id: 'student-detail', list: '/admin/students', href: '/admin/students/', pack: 'student-form' },
    { id: 'class-detail', list: '/admin/classes', href: '/admin/classes/', pack: 'class-form' },
    { id: 'opportunity-detail', list: '/crm', href: '/crm/opportunities/', pack: '14' },
    { id: 'receipt-detail', list: '/finance', href: '/finance/', pack: 'finance-form' },
  ];

  for (const d of detailTargets) {
    try {
      const url = await openFirstDetail(page, d.list, d.href);
      if (!url) {
        findings.push({ sev: 'warn', id: d.id, msg: 'no detail link found' });
        pages.push({ ...d, kind: 'form', skip: true });
        console.log(`skip ${d.id} (no link)`);
        continue;
      }
      await page.waitForTimeout(500);
      const m = await measurePage(page);
      const shot = `shots/${d.id}.png`;
      await page.screenshot({ path: path.join(OUT, shot), fullPage: false });
      // crop statusbar if present
      const bar = page.locator('.console-detail-statusbar, .console-steps').first();
      if ((await bar.count()) > 0) {
        await bar.screenshot({ path: path.join(OUT, `shots/${d.id}-statusbar.png`) }).catch(() => {});
      }
      const f = findingsFor(d.id, 'form', m);
      findings.push(...f);
      pages.push({ ...d, kind: 'form', measure: m, shot, findings: f, url });
      console.log(
        `ok  ${d.id}  statusbar_in_sheet=${m.statusbar?.insideSheet}  lavender=${m.statusbar?.currentIsLavender}  blue=${m.blueButtons?.length ?? 0}`,
      );
    } catch (err) {
      findings.push({ sev: 'critical', id: d.id, msg: String(err instanceof Error ? err.message : err) });
      console.log(`FAIL ${d.id}: ${err}`);
    }
  }

  await browser.close();

  const bySev = { critical: 0, P0: 0, P1: 0, P2: 0, warn: 0 };
  for (const f of findings) bySev[f.sev] = (bySev[f.sev] || 0) + 1;

  const report = {
    generatedAt: new Date().toISOString(),
    target: ERP,
    viewport: '1280x900',
    role: 'super_admin',
    contract: 'design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md',
    pack: '/home/manhquy/Downloads/openeducat-ui-pack',
    summary: bySev,
    findingCount: findings.length,
    consoleErrors: consoleErrors.filter((t) => !/401 \(Unauthorized\)/.test(t)).slice(0, 40),
    findings,
    pages,
  };
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

  const md = [
    `# Live UI audit — OpenEduCat fidelity (${STAMP})`,
    '',
    `Target: \`${ERP}\` @ 1280×900 · role admin · contract OPENEDUCAT-VISUAL-CONTRACT`,
    '',
    `## Summary`,
    '',
    `| Sev | Count |`,
    `|-----|------:|`,
    ...Object.entries(bySev).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    `## Top defects (unique)`,
    '',
    ...[...new Map(findings.map((f) => [`${f.sev}|${f.msg}`, f])).values()]
      .sort((a, b) => String(a.sev).localeCompare(String(b.sev)))
      .slice(0, 80)
      .map((f) => `- **${f.sev}** [\`${f.id}\`] ${f.msg}`),
    '',
    `## Pages`,
    '',
    ...pages.map((p) => {
      const m = p.measure;
      if (!m) return `- \`${p.id}\` — ${p.error || p.skip ? 'skipped/error' : '?'}`;
      return `- \`${p.id}\` ${p.path || p.url || ''} — CP ${m.controlPanel?.h ?? '—'}px · blueBtns ${m.blueButtons?.length ?? 0} · statusbar ${m.statusbar ? (m.statusbar.insideSheet ? 'in-sheet' : 'OUT') : '—'} · [shot](./${p.shot})`;
    }),
    '',
    `Artifacts: \`${OUT}\``,
  ].join('\n');
  writeFileSync(path.join(OUT, 'report.md'), md);

  console.log(`\nlive-openeducat-ui-audit  findings=${findings.length}  -> ${OUT}`);
  process.exitCode = bySev.critical > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
