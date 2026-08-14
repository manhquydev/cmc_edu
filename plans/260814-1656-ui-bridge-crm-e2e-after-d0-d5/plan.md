---
title: "UI bridge CRM E2E after D0-D5"
description: "Wave 4A atoms + CRM E2E grammar (single CRM PR) + courses fan-out recipe. No shell/repaint."
status: completed
priority: P1
effort: "1-2 weeks solo+AI"
tags: [ui, design-system, design-lab, crm, bridge, wave-4a]
created: 2026-08-14
completed: 2026-08-14
blockedBy: []
blocks: []
supersedes:
  - 260813-2038-openeducat-visual-clone
narrows:
  - 260806-odoo-ui-component-dissection
related:
  - brainstorm: plans/reports/brainstorm-260814-ui-bridge-implement-direction.md
  - bridge: design-lab/system/BRIDGE.md
  - d0d5: plans/reports/impl-260814-d0-d5-design-path.md
  - contract: design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md
---

# UI bridge CRM E2E after D0-D5

## Overview

After D0–D5 and PR #142 **merged** into `develop`, adopt lab **grammar** into production: Wave **4A** atoms, one CRM E2E PR, then an adoption recipe proven on **courses** list. Prepares whole-project rollout without shell topology or gallery pixel repaint.

**Cook status (2026-08-14):** Implemented on `feat/ui-bridge-crm-e2e-after-d0-d5`. Local unit tests green; merge gated on CI `typecheck-and-test` + `ui-e2e`.

**Impeccable mode:** Operate. Authority = OpenEduCat chrome + lab grammar (not gallery 6/8px).

## Brainstorm contract (accepted 2026-08-14)

| Field | Content |
|-------|---------|
| Outcome | CRM uses lab grammar; recipe exists for safe fan-out. |
| Constraints | Visual contract wins pixels; Wave 9 closed; CI is review; under-claim empty kinds when evidence missing. |
| Non-goals | Rail/shell swap; gallery repaint; statusbar/funnel geometry; lab DnD; invent CRM server sort; bulk-widen without ID materialization; mega Wave 4→8; Wave 4B buttons/tabs in this plan. |
| Acceptance | CategoryChip + brand tone; CRM list+kanban grammar; BRIDGE recipe; courses proof; typecheck + UI tests green. |

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Park/narrow overlapping plans without killing audit authorities | P1 |
| 2 | Land Wave **4A** (badge brand + CategoryChip) | P1 |
| 3 | CRM list + pipeline grammar in **one** PR | P1 |
| 4 | Recipe + courses fan-out proof | P1 |

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [Kickoff gates](./phase-01-start.md) | Pending | — |
| 2 | [Park/narrow stale plans](./phase-02-park-stale-plans-and-baseline.md) | Pending | 1 |
| 3 | [Wave 4A atoms](./phase-03-wave-4-atoms-vocabulary.md) | Pending | 2 |
| 4 | [CRM list + pipeline grammar](./phase-04-crm-list-and-detail-grammar.md) | Pending | 3 |
| 5 | [CANCELLED — folded into 4](./phase-05-crm-pipeline-kanban-grammar.md) | Cancelled | — |
| 6 | [Recipe + courses proof](./phase-06-adoption-recipe-and-fan-out-proof.md) | Pending | 4 |

Cook phases **sequentially** for 3→4→6. `--parallel` only for research/review agents, **not** for editing `pipeline.tsx` in two workers.

## Architecture

```
Wave 4A (StatusBadge brand + CategoryChip)
        │
        ▼
CRM single PR (list + aftersale + kanban gap-audit)
        │
        ▼
BRIDGE recipe → courses proof → later module PRs
```

## Out of scope (hard)

- Wave 9 / Q-shell; gallery radius/palette repaint
- ProgressSteps / StageFunnel geometry ports
- Lab DnD / attendance-cycle demos
- CRM `sortable` / `onSelectAllMatching` without API support
- Wave 4B (button states, tabs indicator)
- Mass-sweep ~30 ListPages

## Success Criteria

- [ ] Clone execution superseded with residual chrome tracker; dissection annotated not cancelled
- [ ] `brand` + `CategoryChip` tested; no `:root` substring in `console.css`
- [ ] CRM empties: first-run/filtered under evidence rules; kanban isEmpty invariant tested; no fake sort/bulk-widen
- [ ] BRIDGE recipe + courses proof
- [ ] CI green on cook PRs

## Risks

| Risk | Mitigation |
|------|------------|
| Silent wrong empty-kind | Under-claim; evidence rules; tests |
| Receipt-list bulk-widen copy-paste lie | Forbid without ID materialization |
| Parallel cook on pipeline.tsx | Single CRM phase |
| Declaring Wave 4 complete | 4A partial only |

## Red Team Review

### Round 1 — 2026-08-14 (applied)

Reviewers: Assumption Destroyer, Failure Mode Analyst, Scope Critic, Fact Checker (0 factual fails on baseline claims).

| ID | Finding | Disposition | Plan delta |
|----|---------|-------------|------------|
| AD-1 | Phase 5 redoes shipped kanban empties | **Accept** | Phase 5 cancelled; Phase 4 = gap-audit |
| AD-2 | CRM sort has no server contract | **Accept** | Forbid sortable until API |
| AD-3 | Forced empty×3 invents `done` | **Accept** | first-run/filtered only for CRM |
| AD-4 | StatusBadge vs CategoryChip ambiguity | **Accept** | CategoryChip only; no category on StatusBadge |
| AD-5 | Mis-supersede dissection / density format | **Accept** | Annotate dissection; density in own format |
| FM-1 | Filter≠proof of filtered empty | **Accept** | Evidence / under-claim rules |
| FM-2 | Bulk-widen can lie (receipt pattern) | **Accept** | Forbid without ID materialization |
| FM-3 | Kanban isEmpty only prose | **Accept** | Mandatory invariant tests |
| FM-4 | `:root` comment fails CI | **Accept** | Ban substring anywhere |
| FM-5 | Pagination empty mislabel | **Accept** | Page-clamp tests |
| SC-1 | Phases 4+5 false parallel | **Accept** | Merge into Phase 4 |
| SC-2 | Wave 4 “landed” while partial | **Accept** | Wave 4A naming |
| SC-3 | Fan-out target vague | **Accept** | Preselect `courses/index.tsx` |
| SC-4 | Parking clone strands chrome debt | **Accept** | Residual tracker before supersede |
| FC-* | Baseline facts | N/A | All verified |

### Whole-Plan Consistency Sweep (after RT1)

- Removed dual CRM phase ownership; cook note forbids parallel pipeline editors.
- Non-goals updated: sort, bulk-widen, Wave 4B, forced `done`.
- Fan-out target fixed to courses.
- Supersedes vs narrows distinguished in frontmatter.

Unresolved contradictions: **None**.

### Round 2 — 2026-08-14 (applied)

| ID | Finding | Disposition | Plan delta |
|----|---------|-------------|------------|
| RT2-AD | Force brand/CategoryChip on CRM without map | **Accept** | Under-claim; prove CategoryChip on courses program with documented map |
| RT2-FM1 | Neutral empty vs required TableEmptySpec.kind | **Accept** | Bare string when under-claiming; keep kanban facilityCount matrix |
| RT2-FM2 | Courses forced filtered without baseline | **Accept** | Filtered kind optional; honest empty OK |
| Kongming | GO with filtered-empty risk watch | Noted | Phase 4 cook watch |

### Whole-Plan Consistency Sweep (after RT2)

- Phase 4/6 aligned on under-claim + string fallback.
- CategoryChip first consumer = courses `program`, not CRM `source`.
- Unresolved contradictions: **None**.

### Round 3 — 2026-08-14

**CLEAN** — no Critical/High remain; cook-ready ([RT3](ac12232a-ae0a-4360-8be2-96872ebcd5ad)).

## Validation Log


### Round 1 — decisions locked from RT adjudication + owner-confirmed direction #2

Owner confirmed brainstorm #2 and authorized plan→RT→validate loops until clean. Interview topics resolved by accepted RT findings (no remaining open product forks inside this plan).

| Topic | Decision |
|-------|----------|
| Direction | CRM E2E + Wave 4A + recipe |
| Empty kinds | first-run/filtered; under-claim if no baseline |
| Sort | Out until API |
| Bulk widen | Out until ID materialization |
| Fan-out page | `courses/index.tsx` |
| Wave 4 scope | 4A only this plan |
| Stale plans | Supersede clone (+residual); narrow dissection |

### Verification Results (pre-RT fact check)

- Claims checked: 7 core + RT evidence cites
- Verified: SoftTone lacks brand; pipeline/aftersale string empties; TableEmptySpec exists; #142 merged; overlapping plan dirs exist
- Failed: 0
- Tier: Full (6 phase files)

## Cook handoff (after RT2 clean)

```
/ak:cook plans/260814-1656-ui-bridge-crm-e2e-after-d0-d5 --advice
```

Prefer **sequential** phase cook; use `--parallel` only for non-overlapping file owners (e.g. docs park vs atoms), never two agents on `pipeline.tsx`.

Then `/ak:test` and `/ak:code-review --parallel --advice`.

<!-- slug: ui-bridge-crm-e2e-after-d0-d5 -->
