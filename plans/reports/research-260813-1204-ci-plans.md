---
title: CI gates vs unfinished plans (measurement, not claims)
kind: research
date: 2026-08-13
measured_at: 2026-08-13T12:07+07:00
local_head: bc3f473 (#131)
origin_develop: 7227676 (#134)
---

# Research: CI truth + unfinished-plan overlap

**Do not write a 7th product plan.** New ROADMAP must POINT at live plans. Docs/INDEX/plan YAML are claims. This file is measurement.

## Executive summary

Two required checks actually block merge on `main` **and** `develop`: `typecheck-and-test` + `ui-e2e`. Both branches: `strict:true`, `enforce_admins:true`, 0 review approvals. Last 12 develop pushes: both workflows **success**. API Playwright job `e2e` and Trivy `security-scan` are **advisory** (`continue-on-error`). `acceptance:report` inside `typecheck-and-test` is advisory; the **same command is blocking inside `ui-e2e`** plus `business:verify --strict`.

Of six "unfinished" plans: **two are live remaining work**, **one is a parent program still needed for Đợt 4–5**, **three are stale wrappers around already-merged code**. Writing new phases that re-spec #123 / #124–#128 / #134 / branch-protection will fight HEAD.

Acceptance ledger of record = CI artifact, not local `verification.json`. Latest `ui-e2e` on `develop@7227676`: **60/60 expected**, `gitDirty:false`. Manifest has **43 flows / 36 journeys / all 36 present in that artifact**. Ceiling of the journey method is **36 proven** until P2-09 gets a spec (UI already exists) and/or stale `no-ui-path` tags are re-measured. INDEX `36/42` is a dated photo with a wrong denominator.

## Research methodology

- Sources: GitHub branch protection API; `gh run list` + job conclusions; `.github/workflows/{ci,ui-e2e,dependabot-auto-merge}.yml`; six `plan.md` + child phase files; `schema.prisma` / routers / UI call-sites; CI artifact `acceptance-journeys-7227676…/journeys.json`; local `/acceptance-report/verification.json` (rejected as ledger); prior pipeline research `plans/reports/research-260813-0908-dev-pipeline.md` (cross-check, not copied as truth).
- Date range: workflow comments 2026-07-26 → 2026-08-13; runs sampled 2026-08-12–13.
- Key terms: required check, `continue-on-error`, `strict`, `enforce_admins`, journey proven vs `no-ui-path`.
- GitNexus MCP unavailable (as instructed). No implementation.

## 1. CI truth table (blocks vs advises)

Protection (measured `gh api repos/manhquydev/cmc_edu/branches/{main,develop}/protection`):

| Field | `main` | `develop` |
|---|---|---|
| Required contexts | `typecheck-and-test`, `ui-e2e` | same |
| `strict` (must be up to date) | **true** | **true** |
| `enforce_admins` | **true** | **true** |
| Required approving reviews | **0** | **0** |
| Force push / deletions | disabled | disabled |
| Default branch | `main` | — |

`typecheck-and-test` is a **job name** in workflow `CI` (id 308026424), not a workflow name. `gh run list --workflow=typecheck-and-test` returns nothing. Query `--workflow=CI` and `--workflow=ui-e2e`.

| Surface | File:line | Merge effect | Notes |
|---|---|---|---|
| Required check `typecheck-and-test` | branch protection; job `.github/workflows/ci.yml:29` | **BLOCKS** | Job has no `continue-on-error`. Fail → check red → merge blocked (admins included). |
| Required check `ui-e2e` | branch protection; job `.github/workflows/ui-e2e.yml:108` | **BLOCKS** | `continue-on-error` **removed** 2026-08-02 (`ui-e2e.yml:92-104`). Push-only workflow (`ui-e2e.yml:12-13`) so a PR SHA is not double-registered skipped (`ci.yml:202-209`, `ui-e2e.yml:1-11`). |
| CI trigger PR | `ci.yml:4-6` | PRs targeting **`main` only** + **every `push`** | PRs into `develop` get this job via **push of the PR branch**, not `pull_request`. |
| ui-e2e trigger | `ui-e2e.yml:12-13` | **push only** | Same SHA-attachment trick. Timing hole if a PR is opened on a SHA that never got a push run — solo remote-push workflow makes this rare. |
| Screen-role matrix | `ci.yml:100-105` | **ADVISES** | `continue-on-error: true`. Comment admits prior silent drift. |
| Lint / typecheck / test / payroll coverage | `ci.yml:83-84, 107-108, 131-132, 144-145` | **BLOCKS** (inside required job) | |
| UI frames / ratchet / a11y-roles / doc-authority | `ci.yml:112-129` | **BLOCKS** (inside required job) | Wired; `check:css-vars` **does not exist** in `package.json`. |
| `acceptance:report` in CI | `ci.yml:140-142` | **ADVISES** | `continue-on-error: true`. Orphan ratchet can go red here and the required check still passes. |
| API Playwright `e2e` | `ci.yml:150-152` + `ci.yml:199-200` | **ADVISES** | Whole job `continue-on-error: true`. No `PLAYWRIGHT_UI`. Not a required check. This is quality plan **P1b / F8**. |
| Trivy `security-scan` | `ci.yml:219-223` + `ci.yml:235` | **ADVISES** | Job `continue-on-error` **and** `exit-code: '0'`. Comment forbids adding to required checks until someone owns triage (`ci.yml:216-218`). |
| `acceptance:report` in ui-e2e | `ui-e2e.yml:197-200` | **BLOCKS** | No `continue-on-error`. Orphan ratchet + ledger regen. |
| `business:verify --strict` | `ui-e2e.yml:197-200` | **BLOCKS** | Money/state must not sit at `reachable-only`. Vacuous-pass guard in `scripts/business-verify/verify.ts:154`. |
| Journey artifact | `ui-e2e.yml:207-213` | evidence only | `if: always()`. **Only sanctioned ledger source** (`ui-e2e.yml:202-206`). Local JSON is hand-editable. |
| Dependabot auto-merge | `.github/workflows/dependabot-auto-merge.yml:26-31` | still gated by required checks | Patch/minor *request* auto-merge; GitHub waits for the two required checks. |
| CodeQL / GHAS | separate workflows; check-runs `Analyze (*)` on SHA | **ADVISES** | Present on `7227676`, **not** in required contexts. |

**Recent develop runs (workflow `CI` + `ui-e2e`, newest 12 each):** all `conclusion=success`. Sampled job-level `e2e` on 6 newest CI runs: **all success** (so workflow green is not hiding a red advisory e2e *today*). That is **~1 day** of green, not the "~1 tuần ổn" P1b asked for. Do not flip P1b on this sample.

**INDEX / AGENTS / WORKSPACE-LEAN** say the two required checks block. That claim **matches protection**. They do **not** disclose advisory `e2e` / matrix / Trivy / in-job `acceptance:report`. `plans/260812-1018-qa-pipeline-agent-orchestration/plan.md:8-11` says `enforce_admins:false` and develop unprotected — **false as of this measurement**.

```
push any branch
 ├─ workflow CI
 │   ├─ typecheck-and-test  ── required ── BLOCKS merge
 │   ├─ e2e (API)           ── continue-on-error ── advises
 │   └─ security-scan       ── continue-on-error + exit 0 ── advises
 └─ workflow ui-e2e
     └─ ui-e2e              ── required ── BLOCKS merge
         ├─ Playwright ui-chromium
         ├─ acceptance:report          BLOCKS here (not in CI job)
         └─ business:verify --strict   BLOCKS
```

## 2. Acceptance numbers (measured)

| Artifact | SHA | Dirty | Verdict |
|---|---|---|---|
| **CI** `ui-e2e` run [31668483286](https://github.com/manhquydev/cmc_edu/actions/runs/31668483286) artifact `acceptance-journeys-7227676…` | `7227676` | **false** | **Ledger of record.** stats: expected 60, unexpected 0, skipped 0, flaky 0. |
| Local `acceptance-report/verification.json` | commit `7b0686d`; evidence SHA `b5bd0cc` | **true** | **Not ledger.** 43 flows all `built`; evidence 37 `built-unproven` + 6 `not-yet`; 36 badges `stale`; 33 unrun journeys. Generated 2026-08-13T03:55Z against a dirty tree. |
| Local `apps/e2e/acceptance-results/journeys.json` | `b5bd0cc`, dirty, **single spec** `shift-register-approve-reject` | — | Partial local run. Do not quote. |
| INDEX-live `36/42` | dated 2026-08-12 | — | **Claim.** Denominator now **43** (P2-09 added). |

Recompute from manifest + CI report (this worktree's `flow-manifest.ts`, CI files at `7227676`):

| Bucket | Count | IDs |
|---|---:|---|
| Flows declared | 43 | — |
| Has journey + spec in CI artifact | **36** | P1-01..13, P2-04/06/07/08, P3-01..09, P4-01..05, ADM-01..05 |
| `no-ui-path` | 6 | P2-01, P2-02, P2-03, P2-05, P3-10, P3-11 |
| UI exists, no journey | 1 | **P2-09** xếp dãy (`flow-manifest.ts:546-560`) |
| Untriaged tRPC orphans (local scan photo) | 0 | 17 documented gaps |

**Spot-check: several `no-ui-path` details are stale vs HEAD.** Do not put "build these screens" on a new roadmap.

| Flow | Manifest claim | HEAD |
|---|---|---|
| P2-01 | `rg classBatch.create … = 0`; list-only | `apps/admin/src/pages/classes/index.tsx:260` calls `lmsOps.createClassWithUnits`. Wrong procedure in the grep. |
| P2-02 | no in-app `?session=` link (2026-07-25) | `teaching/attendance.tsx` + `attendance-panel.tsx` on session detail exist. Re-measure reachability; do not rebuild the page. |
| P2-03 | `rg classSession.assignUnit = 0` | `class-detail.tsx:208` `classSession.assignUnit.useMutation`. Claim false. Student open-tier journey still missing. |
| P2-09 | honest: UI, no journey | True. Sequence screen shipped with #123. |

Journey method ceiling: **36/43 proven at `7227676` if ledger regenerated on that SHA**. INDEX 36/42 under-counts flows. "7 `no-ui-path`" in older AGENTS copy is also stale (6 + 1 no-journey).

`pnpm acceptance:report` locally would still be **stale/dirty** unless pointed at the CI artifact + matching HEAD. This session did **not** rewrite local `verification.json`.

## 3. Plan-overlap table

Worktree HEAD = `bc3f473` (#131). `origin/develop` is **one commit ahead**: `7227676` (#134 DataTable keyboard). Spot-checks below use this worktree unless noted "origin/develop".

| Plan | YAML / header status | Spot-check (1 claim vs HEAD) | Real remaining? | Recommend |
|---|---|---|---|---|
| `260813-0120-design-system-hardening` | `in-progress`; "C local, chờ PR" | **False.** Kanban C is on develop: #127 `bc986bd`, #128 `cc7b7b7`. `pipeline.tsx:511` `count={stageItems.length}`. Keyboard phase D "backlog" is on **origin/develop** #134 (`7227676`). Local `data-table.tsx:147-161` still mouse-only because this worktree has not fast-forwarded. Focus-visible: cook `23d882d` **unpushed** worktree. | Leftover = **one unpushed CSS PR** (`:focus-visible`). A/B/C/keyboard done. | **keep-as-child** for focus-visible only; then **close**. Do not re-spec token isolation / css-vars / LMS `<15`. |
| `260813-0813-nen-van-hanh-lop-va-danh-tinh-gia-dinh` | `pending`; child of 1407 | A1 claim matches: `ClassSession @@unique([classBatchId, sessionDate, startTime])` `schema.prisma:772`; phase file `status: completed`; merged #131. `StudentLifecycle` still 3 values (`schema.prisma:93-97`). No `SessionCancelReason`. `Student` has no code/DOB/gender/notes (`schema.prisma:423-431`). `loginStudent` still `findMany` + password-match (`lms-auth/router.ts:546-572`). No lesson-in-unit model. | **Yes.** A2–A5 + B1. A1 done — do not redo unique-key. | **keep-as-child** of 1407. Update parent/child status: A1 shipped. |
| `260813-0053-thu-vien-bai-tap-va-xep-day` | `pending` | Claim `@@unique([curriculumUnitId, type])` **false on HEAD**. `Exercise` has `folderId`+`title`, no unit FK (`schema.prisma:834-854`). `ExerciseFolder` exists, no `facilityId`. Fallback removed (`exercise-delivery.ts:172` + int test). UI: `exercises.tsx` + `exercise-detail.tsx` + sequence page. Merged #123 `27e9ebed`. | Leftover = **P2-09 journey** (and maybe `exercise.update` unused). Not 1.5–2.5 weeks of model work. | **ignore-stale** (mark completed). Point leftover journey at quality/acceptance, not a new B5 plan. |
| `260812-1407-hop-nhat-lms-theo-chuan-van-hanh` | `pending` (program) | Đợt 1 "4 unit seed" **false**: `import-curriculum-units.mjs:34-38` `EXPECTED_COUNTS.TOTAL: 96`. Makeup API gone (`addMakeup` = 0). B5/B6 shipped as #123. Đợt 3 identity **not** shipped (`LoginOtp` still in schema ~1053; OTP journey still in manifest P1-07). Đợt 4 gói bán: still no package model (plan says so; not re-verified by grepping every finance field). Đợt 5: `scripts/lms-v2/` still absent per phase-05. | **Yes, as parent.** Remaining = child 0813 (A2–B1) + **Đợt 4 UI/gói bán** + **Đợt 5 import**. Do not re-do Đợt 1 CSV or Đợt 2 library. | **keep-as-child target of ROADMAP** (the program). Do not duplicate phases that live in 0813/0053. |
| `260812-1145-quality-hardening-p1-p5` | `ACTIVE` | P1a/P1c/P2 claimed first-wave: INDEX + `grade.test.ts:155` atomic-lock test still present; orphan ratchet lives in `verify.ts` + **blocking** `ui-e2e.yml:197-200` (CI job still `\|\| continue-on-error`). P1-08 journey exists (`flow-manifest.ts:208-221`) and is in the CI artifact. | Remaining: **P1b** (promote API `e2e` — still `ci.yml:152`), **P3** ADR/INDEX refresh (INDEX already stale), **P4** develop→main human, **P5** human UAT. | **keep-as-child** for P1b/P4/P5 only. Waves 1–2 **ignore-stale**. |
| `260812-1018-qa-pipeline-agent-orchestration` | awaiting chốt §5 → §6 | §6.1 protect develop + `enforce_admins:true`: **done** (API above). §6.2–3 PR #110: INDEX says merged. F8 = same as quality P1b. | Pipeline-as-product: **done**. Leftover F8 must not be specified twice. | **ignore-stale**. Point F8 at `260812-1145` P1b. Do not "protect develop" again. |

### Parent / child (do not fork)

```
260812-1407 hop-nhat-lms          ← program of record (Đợt 4–5 still open)
 ├─ Đợt 1 khung 96 unit           ← SHIPPED (importer). phase-01 YAML pending = lie
 ├─ Đợt 1 leftover lifecycle      ← 260813-0813 A2, A3, A4
 ├─ Đợt 2 B5+B6 library           ← 260813-0053 SHIPPED #123
 ├─ Đợt 3 family identity         ← 260813-0813 B1 (rebase after A4)
 ├─ Đợt 4 vận hành + gói bán      ← NO child plan file yet — this is the hole
 └─ Đợt 5 import/cutover          ← phase-05, blocked on 4

260813-0120 design-system         ← leftover focus-visible PR; then close
260812-1145 quality               ← leftover P1b / P4 / P5 (governance, not LMS)
260812-1018 qa-pipeline           ← historical; do not execute §6 again
```

## 4. What a completion ROADMAP may contain

**Allowed (pointers):**

1. Execute `260813-0813` A2 → A3 → A4 → A5; B1 rebase after A4 (file-ownership table in that plan is still the merge protocol).
2. Then `260812-1407` Đợt 4 (gói bán + vận hành UI that is *actually* missing — not class-create, not exercise library). Then Đợt 5.
3. Land leftover DS `:focus-visible` PR; close `260813-0120`.
4. After ≥1 week of green API `e2e` jobs, **one-line** P1b: drop `ci.yml:152` `continue-on-error` **and** add check name `e2e` to branch protection — or it still will not block (`ui-e2e.yml:103-104` already stated this). Human P4 promote develop→main; P5 UAT. Never auto-claim production-ready.
5. Add **P2-09 journey** (sequence screen exists). Re-triage P2-01/02/03 `no-ui-path` against current UI before scheduling "build screens".

**Forbidden (duplication / fight HEAD):**

- New token-isolation / phantom-css-var / kanban-count / DataTable-keyboard phases.
- New ExerciseFolder / drop-unit-unique / fallback-delivery phases.
- New ClassSession unique-key / archiveSlot phases (A1).
- "Protect develop" / `enforce_admins` / "flip orphan `\|\| true`" (orphan already fails `ui-e2e`).
- Treating INDEX dual-HITL GAP #3 (exercises list Công bố) as live — list file has no those buttons; form-depth exists.

## Comparative analysis (how to finish, not what stack)

| Option | Completeness | Collision with live plans | Maintenance | Cost |
|---|---|---|---|---|
| **A. Pointer ROADMAP** (recommended) | High if it names remaining phases | None if it only links | Low — one index | Hours of writing |
| B. New 6-phase "completion" plan that copies 0813/1407 | Looks complete | **Fights** A1/B5/DS already merged | Agents will re-implement | Weeks of waste |
| C. Ignore live plans, drive from INDEX 36/42 | False baseline | Rebuilds shipped UI | High | Highest defect rate |
| D. Promote every advisory CI gate now | Stronger gates | P1b too early (1 day ≠ 1 week); Trivy has no owner | Noise → people delete gates | Medium, wrong time |

**Adoption risk:** solo + AI. Extra plans are how this repo already drifted (six "pending" folders, three already shipped). Breaking-change history on LMS is intentional (not-production assumption in 1407). Abandonment risk is **plan abandonment**, not library abandonment.

**Architectural fit:** existing stack already has the two-tier CI the QA plan wanted. Remaining product work is LMS model (lifecycle, cancel reasons, family login, pricing catalog) sitting on a Console that is "good enough" after A/B/C/#134.

## Ranked recommendation

1. **ROADMAP = pointer index.** One page. Links to `260812-1407` + `260813-0813` + leftover DS PR + leftover quality P1b/P4/P5. No new phase files for shipped work.
2. **Mark stale YAML completed/superseded** on 0053, 1018, DS A/B/C/keyboard, quality waves 1–2, 1407 phase-01/02. Historical files stay (WORKSPACE-LEAN: never mass-delete).
3. **Do not promote API `e2e` this week.** Job is green on sampled develop runs; the written time-gate is unmet. When flipping: YAML **and** protection context `e2e`, or it is theater.
4. **Do not treat local `verification.json` as 36/42.** Quote CI artifact SHA `7227676` / run 31668483286 / 60 specs. Re-run ledger on that SHA if a number must be published.
5. **Fast-forward local `develop`** (`bc3f473` → `7227676`) before any DS/keyboard cook, or you will re-implement #134.

## Common pitfalls

- Reading `plan.md` status as work remaining.
- `gh run list --workflow=typecheck-and-test` (empty). Use workflow `CI`.
- Quoting `acceptance:report` inside `typecheck-and-test` as the orphan gate (it is not; `ui-e2e` is).
- Rebuilding class-create / exercise library / session unique because a parent phase file still says `pending`.

## Resources

- Protection: GitHub API `branches/main/protection`, `branches/develop/protection`
- Workflows: `.github/workflows/ci.yml`, `ui-e2e.yml`
- Ledger rules: `scripts/acceptance-report/flow-evidence.ts`, `verify.ts`
- Prior pipeline research (same day, YAML-only): `plans/reports/research-260813-0908-dev-pipeline.md` — still accurate on continue-on-error lines; **stale** if used for plan status (DS/C/library/A1 landed after 09:08).
- Live pointer (itself stale on counts/GAP#3/DS C): `plans/reports/INDEX-live-260812.md`

## Limitations

- Did not run `pnpm acceptance:report` against the downloaded CI artifact (would mutate local `/acceptance-report/`). Proven 36 is inferred from manifest ∩ CI spec files + ingest rules, not a regenerated `verification.json`.
- Did not audit Đợt 4 gói bán schema beyond "plan says no package model".
- Did not open every child phase of 0813 for AC vs HEAD beyond A1 + lifecycle/login/lesson absence.
- P2-02 reachability (`?session=` vs session hub) not walked in a browser.
- `origin/develop` #134 not in this worktree; keyboard claim for local files would be wrong.

## Unresolved questions

1. Is P1b's "~1 tuần ổn" calendar already running from #110 merge (2026-08-12), or does it restart after #134?
2. Who owns Trivy findings if `security-scan` is ever made required?
3. Đợt 4 gói bán: still no child plan — is that a missing plan or an explicit "don't start until 0813 A4"?
4. Should P2-09 journey be a one-PR under 0053 (close-out) or under quality P2 leftovers?

## Next steps (for the ROADMAP author, not this session)

1. Write ROADMAP as pointers only.
2. Tick/close stale plan YAML.
3. Continue 0813 at A2, not A1.
4. Publish acceptance from CI run 31668483286, not INDEX.
