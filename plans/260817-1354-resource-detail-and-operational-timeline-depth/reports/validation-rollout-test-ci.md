# Validation — rollout, test and CI

**Date:** 2026-08-17  
**Scope:** read-only validation of rollout boundaries, rollback, test discovery, E2E consumers,
acceptance evidence and required CI for
`plans/260817-1354-resource-detail-and-operational-timeline-depth/`.  
**Tier:** Full — 7 phases, 15 claims checked per phase.  
**Verdict:** **FAILED — revise before implementation.**

The rollout direction is sound, and the two required CI checks are currently enforced on both
`main` and `develop`. The plan is not execution-ready because several test/file references are
non-resolving or ambiguous, one named Node test is not discovered by any repository test command,
and Phase 3 does not freeze the complete legacy Staff consumer ledger it requires.

## Summary

| Result | Count |
|---|---:|
| Claims checked | 105 |
| VERIFIED | 75 |
| FAILED | 14 |
| UNVERIFIED | 16 |

`UNVERIFIED` means the future behavior is reasonable but the phase does not name an executable
proof, exact owner, or PR boundary. It does not mean the proposed feature is already implemented.

## Blocking findings

### H1 — Phase 7 names a UI E2E location that contains zero UI specs

- **Plan:** `phase-07-coverage-gates-e2e-and-documentation.md:41` names
  `apps/e2e/src/*.ui.spec.ts`.
- **Actual discovery:** Playwright uses `testDir: './tests'` and matches
  `*.ui.spec.ts` there (`apps/e2e/playwright.config.ts:99-125`).
- **Observed tree:** there are 49 `apps/e2e/tests/**/*.ui.spec.ts` files and zero
  `apps/e2e/src/**/*.ui.spec.ts` files.
- **Required correction:** replace the glob with exact specs under `apps/e2e/tests/`; at minimum,
  name the Staff journey and the deep-link/return specs that each phase will extend.

### H2 — `erp-mobile-route-audit.test.ts` is currently dead as an automated test

- Phase 3 says to modify `apps/e2e/src/erp-mobile-route-audit.test.ts`
  (`phase-03-staff-routes-forms-and-navigation.md:56`).
- Root `pnpm test` explicitly excludes `@cmc/e2e` (`package.json:13`).
- The `@cmc/e2e` test script is Playwright (`apps/e2e/package.json:6-8`), and Playwright only
  discovers `apps/e2e/tests/` (`apps/e2e/playwright.config.ts:99-125`).
- CI only invokes the matrix generator from `src/`; it does not invoke this Node test
  (`.github/workflows/ci.yml:100-105`).
- **Required correction:** either wire an explicit Node-test command into a blocking script/CI
  step, or move the assertions into an already-discovered test surface. Naming the file without
  naming its executor is not proof.

### H3 — Phase 3's “all `/admin/users` consumers” is not an exact migration ledger

The catch-all instruction is directionally correct
(`phase-03-staff-routes-forms-and-navigation.md:59,72-73`), but an execution plan must freeze the
actual owners. Current source has:

- **7 direct literal assertions/emitters:** `apps/admin/src/shell/nav-registry.ts:162`,
  `apps/e2e/src/journey/create-staff-via-admin-ui.ts:131`,
  `apps/e2e/src/erp-mobile-route-audit.test.ts:25-31`,
  `apps/e2e/tests/live/14-ops-user-guards.spec.ts:39-43`,
  `apps/e2e/design3-frontend-audit.mjs:87-91`,
  `packages/ui/src/lib/active-module.test.ts:28-36`,
  `scripts/acceptance-report/flow-manifest.ts:962-986`.
- **Route owner:** `apps/admin/src/routes/admin.routes.tsx:34-39,169-174`.
- **Current Staff journey:** `apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts:33-49`.
- **Shared helper owner:** `apps/e2e/src/live/live-ui.ts:36-52`.
- **7 `createStaffViaAdminUi` calling journeys:**
  `apps/e2e/tests/journeys/checkin-offsite-approval.journey.ui.spec.ts:56,148`,
  `apps/e2e/tests/journeys/checkin-punch.journey.ui.spec.ts:30,42`,
  `apps/e2e/tests/journeys/kpi-submit-confirm-bulk-approve.journey.ui.spec.ts:26,63-72`,
  `apps/e2e/tests/journeys/payroll-assemble-finalize.journey.ui.spec.ts:20,50`,
  `apps/e2e/tests/journeys/payroll-roster.journey.ui.spec.ts:26,44`,
  `apps/e2e/tests/journeys/session-assessment-roster.journey.ui.spec.ts:53,91`,
  `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts:18,125`.
- **Live helper callers:** `apps/e2e/tests/live/00-setup-roles.spec.ts:21-23,44-64`,
  `apps/e2e/tests/live/07-ops-kpi-payroll-kd.spec.ts:24,57`,
  `apps/e2e/tests/live/08-ops-kpi-payroll-gv.spec.ts:18,51`.
- **Additional source comments/contracts containing the legacy path:** `apps/e2e/src/db.ts:268-270,1226-1229`
  and the journey/live files returned by a whole-repo `/admin/users` search.

The plan must state which remain compatibility assertions, which become canonical `/hr/staff`
expectations, and which only inherit the changed helper contract.

### M4 — Test ownership remains ambiguous in five phases

- Phase 1: `apps/admin/src/routes/*.routes.tsx`, “domain routers”, and `plans/...`
  (`phase-01-start.md:36-41`).
- Phase 2: `apps/api/src/user/app-user.test.ts or existing user tests`
  (`phase-02-staff-authorization-and-api-contract.md:42-47`). The named file exists, so the
  alternative should be removed.
- Phase 3: “live setup/user-guard specs”, “all consumers”, “adjacent tests”
  (`phase-03-staff-routes-forms-and-navigation.md:54-60`).
- Phase 4: “API/Admin/UI tests” (`phase-04-operational-timeline-and-compliance-audit-separation.md:59`).
- Phase 5: “dialog / caller” and “corresponding tests”
  (`phase-05-existing-detail-url-and-cross-link-normalization.md:47-49`).
- Phase 6: `apps/api/src/{class,student,parentAccount,finance,meeting,...}` and “their Admin pages”
  (`phase-06-remaining-first-class-record-rollout.md:62-63`).
- Phase 7: `scripts/` entry, “workspace scripts”, wrong E2E glob and `plans/...`
  (`phase-07-coverage-gates-e2e-and-documentation.md:37-45`).

### M5 — Exact-head-SHA policy is correct, but the plan does not name the verification operation

- `ui-e2e` is push-only (`.github/workflows/ui-e2e.yml:1-14`) and the workflow explains that the
  check attaches to the pushed PR head SHA (`.github/workflows/ui-e2e.yml:80-90,106-108`).
- The UI run stamps `GIT_SHA: ${{ github.sha }}` (`.github/workflows/ui-e2e.yml:176-186`).
- Acceptance evidence compares the full recorded SHA to full `HEAD`
  (`scripts/acceptance-report/verify.ts:139-157`;
  `scripts/acceptance-report/flow-evidence.ts:52-67`).
- Live GitHub API inspection on 2026-08-17 confirmed strict required checks
  `typecheck-and-test` and `ui-e2e` on both `main` and `develop`.
- **Required correction:** every PR gate should name a read-only check-run verification, e.g. read
  the PR `headRefOid`, query check runs for that exact SHA, and require both contexts to be
  terminal `success`. A green check shown for an earlier push is insufficient.

### M6 — Phase 7 PR segmentation is not defined

Phase 7 says “Open PRs sequentially” (`phase-07-coverage-gates-e2e-and-documentation.md:54-57`)
without defining whether the scanner, E2E additions and docs are one PR or multiple dependent PRs.
By contrast, Phase 4 explicitly defines 4A and 4B
(`phase-04-operational-timeline-and-compliance-audit-separation.md:61-65`) and Phase 6 defines one
protected PR series per module (`phase-06-remaining-first-class-record-rollout.md:8-13`).

### M7 — The new Phase 7 gate has no rollback/adoption contract

Phase 7 introduces a scanner that can fail on unclassified routes, missing depth, duplicate paths
and unsafe landings (`phase-07-coverage-gates-e2e-and-documentation.md:15-24`), but it has no
rollback section and does not say whether the first merge must prove zero existing violations before
the gate becomes blocking. Existing CI deliberately distinguishes blocking and warn-first gates
(`.github/workflows/ci.yml:86-105,139-147`). The phase must say how the resource-depth audit is
introduced without either grandfathering unknown debt forever or blocking unrelated changes on
pre-existing findings.

### M8 — The 30–45 engineer-day estimate is not auditable

The aggregate estimate appears only in `plan.md:6`; none of the seven phase frontmatters carries an
effort estimate. Phase 6 alone contains seven sequential module waves
(`phase-06-remaining-first-class-record-rollout.md:23-34`) with cross-domain producer discovery,
API/UI/deep-link work and two required CI runs per PR. The sequence is technically feasible, but the
duration is **UNVERIFIED and likely optimistic** until each module wave has an exact owner/test
matrix and a bounded effort range.

## Phase claim ledger

### Phase 1 — Contract, Inventory and Decision Freeze

| # | Status | Claim and evidence |
|---|---|---|
| 1 | VERIFIED | The assembled Admin router imports all route domains (`apps/admin/src/routes/index.tsx:11-18,75-88`). |
| 2 | VERIFIED | A nav-to-route registration test exists and walks the assembled router (`apps/admin/src/shell/nav-route-resolution.test.ts:16-23,53-63`). |
| 3 | VERIFIED | The test explicitly proves registration, not a real implemented screen (`apps/admin/src/shell/nav-route-resolution.test.ts:11-14`). |
| 4 | VERIFIED | A source route scanner exists and composes imported route arrays (`scripts/acceptance-report/scanners/route-scanner.ts:1-7,63-75`). |
| 5 | VERIFIED | The scanner includes spread route arrays such as `/go` (`scripts/acceptance-report/scanners/route-scanner.ts:98-104`). |
| 6 | VERIFIED | `apps/admin/src/shell/nav-registry.ts` is the current nav source (`apps/admin/src/shell/nav-registry.ts:155-170`). |
| 7 | VERIFIED | `packages/links/src/index.ts` is a real canonical-link registry (`packages/links/src/index.ts:16-32`). |
| 8 | VERIFIED | `apps/api/src/router.ts` is the real router registry (`apps/api/src/router.ts:57-125`). |
| 9 | FAILED | `plans/.../reports/source-current-resource-depth-inventory.md` is not a literal path; the actual file is plan-local (`phase-01-start.md:40`). |
| 10 | FAILED | `plans/.../decisions.md` is not a literal path; the actual file is plan-local (`phase-01-start.md:41`). |
| 11 | UNVERIFIED | `apps/admin/src/routes/*.routes.tsx` expands to eight files, but the phase does not freeze that expansion (`phase-01-start.md:36`; `apps/admin/src/routes/index.tsx:11-18`). |
| 12 | UNVERIFIED | “domain routers” has no exact path list despite 30+ mounted routers (`phase-01-start.md:39`; `apps/api/src/router.ts:5-49`). |
| 13 | UNVERIFIED | The phase names “existing nav-route-resolution test” but no exact command (`phase-01-start.md:55-63`; `apps/admin/package.json:6-11`). |
| 14 | UNVERIFIED | GitNexus freshness is recorded but no read-only command/evidence location is specified (`phase-01-start.md:43-46`). |
| 15 | UNVERIFIED | The event-producer map is required, but no schema/checker/report filename is fixed (`phase-01-start.md:48-53,55-63`). |

**Phase 1:** 8 VERIFIED · 2 FAILED · 5 UNVERIFIED.

### Phase 2 — Staff Authorization and API Contract

| # | Status | Claim and evidence |
|---|---|---|
| 1 | VERIFIED | `apps/api/src/user/router.ts` exists and is the mounted `user` router (`apps/api/src/router.ts:17,93-95`). |
| 2 | VERIFIED | `APP_USER_SELECT` exists and excludes credential fields (`apps/api/src/user/router.ts:74-91`). |
| 3 | VERIFIED | `AppUser` contains credential/lockout columns the select must exclude (`packages/db/prisma/schema.prisma:1221-1247`). |
| 4 | VERIFIED | `apps/api/src/user/app-user.test.ts` exists and already owns AppUser CRUD/facility tests (`apps/api/src/user/app-user.test.ts:17-40,90-105`). |
| 5 | FAILED | “or existing user tests” leaves the test owner undecided even though the exact file exists (`phase-02-staff-authorization-and-api-contract.md:45`). |
| 6 | VERIFIED | Password behavior has a dedicated integration test file (`apps/api/src/user/password-procedures.test.ts:26-35,92-105`). |
| 7 | VERIFIED | Cross-facility reset already expects `NOT_FOUND` (`apps/api/src/user/password-procedures.test.ts:121-136`). |
| 8 | VERIFIED | Credential serialization assertions already exist (`apps/api/src/user/password-procedures.test.ts:173-191`). |
| 9 | VERIFIED | Pick-list authorization/facility tests exist (`apps/api/src/user/pick-list.test.ts:17-43,58-84`). |
| 10 | VERIFIED | Role-drift tests exist (`apps/api/src/user/role-drift.test.ts:12`). |
| 11 | VERIFIED | The API package exposes deterministic `typecheck` and `test` scripts (`apps/api/package.json:12-16`). |
| 12 | VERIFIED | The auth package exposes its own `typecheck` and `test` scripts (`packages/auth/package.json:18-21`). |
| 13 | UNVERIFIED | `user.get` is future work and does not exist in the current router (`apps/api/src/user/router.ts:149-296`). |
| 14 | UNVERIFIED | The phase says “all user-router and auth permission tests” but gives no exact command/file set (`phase-02-staff-authorization-and-api-contract.md:49-57`). |
| 15 | UNVERIFIED | No Phase 2 PR boundary or exact-head-SHA check step appears in the phase; only the plan-wide rule supplies it (`plan.md:46-53`). |

**Phase 2:** 11 VERIFIED · 1 FAILED · 3 UNVERIFIED.

### Phase 3 — Staff Routes, Forms and Navigation

| # | Status | Claim and evidence |
|---|---|---|
| 1 | VERIFIED | Current Staff authority is `apps/admin/src/pages/admin/users.tsx`, mounted at `admin/users` (`apps/admin/src/routes/admin.routes.tsx:34-39,169-174`). |
| 2 | VERIFIED | `hr.routes.tsx` exists as the canonical route owner for future `/hr/staff` (`apps/admin/src/routes/index.tsx:14,78`). |
| 3 | VERIFIED | The current nav places Users under the super-admin-only Admin module (`apps/admin/src/shell/nav-registry.ts:155-163`). |
| 4 | VERIFIED | The link registry and link tests are exact existing owners (`packages/links/src/index.ts:16-32`; `packages/links/src/index.test.ts:20-32`). |
| 5 | VERIFIED | The main Staff E2E helper is exact and directly opens `/admin/users` (`apps/e2e/src/journey/create-staff-via-admin-ui.ts:107-132`). |
| 6 | VERIFIED | The live helper navigates through the real Admin nav and asserts the legacy URL (`apps/e2e/src/live/live-ui.ts:36-52`). |
| 7 | VERIFIED | The current Staff journey is at the exact named `tests/journeys` path (`apps/e2e/tests/journeys/user-admin-roles.journey.ui.spec.ts:33-49`). |
| 8 | VERIFIED | The acceptance manifest currently owns `/admin/users` and the Staff journey (`scripts/acceptance-report/flow-manifest.ts:962-986`). |
| 9 | FAILED | The plan does not enumerate the complete direct/helper consumer ledger; H3 lists the missing exact ownership (`phase-03-staff-routes-forms-and-navigation.md:54-60,72-76`). |
| 10 | FAILED | `apps/e2e/src/erp-mobile-route-audit.test.ts` is not discovered by root tests, Playwright, or CI; see H2 (`package.json:13`; `apps/e2e/playwright.config.ts:99-125`). |
| 11 | VERIFIED | The real Staff browser journey is correctly moved into the Phase 3 merge gate (`phase-03-staff-routes-forms-and-navigation.md:95-103`). |
| 12 | VERIFIED | `ui-e2e` is push-triggered and blocking (`.github/workflows/ui-e2e.yml:1-14,92-108`). |
| 13 | VERIFIED | The rollback prevents two editable Staff surfaces (`phase-03-staff-routes-forms-and-navigation.md:114-119`). |
| 14 | UNVERIFIED | The future Staff route/page tests are only “adjacent tests”; no exact filenames or commands are fixed (`phase-03-staff-routes-forms-and-navigation.md:40-60`). |
| 15 | UNVERIFIED | The planned E2E expansion lists behavior but not the exact spec/test cases that prove director, ordinary-role, F5 and Back/query semantics (`phase-03-staff-routes-forms-and-navigation.md:75-93`). |

**Phase 3:** 11 VERIFIED · 2 FAILED · 2 UNVERIFIED.

### Phase 4 — Operational Timeline and Compliance Audit Separation

| # | Status | Claim and evidence |
|---|---|---|
| 1 | VERIFIED | Phase 4 is explicitly split into independently protected PRs 4A and 4B (`phase-04-operational-timeline-and-compliance-audit-separation.md:61-65`). |
| 2 | VERIFIED | The current CRM `RecordEvent` owner exists (`apps/api/src/crm/record-event.ts:1-21,141-151`). |
| 3 | VERIFIED | A current CRM RecordEvent integration test owns facility/cursor/append-only behavior (`apps/api/src/crm/record-event.test.ts:45-75,154-167,231-279`). |
| 4 | VERIFIED | `RecordEvent` is defined append-only in schema (`packages/db/prisma/schema.prisma:314-329`). |
| 5 | VERIFIED | Migration enables and forces RLS, grants SELECT/INSERT, and revokes UPDATE/DELETE (`packages/db/prisma/migrations/20260813143000_record_event/migration.sql:23-36`). |
| 6 | VERIFIED | Audit helper and unit tests exist (`apps/api/src/audit/audit-helpers.ts:13-95`; `apps/api/src/audit/audit-helpers.test.ts:24-95`). |
| 7 | VERIFIED | Audit router and integration tests exist (`apps/api/src/audit/router.ts:19-44`; `apps/api/src/audit/router.test.ts:10-100`). |
| 8 | VERIFIED | Current audit tests prove director denial (`apps/api/src/audit/router.test.ts:96-100`). |
| 9 | VERIFIED | Mutation audit coverage has an exact current test owner (`apps/api/src/audit/mutation-audit-coverage.test.ts:38-57,79-135`). |
| 10 | VERIFIED | Shared `RecordTimeline` and its test exist (`packages/ui/src/components/record-timeline.tsx:4-47`; `packages/ui/src/components/record-timeline.test.tsx:3-44`). |
| 11 | FAILED | “API/Admin/UI tests” is not an executable file inventory (`phase-04-operational-timeline-and-compliance-audit-separation.md:45-59`). |
| 12 | UNVERIFIED | Planned `apps/api/src/record-event/store.ts` and `apps/api/src/user/record-event.ts` do not exist yet; their exact test owners are not named (`phase-04-operational-timeline-and-compliance-audit-separation.md:49-52`). |
| 13 | UNVERIFIED | The four required ambiguous audit actions are named, but no exact manifest test filename/cases are assigned (`phase-04-operational-timeline-and-compliance-audit-separation.md:74-79`). |
| 14 | VERIFIED | Rollback semantics correctly preserve append-only Staff events and isolate 4B (`phase-04-operational-timeline-and-compliance-audit-separation.md:117-123`). |
| 15 | VERIFIED | Exact-head CI applies independently to 4A and 4B through the stated PR boundary and plan-wide gate (`phase-04-operational-timeline-and-compliance-audit-separation.md:63-65`; `plan.md:50-53`). |

**Phase 4:** 12 VERIFIED · 1 FAILED · 2 UNVERIFIED.

### Phase 5 — Existing Detail URL and Cross-Link Normalization

| # | Status | Claim and evidence |
|---|---|---|
| 1 | VERIFIED | `admin.routes.tsx` currently owns class/student detail routes (`apps/admin/src/routes/admin.routes.tsx:55-78,99-113`). |
| 2 | VERIFIED | `finance.routes.tsx` currently owns receipt detail (`apps/admin/src/routes/finance.routes.tsx:61-80`). |
| 3 | VERIFIED | Class detail currently uses local `activeTab`, proving the migration target (`apps/admin/src/pages/classes/class-detail.tsx:433-438,500-506,598`). |
| 4 | VERIFIED | Student detail currently builds local tabs (`apps/admin/src/pages/students/student-detail.tsx:134-258,388`). |
| 5 | VERIFIED | Receipt detail currently uses local `activeTab` and two tab ids (`apps/admin/src/pages/finance/receipt-detail.tsx:67-72,660-667`). |
| 6 | VERIFIED | Exact current page tests exist for class, student and receipt (`apps/admin/src/pages/classes/class-detail.test.tsx:95-188`; `apps/admin/src/pages/students/student-detail.test.tsx:78-143`; `apps/admin/src/pages/finance/receipt-detail.test.tsx:121-218`). |
| 7 | VERIFIED | Existing browser cold-link coverage lives in `apps/e2e/tests/deeplink-detail-gates.ui.spec.ts` (`apps/e2e/tests/deeplink-detail-gates.ui.spec.ts:61-82,87-154`). |
| 8 | VERIFIED | Existing return/open-redirect coverage lives in `apps/e2e/tests/deeplink-return-to.ui.spec.ts` (`apps/e2e/tests/deeplink-return-to.ui.spec.ts:21-97`). |
| 9 | VERIFIED | Existing `/go` coverage has an exact spec (`apps/e2e/tests/deeplink-go.ui.spec.ts:19-53`). |
| 10 | VERIFIED | Existing after-sale journey is exact and already proves create-to-detail URL (`apps/e2e/tests/journeys/aftersale-case-lifecycle.journey.ui.spec.ts:36-64`). |
| 11 | FAILED | “create-after-sale-case-dialog.tsx / caller” does not name the caller; current dialog only calls `close` on success (`apps/admin/src/pages/crm/create-after-sale-case-dialog.tsx:16-35`). |
| 12 | FAILED | “corresponding tests” omits the exact Admin/E2E files above (`phase-05-existing-detail-url-and-cross-link-normalization.md:38-49`). |
| 13 | VERIFIED | Rollback requires route emitters and renderers to roll back atomically (`phase-05-existing-detail-url-and-cross-link-normalization.md:89-94`). |
| 14 | UNVERIFIED | The phase lacks an explicit protected-PR boundary; only the plan-wide sequential graph supplies ordering (`plan.md:46-53`). |
| 15 | UNVERIFIED | No exact test is assigned for unknown section + malformed UUID avoiding API calls (`phase-05-existing-detail-url-and-cross-link-normalization.md:51-74`). |

**Phase 5:** 11 VERIFIED · 2 FAILED · 2 UNVERIFIED.

### Phase 6 — Remaining First-Class Record Rollout

| # | Status | Claim and evidence |
|---|---|---|
| 1 | VERIFIED | The phase explicitly requires one protected PR series per module (`phase-06-remaining-first-class-record-rollout.md:8-13`). |
| 2 | VERIFIED | Class has exact router/test owners under `apps/api/src/class/` (`apps/api/src/router.ts:18-20,79-81`). |
| 3 | VERIFIED | Student has exact router/test owners under `apps/api/src/student/` (`apps/api/src/router.ts:36,71`). |
| 4 | VERIFIED | ParentAccount has exact `get/list/set-active/update-email` tests (`apps/api/src/router.ts:46-49,122-123`; `apps/api/src/parentAccount/get.test.ts:1-14`; `apps/api/src/parentAccount/list.test.ts:1-23`). |
| 5 | VERIFIED | Finance has exact receipt get/list/lifecycle tests (`apps/api/src/router.ts:31,64`; `apps/api/src/finance/receipt-get.test.ts:1-15`; `apps/api/src/finance/cancel-refund.test.ts:1-26`). |
| 6 | VERIFIED | ParentMeeting has an exact API test and browser journey (`apps/api/src/meeting/parent-meeting.test.ts:1-18`; `apps/e2e/tests/journeys/parent-meeting-schedule-complete.journey.ui.spec.ts:1-49`). |
| 7 | VERIFIED | AfterSale, Reward and Exercise have existing detail/journey owners (`apps/admin/src/routes/admin.routes.tsx:148-165`; `apps/admin/src/routes/crm.routes.tsx:104`; `apps/admin/src/routes/teaching.routes.tsx:97`; `apps/e2e/tests/journeys/aftersale-case-lifecycle.journey.ui.spec.ts:1-6`; `apps/e2e/tests/journeys/rewards-redeem-approval.journey.ui.spec.ts:1-23`; `apps/e2e/tests/journeys/exercise-publish-close.journey.ui.spec.ts:1-18`). |
| 8 | VERIFIED | Shift, KPI, PunchTicket and Session have existing detail routes (`apps/admin/src/routes/hr.routes.tsx:50,67-75,99`; `apps/admin/src/routes/teaching.routes.tsx:40`). |
| 9 | VERIFIED | Shared link/route ownership is correctly sequential (`phase-06-remaining-first-class-record-rollout.md:51-60`). |
| 10 | FAILED | `apps/api/src/{class,student,parentAccount,finance,meeting,...}` is not a resolvable path and omits after-sale/rewards/exercise/shift/kpi/checkin/session (`phase-06-remaining-first-class-record-rollout.md:62-63`; `apps/api/src/router.ts:5-49`). |
| 11 | FAILED | “their Admin pages, and adjacent tests” cannot assign file ownership or produce a module PR checklist (`phase-06-remaining-first-class-record-rollout.md:62-63`). |
| 12 | VERIFIED | Each module requires focused checks, `git diff --check`, `detect_changes()` and exact-head CI (`phase-06-remaining-first-class-record-rollout.md:67-77`). |
| 13 | VERIFIED | CI identity is explicitly part of each module test matrix (`phase-06-remaining-first-class-record-rollout.md:79-89`). |
| 14 | VERIFIED | Rollback is per module and preserves append-only RecordEvent rows (`phase-06-remaining-first-class-record-rollout.md:107-114`). |
| 15 | UNVERIFIED | No exact command/file matrix maps the seven module waves to their focused API/Admin/E2E tests; “focused tests” remains operator judgment (`phase-06-remaining-first-class-record-rollout.md:65-89`). |

**Phase 6:** 12 VERIFIED · 2 FAILED · 1 UNVERIFIED.

### Phase 7 — Coverage Gates, E2E and Documentation

| # | Status | Claim and evidence |
|---|---|---|
| 1 | FAILED | `scripts/` resource-depth audit entry does not name the file to create (`phase-07-coverage-gates-e2e-and-documentation.md:37`). |
| 2 | FAILED | “package.json / workspace scripts” does not name the script key or owning package (`phase-07-coverage-gates-e2e-and-documentation.md:38`). |
| 3 | VERIFIED | Existing route-scanner infrastructure is reusable (`scripts/acceptance-report/scanners/route-scanner.ts:1-21,48-75`). |
| 4 | VERIFIED | Existing route-scanner tests are discoverable by the scripts Vitest config (`scripts/vitest.config.ts:4-8`; `scripts/acceptance-report/scanners/route-scanner.test.ts:1`). |
| 5 | VERIFIED | `nav-route-resolution.test.ts` is an exact existing Admin test owner (`apps/admin/src/shell/nav-route-resolution.test.ts:53-63`). |
| 6 | VERIFIED | The Staff helper named for verification exists (`apps/e2e/src/journey/create-staff-via-admin-ui.ts:107-132`). |
| 7 | FAILED | `apps/e2e/src/*.ui.spec.ts` is wrong; UI specs are under `apps/e2e/tests/**/*.ui.spec.ts` (`apps/e2e/playwright.config.ts:99-125`). |
| 8 | VERIFIED | All three durable docs named by the phase exist (`docs/06-kien-truc-url-routing.md:1`; `docs/ux-resource-centric-structure.md:1`; `docs/system-architecture.md:1`). |
| 9 | FAILED | `plans/.../reports/final-resource-depth-ledger.md` is not a literal output path (`phase-07-coverage-gates-e2e-and-documentation.md:45`). |
| 10 | VERIFIED | `pnpm acceptance:report` is a real root command (`package.json:10-17`). |
| 11 | VERIFIED | The acceptance tool recomputes from current source and writes verification output (`scripts/acceptance-report/verify.ts:1-4,288-304`). |
| 12 | VERIFIED | A flow is proven only by a passing ingested run at the current full SHA (`scripts/acceptance-report/flow-evidence.ts:8-11,48-111`). |
| 13 | VERIFIED | `ui-e2e` runs the full UI project, acceptance report and strict business gate (`.github/workflows/ui-e2e.yml:169-200`). |
| 14 | VERIFIED | The CI artifact is SHA-named and is the sanctioned ledger evidence (`.github/workflows/ui-e2e.yml:202-212`). |
| 15 | UNVERIFIED | “Open PRs sequentially” does not define the Phase 7 PR boundary or dependency order (`phase-07-coverage-gates-e2e-and-documentation.md:47-58`). |

**Phase 7:** 10 VERIFIED · 4 FAILED · 1 UNVERIFIED.

## Shorthand and ambiguous path inventory

### Must be replaced with exact execution paths

| Plan location | Ambiguous value | Exact direction |
|---|---|---|
| Phase 1:36 | `apps/admin/src/routes/*.routes.tsx` | Freeze the eight current route files, or name the scanner as the owner. |
| Phase 1:39 | `apps/api/src/router.ts` + domain routers | Name `apps/api/src/router.ts` plus the specific routers included in each wave. |
| Phase 1:40-41 | `plans/...` | Use the exact plan-local report and decisions paths. |
| Phase 2:45 | `app-user.test.ts or existing user tests` | Use `apps/api/src/user/app-user.test.ts` plus explicitly named adjacent user tests. |
| Phase 3:55 | `live setup/user-guard specs` | Name `tests/live/00-setup-roles.spec.ts`, `07-...`, `08-...`, `14-...`. |
| Phase 3:59-60 | “all consumers”, “adjacent tests” | Materialize H3's consumer ledger and exact Staff route/nav/link/form test files. |
| Phase 4:59 | `API/Admin/UI tests` | Name API, Admin and UI test files separately for PR 4A and PR 4B. |
| Phase 5:47-49 | `/ caller`, `corresponding tests` | Name the dialog caller and the Admin/E2E specs that change with it. |
| Phase 6:58 | `apps/admin/src/routes/*.routes.tsx` | Name the route file per module PR. |
| Phase 6:62-63 | brace path + ellipsis + “their Admin pages” | Replace with a module-to-router/page/test table. |
| Phase 7:37-38 | `scripts/` entry + “workspace scripts” | Freeze the new script filename, test filename and package script key. |
| Phase 7:41 | `apps/e2e/src/*.ui.spec.ts` | Replace with exact `apps/e2e/tests/**/*.ui.spec.ts` files. |
| Phase 7:45 | `plans/.../reports/...` | Use the exact plan-local report path. |

### Acceptable shorthand only as route-set notation

These are understandable in requirements, but must not be copied into a file inventory or test
command:

- `/hr/staff/:staffId/{profile,access}` (`phase-03...:17`)
- `/hr/staff/{id}/profile` (`phase-03...:85`)
- `/admin/classes/:id/{overview,students,sessions}` (`phase-05...:17`)
- `/admin/students/:id/{profile,enrollments}` (`phase-05...:18`)
- `/finance/:id/{overview,order-lines}` (`phase-05...:21`)

## Exact CI and acceptance contract

1. `typecheck-and-test` runs on both push and PR through `ci.yml`
   (`.github/workflows/ci.yml:1-7,22-28`).
2. `ui-e2e` is a separate push-only workflow (`.github/workflows/ui-e2e.yml:1-14`).
3. `ui-e2e` stamps the real pushed SHA and runs the entire UI project
   (`.github/workflows/ui-e2e.yml:169-186`).
4. The same job runs `pnpm acceptance:report` then `pnpm business:verify --strict`
   (`.github/workflows/ui-e2e.yml:188-200`).
5. Acceptance results are not authoritative when missing, stale, dirty, run-error, or partial
   (`scripts/acceptance-report/verify.ts:150-161,320-367`;
   `scripts/acceptance-report/flow-evidence.ts:48-111`).
6. Live GitHub branch-protection inspection on 2026-08-17 returned strict required contexts
   `typecheck-and-test` and `ui-e2e` for both `main` and `develop`.

The plan should require the controller to compare every PR's current `headRefOid` with the check-run
SHA before merge, not merely read a green badge.

## Required revisions before validation can pass

1. Correct Phase 7 from `apps/e2e/src/*.ui.spec.ts` to exact files under
   `apps/e2e/tests/`.
2. Decide how `apps/e2e/src/erp-mobile-route-audit.test.ts` becomes executable, or move its
   assertions to a discovered test.
3. Materialize the full Phase 3 Staff consumer ledger from H3 and classify each entry:
   canonical update, compatibility assertion, inherited helper consumer, or comment-only cleanup.
4. Replace every execution-path shorthand in the inventory above.
5. Add an exact focused test command/file matrix to every phase, especially Phase 4A/4B and each
   Phase 6 module wave.
6. Define the Phase 7 PR boundary.
7. Add the exact read-only PR-head/check-run verification operation to every protected PR gate.
8. Keep `pnpm acceptance:report` tied to the current `ui-e2e` artifact/SHA; never use a local dirty
   result as the measured acceptance record.
9. Add a Phase 7 gate-adoption/rollback contract and break the 30–45 day aggregate into bounded
   per-phase/per-module estimates.

## Unresolved questions

- Will the dead `erp-mobile-route-audit.test.ts` be wired as a Node test, migrated into Vitest, or
  replaced by assertions in the discovered Playwright mobile viewport audit?
- Is Phase 7 one protected PR, or separate scanner/E2E/docs PRs with an explicit dependency order?

Status: DONE_WITH_CONCERNS  
Summary: 105 rollout/test/CI claims checked; 14 failed and 16 remain unverified. The required CI and
acceptance architecture is valid, but wrong E2E paths, a dead test, incomplete Staff consumer
ownership, and ambiguous per-phase proof prevent implementation handoff.  
Concerns/Blockers: H1-H3 and M4-M8 above must be incorporated into the plan before it can pass the
whole-plan validation gate.
