---
title: "UI Structure Depth Tier 0-1"
description: "Deepen list/record structure after Odoo grammar adoption. Tier 0 polish + Tier 1 record page. Coordinated via ak plan store cmc_edu/260803-1407."
status: completed
priority: P1
effort: "1 sprint"
tags: [ui, structure, design-system, agentkit]
created: 2026-08-03
blockedBy: []
blocks: []
---

# UI Structure Depth Tier 0–1

## Overview

Improve **structure depth** of CMC admin UI after frames/ControlBar/VIEW-GRAMMAR landed. Inspired by Lightning record pages, Polaris list chrome, Odoo ControlPanel — **without** porting foreign design systems.

**Upstream:** `plans/260803-2043-odoo-ux-grammar-full-adoption/reports/ui-structure-review-research-2026-08-03.md`

**AgentKit coordination**

| Tool | Role |
|------|------|
| `ak plan create/add-phase` | Scaffold (done) |
| `ak plan parse/status` | Progress |
| `ak plan check` | Phase complete |
| `ak plan update --status` | Store lifecycle |
| `ak plan validate` | Format gate |
| `ak journal create` | Session record |
| Orchestrator (this session) | Cook phases + subagents |

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Single identity heading on detail pages | P1 |
| 2 | ControlBar quiet sticky surface | P1 |
| 3 | ListPagination on ≥5 top lists | P1 |
| 4 | FilterBar date type | P2 |
| 5 | HighlightStrip component + Design Lab | P1 |
| 6 | Dual-title cleanup all DetailPage entities | P1 |
| 7 | WorkflowStatusbar + StatActions (pilot) | P2 |

## Non-goals

- Bulk selection / BulkActionBar (needs DataTable selection — separate plan)
- KanbanBoard generic · command palette · SettingsShell full
- Brand pivot cool gray · SLDS/Polaris port

## Architecture target

```text
LIST:   ControlBar[surface sticky] → filters(date+) → pager → table
RECORD: breadcrumbs-only header → EntityHeader (1 h1) → HighlightStrip
        → WorkflowStatusbar? → tabs → sections/related
```

## Phases

| # | Phase | Depends |
|---|-------|---------|
| 1 | [Coordination brief + VIEW-GRAMMAR amend](./phase-01-start.md) | — |
| 2 | [Single identity heading API](./phase-02-single-identity-heading.md) | 1 |
| 3 | [ControlBar quiet surface](./phase-03-controlbar-quiet-surface.md) | 1 |
| 4 | [ListPagination top lists](./phase-04-listpagination-top-lists.md) | 3 |
| 5 | [FilterBar date type](./phase-05-filterbar-date-type.md) | 1 |
| 6 | [HighlightStrip + Design Lab](./phase-06-highlightstrip-and-design-lab.md) | 2 |
| 7 | [Detail dual-title cleanup](./phase-07-detail-dual-title-cleanup.md) | 2, 6 |
| 8 | [WorkflowStatusbar + StatActions pilot](./phase-08-workflowstatusbar-and-statactions.md) | 6, 7 |

Phases **2–3–5** parallel after 1. Phase 4 after 3. Phase 7 after 2+6.

## Success criteria

- [ ] Detail pages: only one visible entity title (EntityHeader h1)
- [ ] ControlBar has quiet raised sticky surface in CSS
- [ ] ≥5 production lists use ListPagination via controlFooter
- [ ] FilterBar supports date type + unit tests
- [ ] HighlightStrip exported + used on ≥2 detail pages + Design Lab
- [ ] Receipt or opportunity shows WorkflowStatusbar or StatActions pilot
- [ ] Focused vitest green

## File ownership (parallel cook)

| Phase | Owns |
|-------|------|
| 2 | `page-header.tsx`, VIEW-GRAMMAR, PAGE-FRAMES |
| 3 | `premium.css` ControlBar, control-bar tests |
| 4 | list pages only (users, classes, aftersale, gifts, admin lists…) |
| 5 | `filter-bar.tsx` + tests |
| 6 | new `highlight-strip.tsx`, design-lab, index export |
| 7 | `*-detail.tsx` entity pages |
| 8 | new widgets + receipt/opportunity pilot |

## Commands cheat-sheet

```bash
ak plan status ./plans/260803-2107-ui-structure-depth-tier-0-1
ak plan parse  ./plans/260803-2107-ui-structure-depth-tier-0-1
ak plan validate ./plans/260803-2107-ui-structure-depth-tier-0-1
ak plan check  ./plans/260803-2107-ui-structure-depth-tier-0-1/phase-0N-*.md
ak plan update cmc_edu/260803-1407 --status in-progress
ak plan update cmc_edu/260803-1407 --status completed
ak journal create "UI structure depth" --summary "..."
```

<!-- slug: ui-structure-depth-tier-0-1 -->
