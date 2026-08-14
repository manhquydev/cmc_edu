#!/usr/bin/env node
/**
 * Source-literal scan for paper/stale admin+LMS paths that are not registered.
 * Authority is as-built (@cmc/links + routers), not TL06.
 *
 * Usage:
 *   node scripts/check-url-literals.mjs [--json] [--root <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const rootFlag = process.argv.indexOf('--root');
const root =
  rootFlag !== -1 && process.argv[rootFlag + 1]
    ? path.resolve(process.argv[rootFlag + 1])
    : defaultRoot;

const SCAN_ROOTS = [
  'apps/admin/src',
  'apps/lms/src',
  'apps/api/src',
  'apps/e2e',
  'packages/links/src',
  'scripts/acceptance-report/flow-manifest.ts',
  'scripts/live-sim-ops-lifecycle.mjs',
  'scripts/live-sim-browser-audit.mjs',
];

const SKIP_NAME = /\.test\.(ts|tsx|mjs|js)$/;
const ALWAYS_SCAN = /(?:^|\/)(apps\/e2e|flow-manifest\.ts)/;

/** Quoted path prefixes that 404 or are July paper, not as-built. */
const FORBIDDEN = [
  '/finance/receipts',
  '/attendance/check-in-out',
  '/attendance/shifts',
  '/login/otp-phone',
  '/hr/salary-structure',
  '/hr/my-payslip',
  '/child/',
  '/teaching/report-cards',
  '/students',
  '/parents',
  '/courses',
  '/engagement/rewards',
  '/engagement/gifts',
  '/engagement/leaderboard',
];

const ALLOW_PREFIX = new Set(['/students', '/parents', '/courses', '/engagement/rewards', '/engagement/gifts', '/engagement/leaderboard']);

function walk(abs, out = []) {
  if (!fs.existsSync(abs)) return out;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    const relHint = abs.replace(/\\/g, '/');
    const keepTest = ALWAYS_SCAN.test(relHint);
    if ((keepTest || !SKIP_NAME.test(abs)) && /\.(ts|tsx|mjs|js)$/.test(abs)) out.push(abs);
    return out;
  }
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist') continue;
    walk(path.join(abs, ent.name), out);
  }
  return out;
}

function isAllowedMount(literal) {
  return (
    literal.startsWith('/admin/students') ||
    literal.startsWith('/admin/parents') ||
    literal.startsWith('/admin/courses') ||
    literal.startsWith('/admin/engagement/')
  );
}

function forbiddenHit(literal) {
  for (const needle of FORBIDDEN) {
    if (!literal.startsWith(needle)) continue;
    if (ALLOW_PREFIX.has(needle) && isAllowedMount(literal)) continue;
    if (needle === '/students' && literal.startsWith('/admin/students')) continue;
    return needle;
  }
  return null;
}

function scanFile(abs) {
  const text = fs.readFileSync(abs, 'utf8');
  const hits = [];
  const re = /(['"`])(\/[A-Za-z][A-Za-z0-9\-/{}$]*)/g;
  let match;
  while ((match = re.exec(text))) {
    const literal = match[2].replace(/\$\{[^}]*\}/g, ':id');
    const needle = forbiddenHit(literal);
    if (!needle) continue;
    const line = text.slice(0, match.index).split('\n').length;
    hits.push({ line, literal, needle });
  }
  return hits;
}

const files = SCAN_ROOTS.flatMap((rel) => walk(path.join(root, rel)));
const results = files
  .map((abs) => {
    const hits = scanFile(abs);
    return { file: path.relative(root, abs), ok: hits.length === 0, hits };
  })
  .filter((row) => !row.ok);

const report = {
  ok: results.length === 0,
  fileCount: files.length,
  failCount: results.length,
  results,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  if (report.ok) {
    console.log(`ok  url-literals  ${files.length} files`);
  } else {
    for (const row of results) {
      console.log(`FAIL ${row.file}`);
      for (const hit of row.hits) {
        console.log(`     ${row.file}:${hit.line}  ${hit.literal}  (paper/stale ${hit.needle})`);
      }
    }
    console.log(`\n${results.length} files still use paper/stale URL literals.`);
  }
}

process.exit(report.ok ? 0 : 1);
