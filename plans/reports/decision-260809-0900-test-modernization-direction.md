---
title: "Test Modernization Direction — CMC EDU"
date: 2026-08-09
status: awaiting-user-approval
---

# Test Modernization Direction — CMC EDU

## Evidence

- Research: `plans/reports/research-260809-0900-test-evolution-ai.md`
- Repository scout: `plans/reports/scout-260809-0900-test-system-baseline.md`
- Clean-main baseline: `plans/reports/test-260809-0900-test-system-baseline.md`
- Main commit under test: `d499ab714489b5277c14bc90947bba603a345ae1`
- Latest matching CI: `31260530525` (`CI`) and `31260530514` (`ui-e2e`), both successful.
- Required checks on `main`: `typecheck-and-test`, `ui-e2e` (strict).

## Verified Findings

1. Existing portfolio is broad: roughly 286 source test/spec files, 42 UI specs, 9 API e2e specs, 38 acceptance flows, 31 journey claims and 7 no-UI paths.
2. Local clean-worktree baseline is not yet reproducible: `pnpm typecheck` and `pnpm lint` pass, but `pnpm test` fails because shared Turbo cache did not materialize the worktree-local Prisma client. CI has the required Postgres/migration/build setup.
3. `apps/api/vitest.config.ts` serializes shared Postgres but does not exclude generated `dist` test copies.
4. Acceptance/business scripts are executable authority but their own tests are not included in the root test path; `business:verify` has no dedicated test suite.
5. There are explicit skips and untriaged acceptance orphans; dated docs claiming zero skips or advisory UI gates are stale.
6. AI increases test/code output and correlated “self-confirming” evidence risk. Independent invariants, provenance, deterministic replay and risk-based fidelity are the durable controls.

## Recommended Scope

### Phase 1 — Deterministic proof foundation

- Make API test discovery source-only and prevent accidental `src`/`dist` duplication.
- Make local/CI generated Prisma and Turbo cache behavior explicit and worktree-safe.
- Add CI coverage for acceptance-report, business-verify and existing a11y-role checks.
- Add tests for report/ledger parsing and business classification; classify intentional skips/orphans.
- Reconcile current gate docs with executable workflow truth.

### Phase 2 — Independent business/security oracles

- Expand exact-value and state-transition assertions for money, payroll, refunds, idempotency, RLS, RBAC and audit behavior.
- Cover no-UI flows at API/integration level; use UI journeys for role reachability and wiring.
- Formalize retry-pass/flaky classification and preserve first-retry traces.

### Phase 3 — Bounded experiments

- Pilot `fast-check` on one pure critical domain with recorded seeds and replay.
- Pilot StrykerJS on one small pure package or changed critical files; measure survivor yield and triage cost.
- Consider sharding only when measured UI wall time/CI budget is the bottleneck.

## Non-goals

- No wholesale test-framework migration.
- No full-monorepo mutation threshold.
- No preemptive Playwright sharding or multi-browser expansion.
- No LLM judge for exact money, authorization or tenant-isolation assertions.
- No weakening of required CI checks.

## Approval Gate

Implementation must wait until the user approves Phase 1 as the first scoped change, or explicitly chooses a different scope. This gate exists because the current branch/worktree has unrelated CRM work and because CI/test contracts are user-visible maintainer policy.

## Unresolved Questions

- Should local validation use a worktree-local Turbo cache namespace or a forced uncached build/test recipe?
- Which exact acceptance orphans are intentional versus missing executable proof?
- Which pure domain gets the first property-based pilot?
- Who owns real-human UAT and the expected business calculations?
