# Validation report — test-system-modernization Phase 1

Date: 2026-08-09  
Worktree: `/home/manhquy/Downloads/worktrees/cmc_edu-test-system-modernization`  
Base: `d499ab7`  
Branch: `test/test-system-modernization`

## Delivered

- `@cmc/scripts test` now keeps the existing Node `.mjs` checks and runs a
  scoped Vitest suite for acceptance-report and business-verifier tests.
- Added deterministic business-verifier tests for `not-proven`,
  `reachable-only`, `verified-correct`, stale SHA, missing evidence,
  zero-critical-correctness, critical smoke, and strict/non-strict behavior.
- `business:verify` exports pure helpers and guards CLI execution so importing
  the module does not read/write artifacts or exit the test process.
- `apps/api` Vitest discovery is explicit: `src/**/*.test.ts`; generated
  `dist/**/*.test.js` copies are not collected.
- Preserved shared-Postgres serialization, environment forwarding, coverage
  thresholds, CI workflow, branch-protection assumptions, and money/state
  keyword policy.

## Validation evidence

| Check | Result |
|---|---|
| `pnpm --filter @cmc/scripts test` | PASS — 5 Node tests + 33 Vitest tests, 38/38 |
| `pnpm --filter @cmc/scripts typecheck` | PASS |
| `pnpm typecheck` | PASS — 29/29 tasks |
| `pnpm lint` | PASS |
| API Vitest `list` after Prisma generate | PASS — 1,072 source-path test lines, 0 `dist` hits |
| `pnpm business:verify` | PASS, exit 0; current ignored ledger reports 0/38 verified-correct |
| `pnpm business:verify --strict` | EXPECTED FAIL, exit 1; rejects zero verified-correct |
| Root `pnpm test` | FAIL outside touched scope: `@cmc/llm` generated `dist/index.test.js` hash test timed out while source test passed |
| GitNexus `detect_changes()` | MEDIUM scope; 5 touched symbols, 4 verifier flows; no HIGH/CRITICAL risk |

The API list check required a worktree-local Prisma generation preflight with
explicit `DATABASE_URL`/`APP_DATABASE_URL`; no local Postgres service was
available. CI's Postgres+migration job remains the authority for DB-backed
API test status.

## Independent review rounds

1. Evidence/research arbitration: approved conservative Phase 1; no merge
   policy or criticality changes.
2. Pre-implementation plan review: approved with cwd and CLI-contract
   constraints.
3. Post-implementation review: API discovery approved; verifier refactor
   accepted with one medium gap — no command-level smoke test in the blocking
   suite. The current CLI was manually exercised; adding an artifact-dependent
   smoke test to `pnpm test` would fail on fresh CI because acceptance artifacts
   are ignored/generated.

## External research decision

Current primary-doc research supports keeping Playwright trace-on-retry,
fast-check seeded replay, Testcontainers, and StrykerJS as bounded follow-up
experiments. None is added to required gates in this phase. See
`plans/reports/research-r2-260809-test-tools.md` when available and the prior
research/arbitration reports in this directory.

## Unresolved questions

- Should the next phase apply source-only Vitest discovery to all workspace
  packages (the root run exposed a separate `@cmc/llm` `dist` duplicate)?
- Where should a command-level business-verifier smoke run after CI generates
  ignored acceptance artifacts?
- Who owns the critical-flow manifest and invariant policy before keyword
  classification is replaced?
