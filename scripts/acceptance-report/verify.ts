// Entry point for `pnpm acceptance:report`. Scans code at HEAD, matches
// against the flow manifest, writes acceptance-report/verification.json,
// then renders the HTML (Phase 2/3). No hand-written state persists between
// runs — everything here is recomputed from the current worktree.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { flows } from './flow-manifest.js';
import { scanTrpcRouters } from './scanners/trpc-scanner.js';
import { scanUiRoutesDetailed } from './scanners/route-scanner.js';
import { scanPrismaModels } from './scanners/prisma-scanner.js';
import { render } from './render.js';
import { auditFlowActors } from './actor-audit.js';
import type { FlowVerification, OrphanResult, VerificationResult } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'acceptance-report');

// Namespaces that are wholly infrastructure, not business flows — real
// appRouter keys only. `audit`/`user`/`facilityNetwork` are NOT here: they are
// claimed by ADMIN flows (ADM-04/02/03), so orphan detection covers the admin
// surface too (plan 260718-0423 E4). Only `health` (probe) and `lmsAuth` (auth
// plumbing: OTP variants, student login, child-password reset) stay whitelisted.
const INFRA_NAMESPACE_WHITELIST = new Set(['health', 'lmsAuth']);

// Individual infrastructure procedures inside otherwise-business namespaces.
// STRICT rule (E4): only provably infra-pure, read-only, non-admin procedures.
// Never an admin/auth-sensitive procedure — those must become a manifest flow
// or a documented gap, never a silent whitelist entry. Each needs a 1-line why.
const INFRA_PROCEDURE_WHITELIST = new Set([
  'session.me', // phiên đăng nhập hiện tại — hạ tầng nav-gating, đọc-only, không admin
]);

// Orphan procedures that ARE real capabilities but have no TL25 workflow / dedicated
// screen — deliberately NOT claimed by a flow and NOT whitelisted (E7 category c).
// These are honest "documented gaps": candidates for a future flow or a TL25 addendum.
// Keeping them out of the whitelist means they stay VISIBLE (not silently suppressed);
// this map only annotates them with a reason so the tool distinguishes triaged gaps
// from brand-new un-triaged orphans that need a decision.
const DOCUMENTED_GAPS: Record<string, string> = {
  // PO quyết 2026-07-18: khoá học hiện import data, nhưng cần MÀN HÌNH tạo/quản lý
  // cho GĐĐT tự xử lý (không phụ thuộc IT chạy code) → tính năng tương lai cần xây;
  // trang /admin/courses hiện chỉ có danh sách (course.list), thiếu form tạo.
  'course.create': 'Tạo/quản lý khoá học cho GĐĐT — cần màn hình mới (hiện chỉ import data + trang danh sách; PO xác nhận là tính năng tương lai 2026-07-18)',
};

/**
 * Phase 5 (plan 260723-1422): cheap, non-Playwright check for every flow that
 * declares a `journey` spec — the file must exist AND contain at least one
 * `test(` call. WARN only (never fail the report), per the phase doc: the
 * report must stay cheap (no Playwright execution inside `acceptance:report`)
 * and a missing/empty journey file is a authoring mistake to flag, not a
 * reason to block the whole ledger from rendering.
 */
function checkJourneyCoverage(manifestFlows: typeof flows): void {
  for (const flow of manifestFlows) {
    if (!flow.journey) continue;
    const specPath = path.join(REPO_ROOT, flow.journey);
    if (!existsSync(specPath)) {
      console.warn(`  JOURNEY MISSING: flow "${flow.id}" declares journey "${flow.journey}" — file not found.`);
      continue;
    }
    const contents = readFileSync(specPath, 'utf8');
    if (!contents.includes('test(')) {
      console.warn(`  JOURNEY EMPTY: flow "${flow.id}"'s journey "${flow.journey}" has no \`test(\` call.`);
    }
  }
}

function getHeadCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function verifyFlow(
  flow: (typeof flows)[number],
  scan: {
    procedures: ReadonlySet<string>;
    uiRoutes: ReadonlySet<string>;
    models: readonly string[];
    uiRouteInfo: ReadonlyMap<string, { placeholder: boolean; placeholderKind?: string }>;
  },
): FlowVerification {
  const missingTrpc = flow.expected.trpc.filter((p) => !scan.procedures.has(p));
  const missingRoutes = flow.expected.uiRoutes.filter((r) => !scan.uiRoutes.has(r));
  const missingModels = flow.expected.models.filter((m) => !scan.models.includes(m));

  const totalExpected = flow.expected.trpc.length + flow.expected.uiRoutes.length + flow.expected.models.length;
  const totalMissing = missingTrpc.length + missingRoutes.length + missingModels.length;

  // A route that resolves but renders a placeholder is not a delivered screen.
  // Without this the flow counts as built purely because the path exists, which
  // is how a "feature not implemented yet" page was reported as done.
  const placeholderRoutes = flow.expected.uiRoutes
    .map((path) => ({ path, info: scan.uiRouteInfo.get(path) }))
    .filter((r) => r.info?.placeholder)
    .map((r) => ({ path: r.path, kind: r.info!.placeholderKind ?? 'placeholder' }));

  const status: FlowVerification['status'] =
    totalMissing === totalExpected && totalExpected > 0
      ? 'missing'
      : totalMissing === 0 && placeholderRoutes.length === 0
        ? 'built'
        : 'partial';

  return {
    flow,
    status,
    missing: { trpc: missingTrpc, uiRoutes: missingRoutes, models: missingModels },
    placeholderRoutes,
  };
}

function computeProcedureOrphans(
  scannedProcedures: ReadonlySet<string>,
  manifestFlows: typeof flows,
): OrphanResult {
  const referenced = new Set(manifestFlows.flatMap((f) => f.expected.trpc));
  const orphans: string[] = [];
  for (const proc of scannedProcedures) {
    const namespace = proc.split('.')[0];
    if (INFRA_NAMESPACE_WHITELIST.has(namespace)) continue;
    if (INFRA_PROCEDURE_WHITELIST.has(proc)) continue;
    if (!referenced.has(proc)) orphans.push(proc);
  }
  orphans.sort();
  const documented = orphans
    .filter((p) => p in DOCUMENTED_GAPS)
    .map((procedure) => ({ procedure, reason: DOCUMENTED_GAPS[procedure] }));
  const untriaged = orphans.filter((p) => !(p in DOCUMENTED_GAPS));
  return { procedures: orphans, documented, untriaged };
}

function main(): void {
  const trpcScan = scanTrpcRouters();
  const uiRouteInfo = scanUiRoutesDetailed();
  const uiRoutes = new Set(uiRouteInfo.keys());
  const models = scanPrismaModels();

  // Whitelist entries must resolve to a real scanned namespace — a dead
  // entry means the whitelist is guessing, not describing the code (red-team #14).
  for (const ns of INFRA_NAMESPACE_WHITELIST) {
    if (!trpcScan.namespaces.includes(ns)) {
      throw new Error(`INFRA_NAMESPACE_WHITELIST entry "${ns}" does not match any scanned appRouter key`);
    }
  }

  // Liveness guard for the procedure-level whitelist (mirror of the namespace
  // guard above, E4): a dead entry means the whitelist is stale config nobody
  // can prove still describes real infra — fail loud so it can't silently rot.
  for (const proc of INFRA_PROCEDURE_WHITELIST) {
    if (!trpcScan.procedures.has(proc)) {
      throw new Error(`INFRA_PROCEDURE_WHITELIST entry "${proc}" does not match any scanned procedure`);
    }
  }

  // Liveness guard for documented gaps: a gap entry that no longer resolves to a
  // real procedure is stale — drop it from the map rather than leaving a lie.
  for (const proc of Object.keys(DOCUMENTED_GAPS)) {
    if (!trpcScan.procedures.has(proc)) {
      throw new Error(`DOCUMENTED_GAPS entry "${proc}" does not match any scanned procedure`);
    }
  }

  // A flow with zero expected symbols across all three dimensions would
  // vacuously compute totalMissing === totalExpected === 0 -> "built" with
  // nothing actually verified. That is a manifest-authoring mistake, not a
  // real flow — fail loudly instead of silently reporting false green.
  for (const flow of flows) {
    const totalExpected = flow.expected.trpc.length + flow.expected.uiRoutes.length + flow.expected.models.length;
    if (totalExpected === 0) {
      throw new Error(`Flow "${flow.id}" has no expected trpc/uiRoutes/models — manifest entry is empty`);
    }
  }

  const flowResults = flows.map((flow) =>
    verifyFlow(flow, { procedures: trpcScan.procedures, uiRoutes, models, uiRouteInfo }),
  );
  const orphans = computeProcedureOrphans(trpcScan.procedures, flows);
  const actorAudit = auditFlowActors(flows, trpcScan.permissionKeys);

  const result: VerificationResult = {
    generatedAt: new Date().toISOString(),
    commit: getHeadCommit(),
    flows: flowResults,
    orphans,
    actorAudit,
    scan: {
      trpcNamespaceCount: trpcScan.namespaces.length,
      unresolvedNamespaces: trpcScan.unresolved,
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(OUTPUT_DIR, 'verification.json'), JSON.stringify(result, null, 2));

  render(result, OUTPUT_DIR);

  const built = flowResults.filter((f) => f.status === 'built').length;
  const partial = flowResults.filter((f) => f.status === 'partial').length;
  const missing = flowResults.filter((f) => f.status === 'missing').length;
  console.log(
    `acceptance:report — ${flowResults.length} luồng (${built} built, ${partial} partial, ${missing} missing), ` +
      `${orphans.procedures.length} orphan (${orphans.documented.length} documented gap, ${orphans.untriaged.length} chưa phân loại), ` +
      `${trpcScan.unresolved.length} unresolved namespaces.`,
  );

  // Phase 5: journey coverage — "has a spec file" only, never "passed in CI".
  checkJourneyCoverage(flows);
  const journeyCount = flows.filter((f) => f.journey).length;
  console.log(`journey coverage — ${journeyCount}/${flows.length} luồng có journey spec (xem badge trong tab Nghiệm thu).`);
  if (orphans.untriaged.length > 0) {
    console.warn(`  ORPHAN CHƯA PHÂN LOẠI (cần quyết định): ${orphans.untriaged.join(', ')}`);
  }
  if (trpcScan.unresolved.length > 0) {
    console.warn(`  UNRESOLVED namespaces (scanner could not parse): ${trpcScan.unresolved.join(', ')}`);
  }

  // Actor-vs-permission consistency. Reported, not yet fatal: the backlog it
  // surfaces predates this check, and a gate that fails on day one gets muted
  // rather than fixed. Promote to exit-code once the existing findings are
  // triaged.
  const byKind = (kind: string) => actorAudit.findings.filter((f) => f.kind === kind);
  console.log(
    `actor-audit — ${actorAudit.findings.length} phát hiện ` +
      `(${byKind('invalid-actor').length} vai không tồn tại, ${byKind('idle-actor').length} actor không làm được gì, ` +
      `${byKind('unreachable-procedure').length} procedure không actor nào gọi được); ` +
      `${actorAudit.ungatedProcedureCount} procedure ngoài tầm registry, ` +
      `${actorAudit.inconclusiveActorCount} (luồng, vai) không kết luận được`,
  );
  for (const f of [...byKind('invalid-actor'), ...byKind('idle-actor')]) {
    console.warn(`  ${f.kind.toUpperCase()} ${f.flowId} · ${f.subject}`);
  }
  console.log(`  -> ${path.join(OUTPUT_DIR, 'index.html')}`);

  // The report is written and rendered first, then the exit code is set: a
  // failing run must still leave the artifact behind to read. An untriaged
  // orphan means a procedure exists that no flow claims — either the manifest
  // is stale or something shipped nobody described; both need a decision, and
  // a warning nobody reads is how this went unnoticed until now.
  if (orphans.untriaged.length > 0 || trpcScan.unresolved.length > 0) {
    process.exitCode = 1;
  }
}

main();
