# Research/scout arbitration — test-system modernization

## Summary

The research direction is generally sound: preserve the existing Vitest/Playwright stack, strengthen independent business/security oracles, and measure signal quality rather than test counts. The scout and baseline reports are consistent with the checked-in workflows and configs, but they correctly expose a few authority and reproducibility gaps that must be resolved before changing merge policy.

The smallest safe Phase 1 is a deterministic evidence-and-collection hardening slice: (1) add focused tests for the acceptance/business-verification code and run those tests in the existing blocking `typecheck-and-test` path, and (2) make API Vitest discovery explicitly source-only after confirming that no intentional generated `dist` tests are part of the contract. Do not promote additional CI jobs, add new testing platforms, or broaden coverage gates in the same phase.

## Findings by severity

### High

1. **“Two blocking CI gates” is imprecise and must not be used as branch-policy evidence.**

   `.github/workflows/ui-e2e.yml` has no `continue-on-error`, and its `business:verify --strict` step is job-blocking. However, the checked-in branch-protection statement in `docs/system-architecture.md` says `main` requires `typecheck-and-test`; it does not establish that `ui-e2e` is a required remote check. The research report itself lists this as unresolved. Treat `ui-e2e` as a blocking workflow/job, not as a verified required merge check, until the remote setting is inspected. Do not add or alter required checks as part of Phase 1.

2. **The local `pnpm test` failure is an environment/reproducibility failure, not evidence of a product regression.**

   The baseline records missing `.prisma/client/default`, no local Postgres, and Turbo cache logs pointing at the primary checkout. CI explicitly installs, migrates, builds, and generates Prisma artifacts before tests. Any plan must keep CI as the authority for DB-backed test status and require a worktree-local/forced-cache preflight before interpreting local API failures. The duplicate `src`/`dist` collection observed in the baseline is nevertheless a real test-system issue worth fixing.

3. **Critical-flow classification is a product/acceptance authority, not an implementation detail.**

   The scout reports that `business:verify --strict` classifies money/state flows by display-name keywords. Replacing this with manifest metadata is a good direction, but it changes which flows can block merges. The required critical-flow set and required invariant types need an explicit owner/decision first; do not silently encode a new policy.

### Medium

4. **The evidence taxonomy is supported, but inventory metrics are snapshots rather than current readiness claims.**

   The reports correctly distinguish static, unit/domain, integration, browser reachability, business correctness, and human UAT. The 31/38 journey figure, historical 532-test figure, and “0 skipped” prose are dated snapshots. They must not be repeated as present status without matching-commit CI artifacts and `pnpm acceptance:report`; `business:verify` exiting 0 in non-strict mode is explicitly compatible with 0/38 proven-correct and is not a readiness signal.

5. **Verifier coverage is the highest-confidence first improvement.**

   The repository has acceptance-report tests and a business verifier, but the reports show those checks are not fully in the default blocking test path. This is a directly evidenced gap in the evidence system itself. Add deterministic unit tests for verifier behavior and wire only those tests into the existing blocking gate; do not make the acceptance report's six current orphan findings merge-blocking yet.

6. **Explicit API Vitest include/exclude is justified, but the contract must be stated.**

   `apps/api/vitest.config.ts` sets `fileParallelism: false` and coverage include/exclude, but no test-discovery include. The baseline observed source and built `dist` test files being collected, with duplicate SSO failures. A source-only include is likely the smallest deterministic fix, but the plan must document that compiled `dist` tests are generated artifacts and are not an independent acceptance layer. Validate the full CI build/test once changed.

7. **Broad CI promotion proposals are premature and risky.**

   The workflows intentionally leave API-only e2e, acceptance/orphan drift, screen-role drift, Trivy, and most coverage thresholds advisory. Their comments state that promotion requires an observation window, ownership, or triage capacity. Keep these recommendations as later experiments. Do not drop `continue-on-error`, add sharding, or add whole-monorepo mutation/coverage gates in Phase 1.

8. **Property-based and mutation testing are experiments, not established repository requirements.**

   The research rationale is credible, but the checked-in package manifest does not show either tool wired into scripts. Adding `fast-check` or Stryker now would add dependency, seed/replay, compute, and survivor-triage obligations without a selected domain or budget. First choose one authoritative invariant set and define a success metric; pilot outside required PR gates.

9. **The shared-Postgres and selective-seeding risks are real but too broad for the first slice.**

   The API harness serializes files against one shared database, and UI setup has approved direct-seed seams. These justify later isolation/fixture work, but schema-per-file/container changes can affect every integration test and require stronger rollback and runtime evidence. Keep them out of Phase 1.

### Low

10. **A11y and LMS unit-layer gaps are credible follow-ups, not immediate modernization proof.**

    The reports note a source-string accessibility smoke that is not wired to CI and no LMS unit-test task. These are useful backlog items, but they require choosing a browser-level accessibility standard and LMS behavior scope. They should not be bundled with evidence/collection hardening.

## Recommendation

The direction is clear enough to create an implementation plan, with the following bounded Phase 1 acceptance criteria:

- Add focused, deterministic tests for acceptance-report evidence handling and `business:verify` strict/non-strict outcomes, including stale/mismatched commit, partial/empty journey evidence, reachable-only critical flow, and verified-correct flow cases.
- Execute those tests from the existing blocking `typecheck-and-test` workflow without changing branch-protection settings or making the acceptance report itself blocking.
- Add an explicit API Vitest test-discovery rule that prevents generated `dist` tests from being collected; preserve the existing serial DB execution and coverage thresholds. Confirm in CI that source test coverage and counts remain expected.
- Record the local clean-worktree preflight (Prisma generation/build, database availability, and cache isolation) as validation guidance; do not treat the current local no-DB failure as a code regression.
- Keep the following as Phase 2/later decisions: manifest-owned criticality metadata, skip budget/ownership, expanded risk-based coverage, LMS unit tests, runtime accessibility checks, property-based and mutation pilots, database isolation, and Playwright sharding.

Before implementation, the plan should name the owner and authority for the critical-flow list and state whether the remote branch protection actually requires `ui-e2e`. If either is unknown, the implementation must not alter merge policy; the Phase 1 slice above remains safe without those decisions.

## Unresolved questions

- Is `ui-e2e` currently a required check on the remote `main` branch, or only a non-bypassable job in its push workflow?
- Are compiled `dist/**/*.test.*` files intentionally part of the supported test contract, or should source tests be the sole Vitest discovery target?
- Which exact manifest flows are money/state-critical, and which invariant assertions are required before a flow may be `verified-correct`?
- Who owns the six acceptance-report orphan procedures and the policy for the conditional OTP/S3 skips?
- What CI/runtime budget and observation window would justify later mutation testing, additional coverage gates, or Playwright sharding?

Status: DONE_WITH_CONCERNS
Summary: The evidence supports a conservative Phase 1 focused on verifier coverage and deterministic API test discovery. Merge-policy and critical-flow authority questions remain open and must not be changed implicitly.
Concerns/Blockers: Remote branch-protection state and manifest ownership for money/state criticality require confirmation before any policy-changing work.
