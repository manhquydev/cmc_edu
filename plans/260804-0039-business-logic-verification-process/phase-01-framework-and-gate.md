# Phase 01 — Convention + gate composer + honest baseline

## Context

- Ledger backbone: `scripts/acceptance-report/` (verify.ts, flow-evidence.ts,
  ingest-playwright-results.ts, flow-manifest.ts, types.ts).
- Reusable signal: `SpecFacts.annotations: string[]` (types.ts:107) already carries
  every executed annotation type per spec into `RunFacts`.
- Journeys live in `apps/e2e/tests/journeys/*.journey.ui.spec.ts`; helpers in
  `apps/e2e/src/journey/`.

## Files

- CREATE `apps/e2e/src/journey/assert-business.ts` — `assertBusinessInvariant(label,
  actual, expected)`: push Playwright annotation `{ type: 'business-invariant',
  description: label }`, then `expect(actual).toEqual(expected)`.
- CREATE `scripts/business-verify/verify.ts` — read `acceptance-report/
  verification.json` (proven state) + `apps/e2e/acceptance-results/journeys.json`
  (via `ingestPlaywrightResults`, annotations) + `flows` manifest; compose per-flow
  correctness; write `acceptance-report/business-verification.json`; print summary;
  exit non-zero only when `--strict` and a money/state-critical flow is
  `reachable-only`.
- EDIT root `package.json` — add `"business:verify": "tsx scripts/business-verify/verify.ts"`.

## Rules

- Do NOT edit `flow-evidence.ts` / `verify.ts` / `types.ts` (required-check inputs).
- Import the acceptance-report modules with `.js` specifiers (ESM + tsx), same as
  `verify.ts`.
- The gate re-derives nothing about `proven`; it TRUSTS `verification.json.flows[].
  evidence.state` and only ADDS the correctness dimension.

## Correctness composition (per flow)

```
ledgerState = verification.json flow.evidence.state
hasInvariant = runFacts.specs[flow.journey]?.annotations.includes('business-invariant')
specPassed   = runFacts.specs[flow.journey]?.outcome === 'pass'

verified-correct : ledgerState === 'proven' && hasInvariant && specPassed
reachable-only   : ledgerState === 'proven' && !(hasInvariant && specPassed)
not-proven       : else (inherit ledger badge, correctness N/A)
```

## Money/state-critical set (Phase-1 strict gate targets)

Flows whose displayName touches tiền / lương / trạng thái duyệt / số dư — the ones
where a wrong number is a real-world incident:
`P1-02, P1-03` (phiếu thu / duyệt), payroll, refund, reconciliation, stars-redeem,
rewards-approval, KPI approve. Encoded as a small id/keyword list in the composer,
not scattered in code comments.

## Validation

- `pnpm business:verify` runs, exits 0 in non-strict, prints
  `verified-correct / reachable-only / not-proven` counts.
- `acceptance-report/business-verification.json` written with per-flow correctness.
- Baseline on current code = 0 verified-correct (no journey carries an invariant yet)
  — the honest truth this gate exists to surface.
- `pnpm -w typecheck` (or tsx type run) stays green for the new files.

## Risk / rollback

- Additive only. Rollback = delete `scripts/business-verify/`,
  `apps/e2e/src/journey/assert-business.ts`, and the one package.json line. Nothing
  else references them.
