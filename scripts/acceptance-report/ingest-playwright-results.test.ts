import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ingestPlaywrightResults } from './ingest-playwright-results.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEC_ROOT = 'apps/e2e/tests';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(HERE, '__fixtures__', `${name}.json`), 'utf8'));
}

const run = () => ingestPlaywrightResults(fixture('playwright-report-ui-run'), { specRoot: SPEC_ROOT });

describe('ingestPlaywrightResults', () => {
  it('keys specs by repo-relative path so manifest paths can be compared directly', () => {
    expect(Object.keys(run().specs).sort()).toEqual([
      'apps/e2e/tests/journeys/alpha.journey.ui.spec.ts',
      'apps/e2e/tests/journeys/beta.journey.ui.spec.ts',
      'apps/e2e/tests/journeys/delta.journey.ui.spec.ts',
      'apps/e2e/tests/journeys/epsilon.journey.ui.spec.ts',
      'apps/e2e/tests/journeys/gamma.journey.ui.spec.ts',
    ]);
  });

  it('reads the commit, cleanliness, and projects the run was produced at', () => {
    const facts = run();
    expect(facts.sha).toBe('abc1234');
    expect(facts.dirty).toBe(false);
    expect(facts.projects).toEqual(['ui-chromium']);
    expect(facts.runErrors).toBe(0);
  });

  it('records every project in the report, not just the first seen', () => {
    // A run without --project merges api and ui-chromium into one report;
    // keeping only the first would let provenance claim `api` for passes that
    // actually came from `ui-chromium`.
    const merged = {
      config: { metadata: {} },
      suites: [
        { file: 'a.spec.ts', specs: [{ tests: [{ status: 'expected', projectName: 'api' }] }] },
        { file: 'b.ui.spec.ts', specs: [{ tests: [{ status: 'expected', projectName: 'ui-chromium' }] }] },
      ],
    };
    expect(ingestPlaywrightResults(merged, { specRoot: SPEC_ROOT }).projects).toEqual(['api', 'ui-chromium']);
  });

  it('reports a run that died before any spec ran, instead of calling it empty', () => {
    const crashed = { config: { metadata: {} }, suites: [], errors: [{ message: 'globalSetup failed' }] };
    expect(ingestPlaywrightResults(crashed, { specRoot: SPEC_ROOT }).runErrors).toBe(1);
  });

  it('normalizes Windows-style separators so paths still match the manifest', () => {
    const win = {
      config: { metadata: {} },
      suites: [{ file: 'journeys\\alpha.journey.ui.spec.ts', specs: [{ tests: [{ status: 'expected' }] }] }],
    };
    expect(Object.keys(ingestPlaywrightResults(win, { specRoot: SPEC_ROOT }).specs)).toEqual([
      'apps/e2e/tests/journeys/alpha.journey.ui.spec.ts',
    ]);
  });

  it('reports null sha when the report carries no commit metadata', () => {
    const facts = ingestPlaywrightResults(fixture('playwright-report-no-sha'), { specRoot: SPEC_ROOT });
    expect(facts.sha).toBeNull();
  });

  it('collects tests nested under describe blocks, not just top-level specs', () => {
    // alpha's two tests live inside a describe — a walker that only read the
    // file-level `specs` array would report the file as having run nothing.
    const alpha = run().specs['apps/e2e/tests/journeys/alpha.journey.ui.spec.ts'];
    expect(alpha).toMatchObject({ outcome: 'pass', passed: 2, failed: 0, skipped: 0 });
  });

  it('marks a spec with any failing test as failed', () => {
    expect(run().specs['apps/e2e/tests/journeys/beta.journey.ui.spec.ts']).toMatchObject({
      outcome: 'fail',
      failed: 1,
    });
  });

  it('never reports an all-fixme spec as passing', () => {
    const gamma = run().specs['apps/e2e/tests/journeys/gamma.journey.ui.spec.ts'];
    expect(gamma.outcome).toBe('skipped');
    expect(gamma.passed).toBe(0);
    expect(gamma.annotations).toContain('fixme');
  });

  it('treats a spec with one real pass and one skip as passing', () => {
    expect(run().specs['apps/e2e/tests/journeys/delta.journey.ui.spec.ts']).toMatchObject({
      outcome: 'pass',
      passed: 1,
      skipped: 1,
    });
  });

  it('counts a test that passed on retry as passed, matching Playwright exit code', () => {
    expect(run().specs['apps/e2e/tests/journeys/epsilon.journey.ui.spec.ts']).toMatchObject({
      outcome: 'pass',
      passed: 1,
      failed: 0,
    });
  });

  it('returns no specs for a report where nothing ran', () => {
    const facts = ingestPlaywrightResults({ config: {}, suites: [] }, { specRoot: SPEC_ROOT });
    expect(facts.specs).toEqual({});
    expect(facts.projects).toEqual([]);
  });

  it('rejects a report that is not an object', () => {
    expect(() => ingestPlaywrightResults('not a report', { specRoot: SPEC_ROOT })).toThrow();
  });
});
