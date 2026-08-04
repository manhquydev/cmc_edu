---
title: "Odoo UX Grammar Full Adoption"
description: "VIEW-GRAMMAR law + ControlBar + full admin page-frame adoption (B3, quality gates). Port Odoo interaction grammar only — not OWL/Bootstrap."
status: completed
priority: P1
effort: "1–2 sprints"
tags: [ui, design-system, odoo-grammar, admin]
created: 2026-08-03
blockedBy: []
blocks: []
---

# Odoo UX Grammar Full Adoption

## Overview

Make CMC EDU admin feel like **one product OS** (Odoo-grade muscle memory) by enforcing a closed view grammar, shipping a named **ControlBar** on ListPage, and migrating **all remaining product pages** onto List/Detail/Form/Dashboard frames. Brand and stack stay CMC (`@cmc/ui` + Astryx + warm tokens).

**Upstream evidence (read-only):**

- `plans/260803-xia-odoo-ui-architecture/reports/odoo-ui-compare-cmc-edu.md`
- `…/brainstorm-odoo-ux-grammar.md`
- `…/research-odoo-ux-grammar-2026-08-03.md`
- `…/scout-odoo-ux-grammar-2026-08-03.md`
- `…/advise-odoo-ux-grammar-2026-08-03.md` (user confirmed B3 + quality gates + named ControlBar)

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | VIEW-GRAMMAR.md law linked from PAGE-FRAMES, STRUCTURE, llms.txt | P1 |
| 2 | Named ControlBar in `@cmc/ui`, embedded by ListPage, unit-tested | P1 |
| 3 | Full product adoption: off-frame pages → correct frame (min frame for stubs) | P1 |
| 4 | ListPagination on production receipt-list | P1 |
| 5 | Design Lab shows ControlBar + full list recipe | P2 |
| 6 | Phase-gated tests green (quality first) | P1 |

## Non-goals

- Odoo OWL / Bootstrap / XML views / purple brand
- DataTable selection + BulkActionBar (no selection API yet)
- Generic KanbanBoard / SearchModel favorites / action-stack service
- LMS app redesign
- Full field widget kit (defer)

## Architecture

```text
AppFrame + SideNav
  └── Page frame (mandatory)
        ListPage → ControlBar (title · filters · pager · actions) + body
        DetailPage → EntityHeader · summary · tabs · sections
        FormPage → fields · sticky actions
        DashboardPage → shortcuts · metrics · primary/secondary
```

Special cases:

| Surface | Rule |
|---------|------|
| CRM pipeline | ListPage shell + FunnelBar body — no KanbanBoard |
| Grading | Keep MasterDetail; PageHeader chrome only |
| pdf-annotator | **Exempt** — embed, not a product list |
| login / change-password / design-lab | **Exempt** from product adoption metric |
| Stubs (refund, leaderboard) | Frame + EmptyState minimum |

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [VIEW-GRAMMAR law](./phase-01-start.md) | Pending | — |
| 2 | [ControlBar + ListPage](./phase-02-controlbar-and-listpage.md) | Pending | 1 |
| 3 | [Design Lab demo](./phase-03-design-lab-demo.md) | Pending | 2 |
| 4 | [Academic lists](./phase-04-academic-lists-migration.md) | Pending | 2 |
| 5 | [Finance/CRM shells](./phase-05-finance-crm-shells.md) | Pending | 2 |
| 6 | [HR/settings frames](./phase-06-hr-settings-frames.md) | Pending | 2 |
| 7 | [Parents/stubs/grading](./phase-07-parents-stubs-grading.md) | Pending | 2 |
| 8 | [Pagination + audit + docs](./phase-08-pagination-audit-docs.md) | Pending | 3–7 |

Phases 4–7 may run **in parallel after phase 2** if file ownership is disjoint (different page paths). Phase 3 can parallel phase 4.

## Cook notes

- Subagents: one cluster per phase 4–7; **do not** edit `packages/ui/**` after phase 2 without stop-the-line.
- After phase 2, phases 4–7 may run in parallel with **strict ownership**:

| Phase | Owns only |
|-------|-----------|
| 4 | `students/`, `classes/`, `courses/`, `enrollment/` |
| 5 | `crm/pipeline*`, `finance/revenue*`, `finance/refund*` |
| 6 | `hr/*`, `admin/shift-config*` |
| 7 | `parents/*`, `engagement/leaderboard*`, `teaching/grading*` |

- **Failure cut rule:** if a page fails twice in a phase, ship min frame + EmptyState/body preserve and mark DONE_WITH_CONCERNS — do not block whole plan.
- Validate with `ak-test` after each phase; `ak-debug` only on failures.
- Reference recipes: `receipt-list.tsx`, `receipt-detail.tsx`, `cockpit.tsx`.
- One commit per phase cluster preferred (revert-friendly).

## Adoption definition (red-team RT-1)

A product page is **adopted** when its default-export screen imports one of  
`ListPage | DetailPage | FormPage | DashboardPage`.

**EXEMPT (not counted as gaps):**

- `login.tsx`, `change-password.tsx`, `design-lab.tsx`, `coming-soon.tsx`
- `teaching/pdf-annotator.tsx` (embed)
- `*dialog*.tsx`, `use-*.ts`, `*-actions.ts`, pure test files

Any other exemption must be listed in VIEW-GRAMMAR with reason.

## Success Criteria

- [ ] `design-system/cmc-edu/VIEW-GRAMMAR.md` exists and is linked
- [ ] `ControlBar` exported from `@cmc/ui` with tests
- [ ] All non-EXEMPT product pages adopted (definition above)
- [ ] `receipt-list` uses `ListPagination`
- [ ] Design Lab demos ControlBar recipe
- [ ] Per phase: touched package tests green (`@cmc/ui` and/or admin vitest)
- [ ] After phase 2+: `pnpm --filter @cmc/ui test` when UI package changed; admin typecheck if exports changed

## Risk (post red-team)

| Risk | Mitigation |
|------|------------|
| Scope creep to bulk/kanban | Non-goals binding; new plan required |
| Pipeline FunnelBar layout break | Phase 5: no forced DataTable; keep board body |
| Fuzzy adoption | EXEMPT list + grep audit phase 8 |
| Subagent file fights | Ownership table; UI freeze after phase 2 |
| Solo capacity | Failure cut rule |
| Docs “21/21 templates” stale | Phase 8 inventory rewrite |

<!-- slug: odoo-ux-grammar-full-adoption -->
