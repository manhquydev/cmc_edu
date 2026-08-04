---
phase: 5
title: "Finance CRM shells"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 5: Finance / CRM shells

## Overview

Bring pipeline and remaining finance non-frame pages under ListPage/Dashboard-compatible shells without rewriting domain logic.

## Requirements

- Functional:
  - `pipeline.tsx`: ListPage shell + FunnelBar/kanban body (no KanbanBoard component).
  - `revenue-report.tsx`: DashboardPage **or** ListPage+panels (pick one; prefer DashboardPage if metrics-primary).
  - `refund.tsx`: ListPage min + EmptyState (stub).
- Preserve CRM mutations, filters, custom pager until phase 8 optional ListPagination.
- Tests: pipeline.test.tsx green.

## Related Code Files

- Modify: `crm/pipeline.tsx`, `crm/pipeline.test.tsx`, `finance/revenue-report.tsx`, `finance/refund.tsx` (+ tests if present)
- Do not rewrite: opportunity-detail, receipt-detail/list (already framed)

## Implementation Steps

1. Pipeline: wrap PageHeader+filters in ListPage; body keeps FunnelBar + board.
2. Revenue report: choose DashboardPage if KPI grid is primary; else ListPage with Panel children.
3. Refund: ListPage + EmptyState only.
4. Run CRM pipeline tests.

## Success Criteria

- [x] pipeline uses ListPage
- [x] revenue-report uses a mandatory frame
- [x] refund uses ListPage
- [x] pipeline tests pass
- [x] pipeline body still renders FunnelBar + board/list hybrid — **no** forced DataTable/ck-table-shell around kanban columns
- [x] ListPage `isEmpty` does not hide board when columns exist

## Risk Assessment

FunnelBar CSS inside ListPage body — verify width/scroll; do not force table shell on kanban columns. If ListPage empty-state wrapper fights the board, set isEmpty=false always when pipeline has stage columns.
