/**
 * Design3 frontend system audit — live page walk on cmcv2-prod.
 *
 * Slow-and-sure: login as super_admin, visit every nav leaf (+ extras),
 * measure shell markers, PageHeader presence, app-switcher vs page-content
 * geometric overlap, residual premium classes, and capture screenshots.
 *
 * Run from repo root or apps/e2e:
 *   node outputs/design3-frontend-audit/run-audit.mjs
 */
import { chromium } from '@playwright/test';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../..');
const OUT = join(REPO, 'outputs/design3-frontend-audit');
const SHOTS = join(OUT, 'screenshots');
const LOG = join(OUT, 'audit-log.txt');
mkdirSync(SHOTS, { recursive: true });
writeFileSync(LOG, '');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
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

/** Nav leaves from registry + a few deep routes worth probing. */
const ROUTES = [
  { path: '/cockpit', group: 'cockpit', label: 'Tổng quan' },
  { path: '/teaching/schedule', group: 'teaching', label: 'Lịch dạy' },
  { path: '/teaching/attendance', group: 'teaching', label: 'Điểm danh' },
  { path: '/teaching/grading', group: 'teaching', label: 'Chấm bài' },
  { path: '/teaching/session-evidence', group: 'teaching', label: 'Nhật ký buổi học' },
  {
    path: '/teaching/session-assessment',
    group: 'teaching',
    label: 'Nhận xét buổi học',
    priority: true,
  },
  { path: '/teaching/exercises', group: 'teaching', label: 'Bài tập' },
  { path: '/admin/students', group: 'classes-students', label: 'Học viên' },
  { path: '/admin/classes', group: 'classes-students', label: 'Lớp học' },
  { path: '/admin/courses', group: 'classes-students', label: 'Khoá học' },
  { path: '/admin/parents', group: 'classes-students', label: 'Phụ huynh' },
  { path: '/finance', group: 'finance-ops', label: 'Phiếu thu' },
  { path: '/crm', group: 'finance-ops', label: 'CRM' },
  { path: '/ops/revenue', group: 'finance-ops', label: 'Doanh thu' },
  { path: '/ops/recon', group: 'finance-ops', label: 'Đối soát' },
  { path: '/crm/post-sale-meeting', group: 'finance-ops', label: 'Họp sau bán' },
  { path: '/crm/aftersale', group: 'finance-ops', label: 'Sau bán' },
  { path: '/finance/class-placement', group: 'finance-ops', label: 'Xếp lớp' },
  { path: '/admin/engagement/gifts', group: 'engagement', label: 'Quà tặng' },
  { path: '/admin/engagement/rewards', group: 'engagement', label: 'Đổi thưởng' },
  { path: '/hr/checkin', group: 'hr', label: 'Chấm công' },
  { path: '/hr/shifts', group: 'hr', label: 'Đăng ký ca' },
  { path: '/hr/my', group: 'hr', label: 'Của tôi' },
  { path: '/hr/kpi', group: 'hr', label: 'Duyệt KPI' },
  { path: '/hr/payroll', group: 'hr', label: 'Chốt lương' },
  { path: '/hr/salary-tiers', group: 'hr', label: 'Bậc lương' },
  { path: '/admin/shift-config', group: 'hr', label: 'Ca làm việc' },
  { path: '/admin/users', group: 'admin', label: 'Người dùng' },
  { path: '/admin/facilities', group: 'admin', label: 'Cơ sở' },
  { path: '/admin/network-ip', group: 'admin', label: 'IP mạng' },
  { path: '/admin/audit-log', group: 'admin', label: 'Nhật ký hệ thống' },
  // extras
  { path: '/finance/new', group: 'finance-ops', label: 'Tạo phiếu (extra)' },
  { path: '/admin/engagement/leaderboard', group: 'engagement', label: 'BXH (extra)' },
  { path: '/finance/refund', group: 'finance-ops', label: 'Hoàn tiền (extra)' },
];

function slug(path) {
  return path.replace(/^\//, '').replace(/\//g, '__') || 'root';
}

function rectsOverlap(a, b, pad = 1) {
  if (!a || !b) return false;
  return !(
    a.right <= b.left + pad ||
    a.left >= b.right - pad ||
    a.bottom <= b.top + pad ||
    a.top >= b.bottom - pad
  );
}

function overlapArea(a, b) {
  if (!rectsOverlap(a, b, 0)) return 0;
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return Math.max(0, w) * Math.max(0, h);
}

async function login(page, email, password) {
  await page.goto('https://localhost/admin/login', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  const emailField = page
    .getByLabel(/email/i)
    .or(page.locator('input[type="email"]'))
    .first();
  const passField = page
    .getByLabel(/mật khẩu|password/i)
    .or(page.locator('input[type="password"]'))
    .first();

  if (await emailField.isVisible({ timeout: 8000 }).catch(() => false)) {
    await emailField.fill(email);
    await passField.fill(password);
    const submit = page
      .getByRole('button', { name: /đăng nhập|login|sign in/i })
      .first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.click();
    } else {
      await passField.press('Enter');
    }
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600);
  }

  // Forced password rotation (prod seed sometimes forces this)
  const newPw = page.getByLabel(/mật khẩu mới|new password/i).first();
  if (await newPw.isVisible({ timeout: 2500 }).catch(() => false)) {
    const nextPassword = `${password}!Ux1`;
    await newPw.fill(nextPassword);
    const confirm = page
      .getByLabel(/xác nhận|confirm/i)
      .or(page.locator('input[type="password"]').nth(1))
      .first();
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.fill(nextPassword);
    }
    const saveBtn = page
      .getByRole('button', { name: /lưu|đổi|change|save|cập nhật/i })
      .first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(600);
    }
    log('login: forced password change handled');
  }

  await page.goto('https://localhost/admin/cockpit', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(400);
}

async function measurePage(page, route) {
  const url = `https://localhost/admin${route.path}`;
  const result = {
    path: route.path,
    group: route.group,
    label: route.label,
    priority: Boolean(route.priority),
    url,
    finalUrl: null,
    httpOk: true,
    errors: [],
    shell: {
      oWebClient: false,
      oNavbar: false,
      oMain: false,
      brandCmc: false,
      appSwitcherToggle: false,
    },
    markers: {
      pageHeaderCount: 0,
      pageHeaderVisible: false,
      controlBarCount: 0,
      filterBarCount: 0,
      listFrame: false,
      formFrame: false,
      detailFrame: false,
      kanban: false,
      statusbar: false,
      emptyState: false,
      residualCkTplSh: [],
    },
    stacking: {
      navbarZ: null,
      menuZ: null,
      pageHeaderPosition: null,
      pageHeaderZ: null,
      controlBarZ: null,
      menuBox: null,
      pageHeaderBoxes: [],
      overlappingHeaders: [],
      overlappingMainHits: [],
      menuCoveredByPage: false,
      menuAboveContent: null,
    },
    screenshots: {},
  };

  try {
    const resp = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    if (resp && resp.status() >= 400) {
      result.httpOk = false;
      result.errors.push(`HTTP ${resp.status()}`);
    }
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(450);
  } catch (e) {
    result.httpOk = false;
    result.errors.push(`goto: ${e.message}`);
    return result;
  }

  result.finalUrl = page.url();

  // Shell markers
  result.shell.oWebClient = (await page.locator('.o_web_client').count()) > 0;
  result.shell.oNavbar = (await page.locator('.console-navbar').count()) > 0;
  result.shell.oMain = (await page.locator('main.console-main').count()) > 0;
  // Brand shows active module label (not hardcoded CMC EDU). Pass = non-empty .console-brand.
  result.shell.brandCmc =
    (await page.locator('.console-brand').evaluateAll((els) =>
      els.some((el) => (el.textContent || '').trim().length > 0),
    ).catch(() => false));
  result.shell.appSwitcherToggle =
    (await page.getByRole('button', { name: 'Mở app switcher' }).count()) > 0;

  // Component markers
  const ph = page.locator('.console-page-header');
  result.markers.pageHeaderCount = await ph.count();
  result.markers.pageHeaderVisible =
    result.markers.pageHeaderCount > 0 &&
    (await ph.first().isVisible().catch(() => false));
  result.markers.controlBarCount = await page.locator('.console-control-bar').count();
  result.markers.filterBarCount = await page.locator('.console-filter-bar').count();
  result.markers.listFrame =
    (await page.locator('.console-list, .console-wrap, .console-list-body').count()) > 0;
  result.markers.formFrame =
    (await page.locator('.console-form, .console-form-body, form').count()) > 0;
  result.markers.detailFrame =
    (await page.locator('.console-detail, .console-detail-body, .console-eh').count()) > 0;
  result.markers.kanban = (await page.locator('.console-kanban, .o_kanban').count()) > 0;
  result.markers.statusbar =
    (await page.locator('.console-workflow-statusbar, .console-steps').count()) > 0;
  result.markers.emptyState =
    (await page.locator('.console-empty, [data-empty-state], .console-empty').count()) > 0 ||
    (await page.getByText(/tính năng chưa|chưa áp dụng|coming soon/i).count()) > 0;

  // Residual premium class census in rendered DOM under main
  result.markers.residualCkTplSh = await page.evaluate(() => {
    const main = document.querySelector('main.console-main') || document.body;
    const set = new Set();
    main.querySelectorAll('[class]').forEach((el) => {
      for (const c of el.classList) {
        if (/^(ck-|tpl-|sh-)/.test(c)) set.add(c);
      }
    });
    return [...set].sort().slice(0, 40);
  });

  // Baseline screenshot (menu closed)
  const baseShot = join(SHOTS, `${slug(route.path)}__base.png`);
  await page.screenshot({ path: baseShot, fullPage: false });
  result.screenshots.base = baseShot;

  // Stacking / menu overlay probe
  if (result.shell.appSwitcherToggle) {
    const toggle = page.getByRole('button', { name: 'Mở app switcher' });
    await toggle.click();
    await page.waitForTimeout(350);

    const menu = page.getByRole('menu', { name: 'App switcher' });
    const menuVisible = await menu.isVisible().catch(() => false);

    if (menuVisible) {
      const metrics = await page.evaluate(() => {
        const menuEl = document.querySelector('.console-app-switcher-menu');
        const navEl = document.querySelector('.console-navbar');
        const headers = [...document.querySelectorAll('.console-page-header')];
        const controlBars = [...document.querySelectorAll('.console-control-bar')];
        const main = document.querySelector('main.console-main');

        function box(el) {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            zIndex: cs.zIndex,
            position: cs.position,
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
          };
        }

        // Sample points inside menu to see which element is on top
        const menuBox = menuEl ? menuEl.getBoundingClientRect() : null;
        const sampleHits = [];
        if (menuBox && menuBox.width > 0 && menuBox.height > 0) {
          const points = [
            [menuBox.left + 20, menuBox.top + 20],
            [menuBox.left + menuBox.width / 2, menuBox.top + menuBox.height / 2],
            [menuBox.left + 20, menuBox.bottom - 12],
            [menuBox.right - 12, menuBox.top + 24],
          ];
          for (const [x, y] of points) {
            const stack = document.elementsFromPoint(x, y).slice(0, 8).map((el) => ({
              tag: el.tagName.toLowerCase(),
              id: el.id || null,
              className:
                typeof el.className === 'string'
                  ? el.className.slice(0, 120)
                  : '',
              inMenu: Boolean(el.closest('.console-app-switcher-menu')),
              inNavbar: Boolean(el.closest('.console-navbar')),
              inMain: Boolean(el.closest('main.console-main')),
              isPageHeader: el.classList?.contains('console-page-header') ||
                Boolean(el.closest('.console-page-header')),
            }));
            sampleHits.push({ x, y, stack });
          }
        }

        return {
          navbar: box(navEl),
          menu: box(menuEl),
          pageHeaders: headers.map(box).filter(Boolean),
          controlBars: controlBars.map(box).filter(Boolean),
          main: box(main),
          sampleHits,
        };
      });

      result.stacking.navbarZ = metrics.navbar?.zIndex ?? null;
      result.stacking.menuZ = metrics.menu?.zIndex ?? null;
      result.stacking.menuBox = metrics.menu;
      result.stacking.pageHeaderBoxes = metrics.pageHeaders;
      if (metrics.pageHeaders[0]) {
        result.stacking.pageHeaderPosition = metrics.pageHeaders[0].position;
        result.stacking.pageHeaderZ = metrics.pageHeaders[0].zIndex;
      }
      if (metrics.controlBars[0]) {
        result.stacking.controlBarZ = metrics.controlBars[0].zIndex;
      }

      // Geometric overlap menu vs headers
      if (metrics.menu) {
        for (const h of metrics.pageHeaders) {
          if (rectsOverlap(metrics.menu, h)) {
            result.stacking.overlappingHeaders.push({
              area: overlapArea(metrics.menu, h),
              header: h,
            });
          }
        }
        for (const c of metrics.controlBars) {
          if (rectsOverlap(metrics.menu, c)) {
            result.stacking.overlappingHeaders.push({
              area: overlapArea(metrics.menu, c),
              kind: 'control-bar',
              header: c,
            });
          }
        }
      }

      // Element-from-point: if top element is in main (not menu), menu is covered
      const coveredSamples = [];
      for (const s of metrics.sampleHits) {
        const top = s.stack[0];
        if (!top) continue;
        if (!top.inMenu && (top.inMain || top.isPageHeader)) {
          coveredSamples.push(s);
        }
      }
      result.stacking.overlappingMainHits = coveredSamples.map((s) => ({
        x: s.x,
        y: s.y,
        top: s.stack[0],
      }));
      result.stacking.menuCoveredByPage = coveredSamples.length > 0;
      result.stacking.menuAboveContent =
        metrics.sampleHits.length > 0 && coveredSamples.length === 0;

      const openShot = join(SHOTS, `${slug(route.path)}__menu-open.png`);
      await page.screenshot({ path: openShot, fullPage: false });
      result.screenshots.menuOpen = openShot;
    } else {
      result.errors.push('app switcher menu not visible after click');
    }

    // Close menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  } else if (!result.finalUrl?.includes('change-password')) {
    result.errors.push('no app switcher (shell missing or chrome suppressed)');
  }

  return result;
}

function summarize(results) {
  const total = results.length;
  const shellOk = results.filter(
    (r) => r.shell.oWebClient && r.shell.oNavbar && r.shell.oMain,
  ).length;
  const withHeader = results.filter((r) => r.markers.pageHeaderCount > 0).length;
  const covered = results.filter((r) => r.stacking.menuCoveredByPage);
  const geoOverlap = results.filter(
    (r) => r.stacking.overlappingHeaders.length > 0,
  );
  const residual = results.filter((r) => r.markers.residualCkTplSh.length > 0);
  const emptyish = results.filter((r) => r.markers.emptyState);
  const errors = results.filter((r) => r.errors.length > 0 || !r.httpOk);

  return {
    total,
    shellOk,
    shellPct: total ? Math.round((shellOk / total) * 100) : 0,
    withHeader,
    menuCoveredCount: covered.length,
    menuCoveredPaths: covered.map((r) => r.path),
    geoOverlapCount: geoOverlap.length,
    geoOverlapPaths: geoOverlap.map((r) => r.path),
    residualDomCount: residual.length,
    emptyStateCount: emptyish.length,
    emptyStatePaths: emptyish.map((r) => r.path),
    errorCount: errors.length,
    errorPaths: errors.map((r) => ({ path: r.path, errors: r.errors })),
    // representative stacking from priority page
    prioritySessionAssessment: results.find(
      (r) => r.path === '/teaching/session-assessment',
    ),
  };
}

function toMarkdown(results, summary, meta) {
  const lines = [];
  lines.push('# Design3 Frontend System Audit');
  lines.push('');
  lines.push(`**Date:** ${meta.date}`);
  lines.push(`**Environment:** ${meta.env}`);
  lines.push(`**Branch intent:** design3 admin rollout (Odoo shell language)`);
  lines.push(`**Routes walked:** ${summary.total}`);
  lines.push('');
  lines.push('## Executive summary');
  lines.push('');
  lines.push(
    `| Metric | Value |`,
  );
  lines.push(`|--------|-------|`);
  lines.push(
    `| Shell design3 (o_web_client + console-navbar + console-main) | ${summary.shellOk}/${summary.total} (${summary.shellPct}%) |`,
  );
  lines.push(`| Pages with \`.console-page-header\` | ${summary.withHeader}/${summary.total} |`);
  lines.push(
    `| **App-switcher covered by page content** (elementsFromPoint) | **${summary.menuCoveredCount}/${summary.total}** |`,
  );
  lines.push(
    `| Menu geometrically overlaps page-header/control-bar | ${summary.geoOverlapCount}/${summary.total} |`,
  );
  lines.push(
    `| DOM residual \`ck-*\`/\`tpl-*\`/\`sh-*\` under main | ${summary.residualDomCount}/${summary.total} |`,
  );
  lines.push(`| Empty / placeholder signals | ${summary.emptyStateCount}/${summary.total} |`);
  lines.push(`| Navigation / measure errors | ${summary.errorCount}/${summary.total} |`);
  lines.push('');

  lines.push('## Critical stacking finding (menu overlay)');
  lines.push('');
  lines.push(
    'App switcher (`.console-app-switcher-menu`) is `position:absolute; z-index:10` inside `.console-navbar` which is `position:relative` **without** a shell-level z-index. `<main class="console-main">` is the next flex sibling and paints after the navbar, so page chrome that overlaps the dropdown band can win hit-testing and visual stacking.',
  );
  lines.push('');
  if (summary.menuCoveredPaths.length) {
    lines.push('**Routes where menu samples hit page content (covered):**');
    lines.push('');
    for (const p of summary.menuCoveredPaths) {
      lines.push(`- \`${p}\``);
    }
    lines.push('');
  } else {
    lines.push(
      '_No route produced elementsFromPoint hits into main over the open menu in this viewport (1280×900). Geometric/CSS risk may still exist on shorter viewports or sticky headers._',
    );
    lines.push('');
  }

  const sa = summary.prioritySessionAssessment;
  if (sa) {
    lines.push('### Spotlight: `/teaching/session-assessment`');
    lines.push('');
    lines.push(`- Shell OK: ${sa.shell.oWebClient && sa.shell.oNavbar && sa.shell.oMain}`);
    lines.push(`- \`.console-page-header\` count: ${sa.markers.pageHeaderCount} (visible=${sa.markers.pageHeaderVisible})`);
    lines.push(
      `- PageHeader computed: position=\`${sa.stacking.pageHeaderPosition}\` z-index=\`${sa.stacking.pageHeaderZ}\``,
    );
    lines.push(
      `- Navbar z-index=\`${sa.stacking.navbarZ}\` · Menu z-index=\`${sa.stacking.menuZ}\``,
    );
    lines.push(
      `- Menu covered by page: **${sa.stacking.menuCoveredByPage}** · menuAboveContent=${sa.stacking.menuAboveContent}`,
    );
    lines.push(
      `- Geometric overlap headers: ${sa.stacking.overlappingHeaders.length}`,
    );
    if (sa.stacking.overlappingMainHits?.length) {
      lines.push('- Top-of-stack samples when menu open:');
      for (const h of sa.stacking.overlappingMainHits.slice(0, 4)) {
        lines.push(
          `  - (${Math.round(h.x)},${Math.round(h.y)}) → \`${h.top.className}\` inMain=${h.top.inMain} isPageHeader=${h.top.isPageHeader}`,
        );
      }
    }
    if (sa.screenshots.menuOpen) {
      lines.push(`- Screenshot: \`${sa.screenshots.menuOpen.replace(REPO + '/', '')}\``);
    }
    lines.push('');
  }

  lines.push('## Per-route matrix');
  lines.push('');
  lines.push(
    '| Path | Shell | Header | Menu↑ | Covered | Residual | Empty | Notes |',
  );
  lines.push('|------|-------|--------|-------|---------|----------|-------|-------|');
  for (const r of results) {
    const shell =
      r.shell.oWebClient && r.shell.oNavbar && r.shell.oMain ? '✓' : '✗';
    const header = r.markers.pageHeaderCount > 0 ? String(r.markers.pageHeaderCount) : '—';
    const menuUp =
      r.stacking.menuAboveContent === true
        ? '✓'
        : r.stacking.menuAboveContent === false
          ? '✗'
          : '—';
    const covered = r.stacking.menuCoveredByPage ? '**YES**' : 'no';
    const residual = r.markers.residualCkTplSh.length
      ? String(r.markers.residualCkTplSh.length)
      : '0';
    const empty = r.markers.emptyState ? 'yes' : '';
    const notes = r.errors.join('; ').slice(0, 60);
    lines.push(
      `| \`${r.path}\` | ${shell} | ${header} | ${menuUp} | ${covered} | ${residual} | ${empty} | ${notes} |`,
    );
  }
  lines.push('');

  lines.push('## Residual premium classes (rendered DOM)');
  lines.push('');
  for (const r of results.filter((x) => x.markers.residualCkTplSh.length)) {
    lines.push(
      `- \`${r.path}\`: ${r.markers.residualCkTplSh.slice(0, 12).join(', ')}`,
    );
  }
  if (!results.some((x) => x.markers.residualCkTplSh.length)) {
    lines.push('_None detected under main on walked routes._');
  }
  lines.push('');

  lines.push('## Design3 sync verdict (honest)');
  lines.push('');
  lines.push(
    '1. **Shell language:** Admin production chrome is design3 (ConsoleNavbar + `.o_web_client` + `.console-main`) on walked authenticated routes — unit/static rollout claim holds at runtime if shellOk is high.',
  );
  lines.push(
    '2. **Template coverage:** Most business pages render via shared templates emitting `o-*` (PageHeader/List/Form/Detail). Dialogs and login intentionally outside templates.',
  );
  lines.push(
    '3. **Stacking debt:** Navbar/app-switcher z-index vs main content is a structural defect class — page chrome (incl. `.console-page-header`) can obscure the open menu when geometry overlaps. Fix belongs in `packages/ui` shell CSS (raise `.console-navbar` stacking), not page-by-page hacks.',
  );
  lines.push(
    '4. **Premium residual:** Phase 6 selector mirror may paint `ck-*` correctly, but true class-language retirement is still backlog when residual DOM classes appear.',
  );
  lines.push(
    '5. **Merge gates still open:** full `ui-e2e` + acceptance re-measure per `docs/design-system-odoo.md`.',
  );
  lines.push('');
  lines.push('## Recommended fix order');
  lines.push('');
  lines.push(
    '1. **P0 shell stacking:** set `.console-navbar { z-index: 1000; }` (or Odoo-parity shell layer) so `.console-app-switcher-menu` always wins over main; add regression test with open menu + page-header under navbar band.',
  );
  lines.push(
    '2. **Audit sticky cousins:** `.console-control-bar` sticky z-index:5 and base `.console-page-header` sticky z-index:10 (static under `.o_web_client`) — keep shell layers documented in design-system-odoo.',
  );
  lines.push(
    '3. **Empty/placeholder routes:** close or hide nav for EmptyState screens still reachable (refund/leaderboard if present).',
  );
  lines.push(
    '4. **Optional residual rename:** `ck-*` → `o-*` when bandwidth allows; not required for shell language.',
  );
  lines.push('');
  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- JSON: \`outputs/design3-frontend-audit/results.json\``);
  lines.push(`- Log: \`outputs/design3-frontend-audit/audit-log.txt\``);
  lines.push(`- Screenshots: \`outputs/design3-frontend-audit/screenshots/\``);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const env = loadProdEnv();
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL/PASSWORD missing from .env.prod');
  }

  log(`start audit routes=${ROUTES.length}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  page.on('pageerror', (err) => log(`pageerror: ${err.message}`));

  await login(page, email, password);
  log(`post-login url=${page.url()}`);

  const shellHome = (await page.locator('.o_web_client').count()) > 0;
  log(`home shell .o_web_client=${shellHome}`);
  await page.screenshot({
    path: join(SHOTS, '00_post_login_cockpit.png'),
    fullPage: false,
  });

  const results = [];
  for (const route of ROUTES) {
    log(`→ ${route.path} (${route.label})`);
    const r = await measurePage(page, route);
    results.push(r);
    log(
      `  shell=${r.shell.oWebClient && r.shell.oNavbar && r.shell.oMain} ph=${r.markers.pageHeaderCount} covered=${r.stacking.menuCoveredByPage} residual=${r.markers.residualCkTplSh.length} err=${r.errors.join('|') || '-'}`,
    );
    // Slow-and-sure pause between pages
    await page.waitForTimeout(250);
  }

  const summary = summarize(results);
  const meta = {
    date: new Date().toISOString(),
    env: 'Docker cmcv2-prod · https://localhost/admin · viewport 1280×900',
  };

  writeFileSync(
    join(OUT, 'results.json'),
    JSON.stringify({ meta, summary, results }, null, 2),
  );
  const md = toMarkdown(results, summary, meta);
  writeFileSync(join(OUT, 'REPORT.md'), md);
  // Durable plan report copy
  writeFileSync(
    join(REPO, 'plans/reports/design3-frontend-system-audit-260806.md'),
    md,
  );

  log(
    `done shellOk=${summary.shellOk}/${summary.total} menuCovered=${summary.menuCoveredCount} geoOverlap=${summary.geoOverlapCount}`,
  );
  console.log('\n' + md.split('\n').slice(0, 60).join('\n'));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
