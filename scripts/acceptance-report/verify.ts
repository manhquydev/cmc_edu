// Entry point for `pnpm acceptance:report`. Scans code at HEAD, matches
// against the flow manifest, writes acceptance-report/verification.json,
// then renders the HTML (Phase 2/3). No hand-written state persists between
// runs — everything here is recomputed from the current worktree.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { flows } from './flow-manifest.js';
import { scanTrpcRouters } from './scanners/trpc-scanner.js';
import { scanUiRoutes } from './scanners/route-scanner.js';
import { scanPrismaModels } from './scanners/prisma-scanner.js';
import { render } from './render.js';
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

function getHeadCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function verifyFlow(
  flow: (typeof flows)[number],
  scan: { procedures: ReadonlySet<string>; uiRoutes: ReadonlySet<string>; models: readonly string[] },
): FlowVerification {
  const missingTrpc = flow.expected.trpc.filter((p) => !scan.procedures.has(p));
  const missingRoutes = flow.expected.uiRoutes.filter((r) => !scan.uiRoutes.has(r));
  const missingModels = flow.expected.models.filter((m) => !scan.models.includes(m));

  const totalExpected = flow.expected.trpc.length + flow.expected.uiRoutes.length + flow.expected.models.length;
  const totalMissing = missingTrpc.length + missingRoutes.length + missingModels.length;

  const status = totalMissing === 0 ? 'built' : totalMissing === totalExpected ? 'missing' : 'partial';

  return {
    flow,
    status,
    missing: { trpc: missingTrpc, uiRoutes: missingRoutes, models: missingModels },
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
  const uiRoutes = scanUiRoutes();
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
    verifyFlow(flow, { procedures: trpcScan.procedures, uiRoutes, models }),
  );
  const orphans = computeProcedureOrphans(trpcScan.procedures, flows);

  const result: VerificationResult = {
    generatedAt: new Date().toISOString(),
    commit: getHeadCommit(),
    flows: flowResults,
    orphans,
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
  if (orphans.untriaged.length > 0) {
    console.warn(`  ORPHAN CHƯA PHÂN LOẠI (cần quyết định): ${orphans.untriaged.join(', ')}`);
  }
  if (trpcScan.unresolved.length > 0) {
    console.warn(`  UNRESOLVED namespaces (scanner could not parse): ${trpcScan.unresolved.join(', ')}`);
  }
  console.log(`  -> ${path.join(OUTPUT_DIR, 'index.html')}`);
}

main();
