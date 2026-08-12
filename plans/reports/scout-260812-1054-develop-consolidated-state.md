# Scout — develop consolidated state (post PR #110 merge)

**Date:** 2026-08-12 10:54
**Scope:** SYSTEM STATUS / ACCEPTANCE / COVERAGE — read-only, no edits
**Tip measured:** `origin/develop@92cd677` = **Merge pull request #110** from `feat/lms-foundation-unit-range-spike` (2026-08-12T03:58Z)
**Branch protection:** develop **and** main now protected — required checks `["typecheck-and-test","ui-e2e"]`, 0 required approvals (verified via `gh api branches/*/protection`)

**Method (real measurement, not docs):**
- Code at `92cd677` verified identical to previous HEAD `b273e3c` — `git diff b273e3c..92cd677` = **empty** (merge brought nothing new).
- Acceptance re-run in a throwaway worktree (`git worktree add … origin/develop`) using the **CI artifact** `acceptance-journeys-92cd677…` downloaded from the develop `ui-e2e` run (31561730075): `gitSha:92cd677 · gitDirty:false · stats expected 59 · skipped 0 · unexpected 0 · flaky 0`. Local `journeys.json` untouched (still stale local-run artifact, not the ledger).
- Both develop gates at the merge commit are **green**: `typecheck-and-test` success (3496 unit/integration tests passed, 0 failed across packages, from CI log), `ui-e2e` success (full ui-chromium project + `business:verify --strict` money/state gate).

---

## 1) Acceptance — develop@92cd677 (CI artifact)

**`35/42 flows proven`** — `results @ 92cd677, HEAD 92cd677, project ui-chromium`, clean ledger.

| Cluster | Proven | Open |
|---------|--------|------|
| P1 (enroll/sale/finance) | 12 | 1 (P1-08) |
| P2 (class/LMS) | 4 | 4 (P2-01/02/03/05) |
| P3 (HR) | 9 | 2 (P3-10/11) |
| P4 + ADMIN | 5 + 5 | 0 |

**Not proven (7, unchanged):**
- `built-unproven` (1): **P1-08 Huỷ phiếu / hoàn tiền** — refund/cancel form-depth shipped (`receiptCancel`/`refundCreate`, `/finance/refund`), but manifest declares **no journey** (`scripts/acceptance-report/flow-manifest.ts:202-215`).
- `not-yet` (6): **P2-01** tạo lớp tự sinh lịch · **P2-02** điểm danh · **P2-03** mở bài theo tiến độ · **P2-05** làm/nộp bài PDF — LMS teaching spine, no student-facing UI (open-tier missing); **P3-10** session-done worker · **P3-11** tự huỷ 0 điểm danh + buổi bù — worker-only `he_thong`, no procedure/route/UI.

**Flows moved since last ledger:** **none** — the merge carried the same 42-flow manifest + same journey specs; evidence states byte-identical to `b273e3c`.

---

## 2) tRPC orphans — 26 total (2 documented gap + 24 unclassified)

Breakdown by namespace (`verification.json` @ 92cd677):

| Namespace | Count | Nature |
|-----------|-------|--------|
| `lmsOps.*` | **11** | New LMS-foundation spike (unit-range): `createClassWithUnits`, `grantPast`, `revokeFromNext`, `rosterForSession`, `cancelSessionAndRestamp`, `archiveEnrollment`, `unarchiveEnrollment`, `assignExerciseSequence`, `listExerciseSequence`, `deliverSessionExercise`, `addWithUnits` — **unclaimed by any flow** |
| `classSession.*` | 3 | `get`, `listInRange`, `doneProgress` |
| `parentAccount.*` | 3 | `get`, `list`, `setActive` |
| `user.*` | 2 | `changeOwnPassword`, `resetPassword` |
| form-depth `get` | 5 | `afterSale.get`, `kpi.get`, `manualPunch.get`, `rewards.get`, `shift.get` (added by the form-depth wave; never claimed in manifest) |
| documented gap | 2 | `course.create`, `enrollment.mine` (triaged, `DOCUMENTED_GAPS` map) |

**Consequence:** `pnpm acceptance:report` still exits 1 (24 unclassified need a decision). CI tolerates it (`pnpm acceptance:report || true` in `ui-e2e.yml:200`); `business:verify --strict` (the money/state gate) still passes — that gate is what blocks merges, and it is green.

---

## 3) Test coverage / residual UI gaps

**Unit/integration (CI at 92cd677):** 3496 tests passed, 0 failed (typecheck-and-test job log). Docs' dated photos (988 api + 396 admin @ 07-26; "532/532" @ 07-10) are superseded — CI green at the merge commit is the live gate.

**Journey/e2e:** 59 tests, 0 unexpected, 0 flaky (`ui-chromium` full project) — the exact spec set that backs the 35/42 ledger.

**Residual UI gaps (resource-centric authority):**
- **GAP #3 teaching exercises — STILL OPEN on develop:** `apps/admin/src/pages/teaching/exercises.tsx` mutates on the list — `exercise.publish`/`close` (:114/:121), row `Công bố`/`Đóng` (:205/:214); route `teaching/exercises` only, no `/:id` form (`teaching.routes.tsx:78`). Only remaining list-HITL after the wave.
- **Demoted & verified in the merge:** check-in punch (list index-only `Mở phiếu` → `links.manualPunchTicket` `check-in-out.tsx:359/377`), rewards (`engagement/rewards/:rewardId` form `admin.routes.tsx:158`), aftersale + KPI rows. TEKY teal gone (`2947d6a`).
- **KEEP (owner lock):** parents link-request list Duyệt; KPI bulk period.

---

## 4) PROVEN vs OPEN after the wave + known issues carried forward

**PROVEN (35):** all P1 money/enroll (12) + P3 HR (9) + P4 (5) + ADMIN (5) + P2-04/06/07/08.
**OPEN (7):** P1-08 (journey missing — smallest fix), P2-01/02/03/05 (need LMS student UI; `lmsOps.*` spike is the foundation, journeys are follow-up), P3-10/11 (worker-only, API-level specs planned).

**Known issues / risks carried forward (unchanged by the merge):**
1. **24 unclassified orphans** (11 `lmsOps.*` heaviest) — acceptance tool red at CLI until classified/claimed in the manifest.
2. **Entra SSO disabled** (M365 access lost) — staff email/password active; reactivation needs RLS bypass `sso-routes.ts:220`.
3. **Email transport stub** — parent email OTP non-functional in prod until Brevo/Graph creds (BLOCKED-ON-COMMS).
4. **Journey = smoke, not business-math; human UAT not run** ⇒ still not "production-ready" description.
5. **Docs/INDEX stale** — `plans/reports/INDEX-live-260812.md` still lists check-in as GAP #1 open (wrong on develop); `docs/system-architecture.md:11,15` still quotes 31/38; `:448-455` still says ui-e2e "chưa chặn merge" (blocks since 08-02); `docs/codebase-summary.md` photos outdated.
6. **Promotion path** — develop is the integration branch; `main` last merged #101 (08-10); develop→main promotion of this wave still pending (human merge only).

---

## Delta vs previous snapshot (`scout-260812-1013-project-state.md` @ b273e3c)

| Axis | 10:13 snapshot (b273e3c) | 10:54 (develop@92cd677) | Delta |
|------|--------------------------|--------------------------|-------|
| Proven / total | 35/42 | **35/42** | **0** (code identical) |
| Unproven set | P1-08, P2-01/02/03/05, P3-10/11 | same 7 | **0 moved** |
| Orphans | 26 (24 unclassified) | 26 (24 unclassified) | 0 (same list) |
| Unit tests | not measured (CI green cited) | **3496 passed, 0 failed** (CI log) | +exact count |
| Branch/CI state | PR #110 OPEN → develop, MERGEABLE | **PR #110 MERGED**; develop tip `92cd677`; develop+main branch-protected; gates green at merge | **consolidation complete** |
| Residual UI | GAP #3 exercises open; check-in/rewards done | GAP #3 exercises still open; check-in/rewards verified demoted in merge | 0 |

**Verdict:** the merge consolidated state without changing the ledger — no flow gained/lost proof; what changed is governance (branch protection both tiers), CI green at the consolidated tip, and a confirmed 3496-test unit baseline.

---

**Status: DONE_WITH_CONCERNS**

**Summary:** develop@92cd677 consolidates the form-depth + LMS-foundation wave with **35/42 flows proven** from the CI artifact (59/59 journeys green, gitDirty:false, 3496 unit tests passed) — zero flow delta vs b273e3c since the merge carried no code change; both develop and main are now branch-protected with the acceptance ledger green. Concerns carried forward: 24 unclassified tRPC orphans (11 `lmsOps.*`) keep the acceptance tool at exit 1, P1-08 still lacks a journey, 4 LMS spine flows await student UI, GAP #3 (teaching exercises) remains list-HITL, and INDEX/docs are still stale.

Report: `plans/reports/scout-260812-1054-develop-consolidated-state.md`
