#!/usr/bin/env node
/**
 * Operator scorecard for CMC EDU HEAD. Proof classes:
 *   behavior | source-string | ci-artifact | unmeasured
 * Never `docs`. Never invokes `business:verify --strict`.
 *
 * SHA of record for L3/L4 is `apps/e2e/acceptance-results/journeys.json`
 * `config.metadata.gitSha` vs `git rev-parse HEAD` (full).
 * `acceptance-report/verification.json.commit` is short HEAD written by the
 * report itself — it is not evidence.
 *
 * Usage: node scripts/verify-system.mjs [--json] [--skip-slow]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(root, 'acceptance-report');
const JOURNEYS = path.join(root, 'apps/e2e/acceptance-results/journeys.json');
const UI_SRC = path.join(root, 'packages/ui/src');

const skipSlow = process.argv.includes('--skip-slow');
const asJson = process.argv.includes('--json');

export function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function classifyUiSource(src) {
  const astryx = /@astryxdesign\/core/.test(src) || /from ['"]\.\.\/primitives/.test(src);
  const consoleClass = /console-/.test(src);
  const inline = /style=\{\{/.test(src);
  if (astryx && consoleClass) return 'HYBRID';
  if (consoleClass && !astryx) return 'CONSOLE-ONLY';
  if (astryx && inline && !consoleClass) return 'ASTRYX+INLINE';
  if (astryx) return 'ASTRYX-ONLY';
  if (inline) return 'INLINE-ONLY';
  return 'OTHER';
}

export function inventoryUi(dir = UI_SRC) {
  const counts = {
    HYBRID: 0,
    'CONSOLE-ONLY': 0,
    'ASTRYX-ONLY': 0,
    'ASTRYX+INLINE': 0,
    'INLINE-ONLY': 0,
    OTHER: 0,
  };
  const files = [];
  const walk = (d) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts')) {
        if (ent.name.includes('.test.')) continue;
        const src = readFileSync(p, 'utf8');
        const bucket = classifyUiSource(src);
        counts[bucket] += 1;
        files.push({ file: path.relative(root, p), bucket });
      }
    }
  };
  walk(dir);
  return { counts, fileCount: files.length, files };
}

export function journeysProof(journeysPath, headSha) {
  if (!existsSync(journeysPath)) {
    return {
      present: false,
      journeysSha: null,
      match: false,
      proofClass: 'unmeasured',
      status: 'unmeasured',
      detail: 'Thiếu journeys.json — dùng artifact ui-e2e. Meter không gọi --strict.',
    };
  }
  try {
    const report = JSON.parse(readFileSync(journeysPath, 'utf8'));
    const sha =
      typeof report.config?.metadata?.gitSha === 'string' && report.config.metadata.gitSha.length > 0
        ? report.config.metadata.gitSha
        : null;
    if (sha === headSha) {
      return {
        present: true,
        journeysSha: sha,
        match: true,
        proofClass: 'ci-artifact',
        status: 'ok',
        detail: 'journeys.json SHA khớp HEAD.',
      };
    }
    return {
      present: true,
      journeysSha: sha,
      match: false,
      proofClass: 'unmeasured',
      status: 'unmeasured',
      detail: `journeys.json SHA ${sha ?? 'null'} ≠ HEAD ${headSha}. Dùng artifact ui-e2e. Không --strict.`,
    };
  } catch (error) {
    return {
      present: true,
      journeysSha: null,
      match: false,
      proofClass: 'unmeasured',
      status: 'unmeasured',
      detail: `Không đọc được journeys.json: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function run(command, args) {
  try {
    execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, detail: 'exit 0' };
  } catch (error) {
    const err = error;
    const msg = (err.stderr || err.stdout || err.message || String(error)).toString().slice(0, 800);
    return { ok: false, detail: msg };
  }
}

function renderHtml(report) {
  const rows = report.layers
    .map(
      (l) =>
        `<tr><td>${l.id}</td><td>${l.claim}</td><td><code>${l.command}</code></td><td>${l.proofClass}</td><td>${l.blocking ? 'block' : 'advise'}</td><td>${l.status}</td><td>${escapeHtml(l.detail)}</td></tr>`,
    )
    .join('\n');
  return `<!doctype html>
<meta charset="utf-8">
<title>verify:system ${report.sha.slice(0, 7)}</title>
<style>
  body { font: 14px/1.4 system-ui; margin: 24px; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  code { font-size: 12px; }
</style>
<h1>verify:system</h1>
<p>SHA <code>${report.sha}</code> · ${report.generatedAt} · proof class cấm <code>docs</code></p>
<table>
  <thead><tr><th>L</th><th>Claim</th><th>Command</th><th>Class</th><th>Gate</th><th>Status</th><th>Detail</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p>L3/L4 unmeasured khi thiếu hoặc SHA lệch journeys.json. Ledger of record = artifact job ui-e2e.</p>
`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function buildReport({ skipSlow: skip = false } = {}) {
  const sha = git(['rev-parse', 'HEAD']);
  const layers = [];

  const add = (layer) => layers.push(layer);

  if (!skip) {
    const tc = run('pnpm', ['typecheck']);
    add({
      id: 'L0',
      claim: 'typecheck HEAD',
      command: 'pnpm typecheck',
      sha,
      proofClass: 'behavior',
      blocking: true,
      status: tc.ok ? 'ok' : 'fail',
      detail: tc.detail,
    });
    const lint = run('pnpm', ['lint']);
    add({
      id: 'L0b',
      claim: 'eslint admin+lms+scripts',
      command: 'pnpm lint',
      sha,
      proofClass: 'behavior',
      blocking: true,
      status: lint.ok ? 'ok' : 'fail',
      detail: lint.detail,
    });
  } else {
    add({
      id: 'L0',
      claim: 'typecheck HEAD',
      command: 'pnpm typecheck',
      sha,
      proofClass: 'unmeasured',
      blocking: true,
      status: 'unmeasured',
      detail: '--skip-slow',
    });
  }

  add({
    id: 'L1',
    claim: 'unit tests',
    command: 'pnpm test (CI typecheck-and-test)',
    sha,
    proofClass: 'unmeasured',
    blocking: true,
    status: 'unmeasured',
    detail: 'Meter không chạy turbo test; cổng CI typecheck-and-test giữ nguyên.',
  });

  const sourceChecks = [
    ['L2a', 'UI frames', ['node', 'scripts/check-ui-frames.mjs', '--json']],
    ['L2b', 'UI ratchet', ['pnpm', 'check:ui-ratchet']],
    ['L2c', 'UI a11y roles', ['pnpm', 'check:ui-a11y-roles']],
    ['L2d', 'Doc authority', ['pnpm', 'check:doc-authority']],
    ['L2e', 'URL structure', ['pnpm', 'check:url-structure']],
    ['L2f', 'URL literals', ['pnpm', 'check:url-literals']],
  ];
  for (const [id, claim, argv] of sourceChecks) {
    const result = run(argv[0], argv.slice(1));
    add({
      id,
      claim,
      command: argv.join(' '),
      sha,
      proofClass: 'source-string',
      blocking: true,
      status: result.ok ? 'ok' : 'fail',
      detail: result.detail,
    });
  }

  const j = journeysProof(JOURNEYS, sha);
  add({
    id: 'L3',
    claim: 'ui-e2e ledger at this HEAD',
    command: 'read apps/e2e/acceptance-results/journeys.json',
    sha,
    proofClass: j.proofClass,
    blocking: false,
    status: j.status,
    detail: j.detail,
  });
  add({
    id: 'L4',
    claim: 'business:verify --strict',
    command: 'pnpm business:verify --strict (chỉ job ui-e2e)',
    sha,
    proofClass: 'unmeasured',
    blocking: false,
    status: 'unmeasured',
    detail: 'Meter không gọi --strict. BLOCK chỉ trên ui-e2e.yml khi SHA khớp.',
  });

  const inv = inventoryUi();
  add({
    id: 'L5',
    claim: '@cmc/ui CSS coupling inventory',
    command: 'scan packages/ui/src (no tests)',
    sha,
    proofClass: 'source-string',
    blocking: false,
    status: 'ok',
    detail: `HYBRID ${inv.counts.HYBRID} · CONSOLE-ONLY ${inv.counts['CONSOLE-ONLY']} · ASTRYX-ONLY ${inv.counts['ASTRYX-ONLY']} · ASTRYX+INLINE ${inv.counts['ASTRYX+INLINE']} · INLINE-ONLY ${inv.counts['INLINE-ONLY']} · OTHER ${inv.counts.OTHER} (${inv.fileCount} files)`,
  });

  add({
    id: 'L6',
    claim: 'trivy / API e2e',
    command: 'ci.yml continue-on-error',
    sha,
    proofClass: 'unmeasured',
    blocking: false,
    status: 'unmeasured',
    detail: 'Advisory trên CI; meter không chạy.',
  });

  const failed = layers.filter((l) => l.status === 'fail');
  return {
    generatedAt: new Date().toISOString(),
    sha,
    proofClassesAllowed: ['behavior', 'source-string', 'ci-artifact', 'unmeasured'],
    never: ['docs', 'business:verify --strict', 'verification.json.commit as evidence'],
    layers,
    inventory: inv.counts,
    journeys: { present: j.present, sha: j.journeysSha, match: j.match },
    ok: failed.length === 0,
  };
}

function main() {
  const report = buildReport({ skipSlow });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, 'system-verification.json'), JSON.stringify(report, null, 2));
  writeFileSync(path.join(OUTPUT_DIR, 'system-verification.html'), renderHtml(report));
  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`verify:system  SHA ${report.sha}  ${report.ok ? 'ok' : 'FAIL'}`);
    for (const l of report.layers) {
      console.log(`  ${l.id.padEnd(4)} ${l.status.padEnd(11)} ${l.proofClass.padEnd(14)} ${l.claim} — ${l.detail.split('\n')[0]}`);
    }
    console.log(`  -> ${path.join(OUTPUT_DIR, 'system-verification.html')}`);
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
