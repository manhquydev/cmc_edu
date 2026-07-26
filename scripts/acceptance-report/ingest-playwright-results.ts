// Reads a Playwright JSON report and reports what actually ran. This is the
// only path by which a flow can reach "đã chứng minh chạy" in the ledger —
// every other signal in this tool is static analysis of the worktree, which can
// say "a spec file exists" but never "that spec passed".
//
// Deliberately manifest-blind: it answers "what did this run do?", never "what
// should it have done?". Comparing the run against what the manifest declares
// is verify.ts's job, because that comparison needs the manifest and this file
// must stay testable against a report alone.
//
// Threat model, stated plainly: this RAISES THE COST of fooling yourself. A
// local results file is a normal file and can be hand-edited. What the SHA and
// spec-set checks buy is that a faked green has to also fake the commit it was
// produced at and the complete set of declared specs. The actual defence is
// that the ledger of record only accepts a CI artifact — see the plan.

import type { RunFacts, SpecFacts } from './types.js';

/** Shape of the bits of Playwright's JSON report this reader depends on.
 *  Everything else in the report is ignored on purpose — narrower surface,
 *  fewer ways for a Playwright upgrade to break ingestion silently. */
interface PlaywrightReport {
  config?: { metadata?: Record<string, unknown> };
  suites?: ReportSuite[];
  /** Run-level failures (a crash in globalSetup, a config error). These happen
   *  before any spec runs, so without reading them a dead run looks like a
   *  benign "nothing ran" instead of "this run failed". */
  errors?: unknown[];
}

interface ReportSuite {
  title?: string;
  file?: string;
  specs?: ReportSpec[];
  suites?: ReportSuite[];
}

interface ReportSpec {
  tests?: ReportTest[];
}

interface ReportTest {
  /** Playwright's retry-resolved verdict — 'expected' | 'unexpected' |
   *  'flaky' | 'skipped'. Using this instead of the raw per-attempt
   *  `results[].status` means a spec that passed on retry counts as passed
   *  exactly once, the same way Playwright's own exit code sees it. */
  status?: string;
  projectName?: string;
  annotations?: { type?: string }[];
}

export interface IngestOptions {
  /** Playwright reports paths relative to its `testDir`; the manifest declares
   *  them relative to the repo root. Joining with this makes the two
   *  comparable without either side guessing. */
  specRoot: string;
}

/** Reads Playwright's JSON report into per-spec facts.
 *  Throws only on a structurally unusable report — a report with no suites is
 *  a valid "nothing ran", not an error. */
export function ingestPlaywrightResults(report: unknown, options: IngestOptions): RunFacts {
  if (typeof report !== 'object' || report === null) {
    throw new Error('Playwright report is not an object');
  }
  const parsed = report as PlaywrightReport;
  const metadata = parsed.config?.metadata ?? {};

  const specs: Record<string, SpecFacts> = {};
  // Every project the report contains, not just the first one seen: a run
  // without `--project` merges api and ui-chromium into one report, and
  // recording only the first would let the provenance line claim `api` for
  // results whose passes came from `ui-chromium`.
  const projects = new Set<string>();

  const visit = (suite: ReportSuite, fileFromParent: string | undefined): void => {
    const file = suite.file ?? fileFromParent;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (!file) continue;
        if (test.projectName) projects.add(test.projectName);
        const key = joinPath(options.specRoot, file);
        const facts = (specs[key] ??= { outcome: 'skipped', passed: 0, failed: 0, skipped: 0, annotations: [] });
        tally(facts, test);
      }
    }
    for (const child of suite.suites ?? []) visit(child, file);
  };

  for (const suite of parsed.suites ?? []) visit(suite, undefined);

  for (const facts of Object.values(specs)) facts.outcome = outcomeOf(facts);

  return {
    sha: typeof metadata.gitSha === 'string' && metadata.gitSha.length > 0 ? metadata.gitSha : null,
    dirty: metadata.gitDirty === true,
    projects: [...projects].sort(),
    runErrors: Array.isArray(parsed.errors) ? parsed.errors.length : 0,
    specs,
  };
}

function tally(facts: SpecFacts, test: ReportTest): void {
  for (const annotation of test.annotations ?? []) {
    if (annotation.type && !facts.annotations.includes(annotation.type)) {
      facts.annotations.push(annotation.type);
    }
  }
  switch (test.status) {
    case 'expected':
    // A flaky test passed on retry. It counts as passed here for the same
    // reason Playwright exits 0 on it; flakiness is a separate concern the
    // phase's own retry/reset ritual handles, not a ledger status.
    case 'flaky':
      facts.passed += 1;
      return;
    case 'unexpected':
      facts.failed += 1;
      return;
    default:
      facts.skipped += 1;
  }
}

/** A spec with any failure is a failure. A spec with no failures but also no
 *  passes ran nothing real — that is `skipped`, never a pass. This is the
 *  vacuous-green hole: a file where every test is `fixme` reports no failures,
 *  and calling that "proven" would certify an untested flow as working. */
function outcomeOf(facts: SpecFacts): SpecFacts['outcome'] {
  if (facts.failed > 0) return 'fail';
  return facts.passed > 0 ? 'pass' : 'skipped';
}

function joinPath(root: string, file: string): string {
  // Normalize separators: on Windows the reported path can use backslashes,
  // which would match nothing in the manifest and silently produce a ledger
  // with zero proven flows plus a misleading "partial run" banner.
  const trimmedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const trimmedFile = file.replace(/\\/g, '/').replace(/^\.?\/+/, '');
  return trimmedRoot ? `${trimmedRoot}/${trimmedFile}` : trimmedFile;
}
