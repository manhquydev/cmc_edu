// live-evidence — per-spec result collector for the live-domain suite.
//
// Writes each spec's outcome to plans/reports/uat-live-<ts>/result.json +
// README.md (a run-scoped directory created on first use). Deliberately NOT
// acceptance-results/journeys.json: the acceptance ledger refuses results on
// gitSha mismatch and CI evidence must stay untouched (scout §1, §5).
//
// Also hosts the client-error capture contract the task demands:
//   assertNoErrors(page) — after key steps assert pageerror == 0,
//   console errors == 0, request failures == 0, collecting everything into
//   the evidence entry for the spec.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { type Page, type TestInfo } from '@playwright/test';

export interface CreatedEntity {
  kind: string;
  label: string;
  value: string;
}

export interface SpecResult {
  spec: string;
  project: string;
  status: string;
  durationMs: number;
  errors: string[];
  pageErrors: string[];
  consoleErrors: string[];
  requestFailures: string[];
  created: CreatedEntity[];
}

// live-evidence.ts sits at apps/e2e/src/live/ → 4 levels up is the repo root.
const REPORTS_ROOT = new URL('../../../../plans/reports/', import.meta.url);

function tsNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export class LiveEvidence {
  private runDir: URL;
  private initialized = false;
  private results = new Map<string, SpecResult>();

  constructor() {
    this.runDir = new URL('uat-live-' + tsNow() + '/', REPORTS_ROOT);
  }

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;
    mkdirSync(this.runDir, { recursive: true });
    // eslint-disable-next-line no-console
    console.log('[live-evidence] writing results to ' + fileURLToPath(this.runDir));
  }

  /** Records one spec's outcome and flushes the run files. Safe to call from
   *  afterEach (runs even when the test failed). */
  recordSpecResult(info: TestInfo, opts: { created?: readonly CreatedEntity[] } = {}): void {
    const errors = info.error ? [info.error.message ?? String(info.error)] : [];
    this.results.set(info.title, {
      spec: info.title,
      project: info.project.name,
      status: info.status ?? 'unknown',
      durationMs: info.duration,
      errors,
      pageErrors: [],
      consoleErrors: [],
      requestFailures: [],
      created: [...(opts.created ?? [])],
    });
    this.flush();
  }

  /** Merges client-side captures (from an ErrorCollector) into the recorded
   *  result for the given spec title — APPENDS so a spec with several pages
   *  (per-role contexts) keeps every collector's captures. */
  mergeCaptures(specTitle: string, captures: { pageErrors: string[]; consoleErrors: string[]; requestFailures: string[] }): void {
    const entry = this.results.get(specTitle);
    if (!entry) return;
    entry.pageErrors = [...entry.pageErrors, ...captures.pageErrors];
    entry.consoleErrors = [...entry.consoleErrors, ...captures.consoleErrors];
    entry.requestFailures = [...entry.requestFailures, ...captures.requestFailures];
    this.flush();
  }

  /** Records a gracefully-skipped spec (e.g. 04-parent-otp with no parent
   *  account provisioned yet) and flushes. */
  recordSkippedSpec(info: TestInfo, reason: string): void {
    this.results.set(info.title, {
      spec: info.title,
      project: info.project.name,
      status: 'skipped',
      durationMs: info.duration,
      errors: [reason],
      pageErrors: [],
      consoleErrors: [],
      requestFailures: [],
      created: [],
    });
    this.flush();
  }

  /** Writes result.json + README.md for the run so far. */
  flush(): void {
    this.init();
    const all = [...this.results.values()];
    const summary = {
      runDir: fileURLToPath(this.runDir),
      total: all.length,
      passed: all.filter((r) => r.status === 'passed').length,
      failed: all.filter((r) => r.status === 'failed').length,
      skipped: all.filter((r) => r.status === 'skipped' || r.status === 'conditional').length,
      specs: all,
    };
    writeFileSync(new URL('result.json', this.runDir), JSON.stringify(summary, null, 2), 'utf8');

    const lines: string[] = [];
    lines.push('# UAT Live Run — evidence');
    lines.push('');
    lines.push('- run dir: ' + fileURLToPath(this.runDir));
    lines.push('- total: ' + summary.total + ' | passed: ' + summary.passed + ' | failed: ' + summary.failed + ' | skipped: ' + summary.skipped);
    lines.push('');
    for (const r of all) {
      lines.push('## ' + r.spec + ' — ' + r.status + ' (' + Math.round(r.durationMs / 1000) + 's)');
      lines.push('');
      if (r.errors.length > 0) {
        lines.push('### Errors');
        for (const e of r.errors) lines.push('- ' + e.replace(/\n/g, ' '));
      }
      if (r.pageErrors.length > 0) {
        lines.push('### pageerror (' + r.pageErrors.length + ')');
        for (const e of r.pageErrors) lines.push('- ' + e);
      }
      if (r.consoleErrors.length > 0) {
        lines.push('### console error (' + r.consoleErrors.length + ')');
        for (const e of r.consoleErrors) lines.push('- ' + e);
      }
      if (r.requestFailures.length > 0) {
        lines.push('### request failures (' + r.requestFailures.length + ')');
        for (const e of r.requestFailures) lines.push('- ' + e);
      }
      if (r.created.length > 0) {
        lines.push('### Data created (cleanup log)');
        for (const c of r.created) lines.push('- [' + c.kind + '] ' + c.label + ': ' + c.value);
      }
      lines.push('');
    }
    writeFileSync(new URL('README.md', this.runDir), lines.join('\n'), 'utf8');
  }
}

export const liveEvidence = new LiveEvidence();

// ─── client-error capture ───────────────────────────────────────────────────

export interface ErrorCollector {
  pageErrors: string[];
  consoleErrors: string[];
  requestFailures: string[];
  attach(page: Page): void;
}

/** Benign request-failure patterns: navigation aborts (Playwright cancels
 *  in-flight requests when the page navigates away) are not client bugs.
 *  Everything else counts as a real failure. */
function isBenignRequestFailure(error: string): boolean {
  return error.includes('ERR_ABORTED') || error.includes('net::ERR_FAILED') && error.includes('favicon');
}

/** Attaches pageerror / console-error / request-failed listeners to a page.
 *  Call it on every page the spec creates, as early as possible. */
export function attachErrorCollectors(page: Page): ErrorCollector {
  const collector: ErrorCollector = {
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    attach(p: Page) {
      p.on('pageerror', (err) => {
        collector.pageErrors.push(String(err?.stack ?? err));
      });
      p.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        // Chrome logs "Failed to load resource: the server responded with a
        // status of 4xx" for EVERY failed HTTP resource. That signal is already
        // captured precisely by the response tracker below (with the same
        // benign allow-list), so the generic message is not duplicated here —
        // otherwise one by-design 404 would fail the spec twice.
        if (/^Failed to load resource: the server responded with a status of \d{3}/.test(text)) {
          return;
        }
        collector.consoleErrors.push(text);
      });
      p.on('requestfailed', (req) => {
        const failure = req.failure()?.errorText ?? 'unknown';
        if (!isBenignRequestFailure(failure)) {
          collector.requestFailures.push(req.method() + ' ' + req.url() + ' → ' + failure);
        }
      });
      // HTTP response tracker: catches 4xx/5xx that the requestfailed event
      // never sees (a 404/500 IS a completed response). Benign allow-list
      // mirrors isBenignRequestFailure's intent: only documented by-design
      // responses pass.
      p.on('response', (resp) => {
        const status = resp.status();
        if (status >= 400 && !isBenignHttpError(resp.url(), status)) {
          collector.requestFailures.push('HTTP ' + status + ' ' + resp.url());
        }
      });
    },
  };
  collector.attach(page);
  return collector;
}

/** By-design HTTP error responses that must not fail a spec (documented with
 *  the product contract each one comes from). The browser still logs them as
 *  console 404s, so the console filter above must stay in sync with this list. */
function isBenignHttpError(url: string, status: number): boolean {
  // payroll detail queries payslip.getForUser while NO payslip exists yet —
  // the "Chưa có bảng lương" empty state IS the expected answer (router:
  // throw AppCodeError NOT_FOUND). Only this one tRPC procedure is exempt.
  if (status === 404 && url.includes('payslip.getForUser')) {
    return true;
  }
  return false;
}

/** Asserts the page produced NO client errors since attach; on failure throws
 *  (the spec fails) — the captured lists are merged into the evidence by the
 *  spec's afterEach regardless. */
export async function assertNoErrors(_page: Page, collector: ErrorCollector, step: string): Promise<void> {
  const problems: string[] = [];
  if (collector.pageErrors.length > 0) problems.push('pageerror: ' + collector.pageErrors.join(' | '));
  if (collector.consoleErrors.length > 0) problems.push('console error: ' + collector.consoleErrors.join(' | '));
  if (collector.requestFailures.length > 0) problems.push('request failure: ' + collector.requestFailures.join(' | '));
  if (problems.length > 0) {
    throw new Error(
      'assertNoErrors after "' +
        step +
        '" failed: ' +
        problems.join(' ;; ') +
        ' — captured into the live evidence (plans/reports/uat-live-<ts>/).',
    );
  }
}

/** Marks a result entry as skipped when the whole spec skips gracefully
 *  (used by 04-parent-otp when no parent account exists yet). */
export function recordSkipped(info: TestInfo, reason: string): void {
  liveEvidence.recordSkippedSpec(info, reason);
}
