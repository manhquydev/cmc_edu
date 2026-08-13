# QA Pipeline + Agent Orchestration — cmc_edu

**Status:** ignore-stale (2026-08-13). `develop` đã branch-protected (`strict` + `enforce_admins: true`).
Leftover **F8** (API job `e2e` `continue-on-error`) → plan `260812-1145` P1b. Không cook lại protect-develop.

**Status:** v2 (post red-team) — awaiting user **chốt** on §5 → implement §6
**Date:** 2026-08-12
**Owner:** Herdr orchestrator (claude, w3:pB)
**Inputs:** scout `scout-260812-1013-project-state.md` · ADR `analysis-260812-1013-adr-journal-vs-business.md` · safety `codex-260812-1013-develop-safety.md` · red-team (kongming, in-session) · AGENTS.md operating model

> Red-team verified against live repo config, not just reports: `main` protection has
> **`enforce_admins:false`** (admin can bypass); `develop` unprotected (404); API `e2e`
> job is `continue-on-error` + non-required (`ci.yml:142`); the develop-RED `orderGlobal`
> fix already sits on PR #110's branch (`4736118`/`08c4f1b`).

---

## 1. Failure modes the pipeline must prevent

| # | Failure mode | Evidence |
|---|--------------|----------|
| F1 | Red/unreviewed change reaches a shared branch | codex: PR #109 red-at-merge; **both branches admin-bypassable** |
| F2 | Local-only branch bypasses `ui-e2e` → e2e drift on merge | memory develop-consolidation |
| F3 | Acceptance measured from stale local `journeys.json`, not CI artifact | scout §measurement |
| F4 | `acceptance:report` red from unclassified tRPC orphans (24; 14 `lmsOps.*`) | scout §3 |
| F5 | ADR/doc drift read as law (LMS-Frontend "Not started"; 0039/0040/0045; ADR-C) | ADR analysis |
| F6 | Flaky `grade.test.ts` atomic-lock case fails CI intermittently | memory flaky-grade |
| F7 | Journey = smoke, not business-math; human UAT never run | scout K4 |
| **F8** | **API `e2e` job non-blocking → money/provisioning regressions pass all gates** | red-team: `ci.yml:142` continue-on-error, not required |

Binding principle: **`strict` + required checks + `enforce_admins:true`** is what makes "CI is the review bench" real for a solo admin. Everything else is convention.

---

## 2. Pipeline — two tiers (avoid solo-abandonment)

Route by S1 gitnexus impact tier.

**LIGHT** (docs, small UI, single-module): **S2 → S3 → S5 → S8.**
**FULL** (schema, money, cross-app, LMS gates): add **S0, S1, S4, S6.**

| S | Stage | Gate (checkable) | Worker |
|---|-------|------------------|--------|
| S0 | Scout | affected surfaces known | `ak:scout` on **pi** + Claude `Explore` |
| S1 | Impact/risk tier | no HIGH/CRITICAL unreviewed; selects Light/Full + review tier | gitnexus `impact`/`detect_changes` (orchestrator) — *practice inside S2, not a staffed stage* |
| S2 | Implement | feature branch + PR (never local-only); **tests in diff** cover changed behavior | `ak:cook` on **grok** / `fullstack-developer` subagent |
| S3 | Local validation | typecheck + targeted vitest green (DB via `.env`) | `ak:test` / `tester` subagent |
| S4 | Review (FULL only, risk-tiered) | one reviewer signs off | **codex** for HIGH/money/schema/cross-module (decorrelated model); skip for docs/small-UI |
| S5 | CI gate (non-bypassable) | `typecheck-and-test` + `ui-e2e` + `business:verify --strict` green | orchestrator babysit; **flake rerun-once ONLY for quarantine list = {`grade.test.ts` atomic-lock}; 2nd rerun/wk → fix task** |
| S6 | Acceptance (FULL) | measured from **CI artifact**; new procedures classified in `flow-manifest.ts` same PR | `acceptance:report` via **pi** |
| S8 | Merge governance | green PR only; `strict` forces rebase+re-run; human **chốt**/merge | orchestrator + human |
| S9 | Post-merge | target branch push runs green (glance) | orchestrator; full codex safety audit = **weekly / pre-promotion** |

UAT (F7) stays **manual**, flagged in S6 — never auto-claim "production-ready".

---

## 3. Agent / command assignment (fan-out cap: 2–3 concurrent)

| Worker | Kind | Home | Stages | Commands |
|--------|------|------|--------|----------|
| claude | orchestrator | w3:pB | S1,S5,S8 coord | gitnexus, gh, herdr |
| scout-pi | pi pane | w3:p8 | S0,S6 | `ak:scout`, acceptance:report |
| ui-console | grok pane | w3:p9 | S2 | `ak:cook`,`ak:fix` |
| ui-lean | grok pane | w3:pA | S7 docs (batch) | `ak:docs` |
| codex | codex pane | w3:pC | S4 (HIGH only), S9 weekly | read-only audit, gh |
| code-reviewer / tester / kongming | Claude subagents | in-proc | S3/S4 overflow; hard-call advice | `ak:test`,`ak:code-review` |

Default **serial**; fan-out only when file ownership disjoint AND deadline pressure.

---

## 4. Governance (needs user chốt — outward repo config)

1. **Protect `develop`**: required `typecheck-and-test`+`ui-e2e`, `strict:true`, require-PR (0 approvals — solo), **`enforce_admins:true`**. (Safe while develop is red — gates future merges, not the current tip.) → closes **F1/F2**.
2. **Set `enforce_admins:true` on `main`** too (currently false). → makes existing protection binding.
3. ~~Manual serialization~~ — **cut**; `strict:true` enforces rebase→re-run→merge mechanically.
4. **Acceptance truth = CI artifact** (S6). Later: ~20-line `acceptance:report:ci` guard (refuse `gitDirty`/sha-mismatch) — nice-to-have.
5. **develop→main promotion**: per-wave cadence; promote when develop green on both checks + CI-artifact acceptance ≥ last promoted (no lost flows) + human chốt. Don't let develop accumulate 40+ commit deltas again.
6. **Second-slice ratchets** (after RED closed): promote API `e2e` to required after ~1wk stable (closes **F8**); remove `acceptance:report || true` once orphans classified to 0 (closes **F4** recurrence).

---

## 5. Decisions for chốt (red-team pre-answers in *italics*)

- **D1 — approve branch protection w/ `enforce_admins:true` on develop + main?** *Recommend yes; it's the one change that closes F1/F2.*
- **D2 — fix develop RED separately?** *No — same action as merging PR #110 (fix already on its branch).*
- **D3 — "giao diện" = runnable driver/dashboard?** *No — pipeline = branch protection + this checklist doc; a dashboard is a 2nd product to maintain.*
- **D4 — max parallel sessions?** *Cap 2–3.*
- **D5 — first implementation scope?** *Minimal slice only (§6), then stop.*

---

## 6. Minimal first slice (closes F1/F2, fixes develop RED, dogfoods S5/S8)

1. **[user OK]** Set branch protection on `develop` (checks+strict+require-PR+`enforce_admins:true`); same-day flip `enforce_admins:true` on `main`. ~5 min, reversible.
2. **update-branch PR #110** (into `develop`) → babysit CI on merged head → green.
3. **Human merges #110** (agents never merge) → confirm `develop` push runs green ⇒ develop RED closed with zero new commits.
4. **Stop.** Second slice (orphan ratchet, P1-08 journey, API-`e2e`→required, ADR/doc batch, promotion criteria) is separate.

**Assumptions to confirm at merge:** #110 tip ≈ post-merge develop tree (strict update-branch re-run is the safety net); verify API `e2e` job on #110 before ever promoting it to required.
