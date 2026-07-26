import { describe, expect, it } from 'vitest';

import { composeFlowEvidence, findUnrunJourneys } from './flow-evidence.js';
import type { FlowEntry, RunFacts, SpecFacts } from './types.js';

const HEAD = 'abc1234';
const SPEC = 'apps/e2e/tests/journeys/alpha.journey.ui.spec.ts';

function flow(overrides: Partial<FlowEntry> = {}): FlowEntry {
  return {
    id: 'P1-01',
    displayName: 'Luồng thử',
    cluster: 'P1',
    actorRoles: ['sale'],
    expected: { trpc: ['crm.opportunityCreate'], uiRoutes: ['/crm'], models: ['Opportunity'] },
    ...overrides,
  };
}

function spec(overrides: Partial<SpecFacts> = {}): SpecFacts {
  return { outcome: 'pass', passed: 1, failed: 0, skipped: 0, annotations: [], ...overrides };
}

function facts(specs: Record<string, SpecFacts>, sha: string | null = HEAD): RunFacts {
  return { sha, dirty: false, projects: ['ui-chromium'], runErrors: 0, specs };
}

describe('composeFlowEvidence', () => {
  it('promotes a built flow to proven when its own spec really passed at HEAD', () => {
    const evidence = composeFlowEvidence(flow({ journey: SPEC }), 'built', facts({ [SPEC]: spec() }), HEAD);
    expect(evidence).toEqual({ state: 'proven', badge: 'proven' });
  });

  it('drops every flow to unproven when there are no results at all', () => {
    const evidence = composeFlowEvidence(flow({ journey: SPEC }), 'built', null, HEAD);
    expect(evidence.state).toBe('built-unproven');
    expect(evidence.badge).toBe('no-results');
  });

  it('refuses results produced at a different commit', () => {
    const evidence = composeFlowEvidence(flow({ journey: SPEC }), 'built', facts({ [SPEC]: spec() }, 'deadbee'), HEAD);
    expect(evidence.state).toBe('built-unproven');
    expect(evidence.badge).toBe('stale');
    expect(evidence.detail).toContain('deadbee');
  });

  it('refuses results that carry no commit at all', () => {
    const evidence = composeFlowEvidence(flow({ journey: SPEC }), 'built', facts({ [SPEC]: spec() }, null), HEAD);
    expect(evidence.badge).toBe('stale');
  });

  it('flags a declared spec that the run never touched as a partial run', () => {
    const other = 'apps/e2e/tests/journeys/beta.journey.ui.spec.ts';
    const evidence = composeFlowEvidence(flow({ journey: SPEC }), 'built', facts({ [other]: spec() }), HEAD);
    expect(evidence.state).toBe('built-unproven');
    expect(evidence.badge).toBe('partial');
  });

  it('shows a failing spec with a verified reason as an explained red', () => {
    const entry = flow({
      journey: SPEC,
      statusReason: { code: 'red-fixme', detail: 'Nút duyệt không render cho GĐ — bug đã xác minh.' },
    });
    const evidence = composeFlowEvidence(entry, 'built', facts({ [SPEC]: spec({ outcome: 'fail', passed: 0, failed: 1 }) }), HEAD);
    expect(evidence.badge).toBe('red-fixme');
    expect(evidence.detail).toContain('bug đã xác minh');
  });

  it('shows a failing spec with no stated reason as untriaged, and does not throw', () => {
    const evidence = composeFlowEvidence(
      flow({ journey: SPEC }),
      'built',
      facts({ [SPEC]: spec({ outcome: 'fail', passed: 0, failed: 1 }) }),
      HEAD,
    );
    expect(evidence.badge).toBe('red-untriaged');
  });

  it('never proves a spec whose tests were all fixme or skipped', () => {
    const evidence = composeFlowEvidence(
      flow({ journey: SPEC }),
      'built',
      facts({ [SPEC]: spec({ outcome: 'skipped', passed: 0, skipped: 2, annotations: ['fixme'] }) }),
      HEAD,
    );
    expect(evidence.state).not.toBe('proven');
    expect(evidence.badge).toBe('vacuous');
  });

  it('reads an all-fixme spec as an explained red when the manifest states why', () => {
    const entry = flow({
      journey: SPEC,
      statusReason: { code: 'red-fixme', detail: 'Cần time-travel qua kỳ lương — thuộc plan sửa.' },
    });
    const evidence = composeFlowEvidence(
      entry,
      'built',
      facts({ [SPEC]: spec({ outcome: 'skipped', passed: 0, skipped: 1, annotations: ['fixme'] }) }),
      HEAD,
    );
    expect(evidence.badge).toBe('red-fixme');
  });

  it('marks a flow with no journey and no reason as simply lacking one', () => {
    const evidence = composeFlowEvidence(flow(), 'built', facts({}), HEAD);
    expect(evidence).toMatchObject({ state: 'built-unproven', badge: 'no-journey' });
  });

  it('carries the grep evidence through for a flow with no UI path', () => {
    const entry = flow({
      statusReason: { code: 'no-ui-path', detail: 'rg "guardian.requestLink" apps/admin/src → 0 matches' },
    });
    const evidence = composeFlowEvidence(entry, 'built', facts({}), HEAD);
    expect(evidence).toMatchObject({ state: 'not-yet', badge: 'no-ui-path' });
    expect(evidence.detail).toContain('0 matches');
  });

  // Regression guard. The earlier version of this test passed `facts({})` — an
  // ABSENT spec — so it went green through the partial-run branch without ever
  // exercising the invariant it is named for, while the code happily returned
  // `proven` for an unbuilt flow. The spec must be PRESENT and PASSING here.
  it('never promotes a flow that is not built, even when its journey passes', () => {
    for (const status of ['partial', 'missing'] as const) {
      const evidence = composeFlowEvidence(flow({ journey: SPEC }), status, facts({ [SPEC]: spec() }), HEAD);
      expect(evidence.state).not.toBe('proven');
      expect(evidence.badge).toBe('passed-not-built');
    }
  });

  it('refuses to count a journey triage proved is attached to the wrong flow', () => {
    // The spec passes. It just is not evidence about THIS flow, so a ⬤ here
    // would be a false claim on the page stakeholders read.
    const entry = flow({
      journey: SPEC,
      statusReason: { code: 'h2-mismatch', detail: 'Spec không drive procedure nào của luồng này.' },
    });
    const evidence = composeFlowEvidence(entry, 'built', facts({ [SPEC]: spec() }), HEAD);
    expect(evidence.state).not.toBe('proven');
    expect(evidence.badge).toBe('h2-mismatch');
  });
});

describe('findUnrunJourneys', () => {
  it('lists declared specs missing from the run', () => {
    const flows = [flow({ id: 'P1-01', journey: SPEC }), flow({ id: 'P1-02', journey: 'apps/e2e/tests/journeys/beta.journey.ui.spec.ts' })];
    expect(findUnrunJourneys(flows, facts({ [SPEC]: spec() }))).toEqual(['apps/e2e/tests/journeys/beta.journey.ui.spec.ts']);
  });

  it('is empty when there are no results to judge against', () => {
    expect(findUnrunJourneys([flow({ journey: SPEC })], null)).toEqual([]);
  });
});
