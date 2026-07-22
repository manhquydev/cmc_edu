# Red Team — Scope & Complexity Critic (Contract Verifier)

Plan under review: `plans/260722-0908-acceptance-role-true-evidence/`
Reviewer role: YAGNI enforcer / scope critic. Verification method: caller enumeration by grep.
Date: 2026-07-22. Branch reviewed: `main` @ 4237cb5 + `test/independent-runtime-verification-38-flows`.

Bottom line: the plan's founding factual claim — that the 35 `proven` labels were captured with
`super_admin` — is **false as stated**. All 38 evidence owners are role-true API specs. That single
error propagates into D4, Phase 5, and Phase 6, and it is the justification for roughly half the
plan's work.

---

## Finding 1: The plan's headline evidence claim is factually wrong — 35 `proven` labels were NOT captured with `super_admin`

- **Severity:** Critical
- **Location:** `plan.md` Overview (line 25) and D4 (line 40); `phase-05` Overview (line 13); `phase-06` Overview (line 13) + Implementation Steps 2 and 6
- **Flaw:** The plan states "35 proven — nhưng `flow-ui-routes.ui.spec.ts:52-55` chụp **mọi** luồng bằng `roles: ['super_admin']`" and Phase 6 escalates to "mọi nhãn `proven` đều thu bằng `super_admin` nên vô giá trị". The branch does not work this way. `prove-flow.ts` exports two distinct annotations: `proveFlow(id)` = flow **owner** (primary evidence) and `proveFlowEvidence(id)` = **supplemental** UI artifact, explicitly documented as "Adds supplemental UI/artifact evidence without claiming a second flow owner." `flow-ui-routes.ui.spec.ts` — the only spec with `super_admin` — uses `proveFlowEvidence` exclusively. Every one of the 38 flow entries in `runtime-evidence.json` has an `owner` pointing at an API runtime-proof spec, and those specs contain **zero** occurrences of `super_admin`.
- **Failure scenario:** Phase 6 step 2 wipes `runtime-evidence.json` and step 6 re-runs the entire e2e suite to "cấp lại từ đầu", with the plan pre-announcing that the count will drop below 35 and framing that drop as a success signal. In reality the drop would be an artifact of discarding valid role-true evidence, then re-earning it. Hours of e2e re-runs and a demoralising "we went backwards" report to the PO, both caused by a misread of the branch. The plan also mis-teaches the PO: the 260717-1213 plan has already had this false claim written into it (`plans/260717-1213-so-nghiem-thu-song/plan.md:31`).
- **Evidence:**
  - `apps/e2e/src/prove-flow.ts` (branch) lines 1-38 — `proveFlow` emits `type: 'flow'`; `proveFlowEvidence` emits `type: 'flow-evidence'`, comment: "without claiming a second flow owner"
  - `apps/e2e/tests/flow-ui-routes.ui.spec.ts:52-58` (branch) — the `super_admin` `beforeEach`; all 33 tests in the file call `proveFlowEvidence`, e.g. `:63`, `:65`, `:67`
  - `super_admin` occurrence counts across all 18 branch e2e specs: `adm-runtime-proofs.spec.ts` = 5 (legitimate ADM actor), `flow-ui-routes.ui.spec.ts` = 1, **every other spec = 0** — including `p1/p2/p3/p4-runtime-proofs.spec.ts`
  - `acceptance-report/runtime-evidence.json` (branch): 38 flows, 35 proven / 3 blocked; `owner` field = an API spec for **38/38** flows, 0 owned by `flow-ui-routes.ui.spec.ts`. Example `P1-02.owner` = `apps/e2e/tests/p1-runtime-proofs.spec.ts > receipt creation returns a draft receipt linked to the opportunity`
  - `apps/e2e/tests/p1-runtime-proofs.spec.ts:18,49,112,119,160,226,276` — role-true clients (`giam_doc_dao_tao`, `sale`, `giam_doc_kinh_doanh`)
- **Suggested fix:** Rewrite the premise before executing anything. The defensible claim is narrower: *supplemental UI screenshots were captured as `super_admin`, so "the screen renders" was never proven for the real actor.* The proportionate fix is one `beforeEach` in one file (Phase 6 step 3) plus a re-run of the `ui-chromium` project only. Delete D4's "xoá sạch nhãn proven cũ" and Phase 6 step 2 entirely; API-owned evidence is valid and re-earning it buys nothing.

---

## Finding 2: Phase 5's gate blocks the mechanism that did not cause the problem, and never builds the one that did

- **Severity:** Critical
- **Location:** Phase 5 (whole phase), and the promise in `phase-04` Risk Assessment row 2 ("Phase 5 biến nó thành gate tự động")
- **Flaw:** The genuine role-blindness in the branch is **data bridging**: a privileged client creates an object, and the role under test receives its id through a JavaScript variable rather than through its own API. Phase 4 correctly identifies this as "hạt nhân của cả plan" (line 49) and then defers automation of the rule to Phase 5 (risk row 2). Phase 5 never implements it — it bans the string `super_admin` and nothing else. A guard that only bans `super_admin` scores the branch's most misleading spec as clean.
- **Failure scenario:** After Phase 5 lands, an agent writes exactly the pattern that is already in the repo: `const classBatchId = await createClass(gddtId)` followed by `sale.finance.receiptCreate.mutate({ classBatchId })`. Zero `super_admin`, guard green, `proveFlow('P1-02')` emits `proven`, and the flow is still unusable by any real sale rep. That is precisely how F1 hid for two weeks. Phase 5 costs a new script, a whitelist with liveness guards, a CI wiring decision escalated to the PO, and optionally a runtime guard in `mintStaffCookie` — and stops none of it.
- **Evidence:**
  - `apps/e2e/tests/p1-runtime-proofs.spec.ts:14-32` — `createClass()` mints a `giam_doc_dao_tao` client and returns `batch.classBatch.id`
  - `apps/e2e/tests/p1-runtime-proofs.spec.ts:49-57` — `createDraftReceipt()` builds a `sale` client, calls `createClass(opts.gddtId)`, then passes the id straight into `sale.finance.receiptCreate.mutate`. This file contains 0 `super_admin`.
  - `apps/e2e/tests/enrollment.spec.ts:45,71` — the same bridge on `main`, which the plan itself cites as the antipattern
  - `phase-04-role-true-e2e-cho-luong-gay.md:76` leaves bridging detection as a manual "Grep tự kiểm"
- **Suggested fix:** Drop the `super_admin` grep gate to a 5-line addition inside the existing e2e lint/test step (it is a one-line regex over `apps/e2e/tests/**`, not a phase). Spend the phase budget instead on the bridging rule, which is mechanically checkable: within a `test()` body, an identifier assigned from client A's result must not appear in an argument to client B's mutation. If that is too costly, state honestly that bridging stays a review-time rule and delete Phase 5's runtime-guard option — do not ship a gate whose main value is that it looks like one.

---

## Finding 3: The one production-blocking bug is sequenced behind tooling it does not need

- **Severity:** Critical
- **Location:** `phase-02-permission-fixes-class-read-payroll.md` frontmatter `dependencies: [1]`; `plan.md` "Thứ tự phụ thuộc: 1 → 2 → 4 → 5 → 6"
- **Flaw:** Phase 2 fixes a live defect — no business role can create a tuition receipt, because `classBatch.list` is gated on `class.create`, which only `giam_doc_dao_tao` holds, and `giam_doc_dao_tao` is deliberately denied `finance.receiptCreate` by ADR-B. Nothing in Phase 2 consumes anything Phase 1 produces. Phase 2's seven implementation steps touch `packages/auth/src/index.ts`, the two class routers, the payroll surface, and docs; none reference `FlowActor`, `permission-scanner.ts`, or the manifest. The declared dependency is bookkeeping, not a real edge.
- **Failure scenario:** The revenue-entry path stays broken for the entire duration of Phase 1 — which includes writing a new ts-morph scanner, a union type migration, two falsification tests, and triage of 7 manifest violations. If Phase 1 stalls on the `FlowActor` union (Phase 1's own risk table rates that **Cao** and calls it "điểm dễ làm sai nhất của phase này"), a P1 money-flow bug is held hostage by acceptance tooling. Conversely, bundling them means the permission fix cannot be reviewed, tested, or reverted independently of ~3,000 lines of tooling.
- **Evidence:**
  - `apps/api/src/class/class-batch-router.ts:229` — `list: requirePermission('class', 'create')`
  - `packages/auth/src/index.ts:84` — `'class.create': ['giam_doc_dao_tao']`
  - `packages/auth/src/index.ts:64` — `'finance.receiptCreate': ['giam_doc_kinh_doanh', 'sale']` (GĐĐT absent by ADR-B, `:65-66`)
  - `apps/admin/src/pages/finance/receipt-create.tsx:109` — the create-receipt screen calls `trpc.classBatch.list.useQuery({ pageSize: 100 })` unconditionally
  - `phase-02` steps 1-7 contain no reference to any Phase 1 artifact
- **Suggested fix:** Ship Phase 2 as a standalone PR today, with its three negative-authz tests. Set `dependencies: []`. Renumber the rest. The MVP cut of this plan is Phase 2 alone; everything else is process improvement that can land at its own pace.

---

## Finding 4: The plan says three flows declare `nhan_vien`; there are four

- **Severity:** High
- **Location:** `plan.md` finding table row F6; `phase-01` Implementation Step 3; `plan.md` PO question #2
- **Flaw:** `flow-manifest.ts` declares `nhan_vien` in **four** flows. The plan enumerates three (P3-01, P4-01, P4-03) and misses **P3-02** ("Duyệt phiếu chấm công offsite"). Phase 1 step 2 deliberately makes `pnpm typecheck` red on `nhan_vien`, so the executor will hit a fourth compile error with no prescribed actor and no PO input.
- **Failure scenario:** Mid-execution, the agent invents an actor list for P3-02 to clear typecheck. P3-02 is an **approval** flow (`manualPunch.approve`, `manualPunch.reject`) — guessing its actor set silently encodes an authorization claim into the document the whole plan is trying to make authoritative. Exactly the failure mode the plan exists to prevent.
- **Evidence:**
  - `scripts/acceptance-report/flow-manifest.ts:297` (P3-01), **`:308` (P3-02, `['nhan_vien','giam_doc_kinh_doanh','giam_doc_dao_tao']`)**, `:433` (P4-01), `:457` (P4-03)
  - `scripts/acceptance-report/flow-manifest.ts:305-312` — P3-02 full entry
- **Suggested fix:** Correct the count to four everywhere, add P3-02 to PO question #2 with the derived actor set (`manualPunch.approve` → `['giam_doc_kinh_doanh','giam_doc_dao_tao']` per `packages/auth/src/index.ts:104`, plus whoever files the ticket), and note that `manualPunch.resubmit` has no permission key at all (see Finding 5).

---

## Finding 5: The actor↔permission assertion has no answer for the 20 procedures that carry no permission key

- **Severity:** High
- **Location:** `phase-01` Requirements ("mọi procedure của luồng có ≥1 actor gọi được") and Implementation Step 5's three-bucket triage
- **Flaw:** 20 procedures in `apps/api/src` are declared with `protectedProcedure`/`publicProcedure` and are authorized by owner checks or self-scoping, not by a registry key — a posture `packages/auth/src/index.ts:99-102` documents deliberately. The Phase 1 assertion maps `ns.proc → permission → roles`; for these the permission is `undefined`. Six of them are claimed by manifest flows, so the assertion will either throw or report them as ORPHAN-PROC. Step 5's triage has three buckets (fix manifest / push to Phase 2 / documented exception) and none of them fits "correctly authorized without a permission key".
- **Failure scenario:** `pnpm acceptance:report` starts failing on flows that are correct. The path of least resistance is to dump all six into the exception list — which is precisely the "biến ngoại lệ thành nơi giấu lỗi" risk Phase 1 lists at Trung bình, arriving on day one and at six entries. The alternative is that the executor discovers the gap mid-phase and redesigns the assertion under time pressure.
- **Evidence:** procedures with no `requirePermission`, claimed by manifest flows:
  - `apps/api/src/checkin/router.ts:368` `resubmit` → manifest `flow-manifest.ts` (`manualPunch.resubmit`, P3-02)
  - `apps/api/src/checkin/router.ts:398` `list` → `manualPunch.list`, P3-02
  - `apps/api/src/kpi/router.ts:417` `list`, `:461` `myScore` → both in manifest
  - `apps/api/src/shift/router.ts:372` `listGroups` (2 manifest refs), `:386` `myRegistrations`, `:426` `cancel` → all in manifest
  - `packages/auth/src/index.ts:99-102` — comment documenting that `manualPunch.resubmit` uses an owner check instead of a permission key, "same posture as `shift.cancel`"
  - Total `protectedProcedure`/`publicProcedure` declarations outside test files: 20
- **Suggested fix:** Add a fourth, first-class category to the model — "self-scoped / owner-checked, no registry key" — resolved from the procedure's declaration kind, not from a hand-maintained exception list. A procedure declared `protectedProcedure` is *by construction* callable by every authenticated actor, so it should satisfy the "≥1 actor can call it" assertion automatically.

---

## Finding 6: `permission-scanner.ts` re-implements traversal that already exists, justified by a precedent from a different problem

- **Severity:** High
- **Location:** `phase-01` Related Code Files ("Create: `scanners/permission-scanner.ts`") and Implementation Step 1; `plan.md` D5
- **Flaw:** D5 mandates a new ts-morph scanner handling `mergeRouters`, multi-router files, and off-pattern filenames — all of which `trpc-scanner.ts` already handles, and which it resolves down to the exact `ObjectLiteralExpression` for each namespace. Extracting the permission is then reading each property's initializer text. Separately, D5's ban on regex cites a prototype that resolved only 13/40 **screens** — that failure was about React route resolution (lazy `.js` specifiers, `<Suspense fallback>`), a genuinely hard AST problem. Permission extraction is not that problem: `requirePermission('module', 'action')` sits on the same line as the procedure name, with literal string arguments, in 117 of 118 call sites. The single exception is the function definition itself.
- **Failure scenario:** A day is spent re-deriving `resolveIdentifierToRouterObject`, `resolveModuleToTsFile`, and `mergeRouters` handling in a second file. When the router layout next changes, two scanners must be updated in lockstep; whichever is forgotten fails silently, which is the exact failure class this plan is chartered to eliminate.
- **Evidence:**
  - `scripts/acceptance-report/scanners/trpc-scanner.ts:74-90` (`resolveNamespaceProcedures`, incl. `mergeRouters`), `:104-131` (`resolveIdentifierToRouterObject`, alias- and `.js`-specifier aware), `:139-152` (`getObjectPropertyNames`) — the returned object literal is exactly where permissions live
  - `requirePermission(` call sites under `apps/api/src` excluding `trpc.ts`: **118**. Matching the one-line pattern `^\s*<name>: requirePermission('<mod>', '<act>')`: **117**. Non-literal argument sites: **1** — `apps/api/src/trpc.ts:250`, the definition
- **Suggested fix:** Extend `scanTrpcRouters()` to also return `Map<"ns.proc", "module.action">`, populated in the loop that already walks each router's properties. Roughly 15 lines, one file, one traversal, one place to break. Keep D5's liveness guard. Retire the separate `permission-scanner.ts`.

---

## Finding 7: Phase 3 rebuilds a capability the branch already ships, then Phase 6 merges over it

- **Severity:** High
- **Location:** `phase-03-placeholder-detection.md` (whole phase); `plan.md` phase ordering (3 parallel after 1; 6 last)
- **Flaw:** Phase 3 adds a static placeholder detector, a new `FlowStatus` value, and renderer changes across both HTML tabs. The branch Phase 6 merges already answers the same question at runtime and already got the right answer: `flow-ui-routes.ui.spec.ts` asserts `getByText('Tính năng chưa áp dụng')` has count 0, the branch adds a `RuntimeStatus` vocabulary that includes `blocked`, and `runtime-evidence.json` records **P1-08 as `blocked`, not `proven`** — the exact correction F7 asks for. Phase 3 therefore introduces a third status vocabulary (`FlowStatus` static, `RuntimeStatus` runtime, `AcceptanceState` presentation) for a distinction the second one already carries.
- **Failure scenario:** Phase 3 rewrites `templates/acceptance-tab.ts` and `types.ts` to render a new status. Phase 6 then merges a branch that changes those same two files (`acceptance-tab.ts` +54/-…, `types.ts` +20). The plan's own risk table rates the resulting conflict Trung bình and assigns "giải quyết xung đột thủ công" — a conflict entirely created by doing Phase 3 before Phase 6. Meanwhile the executor must reconcile whether `P1-08` is `ui-missing` (static) or `blocked` (runtime), and which one the acceptance tab shows.
- **Evidence:**
  - `apps/e2e/tests/flow-ui-routes.ui.spec.ts:30` (branch) — `await expect(page.getByText('Tính năng chưa áp dụng', { exact: true })).toHaveCount(0)`
  - `apps/e2e/tests/flow-ui-routes.ui.spec.ts:68-70` (branch) — `P1-08` test is explicitly skipped with reason "Blocked: /finance/refund is a declared Tính năng chưa áp dụng placeholder"
  - branch diff `scripts/acceptance-report/types.ts` — adds `RuntimeVerdict = 'proven' | 'blocked' | 'failed'` and `RuntimeStatus`
  - `runtime-evidence.json` (branch) — `P1-08.verdict = "blocked"`
  - `scripts/acceptance-report/templates/acceptance-tab.ts:17,23,28` — current `AcceptanceState` mapping, changed again by the branch
  - Confirmed still true on `main`: `apps/admin/src/pages/finance/refund.tsx:22-23` renders `EmptyState title="Tính năng chưa áp dụng"`, no `useMutation`
- **Suggested fix:** Move the branch merge first. Then re-evaluate whether a static detector is still worth building — its only advantage over the runtime check is that it works without a DB, which matters only if the report is meant to run in CI without e2e. State that requirement explicitly or cut the phase. If kept, extend `RuntimeStatus`/`blocked` rather than adding a fourth vocabulary to `FlowStatus`.

---

## Finding 8: Phase 2's blast radius is under-declared — 8 pages change behaviour, 2 broken screens are missing from the findings table

- **Severity:** Medium
- **Location:** `phase-02` Architecture (the 6-row procedure table) and Test/Validation ("UAT trình duyệt 3 màn")
- **Flaw:** The table enumerates the six procedures gated on `class.create` correctly, but the plan never enumerates the consumers. Eight production page components call the four procedures being re-gated; the UAT list covers three. Two of the uncovered ones — `/teaching/schedule` and `/teaching/session-evidence` — are nav entries with **no permission gate**, so every role sees them and every non-GĐĐT role currently gets a failed query. `session-evidence` is a `giao_vien` screen by design (`sessionEvidence.upsert` is teacher-only), making it a direct sibling of F2 that appears nowhere in the findings table. Separately, `/admin/classes` and `/admin/classes/:id` are also ungated in nav, so after the change `sale` and `giao_vien` gain a working class-detail screen including `classBatch.listStudents` (student roster). That may well be intended, but the plan never states it, and the risk table only considers over-granting on the *write* side.
- **Failure scenario:** Two outcomes, both bad. If the read grant is intended, the UAT misses two screens and the plan under-sells its own value — the fix repairs four broken screens, not three. If the roster exposure is not intended, it ships unreviewed because the review focus was directed at `class.create` and `assignTeacher`.
- **Evidence:** consumers of the four re-gated procedures (production code, excluding mocks):
  - `apps/admin/src/pages/classes/index.tsx:42`, `apps/admin/src/pages/cockpit.tsx:173`, `apps/admin/src/pages/enrollment/class-placement.tsx:52`, `apps/admin/src/pages/finance/receipt-create.tsx:109`, `apps/admin/src/pages/teaching/schedule.tsx:229`, `apps/admin/src/pages/teaching/session-assessment.tsx:45`, `apps/admin/src/pages/teaching/session-evidence.tsx:26` — `classBatch.list`
  - `apps/admin/src/pages/classes/class-detail.tsx:31,236` — `classBatch.get`
  - `apps/admin/src/pages/classes/class-detail.tsx:71`, `apps/admin/src/pages/teaching/session-assessment.tsx:53` — `classBatch.listStudents`
  - `apps/admin/src/pages/classes/class-detail.tsx:128,130,133`, `apps/admin/src/pages/teaching/session-assessment.tsx:49`, `apps/admin/src/pages/teaching/session-evidence.tsx:31` — `classSession.list`
  - Ungated nav entries: `apps/admin/src/shell/nav-registry.ts:19` (`/teaching/schedule`), `:22` (`/teaching/session-evidence`), `:36` (`/admin/classes`) — no `permission` property
  - `apps/admin/src/pages/cockpit.tsx:210` — `canDo('class', 'create')` gates the schedule widget; after the change this becomes a stale gate hiding data the role may now read. Not in the plan's modify list, and it is the same file the plan self-rejected as F3.
- **Suggested fix:** List all 8 consumers in Phase 2, add `/teaching/session-evidence` and `/teaching/schedule` to the findings table and the UAT list, state explicitly whether `sale`/`giao_vien` are meant to reach `/admin/classes/:id` and the student roster, and either update `cockpit.tsx:210` to `class.read` or record why it stays on `class.create`.

---

## Finding 9: The registry test file is absent from every phase, and it has no exhaustiveness assertion to catch the omission

- **Severity:** Medium
- **Location:** `phase-02` Related Code Files
- **Flaw:** `packages/auth/src/index.test.ts` maintains `ACTIVE_ROLE_MATRIX`, a hand-written table of 64 permission keys that drives an allow/deny assertion for all five active roles. Adding `class.read` without adding a matrix row will not fail any test — nothing asserts the matrix covers `Object.keys(PERMISSIONS)`; the identifier is referenced only at its declaration and at the loop that consumes it. The new permission would ship with zero role-level test coverage while `pnpm test` stays green.
- **Failure scenario:** Phase 2's success criterion "`class.create` vẫn chỉ GĐĐT (kiểm chứng bằng negative test)" is satisfied by the three e2e negative-authz probes, so nobody notices that the *positive* side of `class.read` — sale and giao_vien allowed, and no one else — has no unit assertion. A later edit widening `class.read` to a sixth role would pass CI unchallenged. That is the same silent-drift class the plan is chartered to close, reintroduced by the plan's own change.
- **Evidence:**
  - `packages/auth/src/index.test.ts:94` — `const ACTIVE_ROLE_MATRIX: Array<{ key: string; allowed: readonly string[] }> = [` … `:117` `{ key: 'class.create', allowed: ['giam_doc_dao_tao'] }` … ends `:156`
  - `packages/auth/src/index.test.ts:157` — the only other reference; no `Object.keys(PERMISSIONS)` cross-check
  - `packages/auth/src/index.test.ts:200` and `:215` — the two invariants that *do* iterate `PERMISSIONS` both pass automatically for a new key
  - Docs carrying the class permission matrix, only one of which the plan lists: `docs/14-danh-muc-vai-tro-phan-quyen.md:77` (listed), `docs/uat-checklist-go-live.md:297` (not listed), `docs/11-api-contract.md:82,87` (not listed). Note the four read procedures appear in **no** doc — grep for `classBatch.list|classBatch.get|classSession.list|listStudents` across `docs/` returns zero hits, so the "update docs/14 + spec P2-Foundation" step is adding new rows, not editing existing ones.
- **Suggested fix:** Add `packages/auth/src/index.test.ts` to Phase 2's file list with a `class.read` matrix row, and add a one-line invariant asserting `ACTIVE_ROLE_MATRIX` keys equal `Object.keys(PERMISSIONS)` so the next permission cannot land uncovered. Add `docs/uat-checklist-go-live.md:297` to the doc list.

---

## Verification Results — caller enumeration for the 4 re-gated procedures

Method: `grep -rn` across `apps/`, `packages/`, `scripts/` for `*.ts` and `*.tsx`. `apps/e2e` searched separately for `classBatch|classSession`.

### `classBatch.list` — 7 production call sites, 4 mocked test files, 1 API test, 1 manifest entry

| Kind | Location |
|---|---|
| production | `apps/admin/src/pages/classes/index.tsx:42` |
| production | `apps/admin/src/pages/cockpit.tsx:173` |
| production | `apps/admin/src/pages/enrollment/class-placement.tsx:52` |
| production | `apps/admin/src/pages/finance/receipt-create.tsx:109` |
| production | `apps/admin/src/pages/teaching/schedule.tsx:229` |
| production | `apps/admin/src/pages/teaching/session-assessment.tsx:45` |
| production | `apps/admin/src/pages/teaching/session-evidence.tsx:26` |
| API test | `apps/api/src/class/generate-sessions.test.ts:369` (cross-facility RLS negative, caller is `giam_doc_dao_tao` — unaffected) |
| mock | `apps/admin/src/pages/finance/receipt-create.test.tsx:64` (+ assertions `:131`) |
| mock | `apps/admin/src/pages/teaching/schedule.test.tsx:46` (+ assertions `:69,74,79,89`) |
| mock | `apps/admin/src/pages/teaching/session-assessment.test.tsx:41` |
| mock | `apps/admin/src/pages/teaching/session-evidence.test.tsx:32` (+ assertions `:82,215`) |
| manifest | `scripts/acceptance-report/flow-manifest.ts:171` |

### `classBatch.get` — 2 production call sites (1 file), 1 API test, 1 mock, 1 manifest entry

| Kind | Location |
|---|---|
| production | `apps/admin/src/pages/classes/class-detail.tsx:236` (query), `:31` (cache invalidate) |
| API test | `apps/api/src/class/generate-sessions.test.ts:366` |
| mock | `apps/admin/src/pages/classes/class-detail.test.tsx:51` |
| manifest | `scripts/acceptance-report/flow-manifest.ts:170` |

### `classBatch.listStudents` — 2 production call sites, 2 mocks, 1 manifest entry

| Kind | Location |
|---|---|
| production | `apps/admin/src/pages/classes/class-detail.tsx:71` |
| production | `apps/admin/src/pages/teaching/session-assessment.tsx:53` |
| mock | `apps/admin/src/pages/classes/class-detail.test.tsx:52` |
| mock | `apps/admin/src/pages/teaching/session-assessment.test.tsx:44` |
| manifest | `scripts/acceptance-report/flow-manifest.ts:173` |

### `classSession.list` — 5 production call sites (3 files), 3 mocks, 1 manifest entry

| Kind | Location |
|---|---|
| production | `apps/admin/src/pages/classes/class-detail.tsx:128` (query), `:130`, `:133` (invalidate) |
| production | `apps/admin/src/pages/teaching/session-assessment.tsx:49` |
| production | `apps/admin/src/pages/teaching/session-evidence.tsx:31` |
| mock | `apps/admin/src/pages/classes/class-detail.test.tsx:53` |
| mock | `apps/admin/src/pages/teaching/session-assessment.test.tsx:42` |
| mock | `apps/admin/src/pages/teaching/session-evidence.test.tsx:36` (+ assertions `:87,92`) |
| manifest | `scripts/acceptance-report/flow-manifest.ts:175` |

### Totals and cross-checks

- **Distinct production pages affected: 8** — `classes/index.tsx`, `classes/class-detail.tsx`, `cockpit.tsx`, `enrollment/class-placement.tsx`, `finance/receipt-create.tsx`, `teaching/schedule.tsx`, `teaching/session-assessment.tsx`, `teaching/session-evidence.tsx`
- **e2e callers of the 4 read procedures: 0.** `apps/e2e` uses `classBatch.create`, `classSession.addMakeup`, `classSession.cancel` only (`enrollment.spec.ts:45`, `attendance.spec.ts:38,47,55,61`, `attendance-grading.spec.ts:79,181,255,261`, `finance-approval.spec.ts:33`). The Phase 4 spec that calls `classBatch.list` as `sale` does not exist yet — correct, that is the phase's deliverable.
- **API tests referencing these procedures: 2**, both in `generate-sessions.test.ts:366,369`, both using a `giam_doc_dao_tao` client on a foreign facility (RLS negative). Neither asserts the permission key, so neither breaks.
- **Direct `class.create` permission assertions in tests: 2** — `apps/api/src/class/assign-teacher.test.ts:65` and `apps/api/src/class/generate-sessions.test.ts:420`, both on procedures the plan keeps on `class.create`. Neither breaks.
- **Plan's "6 procedure" table: accurate as an enumeration, and all six line numbers verify** — `class-batch-router.ts:115,229,254,283,300` and `class-session-router.ts:84`. It is 6 procedures / **4 changes**, and `requirePermission('class', ...)` appears at exactly those 6 sites and nowhere else in `apps/api/src`. The gap is not the procedure list; it is the consumer list (Finding 8) and the test/doc list (Finding 9).

### Other claims spot-checked

| Plan claim | Verdict | Evidence |
|---|---|---|
| F1 `classBatch.list` requires `class.create` | Confirmed | `class-batch-router.ts:229`; `packages/auth/src/index.ts:84` |
| F4 `payroll.tsx:414` calls `user.list` unconditionally; `user.manage: []` | Confirmed | `apps/admin/src/pages/hr/payroll.tsx:414`; `apps/api/src/user/router.ts:129`; `packages/auth/src/index.ts:96`. The 4 fields cited are at `payroll.tsx:416-420` |
| F7 `/finance/refund` is a self-declared placeholder | Confirmed | `apps/admin/src/pages/finance/refund.tsx:22-23`, no `useMutation` in file |
| `super_admin` bypasses the registry at `trpc.ts:214` | Confirmed in substance | `packages/auth/src/index.ts:50-52` documents the bypass; `can()` implements it |
| Branch has 5 unmerged commits | Confirmed | `git log main..test/independent-runtime-verification-38-flows` = 5. But the diff is **51 files, +3607/-154** — Phase 6 describes it as "hạ tầng" while it also rewrites 6 existing specs (`enrollment`, `finance-approval`, `kpi-lifecycle`, `shift-lifecycle`, `kind-isolation`, `lms-login`), `package.json`, `scripts/synthetic-seed-env.sh`, and 5 docs. Phase 6's "đọc diff từng commit, không merge mù" is the right instinct but the plan sizes this as smaller than it is. |
| `verify.ts` currently exits non-zero on violations | **False** | `scripts/acceptance-report/verify.ts:160-172` — `main()` only `console.warn`s on untriaged orphans; there is no `process.exitCode`. Phase 1's exit-code requirement is a new behaviour with CI impact, not a tightening of an existing one. Worth calling out so the CI wiring is budgeted. |

---

## Recommended plan restructure (smallest thing that fixes the user-facing breakage)

1. **Ship now, alone:** the `class.read` split + F4 payroll fix + 3 negative-authz tests + `index.test.ts` matrix row + docs. One PR, independently revertible. This is Phase 2 with `dependencies: []`.
2. **Then:** fix `flow-ui-routes.ui.spec.ts`'s `beforeEach` to per-flow roles and merge the branch, re-running only `ui-chromium`. Keep the 38 API-owned labels. (Phase 6, de-scoped by Finding 1.)
3. **Then:** the manifest contract work — `FlowActor` union, permission map folded into `trpc-scanner`, the self-scoped procedure category, four `nhan_vien` flows. (Phase 1, corrected by Findings 4-6.)
4. **Then, if still wanted:** the bridging gate (Finding 2) — the only automated check that would have caught the real defect. The `super_admin` grep is a 5-line rider on it, not a phase.
5. **Cut or defer:** Phase 3 as specified. Re-evaluate after step 2, when `RuntimeStatus.blocked` is already rendering P1-08 honestly.

## Unresolved questions

1. Does the PO accept that supplemental UI evidence was `super_admin`-captured but primary flow evidence was not — i.e. that the "35 proven are worthless" framing overstates the damage? This determines whether Phase 6 is a one-file fix or a full re-run.
2. Is `sale`/`giao_vien` access to `/admin/classes/:id` and the student roster (`classBatch.listStudents`) intended, or an unreviewed side effect of the `class.read` grant?
3. Should `/teaching/session-evidence` and `/teaching/schedule` be added as named findings (they are broken today for the same reason as F2), and does that change the priority of shipping Phase 2 alone?
4. Phase 1 turns `pnpm acceptance:report` into a non-zero-exit gate for the first time. Which CI job runs it, and is a red report allowed to block merges before the 7 existing violations are triaged?
