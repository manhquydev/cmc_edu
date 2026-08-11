---
date: 2026-08-09
repository: cmc_edu-test-modernization
branch: test/test-system-modernization
commit: d499ab714489b5277c14bc90947bba603a345ae1
scope: read-only test and CI architecture baseline
---

# Test-system baseline — 2026-08-09

## Summary

The repository has a broad, mostly real pyramid: Vitest unit/integration tests, Playwright API and browser tests, static acceptance/traceability scanners, business-invariant assertions, and advisory security/IaC scans. Current source says `typecheck-and-test` and push-only `ui-e2e` are the merge checks; the API-only `e2e`, acceptance/orphan drift, screen-role drift, and Trivy jobs remain advisory. `AGENTS.md:64-65` is the operating authority for both required checks.

The largest reliability risks are not absence of tests but test-system drift and selective execution: historical docs still report 532 tests/64 files and advisory `ui-e2e`; acceptance-report and business-verification test files are not in the default `pnpm test`; API Vitest has no `src` test include and can discover both `src` and built `dist`; business criticality is inferred from display-name keywords; and most browser journeys prove reachability rather than business arithmetic.

## Layer map and inventory

| Layer | Evidence and current inventory | Gate |
|---|---|---|
| Type/build | Root scripts: `package.json:10-17`; Turbo test tasks depend on package builds and pass DB env (`turbo.json:8-14`). Admin/LMS builds run `tsc --noEmit && vite build` (`apps/admin/package.json:6-11`, `apps/lms/package.json:6-10`). | `typecheck-and-test` blocking (`.github/workflows/ci.yml:28-85`). |
| Lint/static UI contracts | `pnpm lint` covers admin, LMS, scripts (`package.json:15`); UI frame strict check and node tests run in CI (`.github/workflows/ci.yml:107-113`). Source-string ARIA smoke exists in `scripts/check-ui-a11y-roles.mjs:1-10`, but is not called by CI. | Blocking for lint/frame checks; a11y-role smoke advisory/not wired. |
| Vitest API unit/integration | 112 source test files. Vitest 4 static collection over `src` found 1,768 cases; runtime collection was not used because Prisma generated client is absent in this clean worktree. 90/112 API files reference the real DB helper (`apps/api/src/test/db.ts:1-13`, `:45-82`), so this is integration-heavy, not mock-only. `fileParallelism:false` is an explicit flake mitigation (`apps/api/vitest.config.ts:22-31`). | Included in blocking `pnpm test` (`.github/workflows/ci.yml:115-116`). |
| Vitest admin/UI | `apps/admin`: 55 files, 555 collected tests; `packages/ui`: 43 files, 139 collected tests (Vitest list, source tree). Harnesses: `apps/admin/vitest.config.ts:8-17`, `packages/ui/vitest.config.ts:7-14`. | Included in blocking `pnpm test`. |
| Domain Vitest | Static source collection: auth 24; domain-finance 17; grading 14; identity 7; payroll 38; time 32; links 13; LLM 15; storage 11. Payroll has a CI coverage gate (`apps/api` config thresholds at `apps/api/vitest.config.ts:45-49`; command in `.github/workflows/ci.yml:128-129`). Other package coverage scripts exist but are not CI gates (`packages/domain-payroll/package.json:18-27`, `packages/domain-finance/package.json:18-27`). | Tests blocking; coverage mostly advisory except payroll. |
| E2E API | 51 Playwright spec files total: 9 API-only (`*.spec.ts`) and 42 UI-marked (`*.ui.spec.ts`); 33 of the latter are journey files. Config uses one worker, serial files, CI retry 1, and separate project matchers (`apps/e2e/playwright.config.ts:98-127`). | `ci.yml:e2e` is `continue-on-error:true` (`.github/workflows/ci.yml:131-185`). |
| E2E browser/UI | `PLAYWRIGHT_UI=1` registers Chromium and preview web servers only (`apps/e2e/playwright.config.ts:79-96`, `:114-130`). The job builds both apps, installs Chromium, runs the full project, and uploads journey evidence (`.github/workflows/ui-e2e.yml:142-186`, `:203-214`). | Job is non-`continue-on-error` and documented as promoted blocking (`.github/workflows/ui-e2e.yml:92-104`). Required-check policy is also stated in `AGENTS.md:64-65`. |
| Acceptance/traceability | Manifest contains 38 flows (`scripts/acceptance-report/flow-manifest.ts:1-4`, 38 `id:` entries), 31 declared journeys, and 7 `no-ui-path` entries. `acceptance:report` scans tRPC/UI/model surfaces, ingests only matching-commit Playwright evidence, and refuses partial/stale/vacuous proof (`scripts/acceptance-report/verify.ts:126-177`, `:297-337`; `scripts/acceptance-report/flow-evidence.ts:8-19`, `:48-111`). | CI step is advisory (`.github/workflows/ci.yml:118-126`); it sets exit code for untriaged structural drift (`verify.ts:363-380`) but the job allows failure. |
| Business correctness | `assertBusinessInvariant` annotates executed assertions (`apps/e2e/src/journey/assert-business.ts:22-43`). Current source has 18 calls in 13 journey files. `business:verify --strict` requires same-commit evidence, at least one money/state invariant, and no keyword-classified critical flow left smoke-only (`scripts/business-verify/verify.ts:41-77`, `:147-211`). | Blocking inside `ui-e2e` (`.github/workflows/ui-e2e.yml:188-201`). |
| Security/RLS/auth | Dedicated API suites cover RLS, facility validation, append-only privilege, staff password/SSO/session, plus Playwright kind isolation and no-leak/login checks (`apps/api/src/security/`, `apps/api/src/auth/`, `apps/e2e/tests/kind-isolation.spec.ts:1-12`, `apps/e2e/tests/lms-auth.spec.ts:1-8`, `apps/e2e/tests/lms-login.ui.spec.ts:1-6`). | These tests are in the blocking unit/integration or UI jobs. |
| Security/IaC | GitHub secret scanning/push protection and CodeQL are external/native; Trivy scans Docker/compose/nginx only (`.github/workflows/ci.yml:195-227`). | Trivy is explicitly report-only, `continue-on-error`, and `exit-code:'0'` (`ci.yml:201-219`). |
| AI-agent evaluation | Test-plan design calls for golden datasets, hallucination/override/cost metrics, and regression evals (`docs/29-test-plan.md:53-58`), but no package script or CI job executes these metrics. | Advisory/design-only today. |

## Blocking versus advisory posture

1. Blocking: `typecheck-and-test` runs typecheck, matrix drift (soft), lint, UI frame strict checks, all workspace tests, and payroll coverage (`.github/workflows/ci.yml:83-129`). `typecheck-and-test` is required by branch policy in `AGENTS.md:64-65`.
2. Blocking: push-only `ui-e2e` runs the full `ui-chromium` project and the strict business-correctness gate (`.github/workflows/ui-e2e.yml:108-129`, `:180-201`). The push-only split prevents a duplicate skipped check from clearing a red run (`ui-e2e.yml:3-11`; historical failure analysis in `docs/journals/260802-solo-vibe-operating-model-and-review-wave.md:16-25`).
3. Advisory: API-only Playwright `e2e` job (`ci.yml:131-185`), acceptance report (`ci.yml:118-126`), screen-role matrix drift (`ci.yml:86-105`), and Trivy (`ci.yml:195-227`).
4. Documentation conflict: `docs/system-architecture.md:460`, `:509-519` and the historical note in `docs/29-test-plan.md:65-71` still describe `ui-e2e` as advisory/`continue-on-error`; these claims predate the current workflow promotion and should not be used as merge policy.

## Reliability gaps and blind spots

- **Default test collection is not hermetic.** `apps/api/vitest.config.ts:14-31` does not constrain test discovery to `src`; in this worktree Vitest listed both 112 `src` and 112 built `dist` test files by default. Source-only static parsing avoids this duplicate, but an explicit include/exclude is safer. A live collection also failed on missing generated Prisma client (`.prisma/client/default`), so clean-clone preflight is materially different from a warmed worktree.
- **Shared integration database is serialized, not isolated.** The API harness uses one shared Postgres instance and privileged teardown (`apps/api/src/test/db.ts:45-82`, `:93-188`); the config documents FK-cleanup flakes under parallel files (`apps/api/vitest.config.ts:22-31`). This trades flake risk for slower feedback and leaves interrupted-run residue risk.
- **E2E realism is intentionally selective.** Global setup creates one ephemeral facility and launches the real API (`apps/e2e/src/global-setup.ts:1-16`, `:79-129`), but approved seed exceptions directly write DB state for sessions, enrollments, staff, rewards, and other fixtures (`apps/e2e/src/db.ts:214-318`, `:913-937`). This is valid for setup seams, but can miss UI wiring defects in those capabilities.
- **Journey coverage is mostly smoke.** Acceptance evidence requires a passing journey at the current SHA, but business correctness is a separate annotation tier (`scripts/acceptance-report/flow-evidence.ts:97-111`; `scripts/business-verify/verify.ts:10-14`). Only 13/33 journey files currently annotate invariants; many green flows can therefore remain `reachable-only`.
- **Criticality classification is heuristic.** `business:verify` marks money/state flows by display-name keyword (`scripts/business-verify/verify.ts:41-77`), which can silently misclassify renamed or non-keyword state-critical flows. The manifest already owns flow identity and should own this policy.
- **Skipped seams remain real.** `packages/storage/src/s3-blob-storage.test.ts:1-18` skips when `S3_ENDPOINT` is absent; `apps/e2e/tests/lms-auth.spec.ts:227-242` conditionally skips the OTP seam. Historical “0 skipped” claims in `docs/system-architecture.md:5` and `docs/codebase-summary.md:542-545` are snapshots, not current truth.
- **Coverage gates are asymmetric.** API has risk-based finance/provisioning thresholds (`apps/api/vitest.config.ts:45-49`), but CI only invokes payroll coverage (`.github/workflows/ci.yml:128-129`). No CI coverage gate protects API finance/RLS, admin, UI, or LMS frontend logic.
- **LMS frontend has no unit-test task.** `apps/lms/package.json:6-30` has build/typecheck/preview only; LMS behavior is exercised through browser/API E2E, leaving session-context and route-state regressions with a slower, less diagnosable feedback path.
- **Accessibility checks are shallow and disconnected.** `check-ui-a11y-roles.mjs:1-10`, `:66-121` is a source-substring smoke, explicitly not WCAG; CI never calls `test:ui-a11y-roles` (`package.json:22-25`, `.github/workflows/ci.yml:107-116`). The LMS login spec records an Astryx tabs ARIA regression (`apps/e2e/tests/lms-login.ui.spec.ts:90-99`) but does not create a blocking accessibility audit.
- **Acceptance/report correctness is under-tested in the default gate.** `scripts/acceptance-report/` contains Vitest tests, but `scripts/package.json:6-18` only runs top-level `*.test.mjs`; root `pnpm test` therefore omits acceptance-report and presentation Vitest suites. `scripts/business-verify/verify.ts` has no corresponding test file.
- **AI-generated-code risk remains concentrated in contracts.** The repository has good negative RBAC/RLS tests, but generated code can satisfy type/unit checks while drifting from UI routes, auth mode, or arithmetic. The acceptance scanners catch structural drift, yet their advisory status and the smoke/correctness split still permit a green-but-wrong path unless `business:verify` exercises the relevant invariant.

## Ranked improvement seams (ROI-first)

1. **Put verifier tests in the blocking path.** Add focused tests for `acceptance-report/verify.ts`, `flow-evidence.ts`, and `business-verify/verify.ts`; execute them from `scripts/package.json` or a dedicated CI step. This protects the evidence system that currently gates product claims.
2. **Make Vitest discovery explicit.** Add `include: ['src/**/*.test.{ts,tsx}']` and exclude `dist/**` for API (and equivalent package configs); add a clean-clone check that generated Prisma output exists before collection.
3. **Extend coverage gates by risk, not package convenience.** Gate API finance/provisioning/RLS and auth thresholds from `apps/api/vitest.config.ts`; add admin/UI/LMS coverage only where meaningful, rather than relying on payroll as the sole enforced percentage.
4. **Replace keyword criticality with manifest policy.** Add an explicit `moneyStateCritical`/required-invariants field to each flow and have `business:verify --strict` fail on missing required annotations. This removes display-name drift as a correctness control.
5. **Enforce a skip budget with expiry/owner.** Keep environment seams explicit, but make unexpected skips fail CI and publish a count; retire the two current skips or give them an expiry and owner.
6. **Reduce shared-DB coupling.** Move API integration tests toward per-file schemas/containers or deterministic transaction rollback; retain the existing serial fallback until isolation is proven. This is the highest reliability/performance seam in the 90-file DB-heavy test set.
7. **Add a small LMS unit/component layer.** Cover session context, kind guards, and login/change-password state transitions in Vitest; reserve Playwright for cross-boundary/auth contract proof.
8. **Wire runtime accessibility and contract smoke into CI.** Keep source marker checks, but add browser-level role/keyboard assertions for the known Astryx tab regression and run `test:ui-a11y-roles` in the blocking test job.
9. **Reconcile docs from executable truth.** Update stale test counts and CI posture only after `pnpm acceptance:report` plus the latest CI artifacts; keep dated snapshots labeled historical.

## Commands and validation notes

Authoritative commands from source: `pnpm typecheck`, `pnpm lint`, `pnpm test` (`package.json:10-17`); API coverage `pnpm --filter @cmc/api exec vitest run --coverage` (`README.md:148-153`); UI E2E `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium` (`README.md:125-129`, `apps/e2e/playwright.config.ts:13-18`); acceptance and correctness `pnpm acceptance:report` / `pnpm business:verify --strict` (`package.json:16-17`).

No long suite was run. Read-only collection probes were limited to Vitest static/list discovery and Playwright `--list`; the latter exposed missing built workspace outputs in this clean worktree, not a product-test result. No source/config files were changed.

## Unresolved questions

- Is the branch-protection setting on the remote currently requiring `ui-e2e` for every PR head SHA, or only the `typecheck-and-test` check recorded in older docs?
- Should the seven `no-ui-path` flows remain outside journey proof permanently, or should their API/business correctness receive an explicit non-UI acceptance tier?
- Which team/person owns triaging CodeQL’s four workflow-permission findings and Trivy reports before either becomes blocking?
- What is the intended policy for the conditional OTP and S3 skips: allowed environment seams, or release-blocking gaps?
- Is the current 1,768 source-static API case count the desired denominator, or should parameterized cases be reported separately from test declarations?
- Which API/LMS business flows are required to be `verified-correct` before go-live/UAT, beyond the current display-name keyword set?

