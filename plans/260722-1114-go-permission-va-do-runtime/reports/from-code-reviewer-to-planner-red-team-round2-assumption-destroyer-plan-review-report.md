# Red Team Round 2 — Assumption Destroyer (Scope Auditor)

**Plan:** `plans/260722-1114-go-permission-va-do-runtime/`
**Reviewer role:** Assumption Destroyer / Scope Auditor
**Date:** 2026-07-22
**Method:** every claim re-derived from source; no plan text taken on trust.

Headline: the arithmetic the plan is proudest of (**62 combos**) is correct, but it
measures the wrong universe. `/finance/new` — the screen F1 lives on — is **not a
nav-registry entry**, so a matrix generated from the registry (which Phase 5
mandates) cannot contain it, and Phase 5's own kill-criterion ("phép thử chua must
自 find F1") is unreachable as designed.

---

## Finding 1: Phase 5's sour test cannot find F1 — `/finance/new` is not in the nav registry

- **Severity:** Critical
- **Location:** Phase 5, sections "Architecture" (line 37) and "Implementation Steps" step 5 (lines 53-56)
- **Flaw:** Phase 5 mandates the (screen, role) matrix be generated from
  `nav-registry.ts` ("Không hardcode danh sách — sinh ra từ registry"). It then
  requires the sour test to prove capture finds `/finance/new` + `sale` →
  `classBatch.list` 403. `/finance/new` has **no nav entry**. The registry's only
  finance paths are `/finance` (receipts), `/finance/refund`, `/crm`,
  `/crm/post-sale-meeting`, `/crm/aftersale`, `/ops/revenue`, `/ops/recon`. The
  receipt-create screen is a sub-route reached from the topbar "Ghi danh" CTA
  (`shell.tsx:50-54`) and from the receipt list — never from the side nav. The two
  requirements are mutually exclusive: obey "generate from registry" and the sour
  test fails; hardcode `/finance/new` and you violate the generation rule and have
  mớm (spoon-fed) the answer, which the plan explicitly forbids ("không được mớm").
- **Failure scenario:** Executor writes `nav-role-matrix.ts` faithfully from the
  registry, checks out `4237cb5`, runs capture. Report shows F2
  (`/teaching/session-assessment` **is** a nav entry, `nav-registry.ts:25`) but not
  F1. Executor either (a) declares the phase failed and burns a cycle redesigning,
  or (b) quietly appends `/finance/new` to the list, which converts the sour test
  from a falsification into a confirmation — the capture is then only proven to
  find bugs on screens someone already knew were broken. Option (b) is the likely
  one under schedule pressure, and it silently voids the only evidence the whole
  Nhịp B rests on.
- **Evidence:**
  - `apps/admin/src/shell/nav-registry.ts:44-54` — finance-ops children; no `/finance/new`
  - `apps/admin/src/routes/finance.routes.tsx:28-35` — `path: 'new'` → `ReceiptCreatePage`
  - `apps/admin/src/pages/finance/receipt-create.tsx:109` — `trpc.classBatch.list.useQuery({pageSize:100})` (the F1 call)
  - `plans/.../phase-05-nhip-b-runtime-capture.md:37,54`
- **Suggested fix:** Change the matrix source to **route tree ∪ nav registry**:
  enumerate `apps/admin/src/routes/*.routes.tsx` for reachable static paths, then
  use nav-registry only to attach the `permission` label. State explicitly that
  routes with no nav entry get tested for **all** business roles (no gate to
  derive). Re-baseline the combo count after this change — it will not be 62.

---

## Finding 2: One HTTP response ≠ one procedure — the admin client batches tRPC calls

- **Severity:** Critical
- **Location:** Phase 5, "Implementation Steps" step 3, and "Architecture" ("Capture phải phân biệt bằng **HTTP status**")
- **Flaw:** The capture design records `{path, role, procedure, status}` from
  `page.on('response')`. The admin app uses `httpBatchLink`, so N procedure calls
  fired in the same tick collapse into **one** HTTP request
  (`/trpc/classBatch.list,classSession.list,...?batch=1`) with **one** status code
  and a JSON array body. There is no per-procedure status on the response object.
  Worse, tRPC's batch status is not the per-item status: a batch containing one
  FORBIDDEN and one OK does not reliably surface as HTTP 403, so the plan's central
  discriminator ("bất kỳ 403 nào là lỗi", "phân biệt bằng HTTP status, không bằng
  nội dung render") does not exist at the layer the plan reads it from.
  `/teaching/session-assessment` is exactly this case — it fires `classBatch.list`,
  `classSession.list` and `classBatch.listStudents` from one component
  (`session-assessment.tsx:45,49,53`).
- **Failure scenario:** Capture runs, every batched response reads 200 (or a single
  status that doesn't map to a procedure). The 403 table comes back empty. The
  report says "no permission failures on 62 combos" while F1/F2 are live on the
  commit under test. This is the "âm tính giả im lặng" the phase names as its top
  risk, and the listed mitigation (compare combo count against the registry count)
  does not detect it — all 62 combos genuinely ran.
- **Evidence:**
  - `apps/admin/src/lib/trpc.ts:2,30` — `httpBatchLink({ url: ... })`
  - `apps/admin/src/pages/teaching/session-assessment.tsx:45,49,53` — three procedures from one screen
  - `plans/.../phase-05-nhip-b-runtime-capture.md:39,51`
- **Suggested fix:** Do not read status from the response object. Parse the
  **request URL path segment** (comma-separated procedure names, index-ordered) and
  the **response JSON array** (same index order), extracting
  `result[i].error.data.httpStatus` / `.code === 'FORBIDDEN'` per element. Add a
  self-test asserting the parser correctly splits a known multi-procedure screen.
  Alternatively force `batch=0` for the capture run, but that changes the code path
  under test and must be stated as a deviation.

---

## Finding 3: The 62 combos cover 22 screens, not the application — 12 real screens have no nav entry, 5 gated entries yield zero combos

- **Severity:** High
- **Location:** Phase 5, "Architecture" (line 30); plan.md, "Acceptance Criteria" (line 73)
- **Flaw:** The 19 + 8 = 62 arithmetic is **correct** (re-derived below), but it is
  presented as the app's coverage. Two silent subtractions:
  1. The 5 gated entries under the `admin` module all point at permissions with an
     **empty role list** (`user.manage`, `facility.list`, `facilityNetwork.manage`,
     `compensationPolicy.manage`, `audit.list` — all `[]`). Intersected with the 4
     business roles they contribute **0 combos**. So 62 combos spread over **22**
     screens, not 27.
  2. **12 real screens with real page components have no nav entry at all** and are
     therefore outside the matrix entirely: `/finance/new`, `/finance/class-placement`,
     `/finance/:id`, `/crm/opportunities/:id`, `/admin/parents`, `/admin/courses`,
     `/admin/students/:id`, `/admin/classes/:id`, `/admin/engagement/gifts`,
     `/admin/engagement/rewards`, `/admin/engagement/leaderboard`,
     `/admin/report-cards`.
  Real navigable surface is ~39 screens; the matrix reaches 22 (56%).
- **Failure scenario:** Phase 5 completes, reports "62/62 combos, N remaining 403s",
  and that number is handed to the `260717-1213-so-nghiem-thu-song` acceptance plan
  as the runtime evidence base. Nobody re-derives the denominator. Permission bugs
  on `/finance/class-placement` (which calls `classBatch.list` at
  `class-placement.tsx:52` — same root cause as F1) and on the whole engagement
  cluster ship unmeasured, under a green banner. The acceptance criterion "Runtime
  capture chạy 62 tổ hợp" is satisfied while coverage is silently ~half.
- **Evidence:**
  - `packages/auth/src/index.ts:78-81,96,97,110` — the five `[]` permission entries
  - `apps/admin/src/routes/admin.routes.tsx:53-80`, `finance.routes.tsx:28-49`, `crm.routes.tsx:27`
  - `apps/admin/src/pages/enrollment/class-placement.tsx:52` — `classBatch.list`
  - `plans/.../phase-05-nhip-b-runtime-capture.md:30`; `plan.md:73`
- **Suggested fix:** Replace the bare "62" with an explicit denominator table in the
  phase: *screens reachable by ≥1 business role* / *screens in matrix* / *screens
  excluded and why*. Make "0-combo entry" an explicit reported category rather than
  an invisible zero. Fold the 12 non-nav routes in per Finding 1.

---

## Finding 4: `ui-chromium` defaults to the **LMS** origin — a missing one-line override makes every combo pass

- **Severity:** High
- **Location:** Phase 5, "Architecture" (line 34) and "Test / Validation" (line 61)
- **Flaw:** The phase says the infrastructure is "có sẵn... preview server admin
  :4173 / lms :4174" as if picking the app were free. The `ui-chromium` project's
  `baseURL` is hardcoded to `http://localhost:4174` — the **LMS** preview. Every
  admin spec must override it per-describe. The existing admin spec carries a
  four-line warning comment about exactly this trap. Phase 5's Related Code Files
  and steps never mention the override. Separately, the phase's run command
  (`--project=ui-chromium`) is incomplete: both the project and its preview servers
  register **only** under `PLAYWRIGHT_UI=1`; without that env var Playwright errors
  that the project does not exist.
- **Failure scenario:** Executor writes `screen-role-capture.ui.spec.ts` without
  `test.use({ baseURL: 'http://localhost:4173' })`. All 62 `page.goto('/hr/payroll')`
  etc. resolve against the LMS SPA, which has none of those routes — it renders its
  own fallback, fires zero `/trpc/*` admin procedures, and returns zero 403s. The
  combo-count cross-check passes (62 ran). The report reads perfectly clean. The
  sour test then "fails to find F1/F2", the executor concludes the capture design is
  wrong (per step 5's instruction to stop), and redesigns a working tool to fix a
  one-line config bug.
- **Evidence:**
  - `apps/e2e/playwright.config.ts` — `use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4174' }`
  - `apps/e2e/tests/admin-shell.ui.spec.ts:21-25` — the documented trap + override
  - `apps/e2e/playwright.config.ts:16-21,36,64` — `PLAYWRIGHT_UI=1` gates project *and* webServers
  - `plans/.../phase-05-nhip-b-runtime-capture.md:34,61`
- **Suggested fix:** Add to Phase 5 steps: (a) `test.use({ baseURL: 'http://localhost:4173' })`
  in the capture spec; (b) full command `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium`;
  (c) a smoke assertion at the top of the capture (e.g. the role Badge from
  `shell.tsx:55` is visible) that fails loudly if the page is not the admin shell —
  turning this class of misconfiguration from silent-green into a hard error.

---

## Finding 5: Phase 1 misses `cockpit.tsx:210` — a client-side `class.create` gate that Phase 5 can never see

- **Severity:** High
- **Location:** Phase 1, "Architecture" 6-row table + "Related Code Files"
- **Flaw:** The 6-row procedure table is complete on the **API** side (verified: no
  other `requirePermission('class','create')` exists anywhere). But `class.create`
  is also used as a **client** permission check:
  `const canViewSchedule = canDo('class', 'create')` gates `TodaySchedulePanel`,
  which is the component that calls `classBatch.list`. Phase 1 deliberately does not
  widen `class.create` (Q5), and does not list `cockpit.tsx` as a file to modify.
  So after Phase 1 the teacher's "Lịch dạy hôm nay" panel remains hidden — a read
  view still gated on a write permission, which is the exact defect class Phase 1
  exists to remove. The plan's claim that this one registry change "gỡ cả F1 lẫn F2"
  overstates the blast radius it actually corrects.
- **Failure scenario:** Phase 1–3 land. UAT covers the three acceptance-criteria
  screens and passes. Phase 5 capture visits `/cockpit` as `giao_vien`: because the
  panel is gated **client-side**, `classBatch.list` is never requested, there is no
  403, and `/cockpit` is reported clean. The bug is invisible to every layer the
  plan builds — the fix, the UAT, and the new runtime tool — and ships. Note this
  generalises: the codebase has 28 `canDo(...)` call sites in pages; every one of
  them can hide a permission defect from a 403-only capture.
- **Evidence:**
  - `apps/admin/src/pages/cockpit.tsx:210` — `canDo('class', 'create')`
  - `apps/admin/src/pages/cockpit.tsx:262-263` — `{isTeacher && canViewSchedule && <TodaySchedulePanel />}`
  - `apps/admin/src/pages/cockpit.tsx:172-173` — `TodaySchedulePanel` → `trpc.classBatch.list`
  - `packages/auth/src/index.ts:84` — `'class.create': ['giam_doc_dao_tao']` (unchanged by Q5)
- **Suggested fix:** Add `apps/admin/src/pages/cockpit.tsx:210` to Phase 1's Related
  Code Files (`canDo('class','read')`). Add a Phase 1 step: grep `canDo(` across
  `apps/admin/src/pages/**` and confirm no other client gate references a permission
  whose meaning this phase changes. Add to Phase 5's Architecture an explicit
  limitation note: *a screen whose call is suppressed by a client-side `canDo` gate
  produces no request and therefore no finding* — otherwise the capture's silence is
  read as proof of correctness.

---

## Finding 6: Phase 2's nav test cannot test what Phase 2 changes, and its URL criterion is unreachable from its steps

- **Severity:** High
- **Location:** Phase 2, "Test / Validation" (line 54) and "Success Criteria" (lines 61-63)
- **Flaw:** Two separate errors.
  1. **Phantom test.** Phase 2 proposes proving nav visibility by extending
     `nav-registry.test.ts` with a per-role snapshot of "entries seen".
     `visibleModulesFor` filters **modules only** — it returns each surviving module
     with **all** children attached, regardless of permission. Child filtering lives
     in `shell.tsx`'s `isChildVisible` prop passed to `SideNav`. The test file itself
     documents this at :55-57. A snapshot over `visibleModulesFor` will therefore
     show `/admin/classes` as "visible" for `sale` **before and after** the fix — the
     test executes the code and proves nothing about the behaviour being changed.
  2. **Unreachable criterion.** Step 4 says only "hide write buttons; the API still
     blocks", but Success Criterion 2 demands that typing `/admin/classes` as `sale`
     "không render surface quản trị". After Phase 1, `sale` holds `class.read`, so
     `classBatch.list` returns 200 and the admin list page renders fully populated.
     Nothing in the listed steps prevents that. The repo already has the pattern that
     would (`if (!canDo(...)) return <EmptyState "Không có quyền truy cập" />`, used
     on five admin pages), but Phase 2 neither cites it nor lists
     `pages/classes/index.tsx` — which has no `useSession`/`canDo` at all — as a file
     to modify.
- **Failure scenario:** Phase 2 closes with a green "test nav-registry phủ mọi
  ACTIVE_ROLES" checkbox. The mitigation Q3 relies on for the accepted child-PII risk
  ("Giảm nhẹ bằng nav gate (Phase 2)") is therefore recorded as verified while
  `sale` can still open `/admin/classes` by URL and read the full class list — and
  from there `/admin/classes/:id`, which calls `classBatch.listStudents`
  (`class-detail.tsx:71`) and returns children's names. The documented mitigation for
  the one risk the PO explicitly accepted does not exist.
- **Evidence:**
  - `apps/admin/src/shell/nav-registry.ts:102-115` — module-level filter only
  - `apps/admin/src/shell/nav-registry.test.ts:55-57` — "filtered downstream by shell.tsx"
  - `apps/admin/src/shell/shell.tsx:35` — `isChildVisible={(c) => ...}`
  - `apps/admin/src/pages/admin/users.tsx:307-322` — existing page-guard pattern
  - `apps/admin/src/pages/classes/index.tsx:42` — `classBatch.list`, no `canDo` anywhere in file
  - `apps/admin/src/pages/classes/class-detail.tsx:71` — `listStudents` (child PII)
- **Suggested fix:** Point Phase 2's test at the real gate: assert over
  `isChildVisible`-equivalent logic (extract it from `shell.tsx` into a testable
  `visibleChildrenFor(module, canDo)` and cover both files), or add a
  `shell.test.tsx` rendering the nav per role. Add `pages/classes/index.tsx` and
  `class-detail.tsx` to Related Code Files with the existing `users.tsx:307` guard
  pattern cited explicitly, or delete Success Criterion 2 and admit the mitigation is
  menu-only.

---

## Finding 7: Phase 3 creates the exact violation Phase 6 makes fatal — and nothing orders them

- **Severity:** High
- **Location:** Phase 3, "Related Code Files"; Phase 6, step 5 + `dependencies: []`
- **Flaw:** Phase 3 adds a new procedure (`payslip.assignableStaff`). The acceptance
  scanner classifies every scanned procedure not referenced by a flow-manifest entry
  as an **orphan**, and one not present in `DOCUMENTED_GAPS` as **untriaged**. Phase 6
  step 5 changes `verify.ts` to exit non-zero when untriaged orphans exist, and step
  6 adds `acceptance:report` to CI. Neither phase lists
  `scripts/acceptance-report/flow-manifest.ts` as a file to modify, and Phase 6
  declares `dependencies: []`, so nothing forces Phase 3's manifest update to precede
  Phase 6's gate. Measured baseline today: **1 orphan, 1 documented gap, 0 untriaged,
  exit 0** — i.e. the repo is currently exactly at the threshold Phase 6 will start
  enforcing, so Phase 3's single new procedure is sufficient to cross it.
- **Failure scenario:** Phase 3 and Phase 6 run in parallel (the plan invites this —
  both are dependency-free). Phase 6's falsification test passes on a tree without
  Phase 3. They merge. CI on `main` goes red with
  `ORPHAN CHƯA PHÂN LOẠI: payslip.assignableStaff` — a legitimate-looking failure
  caused by the plan's own work, on the very first day of the new gate. Phase 6's
  named risk ("CI đỏ kinh niên → team tắt gate") materialises immediately, and the
  fastest local fix is to add the procedure to `DOCUMENTED_GAPS`, which permanently
  whitelists it out of acceptance tracking.
- **Evidence:**
  - `scripts/acceptance-report/verify.ts:88-97` — `computeProcedureOrphans`, untriaged = not in `DOCUMENTED_GAPS`
  - `scripts/acceptance-report/verify.ts:168-170` — current `console.warn` path Phase 6 converts to non-zero exit
  - measured: `pnpm acceptance:report` → `38 luồng (38 built), 1 orphan (1 documented gap, 0 chưa phân loại)`, `EXIT_CODE=0`
  - `plans/.../phase-03-nhip-a-man-chot-luong.md:42-46`; `phase-06-nhip-b-luoi-an-toan-ci.md:6,55`
- **Suggested fix:** Add `scripts/acceptance-report/flow-manifest.ts` to Phase 3's
  Related Code Files with a step: register `payslip.assignableStaff` against the
  payroll flow (**not** `DOCUMENTED_GAPS`). Add `dependencies: [3]` to Phase 6, or at
  minimum a precondition line: "before enabling the non-zero exit, run
  `pnpm acceptance:report` and confirm `0 chưa phân loại` on the integration branch."

---

## Finding 8: Two "known-quirk" baseline claims are contradicted by the sources the plan cites

- **Severity:** Medium
- **Location:** plan.md, "Môi trường & cạm bẫy đã biết" (line 91); Phase 6, "Architecture" (line 31)
- **Flaw:**
  1. plan.md:91 states the `EmployeeCodeCounter > 9999` risk "là thật nhưng **chưa
     xảy ra**" and pre-authorises dismissing any red in `app-user.test.ts` as
     pre-existing debt. The cited document says the opposite: it already happened
     (counter at 10773 on 2026-07-20, "`pnpm --filter @cmc/api test` now fails 1/898
     for every team member"), and its Status is **implemented** — the assertion was
     already widened to `/^CMC\d{4,}$/`. The quirk is both *not* hypothetical and *no
     longer active*.
  2. Phase 6 states CI is "install → migrate → typecheck → test → coverage. Không
     lint, không `acceptance:report`, **không e2e**." `ci.yml` has a second job, `e2e`,
     that runs `pnpm --filter @cmc/e2e test` on every push and PR — non-blocking
     (`continue-on-error: true`), but it exists and runs.
- **Failure scenario:** (1) Phase 1 changes class permissions. `app-user.test.ts`
  goes red for an unrelated real reason (or a genuine regression surfaces there). The
  executor consults plan.md:91, finds a written authorisation to treat that exact
  file's failure as "nợ có sẵn, không phải do đợt này", and moves on. A pre-approved
  excuse for a failure mode that no longer exists is worse than no note at all.
  (2) Phase 1's permission change alters behaviour that existing e2e specs assert.
  The CI e2e job goes red, `continue-on-error` swallows it, and the plan's stated
  boundary ("Nhịp A không chạy e2e ⇒ không dính bẫy") is false for anything pushed —
  e2e *does* run, its result is just invisible.
- **Evidence:**
  - `docs/HARNESS_BACKLOG.md:211-218` (already occurred, 1/898 failing), `:240` (`Status: implemented`)
  - `apps/api/src/user/app-user.test.ts:54` — `expect(result.employeeCode).toMatch(/^CMC\d{4,}$/)`
  - `.github/workflows/ci.yml` — job `e2e`, `continue-on-error: true`, step "Run e2e"
  - `plan.md:91`; `phase-06-nhip-b-luoi-an-toan-ci.md:31`
- **Suggested fix:** Delete the `EmployeeCodeCounter` escape clause from plan.md:91
  (or restate it as "already fixed 2026-07-20; a red here is a real regression").
  Correct Phase 6's CI description to "e2e runs as a non-blocking job", and add one
  line to Phase 1: after the permission change, check the e2e job result manually
  since `continue-on-error` hides it.

---

## Verification Results (items 1-8)

### 1. "19 nav entry có gate + 8 không gate = 62 tổ hợp" — **VERIFIED (arithmetic), FAILED (as a coverage claim)**

Re-derived from source. 27 total entries: `cockpit` (top-level leaf) + 26 children
(teaching 6, classes-students 2, finance-ops 7, hr 6, admin 5).
**19 gated / 8 ungated** — exact match.

Combo fan-out against the 4 business roles (`ACTIVE_ROLES` minus `super_admin`):

| Bucket | Count |
|---|---|
| Gated entries with non-empty role list (14) | 30 combos |
| Gated entries with `[]` role list (5, all under `admin`) | 0 combos |
| Ungated entries (8) × 4 roles | 32 combos |
| **Total** | **62** |

The number is right. What it does not say: it spans **22** screens, and 12 further
real screens have no nav entry at all (Finding 3). Evidence:
`apps/admin/src/shell/nav-registry.ts:6-94`; `packages/auth/src/index.ts:54-135`.

### 2. Phase 1's 6-row procedure table complete? — **VERIFIED for procedures / FAILED for dependents**

Exhaustive grep for `class.create` across `apps/`, `packages/`, `scripts/`: the six
listed API sites are the **only** `requirePermission('class','create')` occurrences
(`class-batch-router.ts:115,229,254,283,300`; `class-session-router.ts:84`). The
create/list/listStudents/get/assignTeacher/session-list split is accurate.

Dependents the plan misses:
- **`apps/admin/src/pages/cockpit.tsx:210`** — `canDo('class','create')` as a *client*
  gate over `classBatch.list` (Finding 5). Not in Related Code Files.
- Six further pages consume the four widened procedures and are silently in scope:
  `teaching/schedule.tsx:229`, `teaching/session-evidence.tsx:26,31`,
  `enrollment/class-placement.tsx:52`, `classes/index.tsx:42`,
  `classes/class-detail.tsx:71,128,236`, `finance/receipt-create.tsx:109`.
  `/teaching/session-evidence` in particular is an **ungated nav entry** with the same
  empty-dropdown defect as F2 — the plan never names it, so it is neither in the
  acceptance criteria nor in the UAT list, though Phase 1 does fix it.

### 3. "`verify.ts` chưa từng exit non-zero" — **FAILED as stated**

`main()` is synchronous and invoked bare at `verify.ts:177`; four `throw new Error`
sites (`:107`, `:116`, `:124`, `:135`) propagate as uncaught exceptions → process
exit 1. The script **can and does** exit non-zero today, for whitelist/manifest drift.
The accurate claim is the narrower one Phase 6's Architecture section already makes:
the **orphan/unresolved-namespace** path only `console.warn`s (`:168-172`).
Measured today: exit 0, `0 chưa phân loại`. Side effect for Phase 6's falsification
test: an `exit ≠ 0` observed after injecting a temp orphan does not by itself prove
the *new* check fired — the test must assert on the message, not just the code.

### 4. "`scripts/` has no tsconfig.json, outside pnpm-workspace" — **VERIFIED; turbo pickup FAILED**

`find scripts -name "tsconfig*.json"` → empty. `pnpm-workspace.yaml` contains only
`apps/*` and `packages/*`. Both claims hold.

`pnpm typecheck` = `turbo run typecheck`. Turbo only runs tasks declared in
**workspace packages**. Adding `scripts/tsconfig.json` alone changes nothing — turbo
will not discover it. Workspace membership requires a `scripts/package.json` (name +
`typecheck` script) **and** a `pnpm-workspace.yaml` entry; Phase 6's Related Code
Files lists `pnpm-workspace.yaml` but **not** `scripts/package.json`, so step 4 as
written cannot work via the workspace route. Note also `scripts/` mixes `.ts`,
`.mjs`, `.sh`, `.ps1` and a `bin/` with a Windows `.exe` — the tsconfig `include`
needs an explicit narrow glob or `tsc` will trip on non-TS content.

Related scope drift in plan.md:75 ("`pnpm typecheck` + `pnpm lint` + `pnpm test`
xanh"): `lint` is `eslint apps/admin apps/lms` — `packages/*` and `scripts/` are out
of scope, and the flat config declares exactly one rule
(`no-restricted-imports`, `eslint.config.js:34-52`). `test` is
`turbo run test --filter=!@cmc/e2e` — e2e is excluded, so "pnpm test xanh" can never
cover Phases 4-5. These gates are much weaker than the criterion implies.

### 5. "payroll.tsx uses exactly 4 fields at :416-420" — **VERIFIED**

`trpc.user.list.useQuery()` at `:414`; mapped to `{id, fullName, employeeCode,
position}` at `:416-421`. `StaffRow` (`:65-71`) declares exactly those four (plus an
index signature for `DataTable`), `STAFF_COLS` (`:73-77`) renders three of them, and
`selectedUser` carries `{id, name}` only. The only other tRPC calls on the page are
`payslip.getForUser/assemble/finalize/reopen` (`:97-114`), which take `appUserId` +
`period`. `PayslipDetail` receives `appUserId`, `period`, `employeeName` — no extra
`user.list` fields. **No child needs more of the shape.** Phase 3's narrow-procedure
design is sound.

Two unstated details worth pinning: `user.list` currently returns full `AppUser` rows
(`user/router.ts:129-139`, `findMany` with no `select` — includes `email`,
`managerId`, `isActive`, `roles`), which is the PII argument for option (b); and it
applies **no `isActive` filter**, so the payroll list today includes deactivated
staff. The new procedure must consciously preserve or change that.

### 6. "Không có route-level guard trong apps/admin/src/routes/*.tsx" — **VERIFIED, but the conclusion drawn from it is wrong**

All seven route files contain only lazy/Suspense wiring. The single guard is
`RequireAuth` (`routes/index.tsx:21-26`), which checks **authentication only**
(`if (!me) return <Navigate to="/login">`). No permission check anywhere in the route
layer. Claim confirmed.

The inference "nav là lớp chặn duy nhất ở client" (phase-02:32) is **false**. Five
admin pages implement a page-level permission guard returning an
`EmptyState "Không có quyền truy cập"`: `users.tsx:310`, `facilities.tsx:206`,
`network-ip.tsx:297`, `shift-config.tsx:279`, `audit-log.tsx:180`. This is the
established in-repo pattern for the exact requirement Phase 2's Success Criterion 2
states, and Phase 2 neither cites nor uses it (Finding 6).

### 7. "`pnpm test` xanh 956/956" — **UNVERIFIED (not re-run); unsafe as an acceptance baseline**

Not re-executed: the suite needs the `cmc-test-db-socat` sidecar against shared
`cmc_edu` and runs ~251s; re-running it would mutate shared team state, which is
outside a review's remit. Provenance traced: the number originates from
`plans/reports/skeptical-acceptance-audit-260722-0848-cmc-system-state-report.md:25`
("956/956 pass, 102/102 file, 251s"), i.e. a single measurement at 2026-07-22 08:37,
carried forward through two plans.

Plausibility concerns:
- The stated flake justification is factually inverted (Finding 8): the
  `EmployeeCodeCounter` issue **already occurred** and is **already fixed**
  (`app-user.test.ts:54` now `/^CMC\d{4,}$/`; `HARNESS_BACKLOG.md:240`
  `Status: implemented`).
- The underlying fragility is structural and unaddressed: `cmc_edu` is a single
  never-reset DB shared across sessions and agents (`HARNESS_BACKLOG.md:203-211`), so
  any count is a point-in-time reading, not a property of the commit. Two agents
  running concurrently can still collide.
- `pnpm test` excludes `@cmc/e2e` by construction, so the number says nothing about
  Phases 4-5.

Safe to build acceptance criteria on? **No, not as an absolute.** Recommend restating
as "`pnpm test` must be green on the branch immediately before merge, measured then"
and dropping the hardcoded 956 (any legitimately added test invalidates it, inviting
a "count mismatch" false alarm).

### 8. Phase 5 infrastructure "có sẵn" — **PARTIALLY VERIFIED**

| Component | Exists | Works in the mode Phase 5 assumes |
|---|---|---|
| `ui-chromium` project | Yes, `playwright.config.ts` | **Only under `PLAYWRIGHT_UI=1`** — unmentioned in the phase's run command (Finding 4) |
| Preview servers :4173/:4174 | Yes | Yes, but registered under the same env gate; each does a **full Vite build** per run (`timeout: 120_000`, `reuseExistingServer: false`) |
| `baseURL` | Yes | **Defaults to LMS :4174** — admin needs a per-spec override (Finding 4) |
| `mintStaffCookie` | Yes, `session-injection.ts:141` | Yes. Accepts arbitrary `userId` (`admin-shell.ui.spec.ts:31` uses `'e2e-admin-shell-gdkd'`), so no `AppUser` row is needed to mint a role — good for the matrix, but procedures that resolve an `AppUser` by `ctx.userId` will fail with **NOT_FOUND/500, not 403**, and a 403-only capture will misfile those |
| `page.on('response')` | Yes (Playwright) | **No** — batching defeats per-procedure status (Finding 2) |
| `x-dev-user` fallback | Exists in dev | **Not** in preview: preview is a production build; `apps/admin/src/lib/trpc.ts:37` returns `{}` headers when `import.meta.env.PROD`. Mode-B cookie is the only option, as `admin-shell.ui.spec.ts:9-12` documents |

Also unsupported: the "~2 phút (62 tổ hợp × ~2s)" budget. Config is
`fullyParallel: false, workers: 1`, per-test `timeout: 30_000`, plus two full app
builds before the first navigation. A serial `goto` + network-idle + cookie set per
combo realistically lands at 3-6s each (≈4-6 min) on top of ~2-3 min of build. Not a
correctness defect, but if the estimate is what justifies "run it on every PR"
(open question 2 in plan.md:106), the answer is being derived from a number with no
measurement behind it.

---

## Summary of what actually breaks

| # | Severity | One-line consequence |
|---|---|---|
| 1 | Critical | Registry-generated matrix cannot contain `/finance/new` → Phase 5's own kill-criterion is unreachable |
| 2 | Critical | `httpBatchLink` means one status per N procedures → the 403 table can come back empty while bugs are live |
| 3 | High | "62 combos" covers 22 of ~39 screens; 5 gated entries contribute 0 |
| 4 | High | `ui-chromium` baseURL is the LMS app; a missing override yields 62 silently-green combos |
| 5 | High | `cockpit.tsx:210` client gate on `class.create` survives Phase 1 and is invisible to Phase 5 |
| 6 | High | Phase 2's test cannot observe child-nav visibility; its URL criterion has no implementing step |
| 7 | High | Phase 3's new procedure trips Phase 6's new orphan gate; no dependency orders them |
| 8 | Medium | Two baseline claims (EmployeeCounter, "CI has no e2e") are refuted by their own cited sources |

## Unresolved questions

1. **Is the matrix source negotiable?** Findings 1 and 3 both dissolve if the source
   becomes the route tree with nav-registry as a permission annotation. If the PO
   wants to keep "nav-registry only", Phase 5's sour test must be rewritten around a
   defect that lives on a nav-reachable screen (F2 alone), and the phase must state
   plainly that F1's screen is out of scope.
2. **Do `:id` detail routes belong in the capture?** They need a seeded entity id per
   role, which conflicts with the "chỉ điều hướng và đọc, không mutation" constraint.
   `/admin/classes/:id` is where child roster PII actually renders, so excluding it
   leaves the Q3-accepted risk unmeasured.
3. **Does the PO accept that Q3's stated mitigation ("giảm nhẹ bằng nav gate — Phase
   2") is menu-only unless a page-level guard is added?** Finding 6 changes the
   risk-acceptance calculus, not the decision itself — flagging per the
   "don't relitigate PO decisions, do report misrepresented consequences" rule.
4. **Phase 6 gate mode still unanswered (plan.md:105).** Finding 7 makes it urgent:
   whichever mode is chosen, the flow-manifest update must land with Phase 3, not
   after.
