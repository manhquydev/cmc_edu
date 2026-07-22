# Red Team — Assumption Destroyer (Scope Auditor lens)

Plan: `plans/260722-0908-acceptance-role-true-evidence/`
Reviewer: code-reviewer (rt-assumption) · 2026-07-22 · main @ `4237cb5`
Method: every claim re-derived from the worktree. Independent recomputation script:
`C:\Users\manhquy\AppData\Local\Temp\claude\D--project-vip-CMC\ea36cb70-b272-4232-8976-36ba7b6161d5\scratchpad\audit-actor-permission-crosscheck.mjs`
(parses `apps/api/src/router.ts` namespace map → per-router `requirePermission` gates → `packages/auth` PERMISSIONS → manifest flows; 38/38 flows parsed, 148 gate entries, 59 permissions).

---

## Finding 1: D6 makes 16 of 38 flows structurally unsatisfiable; the real violation count is 19, not 7

- **Severity:** Critical
- **Location:** Phase 1, "Implementation Steps" step 5 + "Success Criteria" bullet 4; plan.md finding F8; plan.md D6
- **Flaw:** D6 removes `super_admin`, `he_thong`, `agent` from every actor computation, and Phase 1 Architecture additionally removes `phu_huynh` / `hoc_vien`. Sixteen flows declare **only** excluded actors, so their staff-actor set is empty and *every* declared procedure becomes an ORPHAN-PROC by construction. The plan budgets triage for "7/38" and names exactly one exception (P1-09 `audit.list`).
- **Failure scenario:** Implementer finishes Phase 1 step 4, runs `pnpm acceptance:report`, and gets 19 failing flows instead of 7. The only way to reach the Phase 1 success criterion ("exit ≠ 0 khi có vi phạm chưa được giải thích") is to add ~12 more `DOCUMENTED_GAPS`-style exceptions that were never scoped or reviewed. Phase 1's own risk row "Biến ngoại lệ thành nơi giấu lỗi" then fires immediately, and the gate ships as a mostly-suppressed check — the exact failure mode the plan exists to prevent.
- **Evidence:**
  - Zero-actor flows (recomputed): ADM-01…ADM-05 (`flow-manifest.ts` — 5 × `actorRoles: ['super_admin']`), P1-04, P1-05, P3-10, P3-11 (`he_thong`), P1-06, P1-07 (`phu_huynh`), P2-03, P2-05 (`hoc_vien`), P3-01, P4-03 (`nhan_vien`), P4-01 (`hoc_vien|nhan_vien`) = **16**.
  - Script output: `flows with ZERO computable staff actor: 16` / `flows violating: 19`.
  - Concrete orphan sets, e.g. ADM-03 → `facilityNetwork.create|update|delete|list|detectMyIp`, all gated on `facilityNetwork.manage` which is `[]` (`packages/auth/src/index.ts:97`). ADM-02 → `user.manage: []` (`packages/auth/src/index.ts:96`).
  - `P4-04` is a **real** IDLE-ACTOR of the same class as F5 and appears nowhere in the plan: `actorRoles: ['sale','giao_vien']` (`flow-manifest.ts:471`) but all four procedures gate on `testAppointment.manage: ['giam_doc_kinh_doanh','giam_doc_dao_tao','sale']` (`packages/auth/src/index.ts:131`) — `giao_vien` can call none of them.
  - P2-04 IDLE-ACTOR `giao_vien` (plan F5) — confirmed.
- **Suggested fix:** Before writing any code, run the recomputation and enumerate all 19. Decide the *rule* for actor classes with no registry representation (`super_admin`, `he_thong`, LMS subjects) — most likely: skip the assertion entirely for flows whose declared actor set is disjoint from `ActiveRole`, and assert that fact explicitly rather than routing 13 flows through a per-line exception list. Add P4-04 to the F-list.

---

## Finding 2: `pnpm typecheck` does not cover `scripts/` — the plan's headline acceptance criterion cannot pass

- **Severity:** Critical
- **Location:** plan.md "Acceptance Criteria" bullet 1; Phase 1 steps 2, "Test / Validation" falsification test 1, Success Criteria bullet 1
- **Flaw:** The plan's primary contract-enforcement mechanism is "make `actorRoles` a union type so `pnpm typecheck` goes red". `scripts/` is not a workspace package and no tsconfig in the repo includes it, so nothing typechecks those files. `tsx` (the runner) strips types without checking them.
- **Failure scenario:** Implementer changes `actorRoles: string[]` → `FlowActor[]`, runs the mandatory falsification test (insert `'nhan_vien'`, expect red), and `pnpm typecheck` passes green. Worse: it *also* passes green with the four real `nhan_vien` entries still in place, so Phase 1 step 2's "kỳ vọng đỏ ở 3 luồng" never happens and the implementer may conclude the manifest is already clean. The contract is decorative — the same failure the plan diagnoses in its own Overview.
- **Evidence:**
  - `pnpm-workspace.yaml`: `packages: [apps/*, packages/*]` — `scripts/` excluded.
  - No root `tsconfig.json` exists; only `tsconfig.base.json` (verified by `ls tsconfig*.json`).
  - Root `package.json:12` → `"typecheck": "turbo run typecheck"`; every workspace package's typecheck is `tsc -p tsconfig.json --noEmit` scoped to its own dir (15/15 packages checked). No package tsconfig references `scripts` (grep over `apps/*/tsconfig.json packages/*/tsconfig.json` → 0 hits).
  - `package.json:16` → `"acceptance:report": "tsx scripts/acceptance-report/verify.ts"` — `tsx` transpiles, does not typecheck.
  - `package.json:15` → `"lint": "eslint apps/admin apps/lms"` — `scripts/` is unlinted too.
- **Suggested fix:** Add a `scripts/tsconfig.json` + a workspace entry (or a root `typecheck:scripts` script wired into `turbo`/CI) as an explicit Phase 1 step, and re-run the falsification test against *that* command. Until then the plan should not claim `pnpm typecheck` as its enforcement surface.

---

## Finding 3: The Phase 1 assertion is structurally blind to F1 and F2 — the two bugs that justify the whole plan

- **Severity:** Critical
- **Location:** Phase 1, "Requirements → Functional" (the two-way assertion); plan.md F1/F2 row mapping to Phase 2
- **Flaw:** The assertion operates on `flow.expected.trpc` — procedures the manifest *declares*. The F1/F2 deadlocks are **transitive UI dependencies** that the manifest does not declare. So the assertion would have reported both flows clean before the bug and will report them clean after the fix. It cannot regress-guard the class of defect it was built for.
- **Failure scenario:** Phase 2 fixes `class.read`. Six months later someone re-gates `classBatch.list` behind a write permission, or a new screen adds a query the manifest doesn't list. `pnpm acceptance:report` stays green; P1-02 stays `built`; the flow is dead again and no gate notices. The plan closes the `super_admin` hole but leaves the *manifest-completeness* hole wide open — and it is the wider one.
- **Evidence:**
  - `flow-manifest.ts:48` — P1-02 `trpc: ['finance.receiptCreate']`, one procedure. `finance.receiptCreate: ['giam_doc_kinh_doanh','sale']` (`packages/auth/src/index.ts:64`) → actor `sale` matches → **flow passes the assertion today**, while F1 is live.
  - The actual blocker is not in the manifest: `apps/admin/src/pages/finance/receipt-create.tsx:109` → `trpc.classBatch.list.useQuery({ pageSize: 100 })`; `apps/api/src/class/class-batch-router.ts:229` → `list: requirePermission('class','create')`; `class.create: ['giam_doc_dao_tao']` (`packages/auth/src/index.ts:84`).
  - Same for P2-07: `apps/admin/src/pages/teaching/session-assessment.tsx:45,49,53` call `classBatch.list`, `classSession.list`, `classBatch.listStudents` — none appear in P2-07's `trpc` list (`flow-manifest.ts:258-264`), which contains only `assessment.*` + `reportCard.getForChild`.
- **Suggested fix:** Either (a) add a scanner pass that extracts `trpc.<ns>.<proc>` call sites from each flow's `uiRoutes` page files and folds them into the flow's effective procedure set — this is the only version of the assertion that could have caught F1 — or (b) drop the claim that Phase 1 prevents recurrence and state plainly that Phase 4's role-true e2e is the only F1/F2 regression guard.

---

## Finding 4: Four flows declare `nhan_vien`, not three — P3-02 has no assigned fix

- **Severity:** High
- **Location:** Phase 1, "Implementation Steps" step 3; plan.md F6; plan.md open question #2
- **Flaw:** The plan enumerates three `nhan_vien` flows (P3-01, P4-01, P4-03) and derives a replacement actor set for each. There are four. `P3-02` is missed in every list, including the PO question that asks for confirmation of the derived actors.
- **Failure scenario:** Implementer applies the three named fixes, then hits a fourth compile/report error with no pre-agreed replacement and no PO sign-off. They improvise an actor set for a flow that touches manual attendance-ticket approval — a payroll-adjacent surface — without the review the other three got.
- **Evidence:** `scripts/acceptance-report/flow-manifest.ts:297` (P3-01), **`:308` (P3-02, `actorRoles: ['nhan_vien','giam_doc_kinh_doanh','giam_doc_dao_tao']`)**, `:433` (P4-01), `:457` (P4-03). Grep `grep -n "nhan_vien" scripts/acceptance-report/flow-manifest.ts` → 4 hits.
- **Suggested fix:** Add P3-02 to step 3 and to plan.md question #2. Its two remaining actors already cover `manualPunch.approve`, so the likely resolution is deleting `'nhan_vien'` outright — but that is a PO call, not an implementer's.

---

## Finding 5: 27 manifest procedures are ungated by design; the assertion has no defined semantics for them

- **Severity:** High
- **Location:** Phase 1, "Requirements → Functional" and "Architecture" diagram (`requirePermission()` → `"ns.proc" → permission`)
- **Flaw:** The architecture diagram assumes every procedure resolves to a permission key. It does not. Three procedure builders bypass the registry entirely, and 27 procedures across 14 flows use them. The plan never says what `permission-scanner.ts` should emit for them, so the implementer will pick one of two wrong answers: treat them as orphans (12+ false positives on deliberately self-service/LMS procedures) or treat them as universally callable (the assertion silently stops covering 27 procedures — vacuous where it matters most, since LMS surfaces are exactly where trust boundaries live).
- **Failure scenario:** Implementer chooses "ungated ⇒ callable by anyone" for expedience. `lmsAuth.requestOtp` / `verifyOtp` (`publicProcedure`) and every `lmsProcedure` count as satisfied for all actors. P1-07 passes with zero real verification. Phase 1's liveness guard ("scanner ra 0 permission → ném lỗi") does not catch this because the scanner *does* return permissions — just not for these.
- **Evidence:**
  - `apps/api/src/trpc.ts:240-244` — `lmsProcedure = basedProcedure.use(requireLmsSession)`, comment: *"Deliberately does NOT check `can()`"*.
  - Builder usage across `apps/api/src`: `lmsProcedure` ×38, `protectedProcedure` ×26, `publicProcedure` ×13 vs `requirePermission` ×149.
  - Deliberately ungated by ADR, per `packages/auth/src/index.ts:99-102`: *"`manualPunch.resubmit` uses an owner check instead of a permission key (protectedProcedure), same posture as `shift.cancel`"*.
  - Recomputed ungated-in-manifest set (27 procs / 14 flows): P1-06 `guardian.requestLink`; P1-07 `lmsAuth.requestOtp|verifyOtp`, `enrollment.mine`; P2-02 `attendance.listForChild`; P2-03 `exercise.openForStudent|listForStudent`; P2-05 `submission.saveDraft|submit|listForChild`; P2-07 `assessment.listForChild`, `reportCard.getForChild`; P2-08 `sessionEvidence.listForChild`, `guardian.setPhotoConsent`; P3-02 `manualPunch.resubmit|list`; P3-03 `shift.listGroups|myRegistrations|cancel`; P3-05 `payslip.my|getForUser`; P3-06 `kpi.myScore|list`; P4-01 `rewards.redeem|listForStudent`; P4-02 `gift.listForStudent`; ADM-05 `shift.listGroups`.
- **Suggested fix:** Make the scanner emit a three-valued gate (`permission` | `owner-check` | `lms-session` | `public`) and specify the assertion per class in Phase 1 *before* implementation. Owner-check and LMS procedures should be excluded from ORPHAN-PROC with a machine-readable reason, not hand-listed.

---

## Finding 6: `trpc.ts:214` is the wrong citation for the registry bypass — and the plan mandates baking it into a user-facing error message

- **Severity:** High
- **Location:** plan.md Overview (line 25) and "Môi trường & cạm bẫy" (line 91); Phase 1 Architecture (line 42); Phase 5 step 3
- **Flaw:** `apps/api/src/trpc.ts:214` is inside `requireValidFacility` — it is the *facility-validation* bypass, not the permission-registry bypass. The registry bypass is `packages/auth/src/index.ts:147`. The plan repeats the wrong citation four times, and Phase 5 step 3 instructs the implementer to put it in the guard's failure message: *"Thông báo lỗi nêu rõ: `super_admin` bypass registry (`trpc.ts:214`)"*.
- **Failure scenario:** The guard ships. An engineer hits it, opens `trpc.ts:214`, finds a middleware about `Facility` row lookups, concludes the error message is stale or wrong, and either suppresses the guard or files a bogus bug. A gate whose explanation does not survive a click is a gate people turn off — Phase 5's own risk row "Fail oan làm team tắt gate".
- **Evidence:**
  - `apps/api/src/trpc.ts:214` → `if (ctx.subject?.roles.includes('super_admin')) { return next(); }` inside `const requireValidFacility = t.middleware(...)` (`trpc.ts:210`), documented at `trpc.ts:200-208` as the first-facility bootstrap exemption.
  - `packages/auth/src/index.ts:147` → `if (subject.roles.includes('super_admin')) return true;` inside `can()`, documented at `:139` as *"`super_admin` bypasses everything"*.
- **Suggested fix:** Global replace the citation to `packages/auth/src/index.ts:147` across plan.md, phase-01, phase-05. Keep `trpc.ts:214` only where the plan discusses facility bootstrap (Phase 5's `global-setup.ts` exemption row, where it is actually the correct reference).

---

## Finding 7: The claimed CI precedent does not exist, and no phase touches the file that would make any gate blocking

- **Severity:** High
- **Location:** Phase 5, "Overview" ("Đã có tiền lệ trong repo: plan `260720-1230` cấm `x-dev-user` trong spec bằng guard grep = 0") and step 5 / "Related Code Files"; plan.md AC bullets 2 and 6
- **Flaw:** Two compounding problems. (a) The cited precedent is not in the repo — there is no grep guard for `x-dev-user` in `scripts/`, `package.json`, or `.github/`, on `main` or on the runtime-verification branch. The plan's "áp đúng mẫu ấy" has no mẫu to copy. (b) The wiring the plan proposes cannot make anything blocking: `pnpm test` excludes the e2e package, `ci.yml` never runs `acceptance:report` or `lint`, and no phase lists `.github/workflows/ci.yml` among files to modify.
- **Failure scenario:** Guard script is written, added as a root `package.json` script, and never runs. `pnpm test` = `turbo run test --filter=!@cmc/e2e` does not pick up a root-level script, and CI runs only typecheck + test + one coverage threshold. Both plan-level acceptance criteria that say a check must "fail (exit ≠ 0)" / "CI chặn được" are satisfied on paper and dead in practice — the plan reproduces its own diagnosed failure mode one layer up.
- **Evidence:**
  - `grep -rln "x-dev-user" scripts/ package.json .github/` → no matches. `ls scripts/*.mjs scripts/*.ts` → only `seed-super-admin.ts`, `verify-repository-portability.mjs`. Same grep on the branch matches only `apps/e2e/src/session-injection.ts`, `apps/e2e/src/trpc-client.ts`, `apps/e2e/tests/admin-shell.ui.spec.ts` — i.e. *usages*, no guard.
  - `package.json:13` → `"test": "turbo run test --filter=!@cmc/e2e"`.
  - `.github/workflows/ci.yml` steps: install, migrate, set role password, write .env, **Typecheck**, **Test**, coverage threshold; second job: install, migrate, set role password, write .env, build, **Run e2e**. No `acceptance:report`, no `lint`, no guard.
- **Suggested fix:** Delete the false precedent claim. Add `.github/workflows/ci.yml` to Phase 1 and Phase 5 "Related Code Files" with explicit steps (`pnpm acceptance:report`, guard script), and add a typecheck step covering `scripts/` (see Finding 2). Resolve plan.md question #3 (block vs warn) *before* Phase 5, since it determines whether the step is `continue-on-error`.

---

## Finding 8: Phase 6's "auth per-flow từ actorRoles" has three unstated blockers

- **Severity:** High
- **Location:** Phase 6, "Implementation Steps" step 3 and Success Criteria bullet 2; Phase 5 "Related Code Files" (`Read-only: flow-manifest.ts — nguồn actor hợp lệ per flow`)
- **Flaw:** Both phases assume `apps/e2e` can read `actorRoles` from the manifest and mint a session for whatever it finds. None of the three prerequisites hold: (a) `actorRoles` currently has **zero consumers** — it is written and never read, so there is no existing wiring to extend; (b) `scripts/` is outside the pnpm workspace and `apps/e2e/tsconfig.json` includes only `["src","tests","playwright.config.ts"]`, so the import crosses a package boundary that has never been crossed; (c) for 13 of the flows there is no staff cookie to mint at all.
- **Failure scenario:** Implementer reaches step 3, tries `import { flows } from '../../../scripts/acceptance-report/flow-manifest.js'`, hits module-resolution/rootDir friction, and takes the fast path: hardcodes a flow→role table inside the spec. Now there are two sources of actor truth that drift — exactly the condition that produced the `nhan_vien` phantom role. Separately, step 3 says "Flow `ADM-*` giữ `super_admin` hợp lệ" and stops there: it never says what to mint for the four `he_thong` flows (not a role; no session exists; P1-04/P3-10/P3-11 declare `trpc: []` and `uiRoutes: []`) or for the four `phu_huynh`/`hoc_vien` flows, which need `mintParentToken`/`mintStudentToken`, not `mintStaffCookie`.
- **Evidence:**
  - `grep -rn "actorRoles" scripts/ apps/` → single hit outside the manifest: `scripts/acceptance-report/types.ts:13`. No reader anywhere.
  - `pnpm-workspace.yaml` → `apps/*`, `packages/*`. `apps/e2e/tsconfig.json` → `"include": ["src","tests","playwright.config.ts"]`.
  - `apps/e2e/src/session-injection.ts` exports `mintParentToken:41`, `mintStudentToken:61`, `mintStaffCookie:141` — three distinct session kinds; Phase 6 mentions only the staff one.
  - `flow-manifest.ts:70-77` (P1-04) and `:404-414` (P3-10) → `trpc: []`, `uiRoutes: []`, models-only, `actorRoles: ['he_thong']`. The branch's `runtime-evidence.json` nonetheless carries entries for all 38 ids including P1-04/P3-10/P3-11 — so "cấp lại proven cho mọi flow" is not achievable by session-minting for these.
- **Suggested fix:** Add an explicit step: expose the flow→actor map through a real module boundary (e.g. a tiny `packages/flow-manifest` or a generated JSON committed next to `runtime-evidence.json`) rather than a cross-boundary relative import. Extend step 3 with a per-actor-class session table (staff cookie / parent token / student token / **no session — evidence must come from an API-side spec, not a UI capture**).

---

## Finding 9: Phase 3's placeholder rule and its 46-route target are both calibrated to wrong numbers

- **Severity:** Medium
- **Location:** Phase 3, "Test / Validation" bullet 3 and "Architecture → Nhận diện placeholder"
- **Flaw:** The acceptance target is "xấp xỉ tổng số `path:` entry (46)". The existing scanner already resolves **57** routes, and there are **61** `path:` string literals. An implementer who lands on 46 would have *lost* 11 routes relative to today and still declared success. Separately, the placeholder heuristic keys on the string `"Tính năng chưa áp dụng"`, which misses the second placeholder family in the codebase: `ComingSoon`, which renders *"Đang phát triển"* and is used as an **inline JSX element inside the route file** with no page file to resolve to.
- **Failure scenario:** (a) Scanner regression goes unnoticed because the target number is below the current baseline, and a placeholder screen slips through as `built` — the precise F7 recurrence Phase 3 exists to prevent. (b) A future flow claims `/hr`, `/ops`, or `/admin`; those routes resolve to `element: <ComingSoon />` declared in the routes file itself. The detector either finds no page file (silent skip) or finds one that does not contain the tracked string, and the flow is scored `built`.
- **Evidence:**
  - Ran the current scanner: `scanUiRoutes()` → **57** routes. `grep -rc "path: '"` over `apps/admin/src/routes apps/lms/src/routes` → **61**.
  - Placeholder string appears in exactly 2 page files — `apps/admin/src/pages/finance/refund.tsx:23`, `apps/admin/src/pages/engagement/leaderboard.tsx:19` — plus 4 test files asserting presence/absence. No legitimate screen uses it as an ordinary empty state, so the *rule* is sound; the *coverage* is not.
  - Second family: `apps/admin/src/pages/coming-soon.tsx:3` renders `"Đang phát triển"` / `"Tính năng này sẽ ra mắt trong phiên bản tiếp theo."`; used as a route element at `admin.routes.tsx:50`, `hr.routes.tsx:17`, `ops.routes.tsx:13`, `index.tsx:49`, and as the `Suspense` fallback in all five route files.
  - Currently latent only: no manifest `uiRoute` equals `/admin`, `/hr`, `/ops`, or `/admin/engagement/leaderboard` (grep → 0).
  - Plan's premise about the existing scanner is otherwise **accurate**: `route-scanner.ts` uses ts-morph and follows the import graph (`:81` `resolveImportedRouteArray`) but reads only `path`/`index`/`children` — it never touches `element` (no occurrence of `element` in the file).
- **Suggested fix:** Set the route-resolution floor to the measured baseline (≥57) and assert it, rather than an approximate literal. Detect *both* placeholder families, and handle the case where the route element is inline JSX rather than a lazily-imported page.

---

## Finding 10: Phase 4's "tiền đề nghiệp vụ vs bắc cầu" boundary is not mechanically checkable, and the plan's own guard doesn't cover it

- **Severity:** Medium
- **Location:** Phase 4, "Architecture" (the beforeAll-vs-variable rule, called "hạt nhân của cả plan") + Success Criteria bullet 5; Phase 5 scope
- **Flaw:** The rule is real and correct in spirit, but the plan enforces it with "Grep tự kiểm" (Phase 4 Test bullet 2) — a manual step with no defined pattern — and Phase 5's automated guard only detects `super_admin`, not id-bridging. The one genuinely mechanical check offered (revert `class.read`, expect red) proves the spec *touches* `class.read`; it does not prove the spec never receives an id from another role's client. A spec can satisfy the falsification test and still bridge on a second id.
- **Failure scenario:** Phase 4 ships with the boundary honored. Six weeks later someone debugging a flaky spec adds `const sessionId = (await gddt.classSession.list.query(...))[0].id` above the teacher's block to stabilize it. The falsification test still goes red (the sale/teacher path still calls `classBatch.list`), the super_admin guard still passes, and the spec is quietly back to proving nothing about `giao_vien`'s reachability. Phase 4's own risk row "Ranh giới bị nới dần thành bắc cầu" is mitigated only by "viết rõ quy tắc trong comment" plus a deferral to Phase 5, which does not in fact cover it.
- **Evidence:**
  - Anti-pattern confirmed on main: `apps/e2e/tests/enrollment.spec.ts:45` `const classBatch = await gddt.classBatch.create.mutate({...})` → `:65-66` `await sale.finance.receiptCreate.mutate({ opportunityId: opportunity.id, ... })`, with the batch id carried in test scope.
  - Phase 5's guard scope, as written, is `super_admin` only — Requirements: *"Guard phát hiện `super_admin` trong spec thuộc luồng nghiệp vụ và fail"*. No bridging rule.
  - The branch spec already mixes actors this way: `flow-ui-routes.ui.spec.ts` `beforeAll` mints `roles: ['sale']` to create `opportunityId`, then `beforeEach` mints `roles: ['super_admin']` for the browser context — one file, two identities, ids crossing between them.
- **Suggested fix:** Make the rule checkable or drop the claim that it is enforced. A tractable mechanical form: within the three new spec files, require that every mutation input id originates from a call made through the *same* client identifier (an AST rule over `apps/e2e/tests/p*-role-true-*.spec.ts` is ~50 lines with ts-morph, which the plan already mandates elsewhere). Otherwise state explicitly that this boundary is convention-enforced and re-reviewed at Phase 6.

---

## Verification Results

**1. Actor strings actually used across all 38 flows — union completeness: VERIFIED (union is complete), with a caveat**

Ten distinct strings appear in `flow-manifest.ts`: `agent`, `giam_doc_dao_tao`, `giam_doc_kinh_doanh`, `giao_vien`, `he_thong`, `hoc_vien`, `nhan_vien`, `phu_huynh`, `sale`, `super_admin`. The proposed `FlowActor = Role | 'phu_huynh' | 'hoc_vien' | 'he_thong' | 'agent'` covers all ten except `nhan_vien`, which is the intended rejection. **Not a Critical.** Two caveats: (a) the union uses `Role` (9 values) rather than `ActiveRole` (5) — `ke_toan`, `cskh`, `ctv_mkt`, `hr` would typecheck as valid actors despite holding zero permissions (`packages/auth/src/index.ts:10-33`, ADR-D comment at `:24-26`), so the contract admits four dead actors; (b) four flows declare `nhan_vien`, not three — see Finding 4.

**2. "Every procedure has ≥1 actor" is meaningful — FAILED**

27 manifest-declared procedures across 14 flows are gated by `lmsProcedure` / `publicProcedure` / `protectedProcedure`, none of which consult the registry (`apps/api/src/trpc.ts:240-244`). Repo-wide: `lmsProcedure` ×38, `protectedProcedure` ×26, `publicProcedure` ×13 against `requirePermission` ×149. Several are ungated *by ADR decision* (owner checks — `packages/auth/src/index.ts:99-102`). The plan defines no semantics for this class; depending on the implementer's choice the assertion is either heavily false-positive or vacuous over exactly the LMS trust boundary. Full list in Finding 5.

**3. "7/38 flows violate actor↔permission" — FAILED**

Independent recomputation: **19/38 violate**, of which **16 have zero computable staff actor**. Flow-by-flow output is reproducible with the script cited at the top. Two violations not named anywhere in the plan: `P4-04` (IDLE-ACTOR `giao_vien`) and `P3-02` (fourth `nhan_vien` flow). See Finding 1.

**4. Prototype "13/40" and route-scanner capability — VERIFIED (scanner claim) / FAILED (the 46 target)**

The plan's description of `scanners/route-scanner.ts` is accurate: it is ts-morph based, it does follow the import graph (`resolveImportedRouteArray:86-110`, including the `.js`→`.tsx` specifier rewrite at `:103`), and it has **no component tracking whatsoever** — the word `element` does not appear in the file; it reads only `path`, `index`, `children`. So "dừng ở đường dẫn" is correct and ts-morph extension is the right call. The "13/40" prototype figure is a brainstorm-session artifact I could not reproduce and did not attempt to. The verifiable defect is the Phase 3 target: actual baseline is 57 resolved routes / 61 `path:` literals, not 46 (Finding 9).

**5. "Tính năng chưa áp dụng" prevalence and false positives — VERIFIED**

Exactly two page components contain it: `apps/admin/src/pages/finance/refund.tsx:23` and `apps/admin/src/pages/engagement/leaderboard.tsx:19`. Both are genuine placeholders — neither declares a `trpc.*.useMutation`, so the plan's dual condition holds. Four test files reference the string (two asserting presence, two asserting absence after real builds: `crm/aftersale.test.tsx:114`, `crm/post-sale-meeting.test.tsx:124`) — confirming the plan's note that `post-sale-meeting`/`aftersale` are no longer placeholders. **No legitimate screen uses it as an ordinary empty state.** The gap is the second placeholder family (`ComingSoon`), not a false positive on this one.

**6. "beforeAll GĐĐT tạo lớp" vs "passing id via variable" — UNVERIFIED as an enforceable distinction**

The distinction is conceptually sound and the falsification test (revert `class.read` → specs must go red) is genuine evidence that the flow traverses the permission being tested. But it is not sufficient: it proves the tested path touches `class.read`, not that no *other* id crossed a role boundary. The plan's stated enforcement is a manual grep with no defined pattern, and Phase 5's automated guard is scoped to `super_admin` only. As written this is convention, not a gate. See Finding 10.

**7. P1-02 and P2-07 are broken — VERIFIED (both), and F4 as well**

- P1-02: `receipt-create.tsx:109` calls `trpc.classBatch.list`; `class-batch-router.ts:229` gates it on `class.create`; `class.create: ['giam_doc_dao_tao']` (`packages/auth/src/index.ts:84`). `sale` holds `finance.receiptCreate` (`:64`) but cannot list a class batch → cannot complete the flow through the UI. Confirmed.
- P2-07: `session-assessment.tsx:45,49,53` call `classBatch.list`, `classSession.list` (`class-session-router.ts:84` → `class.create`), `classBatch.listStudents` (`class-batch-router.ts:254` → `class.create`). `giao_vien` holds `assessment.draft`/`confirm` (`:92-93`) but cannot reach a class. Confirmed — three blocked queries, matching the plan's "3 query".
- F4 (P3-05): `apps/admin/src/pages/hr/payroll.tsx:414` → `trpc.user.list.useQuery()` unconditional in the page body; `apps/api/src/user/router.ts:129` → `list: requirePermission('user','manage')`; `user.manage: []` (`packages/auth/src/index.ts:96`) = super_admin-only. Confirmed. The 4 fields cited by the plan for option (b) are exactly `payroll.tsx:416-420` (`id`, `fullName`, `employeeCode`, `position`) — recommendation (b) is well-founded.
- The `class-batch-router.ts:112-114` comment the plan quotes is verbatim accurate (present at those exact lines), and six procedures depend on `class.create` as the plan's table states, at the exact lines given (`:115, :229, :254, :283, :300` and `class-session-router.ts:84`). Phase 2's diagnosis is the strongest-evidenced part of the plan.

---

## Unresolved questions

1. What is the intended assertion semantics for flows whose entire actor set is outside the staff registry (`he_thong` ×4, LMS subjects ×4, `super_admin` ×5)? Thirteen flows cannot be triaged one exception line at a time without the exception list becoming the report.
2. Does the PO accept adding `scripts/` to the typecheck surface as in-scope for Phase 1? Without it the plan's primary enforcement mechanism does not exist.
3. Is Phase 1 intended to prevent F1/F2 recurrence? If yes, the manifest must model UI→procedure dependencies (Finding 3) and that is a materially larger Phase 1. If no, plan.md's framing should say so.
4. Should `FlowActor` be built on `ActiveRole` rather than `Role`? Given the locked "5 real roles" direction, admitting `ke_toan`/`cskh`/`ctv_mkt`/`hr` as typecheck-valid actors reopens the phantom-role hole the plan is closing.

---

Status: DONE_WITH_CONCERNS
Summary: Phase 2's diagnosis is solidly evidenced and Phase 3's read of the existing route scanner is accurate, but three load-bearing assumptions fail against the codebase — `pnpm typecheck` does not cover `scripts/` at all, the actor↔permission violation count is 19 (16 structurally unsatisfiable) rather than 7, and the Phase 1 assertion cannot see the F1/F2 defects that motivate the plan.
Concerns/Blockers: Findings 1, 2, and 3 are blocking; each independently prevents a stated acceptance criterion from being achievable as written. Findings 6 and 7 (wrong `trpc.ts:214` citation, non-existent CI guard precedent) mean the plan is citing evidence that does not support it — worth correcting before the plan is used as a reference by implementers.
