import { describe, expect, it } from 'vitest';

import {
  collectStrictFailures,
  composeFlow,
  isMoneyStateCritical,
  shouldFailStrictGate,
  type LedgerFlow,
} from './verify.js';

const HEAD = 'abc1234';
const SPEC = 'apps/e2e/tests/journeys/alpha.journey.ui.spec.ts';

function ledgerFlow(overrides: Partial<LedgerFlow['flow']> = {}, state = 'proven'): LedgerFlow {
  return {
    flow: {
      id: 'P1-01',
      displayName: 'Luồng học phí',
      cluster: 'P1',
      journey: SPEC,
      ...overrides,
    },
    evidence: { state, badge: state === 'proven' ? 'proven' : 'no-results' },
  };
}

function facts(overrides: Partial<Parameters<typeof composeFlow>[1]> = {}) {
  return {
    sha: HEAD,
    dirty: false,
    projects: ['ui-chromium'],
    runErrors: 0,
    specs: {
      [SPEC]: {
        outcome: 'pass' as const,
        passed: 1,
        failed: 0,
        skipped: 0,
        annotations: ['business-invariant'],
      },
    },
    ...overrides,
  };
}

describe('business flow classification', () => {
  it('classifies a proven journey with an invariant as verified-correct', () => {
    expect(composeFlow(ledgerFlow(), facts())).toMatchObject({
      correctness: 'verified-correct',
      hasInvariant: true,
      moneyStateCritical: true,
    });
  });

  it('keeps a proven journey without an invariant at reachable-only', () => {
    const run = facts();
    run.specs[SPEC].annotations = [];
    expect(composeFlow(ledgerFlow(), run)).toMatchObject({
      correctness: 'reachable-only',
      hasInvariant: false,
    });
  });

  it('keeps an unproven journey at not-proven even when a run has an invariant', () => {
    expect(composeFlow(ledgerFlow({}, 'built-unproven'), facts())).toMatchObject({
      correctness: 'not-proven',
      moneyStateCritical: true,
    });
  });

  it('identifies money/state names without changing the keyword policy', () => {
    expect(isMoneyStateCritical('Hoàn tiền học phí')).toBe(true);
    expect(isMoneyStateCritical('Danh sách lớp')).toBe(false);
  });
});

describe('strict business verification gate', () => {
  const base = {
    resultsPresent: true,
    resultsSha: HEAD,
    ledgerCommit: HEAD,
    moneyStateVerifiedCorrect: 1,
    criticalReachableOnly: [],
  } as const;

  it('passes when evidence and critical correctness are present', () => {
    const failures = collectStrictFailures(base);
    expect(failures).toEqual([]);
    expect(shouldFailStrictGate(true, failures)).toBe(false);
  });

  it('fails closed when journeys evidence is missing', () => {
    const failures = collectStrictFailures({ ...base, resultsPresent: false, resultsSha: null });
    expect(failures[0]).toContain('không có journeys.json');
    expect(shouldFailStrictGate(true, failures)).toBe(true);
  });

  it('fails when the run SHA does not match the ledger commit', () => {
    const failures = collectStrictFailures({ ...base, resultsSha: 'deadbee' });
    expect(failures).toContain('kết quả (sha deadbee) không khớp ledger commit abc1234.');
  });

  it('fails when no money/state flow is verified-correct', () => {
    const failures = collectStrictFailures({ ...base, moneyStateVerifiedCorrect: 0 });
    expect(failures).toContain('không luồng money/state nào đạt verified-correct — gate từ chối pass rỗng.');
  });

  it('fails when critical flows are reachable-only', () => {
    const failures = collectStrictFailures({
      ...base,
      criticalReachableOnly: [{ id: 'P1-01' }],
    });
    expect(failures).toContain('1 luồng money/state-critical mới ở mức smoke.');
  });

  it('does not fail the non-strict command for the same findings', () => {
    const failures = collectStrictFailures({ ...base, moneyStateVerifiedCorrect: 0 });
    expect(shouldFailStrictGate(false, failures)).toBe(false);
  });
});
