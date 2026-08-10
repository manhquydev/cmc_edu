---
title: "Test-system modernization Phase 1"
date: 2026-08-09
summary: "Completed deterministic verifier coverage and API source-only Vitest discovery, with CI-only limitations recorded."
---

## What happened

Completed Phase 1 of test-system modernization. The root test path now runs the
existing scripts `.mjs` checks and scoped Vitest coverage for acceptance-report
and business-verifier behavior. Verifier tests cover not-proven,
reachable-only, verified-correct, stale SHA, empty evidence, and
strict/non-strict outcomes.

API Vitest discovery is source-only (`src/**/*.test.ts`), preventing generated
`apps/api/dist/**/*.test.js` copies from being collected while preserving serial
shared-Postgres execution and coverage configuration.

## Evidence and decision

Focused scripts tests passed (5 Node checks plus 33 Vitest tests), scripts and
workspace typechecks and lint passed, API test listing found source paths only,
and non-strict `business:verify` passed. Strict `business:verify` correctly
failed when zero verified-correct flows were present.

Independent post-implementation review found no unresolved Phase 1 correctness
or public-contract regression. It accepted the verifier refactor and API
discovery boundary; the noted gap is that an artifact-dependent command smoke
cannot join the blocking suite before CI generates ignored acceptance artifacts.

## Known limitations

Root `pnpm test` remains red outside this phase because `@cmc/llm`'s generated
`dist/index.test.js` hash test timed out although its source test passed.
DB-backed API tests were not run locally because no Postgres service was
available; CI remains authoritative. A blocking command-level
`business:verify` smoke needs CI-generated acceptance artifacts.

## Next steps

Consider source-only discovery for other workspace packages, choose where the
artifact-dependent verifier smoke runs after CI artifact generation, and assign
ownership of the critical-flow manifest/invariant policy before changing keyword
classification.
