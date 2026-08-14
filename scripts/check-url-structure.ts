/**
 * URL structure contract check — as-built authority.
 *
 * Compares four live surfaces against scripts/url-structure-contract.ts:
 *   1. registered React Router paths (route-scanner)
 *   2. @cmc/links entity + workspace builders
 *   3. admin nav-registry paths
 *   4. flow-manifest uiRoutes (acceptance report)
 *
 * TL06 §3 is scanned for a paper-notes appendix only. Paper ≠ as-built
 * does not fail the gate. Unknown routes, dangling links/nav, missing
 * catalog asBuilt rows, and forbidden stale paths do.
 *
 * Usage:
 *   pnpm check:url-structure
 *   pnpm check:url-structure --json
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  attendancePath,
  checkInPath,
  gradingPath,
  kpiScoresPath,
  links,
  payrollPath,
  sessionEvidencePath,
  shiftRegistrationNewPath,
  shiftRegistrationsPath,
} from '../packages/links/src/index.js';
import { flows } from './acceptance-report/flow-manifest.js';
import {
  scanAdminUiRoutesDetailed,
  scanUiRoutesDetailed,
  type UiRouteInfo,
} from './acceptance-report/scanners/route-scanner.js';
import {
  FORBIDDEN_PATHS,
  INFRA_PATHS,
  URL_CONTRACT,
  familyLabel,
  type UrlApp,
  type UrlContractEntry,
  type UrlFamily,
} from './url-structure-contract.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

export interface UrlManifestRoute {
  flowId: string;
  path: string;
}

export interface UrlAuditInput {
  routes: readonly UiRouteInfo[];
  linkPatterns: Readonly<Record<string, string>>;
  workspacePaths: readonly string[];
  navPaths: readonly string[];
  paperPaths: readonly string[];
  catalog: readonly UrlContractEntry[];
  /** Acceptance-report uiRoutes; omitted in unit fixtures. */
  manifestRoutes?: readonly UrlManifestRoute[];
}

export interface UrlAuditFinding {
  code:
    | 'unknown-route'
    | 'missing-as-built'
    | 'missing-redirect'
    | 'wrong-redirect'
    | 'dangling-link'
    | 'dangling-workspace'
    | 'dangling-nav'
    | 'dangling-manifest'
    | 'forbidden';
  message: string;
}

export interface UrlPaperNote {
  paper: string;
  asBuilt?: string;
  reason: 'differs' | 'no-screen' | 'uncatalogued-paper';
}

export interface UrlAuditReport {
  ok: boolean;
  authority: 'router+links+nav';
  routeCount: number;
  catalogCount: number;
  paperCount: number;
  familyCounts: Record<UrlFamily, number>;
  mix: Array<{ id: string; app: UrlApp; paper?: string; asBuilt?: string; family: UrlFamily; label: string }>;
  paperNotes: UrlPaperNote[];
  findings: UrlAuditFinding[];
}

export function canonPath(routePath: string): string {
  return routePath.replace(/:[A-Za-z0-9_]+/g, ':id');
}

export function normalizeDocPath(raw: string): string {
  let value = raw.trim();
  const query = value.indexOf('?');
  if (query !== -1) value = value.slice(0, query);
  value = value.replace(/\{[^}]+\}/g, ':id').replace(/\[id\]/g, ':id');
  if (value.length > 1) value = value.replace(/\/$/, '');
  return value || '/';
}

export function extractTl06Paths(markdown: string): string[] {
  const start = markdown.indexOf('\n## 3.');
  const end = markdown.indexOf('\n## 4.');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('docs/06-kien-truc-url-routing.md is missing §3/§4 headings');
  }
  const section = markdown.slice(start, end);
  const paths = new Set<string>();

  const collect = (text: string) => {
    for (const tick of text.matchAll(/`([^`]+)`/g)) {
      for (const token of tick[1].split(/[·→]/)) {
        const match = token.trim().match(/^(\/[a-zA-Z][a-zA-Z0-9\-/{}.]*)/);
        if (!match) continue;
        const normalised = normalizeDocPath(match[1]);
        if (normalised.startsWith('/:id')) continue;
        if (normalised === '/login/otp-phone') continue;
        paths.add(normalised);
      }
    }
  };

  for (const line of section.split('\n')) {
    const trimmed = line.replace(/^>\s?/, '');
    if (trimmed.startsWith('|')) {
      if (/^\|\s*-+/.test(trimmed) || /^\|\s*Trang/.test(trimmed)) continue;
      const cols = trimmed.replace(/\\\|/g, '/').split('|').map((col) => col.trim());
      collect(cols[2] ?? '');
      continue;
    }
    const bullet = trimmed.match(/^- `(\/[a-zA-Z][^`]+)`/);
    if (bullet) collect(`\`${bullet[1]}\``);
  }

  for (const child of section.matchAll(/`(\/child\/\{[^}]+\}[^`]*)`/g)) {
    paths.add(normalizeDocPath(child[1]));
  }

  return [...paths].sort();
}

export function scanNavPaths(source: string): string[] {
  const paths = [...source.matchAll(/\bpath:\s*'(\/[^']+)'/g)].map((match) => match[1]);
  return [...new Set(paths)].sort();
}

export function liveLinkPatterns(): Record<string, string> {
  const patterns: Record<string, string> = {};
  for (const [entity, builder] of Object.entries(links)) {
    patterns[entity] = builder(SAMPLE_UUID).replaceAll(SAMPLE_UUID, ':id');
  }
  return patterns;
}

export function liveWorkspacePaths(): string[] {
  return [
    shiftRegistrationsPath(),
    shiftRegistrationNewPath(),
    checkInPath(),
    kpiScoresPath(),
    attendancePath({}),
    gradingPath({}),
    payrollPath({}),
    sessionEvidencePath({}),
  ].map((value) => normalizeDocPath(value));
}

function emptyFamilyCounts(): Record<UrlFamily, number> {
  return {
    'form-depth': 0,
    'index-resource': 0,
    'admin-module': 0,
    workspace: 0,
    shell: 0,
    lms: 0,
    'paper-only': 0,
  };
}

function routeExists(
  routes: readonly UiRouteInfo[],
  app: UrlApp,
  routePath: string,
): UiRouteInfo | undefined {
  const wanted = canonPath(routePath);
  return routes.find((info) => info.app === app && canonPath(info.path) === wanted);
}

function paperDiffers(paper: string, asBuilt: string): boolean {
  return canonPath(paper) !== canonPath(asBuilt);
}

export function auditUrlStructure(input: UrlAuditInput): UrlAuditReport {
  const findings: UrlAuditFinding[] = [];
  const paperNotes: UrlPaperNote[] = [];
  const familyCounts = emptyFamilyCounts();
  const catalogAsBuilt = new Set<string>();
  const catalogRedirects = new Set<string>();
  const catalogPaper = new Set<string>();

  for (const entry of input.catalog) {
    familyCounts[entry.family] += 1;
    if (entry.paper) catalogPaper.add(canonPath(entry.paper));
    if (entry.asBuilt) catalogAsBuilt.add(`${entry.app}:${canonPath(entry.asBuilt)}`);
    for (const from of entry.redirectFrom ?? []) {
      catalogRedirects.add(`${entry.app}:${canonPath(from)}`);
    }
    if (entry.paper && !entry.asBuilt) {
      paperNotes.push({ paper: entry.paper, reason: 'no-screen' });
    } else if (entry.paper && entry.asBuilt && paperDiffers(entry.paper, entry.asBuilt)) {
      paperNotes.push({ paper: entry.paper, asBuilt: entry.asBuilt, reason: 'differs' });
    }
  }

  for (const entry of input.catalog) {
    if (entry.asBuilt) {
      const info = routeExists(input.routes, entry.app, entry.asBuilt);
      if (!info) {
        findings.push({
          code: 'missing-as-built',
          message: `${entry.id}: catalog asBuilt ${entry.asBuilt} is not registered in ${entry.app}`,
        });
      }
    }
    for (const from of entry.redirectFrom ?? []) {
      const info = routeExists(input.routes, entry.app, from);
      if (!info) {
        findings.push({
          code: 'missing-redirect',
          message: `${entry.id}: redirect ${from} is not registered`,
        });
        continue;
      }
      if (info.kind !== 'redirect') {
        findings.push({
          code: 'wrong-redirect',
          message: `${entry.id}: ${from} is ${info.kind}, expected redirect`,
        });
        continue;
      }
      if (entry.asBuilt && info.redirectTarget && canonPath(info.redirectTarget) !== canonPath(entry.asBuilt)) {
        findings.push({
          code: 'wrong-redirect',
          message: `${entry.id}: ${from} redirects to ${info.redirectTarget}, expected ${entry.asBuilt}`,
        });
      }
    }
  }

  for (const info of input.routes) {
    const forbiddenHit = FORBIDDEN_PATHS.some(
      (stale) => info.path === stale || canonPath(info.path) === stale,
    );
    if (forbiddenHit) {
      findings.push({ code: 'forbidden', message: `stale path still registered: ${info.path}` });
    }
    if (INFRA_PATHS.has(info.path) || INFRA_PATHS.has(canonPath(info.path))) continue;
    const key = `${info.app}:${canonPath(info.path)}`;
    if (!catalogAsBuilt.has(key) && !catalogRedirects.has(key)) {
      findings.push({
        code: 'unknown-route',
        message: `registered ${info.app} ${info.path} is not in the URL contract catalog`,
      });
    }
  }

  for (const paperPath of input.paperPaths) {
    if (!catalogPaper.has(canonPath(paperPath))) {
      paperNotes.push({ paper: paperPath, reason: 'uncatalogued-paper' });
    }
  }

  const registeredCanons = new Map<string, string[]>();
  for (const info of input.routes) {
    const key = `${info.app}:${canonPath(info.path)}`;
    const list = registeredCanons.get(key) ?? [];
    list.push(info.path);
    registeredCanons.set(key, list);
  }

  for (const [entity, pattern] of Object.entries(input.linkPatterns)) {
    const canon = canonPath(pattern);
    if (!registeredCanons.get(`admin:${canon}`)) {
      findings.push({
        code: 'dangling-link',
        message: `links.${entity} → ${pattern} is not a registered admin route`,
      });
    }
  }

  for (const workspacePath of input.workspacePaths) {
    const canon = canonPath(workspacePath);
    if (!registeredCanons.get(`admin:${canon}`)) {
      findings.push({
        code: 'dangling-workspace',
        message: `workspace builder → ${workspacePath} is not a registered admin route`,
      });
    }
  }

  for (const navPath of input.navPaths) {
    const canon = canonPath(navPath);
    if (!registeredCanons.get(`admin:${canon}`)) {
      findings.push({
        code: 'dangling-nav',
        message: `nav path ${navPath} is not a registered admin route`,
      });
    }
  }

  for (const row of input.manifestRoutes ?? []) {
    const canon = canonPath(row.path);
    if (!registeredCanons.get(`admin:${canon}`) && !registeredCanons.get(`lms:${canon}`)) {
      findings.push({
        code: 'dangling-manifest',
        message: `${row.flowId} uiRoute ${row.path} is not a registered admin or lms route`,
      });
    }
  }

  const mix = input.catalog
    .filter((entry) => entry.family === 'admin-module' || entry.family === 'index-resource')
    .filter((entry) => entry.asBuilt)
    .map((entry) => ({
      id: entry.id,
      app: entry.app,
      paper: entry.paper,
      asBuilt: entry.asBuilt,
      family: entry.family,
      label: familyLabel(entry.family),
    }));

  return {
    ok: findings.length === 0,
    authority: 'router+links+nav',
    routeCount: input.routes.length,
    catalogCount: input.catalog.length,
    paperCount: input.paperPaths.length,
    familyCounts,
    mix,
    paperNotes,
    findings,
  };
}

export function collectLiveRoutes(): UiRouteInfo[] {
  const admin = [...scanAdminUiRoutesDetailed().values()];
  const lms = [...scanUiRoutesDetailed().values()].filter((info) => info.app === 'lms');
  return [...admin, ...lms];
}

export function loadLiveAuditInput(root = REPO_ROOT): UrlAuditInput {
  const navSource = readFileSync(path.join(root, 'apps/admin/src/shell/nav-registry.ts'), 'utf8');
  const tl06 = readFileSync(path.join(root, 'docs/06-kien-truc-url-routing.md'), 'utf8');
  return {
    routes: collectLiveRoutes(),
    linkPatterns: liveLinkPatterns(),
    workspacePaths: liveWorkspacePaths(),
    navPaths: scanNavPaths(navSource),
    paperPaths: extractTl06Paths(tl06),
    catalog: URL_CONTRACT,
    manifestRoutes: flows.flatMap((flow) =>
      flow.expected.uiRoutes.map((routePath) => ({ flowId: flow.id, path: routePath })),
    ),
  };
}

function formatHuman(report: UrlAuditReport): string {
  const lines = [
    `URL structure  ${report.ok ? 'ok' : 'FAIL'}`,
    `  authority  ${report.authority}  (TL06 paper is advisory)`,
    `  routes ${report.routeCount} · catalog ${report.catalogCount} · paper ${report.paperCount}`,
    `  families  form-depth=${report.familyCounts['form-depth']} admin-module=${report.familyCounts['admin-module']} index-resource=${report.familyCounts['index-resource']} workspace=${report.familyCounts.workspace} shell=${report.familyCounts.shell} lms=${report.familyCounts.lms} paper-only=${report.familyCounts['paper-only']}`,
  ];
  if (report.mix.length > 0) {
    lines.push('  as-built mix (accepted, not a defect):');
    for (const row of report.mix) {
      lines.push(`    ${row.id}: ${row.asBuilt}  (${row.label})`);
    }
  }
  if (report.paperNotes.length > 0) {
    lines.push(`  paper notes (${report.paperNotes.length}, not blocking):`);
    for (const note of report.paperNotes.slice(0, 8)) {
      const extra = note.asBuilt ? ` → as-built ${note.asBuilt}` : '';
      lines.push(`    ${note.paper}${extra}  (${note.reason})`);
    }
    if (report.paperNotes.length > 8) {
      lines.push(`    … ${report.paperNotes.length - 8} more`);
    }
  }
  if (report.findings.length > 0) {
    lines.push('  findings:');
    for (const finding of report.findings) {
      lines.push(`    FAIL ${finding.code}  ${finding.message}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function main(): void {
  const report = auditUrlStructure(loadLiveAuditInput());
  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatHuman(report));
  }
  process.exit(report.ok ? 0 : 1);
}

const invoked = process.argv[1] && path.basename(process.argv[1]).includes('check-url-structure');
if (invoked) main();
