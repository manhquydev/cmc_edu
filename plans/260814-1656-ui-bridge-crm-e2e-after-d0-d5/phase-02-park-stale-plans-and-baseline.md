---
phase: 2
title: "Park stale plans and baseline"
status: pending
priority: P1
effort: "1h"
dependencies: [1]
---

# Phase 2: Park stale plans and baseline

## Overview

Align unfinished UI plans so this plan owns **bridge grammar execution**, without killing evergreen audit authorities or stranding OpenEduCat chrome debt.

<!-- Updated: Red Team Round 1 — narrow supersession; residual chrome tracking -->

## Requirements

- Functional:
  - **Supersede** `plans/260813-2038-openeducat-visual-clone/` as the *full clone execution* plan, but first either (a) narrow it to residual chrome validation debt with checklist items, or (b) file named GitHub issues for surviving gaps (StatActions, course-card chrome, form screenshot acceptance), and update `OPENEDUCAT-VISUAL-CONTRACT.md` implementation pointer away from the full clone plan.
  - **Do not cancel** `plans/260806-odoo-ui-component-dissection/` — keep active as source-pin/parity process; add note that **execution** of purple/console chrome follows this bridge plan + visual contract (`#71639e`), not stale blue `#0071E3`.
  - Density plan `plans/260811-list-density-after-ci-warnings/`: if work already landed, mark completed/archived in its existing Markdown status style (it may lack YAML frontmatter); do not invent `status:` fields it does not use.
- Non-functional: Pointer-only; no mass delete.

## Related Code Files

- Modify: `plans/260813-2038-openeducat-visual-clone/plan.md` (+ residual list or issues)
- Modify: `plans/260806-odoo-ui-component-dissection/plan.md` (pointer, not cancelled)
- Modify: `plans/260811-list-density-after-ci-warnings/plan.md` if still open
- Modify: `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md` implementation pointer if it cites the clone plan
- Modify: `plans/reports/INDEX-live-260812.md`

## Implementation Steps

1. Inventory residual clone-plan gaps → issues or narrowed phase list.
2. Supersede clone *execution*; keep contract as chrome SoT.
3. Annotate Odoo dissection: audit continues; brand accent is purple per contract.
4. Close density plan if done; else leave explicit remaining item only.
5. INDEX: this plan = post-D0–D5 bridge cook target.

## Todo

- [x] Residual chrome tracking before superseding clone
- [x] Annotate dissection (not cancel)
- [x] Density plan status in its own format
- [x] Contract + INDEX pointers

## Success Criteria

- [x] No orphan chrome gaps without a tracker
- [x] Dissection still findable as audit process
- [x] INDEX points here for bridge grammar cook

## Risk Assessment

Cancelling dissection → lose Odoo pin process. Mitigated by annotate-not-cancel.
