# Test Report — 2026-08-09 — clean-main baseline

---

## Summary

- Worktree: `test/test-system-modernization`
- HEAD: `d499ab714489b5277c14bc90947bba603a345ae1`
- Baseline started clean; no tracked source/config/lockfile mutation was observed.
- Runtime: Linux, Node `v24.18.0`, pnpm `10.24.0`; repository requires Node `>=22`.
- Root `pnpm typecheck` and `pnpm lint` passed.
- Root `pnpm test` failed in `@cmc/api` because this worktree had no generated Prisma client; no source or environment repair was attempted.
- `pnpm acceptance:report` failed on six untriaged procedure orphans and had no usable local journey evidence.
- `pnpm business:verify` exited 0 but correctly reported `0/38` verified-correct and `38/38` not-proven.

## Test Results Overview

| Command | Exit | Wall time | Result |
|---|---:|---:|---|
| `pnpm typecheck` | 0 | `real 0.66s` | 29/29 Turbo tasks successful; all 29 replayed from cache |
| `pnpm lint` | 0 | `real 3.36s` | ESLint over `apps/admin apps/lms scripts` passed |
| `pnpm test` | 1 | `real 62.45s` | Turbo: 24 successful tasks, 25 total; failed `@cmc/api#test` |
| `pnpm acceptance:report` | 1 | `real 3.81s` | 38 flows scanned; untriaged orphans caused exit 1 |
| `pnpm business:verify` | 0 | `real 1.66s` | 38 not-proven; non-strict mode does not fail on this state |

### Root test detail

The failing `@cmc/api` Vitest task reported:

- Test files: `192 failed | 32 passed (224)`.
- Tests: `14 failed | 300 passed (314)`.
- Failed suites heading: `190`.
- Dominant failure: `Cannot find module '.prisma/client/default'`.
- The 14 assertion failures were the duplicated `src/` and `dist/` SSO route cases in `auth/sso-routes.test`; the remaining failures were suites unable to import Prisma-backed modules.
- Passing workspace output also included `@cmc/admin` (`55` files, `555` tests passed).
- Observed intentional skips: `@cmc/storage` skipped its two S3 tests (2 files, 2 tests); these are configured S3-dependent skips, not hidden failures.
- The run emitted non-fatal jsdom/test-harness warnings (`window.scrollTo`, `HTMLCanvasElement.getContext`, and React updates not wrapped in `act`).

## Acceptance / Business Checks

`pnpm acceptance:report` output:

- `38 luồng (37 built, 1 partial, 0 missing)`.
- `8 orphan (2 documented gap, 6 chưa phân loại)`.
- `0 unresolved namespaces`.
- Journey declarations: `31/38`.
- Evidence: `0/38` proven.
- Existing results input indicated `32` run-level errors and `31` unrun journey specs.
- Untriaged orphans: `classSession.doneProgress`, `classSession.get`, `classSession.listInRange`, `parentAccount.list`, `user.changeOwnPassword`, `user.resetPassword`.

`pnpm business:verify` output:

- Ledger commit: `d499ab7`.
- Results SHA: `d499ab714489b5277c14bc90947bba603a345ae1`.
- `verified-correct: 0/38`, `reachable-only: 0/38`, `not-proven: 38/38`.
- Non-strict mode exited 0; the CI workflow uses `--strict` after a real UI run.

The file `apps/e2e/acceptance-results/journeys.json` existed before this report was written (mtime `2026-08-09 09:12:10 +07`, 24,750 bytes). Its metadata describes `--list --project=ui-chromium`, `expected: 0`, `unexpected: 0`, `suites: 0`, `errors: 32`, and `gitDirty: false`. No UI/e2e command or server was started in this baseline, so this ignored artifact is treated as pre-existing/unusable local input, not as a successful run.

## Environment and Scope Limitations

- `pg_isready` is unavailable; TCP port `5432` was not listening.
- `DATABASE_URL`, `APP_DATABASE_URL`, and `PLAYWRIGHT_UI` were unset.
- No local PostgreSQL service, migrations, API server, preview server, browser install, or UI-e2e run was started.
- CI is the appropriate source for database-backed and UI evidence. The latest matching main commit (`d499ab7`, 2026-08-08) had successful `CI` run `31260530525` (`typecheck-and-test`, `e2e`, `security-scan`) and successful `ui-e2e` run `31260530514`; the latter published artifact `acceptance-journeys-d499ab714489b5277c14bc90947bba603a345ae1`. This report does not infer local journey counts from the CI artifact.

## Determinism / Reproducibility Findings

1. Turbo used the shared worktree cache (`Remote caching disabled, using shared worktree cache`). The replayed `@cmc/db` logs referenced `/home/manhquy/Downloads/cmc_edu`, not this isolated worktree.
2. Read-only inspection confirmed the generated Prisma client was missing in this worktree but present in the primary checkout. Cached build success therefore did not materialize the generated client needed by `@cmc/api` tests, producing the import cascade above.
3. CI is materially different: it installs dependencies, starts PostgreSQL 16, runs migrations, writes CI-only Prisma env, and performs fresh builds before testing. Local Node `v24.18.0` also differs from CI's configured Node 22.
4. A repeatable local baseline needs a per-worktree/forced Turbo execution (or an explicit Prisma generation/build step) before interpreting API test failures. No such repair was performed here per scope.

## Build Status

- Typecheck: PASS (cached).
- Lint: PASS.
- Unit/integration aggregate: FAIL (`@cmc/api`).
- UI-e2e: NOT RUN (no database/browser/server environment).
- Acceptance report: FAIL (untriaged orphans; no usable journey evidence).
- Business verification: PASS exit in non-strict mode, but result is `38/38 not-proven`, not a readiness signal.
- Tracked worktree mutation after all commands: none before this report file.

## Recommendations

1. For isolated-worktree validation, use a worktree-local or forced Turbo cache and verify `packages/db` generated client exists before `pnpm test`.
2. Keep CI's PostgreSQL/migration/env setup as the required proof for API integration and UI-e2e; do not substitute the local no-DB result.
3. Triage the six acceptance-report orphan procedures before treating a local ledger exit 1 as regression.
4. Reduce or explicitly classify duplicate `src`/`dist` test discovery and jsdom warning noise in a future test-system modernization pass.

## Unresolved Questions

- Should the project configure Turbo cache isolation by worktree, or should the local validation recipe force uncached `build`/`typecheck`?
- Why does the pre-existing `journeys.json` contain a `--list --project=ui-chromium` run with `expected: 0` and 32 errors, and which concurrent process produced it?
- Should `pnpm test` exclude generated `dist/**` tests or intentionally retain source+dist parity coverage?
