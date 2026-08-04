# Red-team plan review — Assumption Destroyer

**Plan:** `plans/260804-cycle-4-soft-ops-governance/`  
**Date:** 2026-08-04  
**Reviewer role:** Hostile assumption destroyer (read-only vs plan + codebase)  
**Verdict:** Plan residual is real for **a11y lite + doc/lab bookkeeping**, but **overclaims “4a residual” metrics that are already green**, **confuses report-only depth with CI authority**, and **can greenwash MS-3** with a file existence check.

Live remeasure (2026-08-04, this review):

```text
node --test scripts/check-ui-frames.test.mjs  → 3/3 pass
node scripts/check-ui-frames.mjs --strict     → exit 0
detailTiers: full=2 · standard=2 · settings=3 · thin=2
dualTitleReview=0 · bulkListsOk=true · filterBarCount=6
A11Y-BASELINE.md                              → ABSENT
```

---

## Findings (max 10)

### 1. CRITICAL — Success metrics pad already-green Cycle 4a gates as *this* plan’s delivery

| | |
|--|--|
| **Severity** | Critical |
| **Title** | Plan success table re-lists closed 4a metrics as residual outcomes |
| **Evidence** | `plan.md:57-68` lists dualTitleReview=0, bulkListsOk, detailTiers present, filterBarCount≥5, PAGE-FRAMES §C, check-ui-frames tests+strict as *whole-plan* success. Live run already meets all of those **before any phase 2/3 work**. Only unsatisfied rows are A11Y checklist doc (+ links). Prior cook: `plans/260804-ui-smart-cohesion-upgrade/reports/cook-validate-cycle-4a-2026-08-04.md` already claims MS-1/2/4 delivered. |
| **Why assumption fails** | Treats “verify green” as if it produces new proof. A cook can short-circuit phase 1, write a thin A11Y file, and report a full metric board as *this* plan’s win — inflated completion signal. |
| **Suggested fix** | Split metrics into **Precondition (already green — remeasure only)** vs **Residual deliverables (A11Y-BASELINE + MASTER/llms link + lab/work-def honesty)**. Do not count dual-title/bulk/filterBar/tiers as cycle-4 residual success. |

---

### 2. CRITICAL — “Depth metrics measurable via `pnpm check:ui-frames`” overstates enforceability

| | |
|--|--|
| **Severity** | Critical |
| **Title** | Outcome claims CI/measurable depth; `--strict` still only dual-title + bulk |
| **Evidence** | Outcome `plan.md:37` “Depth metrics are measurable (`pnpm check:ui-frames`)”. Script comment + gate: `scripts/check-ui-frames.mjs:4-5`, `146-147` (“Report-only depth signals (not strict gates)”), `181-191` (strict only `bulkListsOk` + `dualRisk`). CI step name still “bulk gate”: `.github/workflows/ci.yml` ~111–113 runs `pnpm check:ui-frames && pnpm test:ui-frames`. Unit tests pin *named* files (`check-ui-frames.test.mjs:32-64`) but **do not** enforce PAGE-FRAMES required chrome (e.g. HighlightStrip on full/standard). Classifier: `check-ui-frames.mjs:68-73` — full = EH+Workflow only; standard = EH only; **no HS check**. Docs require HS: `PAGE-FRAMES.md:72-73,96`. |
| **Why assumption fails** | Agents will read “measurable / check:ui-frames green” as “depth cannot regress.” False: drop HighlightStrip, empty a tier bucket (if tests not hit), or reclassify via string noise — `--strict` still 0. Plan success row “`--strict` pass” does **not** prove tier integrity. |
| **Suggested fix** | Rewrite outcome: “depth **reported** in JSON; **enforced** only where unit tests pin named exemplars; HS/slot fidelity **not** gated.” Optionally add test asserts for HS on full/standard **or** explicitly non-goal “no new depth strict.” Do not claim MS-2 fully closed if “CI depth matrix” meant fail-on-regression. |

---

### 3. HIGH — Phase 1 “mostly done / verify only” is true for code, false for 4a *governance close*

| | |
|--|--|
| **Severity** | High |
| **Title** | Verify-first short-circuit can skip the only remaining 4a bookkeeping |
| **Evidence** | `plan.md:53` “Mostly done in prior cook — verify only”; `phase-01:14,28-38` short-circuit on two node commands. But advise cook checklist still **all open**: `advise-ms-p1-detail-governance-2026-08-04.md:49-54` (`[ ]` Docs/script/test/llms/lab/validate). work-definition §7 marks Slice D done (`work-definition-clear-2026-08-04.md:125`) while §8 still says “Optional next: Slice D detail tiers” (`:135`). Red-team banner still “cycle 3” / “Detail recipe still mid-band” (`design-lab-redteam.tsx:172-176`) while H6=`fixed` and scorecard Detail=4 (`:23,96-103`). |
| **Why assumption fails** | “Phase 1 verify green ⇒ 4a closed” assumes code ≡ governance. Code is closed; **stale advise checklist + contradictory work-def + mid-band banner** are the residual — currently parked in phase 3 or invisible to phase 1 criteria. |
| **Suggested fix** | Phase 1 success must include: remeasure **and** either (a) stamp advise checklist / fix work-def §8 contradiction **in phase 1**, or (b) explicitly scope those to phase 3 and drop “4a close” language from phase 1 title. Banner “mid-band” must be fixed or phase 1 must fail honesty check. |

---

### 4. HIGH — Phase 2 can “close” MS-3 with file existence while original finding demanded automation *or* real keyboard pass

| | |
|--|--|
| **Severity** | High |
| **Title** | MS-3 lite success criteria are doc-grep theater, not a baseline re-run |
| **Evidence** | Research MS-3: `research-redteam-ds-multi-scope-2026-08-04.md:259` — “Minimal: axe on shell+list+dialog smoke **OR** periodic manual keyboard pass doc”. Plan phase 2 validation: `phase-02:65-69` = `test -f A11Y-BASELINE.md` + grep MASTER/llms + `--strict` (unrelated). Success: “lists ≥5 operator paths” (`phase-02:52`) with **no** required execution log, owner, or last-run date. Red-team has **no** a11y/MS-3 finding today (only H* frame findings). MASTER already has generic “Accessibility checklist (ship gate)” unchecked: `MASTER.md:189-198`. |
| **Why assumption fails** | Writing paths ≠ proving keyboard pass. Plan can mark MS-3 “fixed-lite” while never running the paths, never reconciling MASTER’s existing checklist (dual SoT), and never adding an open/partial red-team row that survives audit. “Partial→partial or fixed-lite” (`phase-02:20`) is an escape hatch to claim closure either way. |
| **Suggested fix** | Define MS-3 residual as **one** of: (1) A11Y-BASELINE with required **last manual pass** section (date, who, paths, fails), or (2) keep status **open/partial** forever until axe smoke. **Reconcile** MASTER §Accessibility (link A11Y-BASELINE as authority; don’t fork). Red-team: add explicit MS-3/H* row status=`partial`, never `fixed` for doc-only. Ban “fixed-lite” wording in scorecard. |

---

### 5. HIGH — Architecture assumes composites “already ship many roles”; SideNav shell path is weak

| | |
|--|--|
| **Severity** | High |
| **Title** | Checklist will document roles that shell nav does not implement |
| **Evidence** | Phase 2 architecture: `phase-02:26-31` “Shell: SideNav, ⌘K, focus” + “composites already ship many roles — document expected, don't invent.” FilterBar/ListPagination/Bulk/Toast/EntityHeader **do** ship roles (`filter-bar.tsx` role=search; `list-pagination.tsx` role=navigation; `bulk-action-bar.tsx` role=toolbar; `toast.tsx` aria-live; `entity-header.tsx` h1). **SideNav does not:** `side-nav.tsx:29-54` — bare `<aside>`/`<nav>`/`<button>`, **no** `aria-current`, **no** aria-labels on icon rows, **no** keyboard tree pattern beyond native button tab. Command palette has dialog/listbox (`command-palette.tsx`) but focus-trap rigor is not proven by plan inventory step. |
| **Why assumption fails** | Inventory step (`phase-02:44`) is correct process; success criteria do **not** require inventory findings to drive checklist honesty. Risk: baseline claims “SideNav keyboard OK” when active route is only a CSS class (`is-active`). |
| **Suggested fix** | Checklist must split **Implemented (cite file:role)** vs **Known gaps (SideNav aria-current, …)**. Gaps stay `partial`; do not invent composite changes in this plan (non-goal) but **do not document gaps as shipped**. |

---

### 6. HIGH — Tier classifier trusted as PAGE-FRAMES authority; docs ≠ heuristic

| | |
|--|--|
| **Severity** | High |
| **Title** | Phase 1 “trust heuristics” assumes classifier matches §C recipe table |
| **Evidence** | Phase 1 risk: `phase-01:51` “trust SettingsShell/EntityHeader/Workflow heuristics already in script.” Classifier `check-ui-frames.mjs:68-73` file-level `src.includes(...)`. PAGE-FRAMES required chrome includes HighlightStrip for full **and** standard (`PAGE-FRAMES.md:72-73,96-97`). Current product files happen to include HS (spot-check opportunity/receipt/student/class) — **not enforced**. Any new `*DetailPage` function name / comment containing the substring `DetailPage` without frame usage can skew counts (coarse scan). Settings always wins over EH even if both present. |
| **Why assumption fails** | “detailTiers classifies 9 into 4 buckets” (`phase-01:44`) proves **partition of current files**, not **recipe compliance**. Agents told “measure tiers via check:ui-frames” (`PAGE-FRAMES.md:82`) will equate bucket membership with correct chrome. |
| **Suggested fix** | Document classifier as **proxy**, not full recipe validator. Phase 1 criteria: “buckets non-empty + exemplars match table” (already partially in tests) **and** explicit non-claim: “HS/WF slot compliance not scanned.” Optionally tighten classifier later — out of residual scope unless tests added. |

---

### 7. MEDIUM — Outcome “agents know correct depth per screen class” overclaims coverage

| | |
|--|--|
| **Severity** | Medium |
| **Title** | Only 9 DetailPages + 4 example pairs; no decision tree for new routes |
| **Evidence** | Outcome `plan.md:36`. Authority table examples only: `PAGE-FRAMES.md:72-75`. Live `detailPageCount=9` — all classified. Plan does not inventory non-DetailPage entity UIs, FormPage depth, or “when to promote thin→standard.” thin residual (payroll, my-hr) named but no promote criteria beyond prose (`PAGE-FRAMES.md:81`). |
| **Why assumption fails** | “Screen class → tier” is not operationalized for agents beyond reading 4 rows. MS-1 “under-adopted EH” is **redefined away** by labeling settings/thin intentional — valid product choice, but outcome language sounds like universal agent certainty. |
| **Suggested fix** | Outcome → “Agents have named tiers + exemplars + measure command; **new** DetailPage must pick a tier in PR description / lab inventory.” Optional one-page decision: entity identity? → EH; config rail? → settings; else thin. |

---

### 8. MEDIUM — Phase 3 rewrites prior-plan advise checklist history

| | |
|--|--|
| **Severity** | Medium |
| **Title** | Mutating another plan’s cook checklist after the fact falsifies provenance |
| **Evidence** | `phase-03:25-26,33,41` — modify `advise-ms-p1-detail-governance-2026-08-04.md` checklist to `[x]` with evidence commands. That file is the **pre-cook advise** artifact under `plans/260804-ui-smart-cohesion-upgrade/`. Cook completion already recorded separately: `cook-validate-cycle-4a-2026-08-04.md`. |
| **Why assumption fails** | Checking boxes later makes it look like the original cook session closed its own list; audit trail loses “advise open → cook delivered → validate report.” |
| **Suggested fix** | Leave historical advise checklist immutable; add one line “Superseded: evidence in cook-validate-cycle-4a + this plan’s cook-complete.” Put `[x]` only on **this** plan’s phase criteria / cook-complete. |

---

### 9. MEDIUM — Lab red-team “not claiming depth matrix missing” is already true; stale banner can survive

| | |
|--|--|
| **Severity** | Medium |
| **Title** | Phase 3 success criterion too weak for lab honesty residual |
| **Evidence** | `phase-03:44` “Red-team panel not claiming ‘depth matrix missing’” — H6/C2 already `fixed` with detailTiers evidence (`design-lab-redteam.tsx:41-48,96-103`). Contradictions remain: banner cycle 3 + mid-band detail (`:172-176`); H3 evidence still “~8 list bulk cohort” while ListPagination count is **11**; scorecard Enforceability “dual-title strict” omits that depth is report-only (`:27`). Phase 2 also modifies same file (`phase-02:39`) — ownership overlap. |
| **Why assumption fails** | Criterion passes **today** without phase 3 edits. Cook can no-op lab and still check the box while banner/scorecard mislead agents. |
| **Suggested fix** | Require concrete lab diffs: banner date/cycle 4; remove “Detail recipe still mid-band” or justify score; align H3 evidence to 11; add MS-3 partial row; single phase owns `design-lab-redteam.tsx`. |

---

### 10. LOW — Phase status / plan status inconsistency invites double-cook or skip

| | |
|--|--|
| **Severity** | Low |
| **Title** | plan.md says phase 1 mostly done; phase-01 frontmatter still `pending` |
| **Evidence** | `plan.md:53` vs `phase-01:4` `status: pending`. Plan `status: in_progress` (`plan.md:5`) while almost all numeric gates pre-satisfied. |
| **Why assumption fails** | Orchestrators (`/ck:cook --auto`) may re-implement 4a (phase-01 risk “False re-cook”) **or** treat entire plan as unfinished engineering when residual is docs. |
| **Suggested fix** | Set phase-01 status to `verify` / `ready_to_confirm` with explicit “code complete pending remeasure stamp.” Keep plan in_progress only for phase 2–3 residual. |

---

## What the plan got right (risk calibration only)

- Live remeasure **confirms** PAGE-FRAMES §C tiers, `detailTiers` JSON, dual-title 0, bulk≥5, FilterBar≥5 — phase 1 **code** claim is not fiction.
- Explicit non-goals (no re-skin, no full axe CI, no force EH on settings/thin, no domain bulk) match research MS boundaries.
- Composites cited for list/detail feedback **mostly** already expose roles (FilterBar/ListPagination/Bulk/Toast/EntityHeader/PageHeader crumbs) — a11y lite as **documentation** is directionally correct if honesty about gaps is forced.
- axe **not** in repo (no real axe dependency); “don’t install axe” constraint matches lockfile reality.

## Residual work that is actually real

1. **Create** `design-system/cmc-edu/A11Y-BASELINE.md` (absent) with implemented-vs-gap inventory + re-run protocol — reconcile MASTER §Accessibility.  
2. **Link** from MASTER + `packages/ui/llms.txt` (no a11y pointer today).  
3. **Honesty sync:** work-def §8 vs §7; red-team banner/H3/MS-3; do **not** fake-close MS-3.  
4. **Remeasure stamp** only for 4a metrics — not as new delivery.

## Recommended plan edits (planner)

1. Rewrite success metrics → precondition remeasure table + residual-only table.  
2. Demote language: MS-2 “report fixed,” not “CI depth enforced.”  
3. Phase 1: either absorb bookkeeping or stop calling it “close 4a.”  
4. Phase 2: ban fixed-lite; require gap list (SideNav); reconcile MASTER checklist; red-team MS-3=`partial`.  
5. Phase 3: immutable historical advise; strengthen lab success criteria; single writer for red-team file.

---

## Metrics (review)

| Check | Result |
|-------|--------|
| Phase 1 code preconditions | **PASS** (tests + strict + 4 tiers) |
| Plan residual honesty | **FAIL** (metrics padding) |
| MS-3 close strategy | **AT RISK** (doc-only greenwash) |
| Lab/work-def single SoT | **FAIL** (stale contradictions) |
| A11Y-BASELINE exists | **NO** |

---

Status: DONE  
Summary: Phase 1 product/script work is already green; the plan’s real residual is a11y lite + governance honesty, but success metrics and MS-3/lab criteria allow false completion without fixing enforceability or stale SoT.  
Concerns: Do not cook until metrics split and MS-3 “fixed-lite” escape hatch removed.
