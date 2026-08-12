# Scout — Project state AS-BUILT (2026-08-12 10:13)

**Mode:** `ak:scout --parallel` · read-only · no product code edited
**cwd:** `/home/manhquy/Downloads/cmc_edu` · monorepo pnpm · Linux
**Branch:** `feat/lms-foundation-unit-range-spike` @ HEAD `b273e3c` (PR #110 → base `develop`, OPEN, `MERGEABLE`/`CLEAN`)
**Measurement basis (REAL, not docs):**
- `pnpm acceptance:report` re-run against the **CI artifact** of HEAD (`acceptance-journeys-b273e3c…`, `gitDirty:false`, downloaded via `gh run download 31557948219`); local `journeys.json` was a stale partial run (`b5bd0cc`-dirty, 32/42 specs missing) and was **not** used as the ledger — restored after measurement.
- CI runs at HEAD `b273e3c`: `CI` (typecheck+test) **success** 5m57s · `ui-e2e` (ui-chromium full project + business-correctness gate) **success** 7m46s · stats `expected 59 · skipped 0 · unexpected 0 · flaky 0`.

---

## TL;DR

Real acceptance at HEAD: **35/42 flows proven** (CI artifact, clean tree) — up from the docs' 31/38 snapshot. 7 unproven = 1 built-without-journey (P1-08 refund/cancel) + 4 LMS teaching-spine `no-ui-path` (P2-01/02/03/05) + 2 worker-only (P3-10/11). Form-depth wave landed both S1 (check-in punch) and S2 (rewards) — the **only remaining list-HITL residual is teaching exercises (GAP #3)**. Biggest open item: **24 unclassified tRPC orphans** (14 are the new `lmsOps.*` LMS-foundation namespace) that keep the acceptance tool at exit 1. Docs are stale on acceptance numbers, the ui-e2e blocking gate, and the live INDEX (still lists check-in as open).

---

## 1) Phases / flows — complete vs open

42-flow manifest (P1×13 · P3×11 · P2×8 · P4×5 · ADMIN×5). Evidence states: **35 proven · 1 built-unproven · 6 not-yet** (`acceptance-report/verification.json`, `evidence.state`).

| Bucket | Flows | Detail |
|--------|-------|--------|
| ✅ Proven (35) | P1 sale/enroll/finance (12 of 13), P2-04/06/07/08, P3 HR (8 of 11), P4, ADMIN×5 | Journey-driven, `gitDirty:false` CI evidence |
| 🟡 Built, no journey (1) | **P1-08 Huỷ phiếu / hoàn tiền** | `built-unproven` — refund/cancel form-depth shipped 2026-08-11 (`receiptCancel`/`refundCreate`, `/finance/refund`), but manifest declares **no journey** (`scripts/acceptance-report/flow-manifest.ts:202-215`) |
| ⚪ not-yet / no-ui-path (6) | **P2-01** tạo lớp tự sinh lịch · **P2-02** điểm danh · **P2-03** mở bài theo tiến độ · **P2-05** làm/nộp bài PDF · **P3-10** session-done worker · **P3-11** tự huỷ 0 điểm danh + buổi bù | P2-01/02/03/05: no student-facing UI (open-tier mechanism missing); P3-10/11: worker-only `he_thong`, models-only, no procedure/route/UI call-site (manifest `statusReason: no-ui-path` :700-741) |

**Phases:** P1 complete · P2–P4 built & tested · admin shell CMC Console · **LMS foundation (unit-range spike) in flight** — `apps/api/src/lms-ops/` new namespace (`createClassWithUnits`, `grantPast`, `rosterForSession`, `cancelSessionAndRestamp`, `archiveEnrollment`, `assignExerciseSequence`, `deliverSessionExercise`, …) targets exactly the P2-01/03/05 mechanisms, but **no journey spec covers them yet**.

---

## 2) Nghiệm thu thật (acceptance:report) vs tài liệu

| Metric | Docs claim (dated photo) | **Real @ HEAD b273e3c** |
|--------|--------------------------|--------------------------|
| Proven flows | **31/38** @ `324bd12` (07-26) and re-confirmed @ `eaa223a` (08-07) — `docs/system-architecture.md:11,15`, `docs/codebase-summary.md:11` | **35/42** @ `b273e3c` (CI artifact, clean) |
| Journey spec files | 43 spec / 31 journey (07-26) | 37 journey files in `apps/e2e/tests/journeys/`; journey coverage 35/42 flows |
| Run stats | n/a (docs don't quote) | **59 tests · 0 skipped · 0 unexpected · 0 flaky** (ui-chromium) |
| Orphans | 6 untriaged (08-07) | **26 orphan — 2 documented gap, 24 unclassified** (tool exit 1) |
| Actor-audit | 0 phát hiện (07-26) | 0 phát hiện · 25 procedures ngoài tầm registry · 2 inconclusive |

**Deviation verdict:** docs' 31/38 is a stale photo — the manifest grew 38→42 flows and proof rose to 35. Docs' `no-ui-path` bucket changed shape: 7 → 6 (`P1-08` moved from covered-by-journey territory into built-unproven; P3-10/11 remain worker-only by design).

---

## 3) Residual gaps (open)

**UI dual-HITL (resource-centric authority):**
- **GAP #3 teaching exercises — OPEN:** `apps/admin/src/pages/teaching/exercises.tsx` still mutates on the list — `exercise.publish/close` (:114-121), row `Công bố`/`Đóng` buttons (:201-218); no `/:id` detail form (`apps/admin/src/routes/teaching.routes.tsx:78`). Only remaining list-HITL after S1/S2.
- **Resolved this wave:** check-in punch S1 (`d52caa4` + `9ddef3f` + `df4ded0` — `manualPunch.get` `apps/api/src/checkin/router.ts:550`, form `check-in-ticket-detail.tsx`, route `/hr/checkin/:ticketId` `hr.routes.tsx:50`, list index-only "Mở phiếu" `check-in-out.tsx:359/377`); rewards S2 (`da3b8a8` — `rewards.get`, `/admin/engagement/rewards/:rewardId`); TEKY teal gone (`2947d6a`).
- **KEEP (owner lock, do not "fix"):** parents link-request list Duyệt (`parents/index.tsx:159-208`); KPI bulk period (`kpi.tsx:109-114`).

**Acceptance ledger gaps:**
- **P1-08** — journey missing for shipped refund/cancel form-depth (smallest fix; write `receipt-refund-cancel` journey).
- **P2-01/02/03/05** — need LMS student-facing UI (open-tier) before journeys can drive them; the `lmsOps.*` spike is the foundation, journeys are the follow-up.
- **P3-10/11** — worker-only; API-level specs planned (not UI-provable).

**Orphan classification backlog (24):** 14× `lmsOps.*` (new LMS-foundation namespace — unclaimed by any flow), 6× form-depth `get` procedures added this wave (`rewards.get`, `manualPunch.get`, `afterSale.get`, `shift.get`, `kpi.get`, `classSession.get`/`listInRange`), plus `parentAccount.get/list/setActive`, `user.changeOwnPassword/resetPassword`, `classSession.doneProgress`. **This is what keeps `pnpm acceptance:report` at exit 1** (CI tolerates via `|| true`; `business:verify --strict` still passes).

---

## 4) Known issues + risk

| # | Issue | Evidence / status |
|---|-------|-------------------|
| 1 | **Docs/INDEX stale** (see §5) — INDEX still lists check-in as GAP #1 open; wave table omits `d52caa4/9ddef3f/df4ded0` | `plans/reports/INDEX-live-260812.md` (last refresh `8d84de0` 09:27) |
| 2 | **Entra SSO disabled** (M365 access lost) — staff email/password login active; code under `SSO_ENABLED` flag; reactivation needs RLS bypass at `sso-routes.ts:220` | `docs/system-architecture.md:531-537` (Known Limitations) |
| 3 | **Email transport stub** — `ConsoleEmailTransport` logs OTP only; parent email OTP non-functional in prod until Brevo/Graph creds | `docs/11-api-contract.md` BLOCKED-ON-COMMS; unchanged |
| 4 | **Journey = smoke, not business-math** — green journey proves the flow runs, not that numbers are right; human UAT still not run ⇒ not "production-ready" | `docs/system-architecture.md:11` banner; unchanged |
| 5 | **ui-e2e cross-app sensitivity** — docs-only commit `8d84de0` triggered a ui-e2e FAILURE (14m17s) fixed by `b273e3c` (rewards journey selector); current green but journey/e2e flake risk remains | `gh run list` 31557015067 (failure) → 31557948219 (success) |
| 6 | **Branch naming vs content** — PR #110 title is "form depth + check-in polish", branch name is `lms-foundation-unit-range-spike`; 37 commits ahead of `develop` (which already merged the earlier #109 batch of the same branch) | `git rev-list --count origin/develop..HEAD` = 37 |
| 7 | **Orphan exit-1 noise** — 24 unclassified orphans keep the acceptance tool red at CLI (non-blocking in CI by design) | §3 |
| 8 | **PR promotion path** — PR #110 → `develop` (not `main`); `main` last merged #101 (08-10). Promotion develop→main still pending for this wave | `gh pr view 110` |

---

## 5) Chỗ tài liệu lệch thực tế

| Doc (file:line) | Claim | Reality @ b273e3c |
|-----------------|-------|-------------------|
| `docs/system-architecture.md:11,15` | 31/38 proven @ 324bd12 / eaa223a | **35/42** @ b273e3c (manifest 42 flows) |
| `docs/system-architecture.md:448-455` | "ui-e2e … chạy cảnh báo (`continue-on-error`), chưa chặn merge" | **ui-e2e blocks at job level since 2026-08-02** + `business:verify --strict` money/state gate (`ui-e2e.yml:180-198`) |
| `docs/system-architecture.md:469-483` (Deferred) | "LMS Frontend: Not started" · "Student lookup: stub (K4)" | LMS SPA built & journey-proven (P1-07, P2-04/06/07/08, lms-parent journeys); row is a P1-era photo |
| `docs/codebase-summary.md:11` | 31/38 @ 324bd12; "đã chạm trần journey; 7 luồng no-ui-path" | 35/42; unproven = 1 built-unproven (P1-08) + 4 LMS spine + 2 worker — ceiling shape changed |
| `plans/reports/INDEX-live-260812.md` | check-in manualPunch = **GAP #1 open**; wave table missing S1 commits | check-in **DONE** (`d52caa4` etc.); only GAP #3 (exercises) remains |
| `docs/codebase-summary.md:628-638` | "532/532 tests" (07-10 photo) | Superseded — 07-26 snapshot quoted 988 api / 396 admin; CI green is the live gate |

---

## 6) One-line next (advisory, not executed)

1. Classify/claim the 24 orphans (esp. `lmsOps.*`) in `flow-manifest.ts` to clear acceptance exit-1; 2. add P1-08 refund/cancel journey (smallest proven-count win 35→36); 3. schedule exercises GAP #3 form-depth; 4. refresh `INDEX-live-260812.md` + acceptance banners; 5. human merge of PR #110 → develop (then develop → main) — agents never merge.

---

**Status: DONE_WITH_CONCERNS**

**Summary:** Real acceptance is **35/42 flows proven at HEAD b273e3c** (CI artifact, clean tree, 59/59 green) — ahead of the docs' stale 31/38 photo; the only list-HITL left is teaching exercises, and the biggest open ledger item is 24 unclassified tRPC orphans (14 new `lmsOps.*`). Concerns: INDEX/architecture/codebase docs deviate from reality in 6 places, P1-08 has no journey despite shipped form-depth, 4 LMS spine flows need student UI, and human UAT still hasn't run.

Report: `plans/reports/scout-260812-1013-project-state.md`
