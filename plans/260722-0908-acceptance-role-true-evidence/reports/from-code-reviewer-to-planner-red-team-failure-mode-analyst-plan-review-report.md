# Red Team — Failure Mode Analyst (Flow Tracer)

**Plan reviewed:** `plans/260722-0908-acceptance-role-true-evidence/` (plan.md + phases 01–06)
**Reviewer role:** Failure Mode Analyst / verification method: Flow Tracer
**Date:** 2026-07-22
**Verdict:** 4 Critical, 3 High, 3 Medium. Not safe to execute as sequenced.

Coverage note: all 6 plan files read in full; all findings below are traced to `file:line` in the
working tree or in `test/independent-runtime-verification-38-flows`. Nothing was left unverified
except where explicitly marked in "Not checked" at the end.

---

## Direct answers to the three priority questions

**1. Phase 1 and Phase 3 both edit `verify.ts` + `types.ts` — is "Phase 3 runs in parallel" a hazard?**

Yes, and it is a three-way hazard, not two-way. Phase 1 changes `FlowEntry.actorRoles`
(`scripts/acceptance-report/types.ts:13`); Phase 3 changes `FlowStatus`
(`types.ts:26`) — adjacent declarations in a 56-line file. Both then add branches to the single
`main()` in `scripts/acceptance-report/verify.ts:98-177`. The Phase 6 branch already rewrites both
files in the same regions: its `types.ts` diff adds a **required** `runtime` field to
`FlowVerification`, and its `verify.ts` diff inserts a post-processing loop into the same `main()`.
Phase 3 also modifies `render.ts` and the templates, which the branch also touches
(`templates/acceptance-tab.ts` +54, `templates/layout.ts` +1).

Concrete failure: run in parallel on separate branches, these conflict on merge; run by two agents
on one worktree, the later write silently drops the earlier. Then Phase 6 resolves a three-way
conflict on the very tool that is the plan's source of truth, with no gate that would notice if a
conflict resolution quietly deleted an assertion. Serialize 1 → 3, or split `types.ts` first so
the three phases own disjoint declarations.

**2. Is "delete `runtime-evidence.json` in the merge commit itself" achievable with git mechanics?**

Yes — `git merge --no-commit <branch>`, then `git rm acceptance-report/runtime-evidence.json`, then
`git commit`. The deletion lands in the merge commit; no intermediate commit ever carries the stale
labels. The plan's stated invariant is achievable. Two caveats the plan omits:

- The branch's `.gitignore` diff adds `/acceptance-report/*` plus an explicit un-ignore
  `!/acceptance-report/runtime-evidence.json`. So the file is deliberately tracked — "reset to
  empty" leaves a tracked empty file, it does not fall out of git. Deleting and later regenerating
  works fine under that rule.
- Nothing **enforces** the invariant. See Finding 9.

**3. Rollback for Phase 2 (changing `PERMISSIONS`) — deploy, migration, or both?**

Deploy only, no migration — but **two artifacts, and the plan never says so.**
`PERMISSIONS` lives in `packages/auth/src/index.ts:54` and is consumed server-side by
`apps/api/src/trpc.ts`, *and* client-side by `apps/admin/src/lib/session-context.tsx:35`, which
calls `can()` in the browser to drive nav gating (`apps/admin/src/shell/nav-registry.ts`). Vite
bakes the bundle at build time, so there is no runtime toggle.

Rollback = single-commit revert of `packages/auth/src/index.ts` plus the four routers, then
redeploy **api and admin together**. No DB migration. No session invalidation — signed staff
cookies carry roles, not permissions, so existing sessions pick up the reverted registry on the
next request. That last point is good news the plan should state explicitly, because without it
nobody knows how expensive a mistake here is.

---

## Finding 1: Phase 5's premise is factually wrong — `super_admin` is not what let F1 hide

- **Severity:** Critical
- **Location:** plan.md "Overview" (line 25) and Phase 5 "Overview"
- **Flaw:** The plan's thesis is that 35 `proven` labels are worthless because
  `flow-ui-routes.ui.spec.ts` mints `super_admin`. Traced: the verdict-conferring `owner` for every
  business flow is an **API spec running real business roles**. The mechanism that let F1 hide is
  **`classBatchId` bridging between two roles**, not `super_admin`.
- **Failure scenario:** Phase 5 builds a gate against `super_admin` in specs. That gate is fine on
  its own terms, but it does not close the hole that produced the false `proven`, and the plan
  presents it as if it does. Phase 5's success criteria can all pass while the actual defect class
  remains completely ungated. The anti-bridging rule — the plan's own stated "hạt nhân của cả plan"
  (Phase 4 Architecture) — is enforced only by a manual `grep tự kiểm` step (Phase 4 Test/
  Validation) and a comment convention. Every future spec re-opens the hole by hand. Meanwhile
  Phase 5 spends its budget on the wrong gate and the team believes the class is closed.
- **Evidence:**
  - `runtime-evidence.json` P1-02: `owner` = `apps/e2e/tests/p1-runtime-proofs.spec.ts > receipt
    creation returns a draft receipt linked to the opportunity`. P2-07 owner = `p2-runtime-proofs.
    spec.ts > AI draft is teacher-confirmed...`. P1-03 owner = `finance-approval.spec.ts >
    over-threshold allowed for giam_doc_dao_tao`. None is the UI spec.
  - `p1-runtime-proofs.spec.ts:49-63` — the bridge, verbatim shape:
    `const sale = createE2eStaffClient(..., roles: ['sale'], ...)`;
    `const classBatchId = await createClass(opts.gddtId)` (GĐĐT creates);
    then `classBatchId` passed straight into sale's `receiptCreate`. `sale` never calls
    `classBatch.list`, which is exactly why `class.create`-gated reads never failed.
  - `p1-runtime-proofs.spec.ts:16-18` — `gddt` client is `roles: ['giam_doc_dao_tao']`, a real role.
  - Branch `verify.ts` diff requires a `.ui.spec.ts` reference **and** a screenshot before a
    UI-bearing flow may stay `proven` — so the `super_admin` UI spec is load-bearing for the
    *tier*, but it is not what proved the business logic.
- **Suggested fix:** Re-anchor the plan on the bridging defect. Keep Phase 5's `super_admin` gate
  (it is cheap and prevents a real future regression), but demote it from "the fix" to "a fix", and
  add an automated anti-bridging gate as a first-class deliverable — e.g. one client identity per
  `test()` body, enforced by a lint rule or an AST check over `apps/e2e/tests/**`, not by grep.
  Correct plan.md line 25: "P1-02 và P2-07 đều mang nhãn proven trong khi không vai nghiệp vụ nào
  dùng nổi" overstates the case — `sale` *did* call `receiptCreate` successfully; it just never had
  to find the class on its own.

## Finding 2: Phase 1 misses the 4th `nhan_vien` flow — typecheck stays red with no assigned fix

- **Severity:** Critical
- **Location:** Phase 1, "Implementation Steps" step 3; plan.md F6
- **Flaw:** Plan says three flows declare `nhan_vien` and enumerates P3-01, P4-01, P4-03. There are
  four — `P3-02` also declares it.
- **Failure scenario:** Step 2 flips `actorRoles` to `FlowActor[]`; step 3 fixes the three listed;
  `pnpm typecheck` is still red on P3-02 with no assigned resolution. An agent holding a plan that
  says "expect red, fix 3, go green" now has an unexplained red and improvises — most cheaply by
  adding `nhan_vien` to the `FlowActor` union, which destroys the contract the phase exists to
  build. P3-02 is also non-obvious on its merits: `manualPunch.approve` is
  `['giam_doc_kinh_doanh','giam_doc_dao_tao']` but `manualPunch.resubmit` deliberately has **no
  registry key at all**, so the ORPHAN-PROC assertion from step 4 fires on it too, again with no
  documented answer.
- **Evidence:** `scripts/acceptance-report/flow-manifest.ts:297` (P3-01), `:308` (P3-02 —
  `['nhan_vien','giam_doc_kinh_doanh','giam_doc_dao_tao']`), `:433` (P4-01), `:457` (P4-03);
  `packages/auth/src/index.ts:99-101` (comment: `manualPunch.create` key removed, `resubmit` "uses
  an owner check instead"), `:104` (`manualPunch.approve`)
- **Suggested fix:** Add P3-02 to step 3 with inferred actors, and state what the ORPHAN-PROC rule
  does with an owner-check-gated procedure that has no registry key — `manualPunch.resubmit` is the
  first such case and will not be the last.

## Finding 3: D6 makes 13 flows actor-less; the plan budgets for 7 violations and one exception

- **Severity:** Critical
- **Location:** plan.md D6; Phase 1 "Requirements" and step 5
- **Flaw:** D6 removes `super_admin`, `he_thong`, `agent` from every actor calculation. Phase 1's
  rule is two-way and hard-fails. Any flow whose *entire* actor list is excluded has an empty
  eligible set, so **100% of its procedures become ORPHAN-PROC**. The plan sizes the problem at
  "7/38 luồng vi phạm" — a number inherited from the brainstorm report, computed before D6 existed
  — and names exactly one exception (P1-09 `audit.list`).
- **Failure scenario:** After step 4, `pnpm acceptance:report` exits non-zero on 13 flows, not 7.
  Nine are structurally unfixable rather than merely wrong: ADM-01…ADM-05 (`['super_admin']` only)
  and P1-04/P1-05/P3-10/P3-11 (`['he_thong']` only) have no non-excluded actor that could ever
  exist. Four more have no staff `Role` at all — P1-06/P1-07 (`phu_huynh`), P2-03/P2-05
  (`hoc_vien`) — and Phase 1 addresses only P1-06. The executing agent faces a report that cannot
  go green, holding one lever: `DOCUMENTED_GAPS`-style exceptions. Bulk-whitelisting 13 flows,
  including all five ADMIN flows, is the obvious escape — and is precisely the "exception as a
  place to hide defects" failure the plan's own Phase 1 risk table rates only Medium.
- **Evidence:** `flow-manifest.ts:70,82,407,419` (he_thong-only); `:511,522,533,544,555`
  (super_admin-only); `:104,125,204,229` (LMS-subject-only); plan.md line 69 ("7/38 luồng");
  Phase 1 step 5 names only P1-09
- **Suggested fix:** Make it structural, not exception-driven: a flow whose declared actors all
  fall outside the staff `Role` set is `not-permission-verifiable` **by construction**, not a
  violation. That separates "we cannot check this" from "we checked and it is broken", and keeps
  the exception list for the handful of genuine cases where it means something.

## Finding 4: Phase 4 writes rows the e2e teardown cannot delete — the fix ships in Phase 6

- **Severity:** Critical
- **Location:** Phase 4 step 2, against Phase 6 "Related Code Files"; dependency chain 1→2→4→5→6
- **Flaw:** Phase 4's P2-07 spec calls `assessment.draftComment`/`confirm`, inserting
  `QualitativeAssessment` rows. Main's `cleanupFacility` does not delete that table. The branch
  Phase 6 merges **does** — but Phase 6 runs last.
- **Failure scenario:** Traced end to end. `assessment.draftComment`
  (`apps/api/src/assessment/router.ts:195`) → `tx.qualitativeAssessment.create` (`:253`). The row
  carries a required `studentId` FK and an optional `classSessionId` FK; Prisma emits
  `onDelete: Restrict` for the required relation. Global teardown
  (`apps/e2e/src/global-setup.ts:125`) → `cleanupFacility` → `tx.student.deleteMany`
  (`apps/e2e/src/db.ts:153`) throws a FK violation. The `try { … } finally { disconnectDb }` at
  `global-setup.ts:124-128` has no catch, so the error propagates and the Facility row plus every
  child row survives. `cmc_edu` is the **persistent shared** test DB — this leaks a full facility
  on every Phase 4 run, permanently, and each retry leaks another. No existing e2e spec on main
  touches this table, so Phase 4 is the first to hit it. The API-side teardown already handles it,
  which is exactly why the e2e gap went unnoticed.
- **Evidence:** `apps/api/src/assessment/router.ts:195,253`;
  `packages/db/prisma/schema.prisma:1006-1025` (`studentId String` required; `student Student
  @relation(...)` with no `onDelete`); `apps/e2e/src/db.ts:121-191` (no `qualitativeAssessment`, no
  `sessionEvidence`); `apps/api/src/test/db.ts:160` (API side has it);
  `git diff main...test/independent-runtime-verification-38-flows -- apps/e2e/src/db.ts` adds
  `privileged.qualitativeAssessment.deleteMany`, `sessionEvidence`, `sessionEvidencePhoto`,
  `reconciliationFlag`, `refundRecord`, plus a residue-count guard that throws on leftovers
- **Suggested fix:** Cherry-pick the branch's `cleanupFacility` rewrite — including its residue
  assertion — as a **Phase 4 prerequisite**. The residue guard is what converts a silent shared-DB
  leak into a loud teardown failure.

## Finding 5: Phase 2 has no rollback row, and the registry ships in two deploy artifacts

- **Severity:** High
- **Location:** Phase 2 "Risk Assessment" (no rollback row) and "Implementation Steps" (no deploy note)
- **Flaw:** The plan treats `PERMISSIONS` as server-side. It is compiled into the admin browser
  bundle as well.
- **Failure scenario:** Deploy API only — the admin bundle still gates nav on `class.create`, so
  sale/GV get no menu entry to the screens just unblocked. The fix appears not to work, and the
  cheapest-looking repair is widening `class.create`, the one thing D2 forbids. Deploy admin only —
  nav opens and every call 403s. On revert the split runs backwards; reverting API first leaves
  users with visible menu items that now fail. No runtime config fallback exists because Vite bakes
  the bundle at build time.
- **Evidence:** `apps/admin/src/lib/session-context.tsx:4,35` (`can()` from `@cmc/auth` in the
  browser); `apps/admin/src/shell/nav-registry.ts:1,72` (payroll nav gated on `payslip.assemble`);
  `packages/auth/src/index.ts:54,147`; `apps/e2e/playwright.config.ts` (comment explains
  `VITE_API_URL` is baked at build time, which is why UI runs rebuild both apps)
- **Suggested fix:** Add the rollback row spelled out in Answer 3 above, with the deploy-ordering
  constraint stated explicitly.

## Finding 6: the permission scanner has no model for `lmsProcedure` — and two sit inside P2-07

- **Severity:** High
- **Location:** Phase 1 "Architecture" and step 1 (`permission-scanner.ts`)
- **Flaw:** The scanner is specified as `"ns.proc" → "module.action" → Role[]`, derived from
  `requirePermission()`. 17 procedures across 10 routers use `lmsProcedure` and carry **no registry
  key at all** — they are gated by an LMS parent/student session. The planned liveness guard
  ("scanner ra 0 permission → ném lỗi") catches only total failure, never a 17-procedure blind spot.
- **Failure scenario:** Every `lmsProcedure` resolves to "no permission", which ORPHAN-PROC reads as
  "no actor can call this" — false violations across P1-06/P1-07/P2-03/P2-05/P2-07/P4-01. Worse, it
  lands inside P2-07, the flow Phase 4 must prove with a single `giao_vien` session:
  `assessment.listForChild` and `reportCard.getForChild` are parent-session procedures a teacher
  cookie can never call. Phase 4's "một vai đi trọn luồng" is unsatisfiable for P2-07 as manifested.
  The likely improvisation — quietly narrowing the spec to the four staff procedures while still
  claiming the flow is role-true — reproduces the plan's own core complaint one level down.
- **Evidence:** `apps/api/src/assessment/router.ts:403` (`listForChild: lmsProcedure`), `:5` (header
  names the LMS surface), `:378` (`listBySession` is `requirePermission`, for contrast);
  `flow-manifest.ts:250-268` (P2-07 lists both LMS procedures; actors `['agent','giao_vien']`);
  17 `lmsProcedure` procedures across assessment / attendance / enrollment / exercise / guardian /
  lms-auth / rewards / session-evidence / submission routers
- **Suggested fix:** Give the scanner a third outcome — `lms-gated` — mapping to
  `phu_huynh`/`hoc_vien` rather than to the empty set, and split P2-07's acceptance into a staff leg
  and an LMS leg so Phase 4 need not pretend one session covers both.

## Finding 7: "pnpm test xanh" is an acceptance criterion on a suite that is already red

- **Severity:** High
- **Location:** Phase 2 "Success Criteria"; Phase 6 "Test / Validation"; plan.md final AC
- **Flaw:** `docs/HARNESS_BACKLOG.md` documents that `pnpm --filter @cmc/api test` fails 1/898 for
  everyone sharing `cmc_edu`: `EmployeeCodeCounter` is a single global row that passed 9999
  (measured 10773 on 2026-07-20) while a test asserts a 4-digit code. The plan's environment
  section covers the socat sidecar and the prod-DB guard but never mentions this. Backlog status
  is unresolved.
- **Failure scenario:** The agent reaches Phase 2's last criterion, sees red, and must decide
  whether the permission change caused it. The failure lives in `user/router.ts` — adjacent enough
  to a user-router permission change that "did I break this?" is a genuine question and an
  expensive detour. The cheap resolution is relaxing the assertion: a live-code change made under
  time pressure to satisfy a checkbox, inside a plan whose thesis is that checkboxes get satisfied
  dishonestly. The same counter is incremented by `seedAppUser`, so Phase 4's P3-05 payroll spec
  pushes it further.
- **Evidence:** `docs/HARNESS_BACKLOG.md:190-236`; `apps/api/src/user/router.ts:96-100`
  (`padStart(4,'0')` — pads, never truncates); `apps/e2e/src/db.ts:230-234` (`E2E` prefix, same
  global counter row `id: 1`)
- **Suggested fix:** Resolve the backlog item as a Phase 0 prerequisite (option (a), a width-
  tolerant assertion, is one line), or record the known-red baseline and the exact failing test
  name in the plan's environment section so nobody burns an hour on it.

## Finding 8: Phase 3 is not parallel-safe

- **Severity:** High
- **Location:** plan.md "Thứ tự phụ thuộc" — "Phase 3 độc lập (chạy song song sau 1)"
- **Flaw / failure scenario / evidence:** See Answer 1 above. Summarized here for the findings
  ledger: Phase 1, Phase 3, and the Phase 6 branch all write `types.ts` and `verify.ts` in
  overlapping regions; Phase 3 and the branch additionally collide on `render.ts` / templates.
  Phase 6's risk table rates this "Trung bình — giải quyết xung đột thủ công", which understates a
  three-way conflict on the plan's own source of truth. A mis-resolved conflict yields a
  plausible-looking, wrong report with no gate to catch it.
- **Evidence:** `scripts/acceptance-report/types.ts:13,26` (56 lines total);
  `scripts/acceptance-report/verify.ts:98-177` (single `main()`);
  `git diff main...test/independent-runtime-verification-38-flows -- scripts/acceptance-report/`
  (+20 `types.ts` adding required `FlowVerification.runtime`; +28 `verify.ts` in the same `main()`;
  +54 `templates/acceptance-tab.ts`)
- **Suggested fix:** Serialize 1 → 3. Add a post-merge check in Phase 6 that re-runs the
  falsification tests from Phases 1 and 3 — a conflict resolution that silently drops an assertion
  is otherwise undetectable.

## Finding 9: "delete evidence in the merge commit" is achievable but unenforced

- **Severity:** Medium
- **Location:** Phase 6 step 2 and its risk row "Nhãn cũ sống sót trên main dù chỉ tạm thời"
- **Flaw:** The git mechanic works (Answer 2). The gap is that nothing enforces the invariant.
  `loadRuntimeEvidence` returns `{present:false, validationErrors:['runtime-evidence.json is
  missing']}` for a missing file and a soft file-level error for an empty one; `verify.ts` prints
  counters and never exits non-zero on either.
- **Failure scenario:** If step 2 is skipped, or a conflict resolution restores the file, main
  carries 35 stale labels and `pnpm acceptance:report` reports them without complaint. Those
  entries would still validate — their commits become ancestors of HEAD the moment the merge lands,
  so the `codeCommitAge` ancestry check passes. Phase 6's most consequential invariant rests
  entirely on the agent remembering a manual step.
- **Evidence:** branch `scripts/acceptance-report/runtime-evidence.ts:125-133` (missing/parse
  handling), `:139-151` (file-level errors + ancestry check); branch `verify.ts` diff adds counters
  only, no exit code; branch `.gitignore` diff (`/acceptance-report/*` + `!/acceptance-report/
  runtime-evidence.json`)
- **Suggested fix:** Put the concrete git sequence in step 2, and make `verify.ts` exit non-zero
  when any `proven` entry's spec set fails the role-discipline rule — an assertion, not a
  procedure step.

## Finding 10: Phase 3's falsification test sabotages a screen Phase 6 asserts on; route target is wrong

- **Severity:** Medium
- **Location:** Phase 3 "Test / Validation" (falsification test; "tổng số `path:` entry (46)")
- **Flaw:** Two problems in one section. The falsification test says to temporarily convert a real
  screen — "ví dụ `/finance`" — into an EmptyState. `/finance` is the receipt list and is the exact
  screen the Phase 6 UI spec asserts on for P1-03 by heading text. Separately, the "~46 path
  entries" target is not the actual count.
- **Failure scenario:** Interruption mid-falsification (context limit, failing gate, handoff) leaves
  `receipt-list.tsx` as an EmptyState on the working tree. There is no revert marker in the code,
  the plan is the only record that a revert is owed, and the sabotage is deliberately shaped to look
  like a legitimate placeholder — so the Phase 3 detector then correctly reports it and the report
  agrees with itself. Downstream, `flow-ui-routes.ui.spec.ts` asserts
  `getByRole('heading', {name: 'Phiếu thu học phí'})` at `/finance` and asserts
  `'Tính năng chưa áp dụng'` has count 0; on a poisoned tree that fails for a reason unrelated to
  whatever is being debugged. On the count: `path:` entries across admin + lms route files total
  **61**, not 46; and the scanner additionally emits paths for `index: true` routes while skipping
  `'*'`, so raw entry count is the wrong denominator anyway. A "must be ≈46" criterion is either
  trivially passed or falsely failed.
- **Evidence:** `apps/admin/src/routes/finance.routes.tsx:18-25` (`index: true` → `ReceiptListPage`);
  branch `apps/e2e/tests/flow-ui-routes.ui.spec.ts` P1-03 case (`'/finance'`, `'Phiếu thu học phí'`)
  and `captureAdminSurface`'s count-0 assertion on `'Tính năng chưa áp dụng'`;
  `grep -c "path: '"` across `apps/{admin,lms}/src/routes/*.tsx` = 61;
  `scripts/acceptance-report/scanners/route-scanner.ts:59-71`
- **Suggested fix:** Falsify against a scratch route the scanner picks up but no spec asserts on.
  Replace the 46 target with a real invariant: every `uiRoute` in the manifest resolves to a page
  file — checkable, and meaningful.

---

## Verification Results

**Traces that passed (plan claim confirmed):**

| Claim | Traced to | Result |
|---|---|---|
| `super_admin` bypasses the registry | `packages/auth/src/index.ts:147`; `apps/api/src/trpc.ts:214` | OK |
| F1 root cause — 6 procedures on `class.create` | `class-batch-router.ts:112-114,115,229,254,283,300`; `class-session-router.ts:84` | OK — all six line numbers correct |
| F4 — payroll calls `user.list` unconditionally | `payroll.tsx:414`; `user/router.ts:129`; `auth/index.ts:96` (`'user.manage': []`); `nav-registry.ts:72` | OK |
| P1-08 `/finance/refund` is a placeholder | `apps/admin/src/pages/finance/refund.tsx:22-23` | OK |
| Phase 6: `post-sale-meeting` now implemented | `apps/admin/src/pages/crm/post-sale-meeting.tsx:66` calls `trpc.parentMeeting.list` | OK — plan is right; the *manifest comment* at `flow-manifest.ts:456-458` is the stale one |
| Branch = 5 unmerged commits, hashes as listed | `git log main..test/independent-runtime-verification-38-flows` | OK |

**FAILED traces (plan claim does not hold):**

| Claim | Actual | Finding |
|---|---|---|
| 35 `proven` were captured by `super_admin` | verdict-conferring `owner` specs use real business roles; the defect is `classBatchId` bridging | 1 |
| "3 luồng khai `nhan_vien`" | four flows declare it (P3-02 missed) | 2 |
| "7/38 luồng vi phạm" under D6 | 13 flows go actor-less under D6 | 3 |
| Phase 4 "teardown đúng" | teardown cannot delete the rows Phase 4's own specs create | 4 |
| "Phase 3 độc lập, chạy song song" | collides with Phase 1 and the Phase 6 branch on `types.ts` + `verify.ts` | 8 |
| "tổng số `path:` entry (46)" | 61 | 10 |

**Checked and cleared — do not re-raise:** concurrent-spec interference *within* an e2e run is not
a defect. `apps/e2e/playwright.config.ts` sets `fullyParallel: false, workers: 1`, and each run
bootstraps its own facility (`global-setup.ts:115-120`), so Phase 4's specs cannot race existing
specs inside a run. Cross-**session** contention is real but confined to genuinely global rows:
`EmployeeCodeCounter` (Finding 7), facility-agnostic `CurriculumUnit`/`Exercise`, and phone-keyed
`ParentAccount`/`LoginOtp`.

**Not checked (out of time / out of method):** the Phase 6 UI-spec assertion-strength question
(step 4, "assert dùng được, không chỉ render được") was not evaluated against each of the 38 flows;
the `docs/14` and P2-Foundation ADR update surface (Phase 2 step 6) was not read; `trpc-scanner.ts`
was not audited for whether Phase 1's "tái dùng đúng cách" is actually feasible against
`mergeRouters`.

---

## Unresolved questions for PO / planner

1. Given Finding 1, does the plan's scope change? The `super_admin` framing is the plan's stated
   motivation; the real defect class is cross-role data bridging in specs. Phase 5 as written does
   not gate the real defect.
2. Do the 9 structurally actor-less flows (5 ADM + 4 `he_thong`) get a distinct
   non-verifiable status, or exceptions? At that volume, exceptions hollow out the gate.
3. Is P2-07 accepted as two legs (staff + LMS)? "One role, whole flow" is unsatisfiable for it as
   currently manifested.
4. Does the `EmployeeCodeCounter` backlog item get fixed before Phase 2, or is the known-red
   baseline documented in the plan instead?
