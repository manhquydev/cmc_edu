# Research report — current test-tool options for CMC EDU

Date: 2026-08-09  
Scope: deterministic CI evidence, database isolation, browser diagnostics,
property-based testing, mutation testing

## Executive summary

The lowest-risk improvements are already in the repository's stack:
source-only Vitest discovery, explicit Turbo inputs/cache discipline, and
Playwright retry traces plus artifact retention. They improve provenance and
flake diagnosis without changing business policy.

Testcontainers, fast-check, and StrykerJS are useful, but each creates a new
operating contract: container lifecycle/runtime budget, reproducible seeds, or
mutation-survivor triage. Keep them as bounded pilots outside required gates
until one domain and an owner are selected.

## Findings

| Technique/tool | Fit | Decision |
|---|---|---|
| Vitest `include`/`exclude` | High; generated `dist` copies are present | Apply to API now; assess other packages separately |
| Turbo cache inputs | High; shared cache can replay another checkout's output | Add a worktree-safe preflight/namespace in a later infra slice |
| Playwright `retries: 1` + `trace: on-first-retry` | High; Playwright is already adopted and CI retries exist | Preserve/extend artifact policy in a later UI diagnostics slice |
| Testcontainers Node/Postgres | Medium; solves shared DB isolation | Pilot one integration lane; no suite-wide retrofit |
| fast-check | Medium for pure money/state functions | Pilot one domain with fixed seed + replay command |
| StrykerJS | Medium for small pure package | Pilot changed critical files; measure survivor yield and triage cost |

## Practical recommendations

1. Treat CI artifacts as the provenance source for acceptance ledgers; local
   JSON is inspectable but not a trust boundary.
2. Record retry/flaky status separately from business correctness. A retry-pass
   is green for reachability but should retain its first-retry trace.
3. Keep exact-value, authorization, tenant-isolation, and state-transition
   assertions deterministic; do not delegate those to an LLM judge.
4. Add Testcontainers only when shared-Postgres flake rate or parallelism is
   measured as the bottleneck.

## Sources

- Playwright retries: https://playwright.dev/docs/test-retries
- Playwright trace viewer: https://playwright.dev/docs/trace-viewer
- Vitest guide/configuration: https://vitest.dev/guide/
- Turborepo caching: https://turborepo.build/repo/docs/crafting-your-repository/caching
- Testcontainers Node: https://node.testcontainers.org/
- fast-check documentation: https://fast-check.dev/docs/
- StrykerJS introduction: https://stryker-mutator.io/docs/stryker-js/introduction/

## Unresolved questions

- Which workspace packages should receive source-only discovery next?
- Which pure domain has an owner and budget for the first fast-check pilot?
- What CI observation window justifies mutation or additional blocking gates?
