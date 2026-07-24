# Code Review: `ui-e2e` job addition to `.github/workflows/ci.yml`

## Scope

- File: `.github/workflows/ci.yml` (pending, uncommitted diff — pure addition, 93 lines, no deletions)
- Reference: `plans/260723-1422-may-hoa-nghiem-thu-ba-tang/phase-00-ci-executor-ui.md`
- Compared against: `apps/e2e/playwright.config.ts` (full), existing `typecheck-and-test` and `e2e` jobs (unchanged parts), `apps/e2e/src/global-setup.ts`, `apps/api/src/boot-checks.ts`, `apps/admin/package.json`, `apps/lms/package.json`

## Verification performed

1. **Diff isolation**: `git diff .github/workflows/ci.yml | grep '^-'` returns nothing — the change is a pure append after the existing `e2e` job. `typecheck-and-test` and `e2e` are untouched. Confirmed no conflict with the later phase that edits `typecheck-and-test`.
2. **YAML validity**: parsed with `yaml.safe_load` — three distinct job keys (`typecheck-and-test`, `e2e`, `ui-e2e`), no duplicates, `ui-e2e.env` reads back correctly with `PLAYWRIGHT_UI: '1'`.
3. **`PLAYWRIGHT_UI` gating**: `playwright.config.ts` gates both `uiServers` (lines 37–54) and the `ui-chromium` project (lines 73–84) on `process.env.PLAYWRIGHT_UI`. Job sets it at job-level `env`, which is what both need — no per-step duplication required. Confirmed the config's `uiServers` bake `VITE_API_URL`/`VITE_PROXY_API_TARGET` internally (lines 44, 51) and are not expected from the job — job correctly does not set these, avoiding redundant/conflicting env.
4. **Fixed port 3999**: `global-setup.ts` line 42 uses `UI_MODE_API_PORT = 3999` only when `PLAYWRIGHT_UI` is set (line 82) — matches `UI_API_URL` in the config (line 35). Single job/single spec run — no concurrent process in the same runner competes for 4173/4174/3999.
5. **`NODE_ENV`/secrets claim**: `boot-checks.ts` guards (lines 87, 105, 127, 150, 174) all gate on `process.env.NODE_ENV === 'production'`. Job leaves `NODE_ENV` unset (same as `e2e`), so the dev-default `STAFF_SESSION_SECRET`/`LMS_SESSION_SECRET` path is taken, matching `global-setup.ts`'s `mintStaffCookie()` use of the same default. Comment's claim is accurate against current code — no real secret needed or introduced. Job only carries the same throwaway Postgres credentials already used by `typecheck-and-test`/`e2e` (`cmc_app_ci_password`, `postgres`/`postgres`).
6. **Build/preview double-build**: admin/lms `package.json` `build` script is `tsc --noEmit && vite build`; `preview` is a plain `vite preview`. The job's own `pnpm build` (workspace-wide) does not carry `VITE_API_URL`/`VITE_PROXY_API_TARGET`, so `playwright.config.ts`'s `uiServers` command rebuilding admin/lms a second time with those env vars is required, not redundant duplication of logic — the job comment explains this correctly, and it matches the phase's Non-functional requirement about builds.
7. **Spec existence**: `apps/e2e/tests/admin-shell.ui.spec.ts` exists.
8. **`e2e` DB import dependency**: `apps/e2e/src/db.ts` imports `@cmc/db`, confirming the `pnpm build` step's stated purpose (producing `@cmc/db/dist`) is real, not speculative.
9. **`continue-on-error` + promotion condition**: present at job level (`ui-e2e.continue-on-error: true`), with a written promotion condition in the comment ("≥2 weeks warn-only, ~0 false positives"), matching the style and wording pattern of the existing `e2e` job's own promotion comment.
10. **No prod secrets**: only CI-only throwaway Postgres credentials (already declared at workflow top-level `env`, reused — not duplicated) plus the dev-default session secrets left implicit via unset `NODE_ENV`. No new secret material added.

## Findings

None survive verification. The added `ui-e2e` job:

- Correctly satisfies `playwright.config.ts`'s env/port requirements without over- or under-specifying job env.
- Does not touch or duplicate `typecheck-and-test`/`e2e` job definitions (pure append).
- Introduces no real secrets, only the same throwaway CI values already used elsewhere in the file.
- Is valid YAML with a unique job key and no step-name collisions that would cause ambiguity (step names are copied from `e2e` but scoped to a distinct job, consistent with the existing repo pattern of one job per lifecycle stage).
- Has `continue-on-error: true` with an explicit, worded promotion condition matching existing style.
- Presents no plausible port/process collision within its own single-job, single-spec run.

## Plan cross-check (phase-00 acceptance criteria)

All five success criteria in `phase-00-ci-executor-ui.md` appear satisfiable by this diff:
- Job runs `PLAYWRIGHT_UI=1 --project=ui-chromium` on an existing UI spec (`admin-shell.ui.spec.ts`) — present.
- `playwright install --with-deps chromium` present; preview ports (4173/4174) match config.
- No real prod secret; "prod-config" definition documented in-job and verified accurate against `boot-checks.ts`.
- `continue-on-error: true` + written promotion condition present.
- Step 5 of the phase ("push a trial branch, measure real duration") is a runtime/CI-execution step outside the scope of a static diff review — not verifiable from the diff alone; flag as an open item for whoever runs the branch, not a defect in the diff.

## Unresolved Questions

- None blocking. The only open item is operational: actually pushing this branch and recording the job's real CI duration (phase step 5 / success criterion 5) — this cannot be verified by static review and is not a defect in the reviewed diff.
