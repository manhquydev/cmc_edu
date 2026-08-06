---
title: Odoo grammar gap cook P0-P2 (xia synthesis)
description: >-
  Cook grammar gaps after red-team: brand=module, kanban responsive, thin
  statusbar sticky (after split), list Astryx target or cut. P0 audit demoted to
  ops. No OWL/3-col CP.
status: pending
priority: P1
branch: feat/design3-admin-rollout
tags:
  - design-system
  - odoo
  - design3
  - xia
  - cook
blockedBy: []
blocks: []
created: '2026-08-06T03:41:19.618Z'
createdBy: 'ck:plan'
source: skill
---

# Odoo grammar gap cook P0-P2 (xia synthesis)

## Overview

Close professional-parity gaps from the 2026-08-06 xia compare suite against `odoo/odoo@19.0` pin `7de220c9`. Layout grammar only in `@cmc/ui` + admin shell.

**Authority inputs:** synthesis + 5× xia reports under `plans/reports/xia-compare-*`; process docs in `plans/260806-odoo-ui-component-dissection/`.

**Related (not mutex):** `260806-odoo-ui-component-dissection` (process), `260805-1920-design3-admin-rollout` (same branch — freeze concurrent `odoo.css` edits during cook).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [P0 stacking ops checklist](./phase-01-p0-stacking-reaudit.md) | Completed |
| 2 | [Brand module name](./phase-02-brand-module-name.md) | Completed |
| 3 | [Thin statusbar sticky md+](./phase-03-statusbar-sticky-md.md) | Completed |
| 4 | [Kanban responsive width](./phase-04-kanban-gutter-responsive.md) | Completed |
| 5 | [List table grammar (Astryx)](./phase-05-list-ops-pad-sticky-e2e.md) | Pending |
| 6 | [Docs delta in PR](./phase-06-docs-matrix-sync.md) | Completed |

## Locked decisions

| Topic | Decision |
|-------|----------|
| ControlBar | Keep densify column — no 3-col port |
| Form dual sheet | Already SHIPPED |
| Scroll-owner mobile flip | Out of plan |
| Brand | `activeApp.label` via navbar default (remove shell hardcode) |
| Phase 1 | **Ops checklist** — does not block phases 2–4 cook |
| Phase 3 | Sticky only **thin statusbar** after split — never whole `.o-detail-summary` |
| Phase 4 | Responsive width only; double-gutter already mitigated |
| Phase 5 | Retarget real Astryx/`.ck-table-shell` DOM or **cut** ops-pad/sticky e2e theater |
| `odoo.css` | **Serial** edits only (single cook stream: prefer 2 → 4 → 3 → 5 → 6) |
| Inline list edit | SKIP |

## Cook order (serial)

```text
2 Brand  →  4 Kanban responsive  →  6 Docs-in-PR
1 P0 audit  // parallel ops
3 DEFERRED | 5 CUT
```

## Acceptance (plan-level)

- [ ] Phases 2–4 (and 3/5 if not cut) meet their success criteria
- [ ] Unit tests green for touched packages
- [ ] Brand asserts updated in shell tests + Playwright + `design3-frontend-audit.mjs` + `webwright-prod-smoke.mjs`
- [ ] No stacking SHIPPED claim without live `menuCoveredCount=0` (Phase 1)
- [ ] No OWL/Bootstrap transplant

## Open questions (must close in validate)

~~Resolved in Validation Session 1 — see Validation Log.~~

## Pipeline

```text
ck:plan → red-team (done) → validate (done) → cook → test → code-review
```

## Validation Log

### Session 1 — 2026-08-06

| Topic | Decision |
|-------|----------|
| Phase 3 sticky | **Defer** — matrix PARTIAL; no DetailPage split this cook |
| Phase 5 list | **Cut** — tokens dense enough; Astryx sticky/scroll = debt note in Phase 6 |
| Brand labels | Ship `NAV_MODULES` labels as-is |

### Verification Results

- Tier: Full (post red-team; remaining gates interviewed)
- Claims re-checked informally against red-team evidence (`.o-list-table` unused; summary not-sticky comment; col-body margin kill)
- Failed claims already rewritten in red-team apply pass

### Whole-Plan Consistency Sweep

- [x] Cook path = Phase 2 + 4 + 6 only (1 ops parallel; 3 deferred; 5 cut)
- [x] Phase 3/5 success criteria allow defer/cut without false SHIPPED
- [x] Brand SoT = NAV_MODULES

## Red Team Review

**Date:** 2026-08-06  
**Lenses:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic  
**Reports:** `reports/from-code-reviewer-to-planner-red-team-*-plan-review-report.md`  
**User disposition:** Apply accepted findings

| ID | Finding | Sev | Disposition |
|----|---------|-----|-------------|
| A | Sticky whole `.o-detail-summary` contradicts odoo.css authority + tall HighlightStrip pilots | C | **Accept** — thin-only / split gate |
| B | Phase 5 `.o-list-table` unused; sticky e2e inert under nested scroll | C | **Accept** — retarget or cut |
| C | Double-gutter already zeroed in col-body | H | **Accept** — Phase 4 responsive-only |
| D | Brand breaks audit/smoke hardcodes | H | **Accept** — expand Phase 2 touch list |
| E | Phase 2 must not wait on Phase 1 deploy | H | **Accept** — `dependencies: []`; demote P0 |
| F | Fake `blockedBy` dissection mutex | H | **Accept** — cleared |
| G | Parallel odoo.css cook race | H | **Accept** — serial cook order |
| H | Ops cell pad denser-than-Odoo without authority | M | **Accept** — drop or authorize in validate |
| I | Docs phase gold-plate | M | **Accept** — fold into PR delta |
| J | Block all cook until live menuCoveredCount=0 | C | **Reject** (as hard mutex) — P0 parallel ops; freeze *new sticky layers* claim until audit green |

### Whole-Plan Consistency Sweep

- [x] Phase titles/order match locked decisions  
- [x] No remaining “blocker note completes P0 as plan done” for stacking SHIPPED  
- [x] No remaining “sticky `.o-detail-summary`” as deliverable  
- [x] No remaining “fix double gutter” as half-day cook  
- [x] Brand dependents listed (audit + smoke)  
- [x] Unresolved Phase 3/5 gates — closed in Validation Session 1 (defer / cut)
