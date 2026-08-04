// Entry point for `pnpm business:verify` — the correctness tier of the
// acceptance verification pipeline.
//
// The acceptance ledger (`pnpm acceptance:report`) answers "is this flow
// reachable and green" (`proven`). It does NOT answer "does the flow compute
// the right numbers". This gate adds exactly that one dimension, as a read-only
// layer ON TOP of the ledger — it never touches flow-evidence.ts / verify.ts,
// which feed the `ui-e2e` required check.
//
// A flow is `verified-correct` only when its journey both (a) is `proven` in the
// ledger and (b) executed at least one `assertBusinessInvariant(...)` that
// passed — the annotation recorded in journeys.json. A `proven` flow with no
// such annotation degrades honestly to `reachable-only`: green, but nothing
// about its numbers was ever checked.
//
// Inputs (both already produced by the existing pipeline):
//   - acceptance-report/verification.json       (ledger `proven` state)
//   - apps/e2e/acceptance-results/journeys.json  (executed annotations)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ingestPlaywrightResults } from '../acceptance-report/ingest-playwright-results.js';
import type { RunFacts } from '../acceptance-report/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const LEDGER_PATH = path.join(REPO_ROOT, 'acceptance-report/verification.json');
const RESULTS_PATH = path.join(REPO_ROOT, 'apps/e2e/acceptance-results/journeys.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'acceptance-report/business-verification.json');

// Must match BUSINESS_INVARIANT_ANNOTATION in
// apps/e2e/src/journey/assert-business.ts.
const INVARIANT_ANNOTATION = 'business-invariant';

// Playwright reports spec paths relative to its testDir; the ledger declares
// them from the repo root. Same value as acceptance-report/verify.ts SPEC_ROOT.
const SPEC_ROOT = 'apps/e2e/tests';

// Flows where a wrong number is a real-world money/state incident. Under
// `--strict` these must reach `verified-correct` or the gate fails. Keyword
// match on displayName keeps the list readable and survives id renames.
const MONEY_STATE_KEYWORDS = [
  'phiếu thu', 'phiếu', 'học phí', 'duyệt', 'lương', 'payroll', 'hoàn', 'refund',
  'đối soát', 'reconcil', 'sao', 'star', 'quà', 'reward', 'kpi',
];

type CorrectnessState = 'verified-correct' | 'reachable-only' | 'not-proven';

interface LedgerFlow {
  flow: { id: string; displayName: string; cluster: string; journey?: string };
  evidence: { state: string; badge: string };
}

interface LedgerFile {
  generatedAt: string;
  commit: string;
  flows: LedgerFlow[];
}

interface FlowCorrectness {
  id: string;
  displayName: string;
  cluster: string;
  journey: string | null;
  ledgerState: string;
  correctness: CorrectnessState;
  hasInvariant: boolean;
  moneyStateCritical: boolean;
  reason: string;
}

function isMoneyStateCritical(displayName: string): boolean {
  const name = displayName.toLowerCase();
  return MONEY_STATE_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()));
}

function readLedger(): LedgerFile {
  if (!existsSync(LEDGER_PATH)) {
    throw new Error(
      `Chưa có ledger: ${path.relative(REPO_ROOT, LEDGER_PATH)}. Chạy \`pnpm acceptance:report\` trước.`,
    );
  }
  return JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as LedgerFile;
}

function readRunFacts(): RunFacts | null {
  if (!existsSync(RESULTS_PATH)) return null;
  return ingestPlaywrightResults(JSON.parse(readFileSync(RESULTS_PATH, 'utf8')), {
    specRoot: SPEC_ROOT,
  });
}

function composeFlow(ledgerFlow: LedgerFlow, facts: RunFacts | null): FlowCorrectness {
  const { id, displayName, cluster, journey } = ledgerFlow.flow;
  const ledgerState = ledgerFlow.evidence.state;
  const moneyStateCritical = isMoneyStateCritical(displayName);

  const spec = journey && facts ? facts.specs[journey] : undefined;
  const hasInvariant = (spec?.annotations ?? []).includes(INVARIANT_ANNOTATION);
  const specPassed = spec?.outcome === 'pass';

  let correctness: CorrectnessState;
  let reason: string;

  if (ledgerState !== 'proven') {
    correctness = 'not-proven';
    reason = `Chưa proven ở ledger (${ledgerFlow.evidence.badge}) — chưa xét được tính đúng số học.`;
  } else if (hasInvariant && specPassed) {
    correctness = 'verified-correct';
    reason = 'Journey chạy xanh và đã khẳng định ≥1 invariant nghiệp vụ.';
  } else {
    correctness = 'reachable-only';
    reason = hasInvariant
      ? 'Có invariant nhưng spec không pass — số nghiệp vụ chưa được chứng minh.'
      : 'Proven (reachable + green) nhưng KHÔNG assert số/trạng thái nghiệp vụ nào — mới ở mức smoke.';
  }

  return {
    id,
    displayName,
    cluster,
    journey: journey ?? null,
    ledgerState,
    correctness,
    hasInvariant,
    moneyStateCritical,
    reason,
  };
}

function main(): void {
  const strict = process.argv.includes('--strict');
  const ledger = readLedger();
  const facts = readRunFacts();

  const results = ledger.flows.map((f) => composeFlow(f, facts));

  const counts = {
    verifiedCorrect: results.filter((r) => r.correctness === 'verified-correct').length,
    reachableOnly: results.filter((r) => r.correctness === 'reachable-only').length,
    notProven: results.filter((r) => r.correctness === 'not-proven').length,
    total: results.length,
  };

  // Money/state-critical flows that are green but never check their numbers —
  // the exact set the strict gate exists to hold the line on.
  const criticalReachableOnly = results.filter(
    (r) => r.moneyStateCritical && r.correctness === 'reachable-only',
  );

  const output = {
    generatedAt: new Date().toISOString(),
    ledgerCommit: ledger.commit,
    ledgerGeneratedAt: ledger.generatedAt,
    resultsPresent: facts !== null,
    resultsSha: facts?.sha ?? null,
    counts,
    criticalReachableOnly: criticalReachableOnly.map((r) => r.id),
    flows: results,
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);

  // ── terminal summary ──
  console.log('\n  Business verification — tầng đúng số học nghiệp vụ');
  console.log(`  ledger: commit ${ledger.commit} @ ${ledger.generatedAt}`);
  console.log(`  results: ${facts ? `sha ${facts.sha ?? '(không ghi sha)'}` : 'KHÔNG có journeys.json'}`);
  console.log('  ───────────────────────────────────────────────');
  console.log(`  ✔ verified-correct : ${counts.verifiedCorrect}/${counts.total}`);
  console.log(`  ~ reachable-only   : ${counts.reachableOnly}/${counts.total}  (green nhưng chưa check số)`);
  console.log(`  · not-proven       : ${counts.notProven}/${counts.total}`);
  if (criticalReachableOnly.length > 0) {
    console.log('  ───────────────────────────────────────────────');
    console.log(`  ⚠ money/state-critical mà mới smoke (${criticalReachableOnly.length}):`);
    for (const r of criticalReachableOnly) {
      console.log(`      ${r.id}  ${r.displayName}`);
    }
  }
  console.log(`\n  → ${path.relative(REPO_ROOT, OUTPUT_PATH)}\n`);

  if (strict && criticalReachableOnly.length > 0) {
    console.error(
      `  STRICT: ${criticalReachableOnly.length} luồng money/state-critical chưa có invariant nghiệp vụ.`,
    );
    process.exit(1);
  }
}

main();
