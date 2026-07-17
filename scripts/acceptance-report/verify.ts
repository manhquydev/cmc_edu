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

// Namespaces that are infrastructure, not business flows — real appRouter
// keys only (never `auth.*`/`security.*`, which don't exist; red-team #14).
const INFRA_NAMESPACE_WHITELIST = new Set(['health', 'lmsAuth', 'audit', 'user', 'facilityNetwork']);

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
    if (!referenced.has(proc)) orphans.push(proc);
  }
  return { procedures: orphans.sort() };
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
      `${orphans.procedures.length} orphan procedures, ${trpcScan.unresolved.length} unresolved namespaces.`,
  );
  if (trpcScan.unresolved.length > 0) {
    console.warn(`  UNRESOLVED namespaces (scanner could not parse): ${trpcScan.unresolved.join(', ')}`);
  }
  console.log(`  -> ${path.join(OUTPUT_DIR, 'index.html')}`);
}

main();
