# Phase 03 — Kanban lưới SIS + form sheet

**Plan:** [plan.md](./plan.md)  
**Pack:** `02`, `05`, `10`, `14`, `16`, `29`

## Overview

Thêm `KanbanRecordGrid` (thẻ người 3 cột) tách khỏi `KanbanBoard` (pipeline). Form: New outline, sheet inset 16px, smart buttons trước pager, statusbar 33px lavender current, tabs gạch chân tím.

## Requirements

- [x] SIS students: grid 3 cột, initial trái, clock phải dưới (faculties chưa có trang)
- [x] CRM pipeline **không** đổi sang grid
- [x] Form New = class `console-btn-outline-primary`
- [x] WorkflowStatusbar height 33px, current `--console-statusbar-current`
- [ ] StatActions ngồi CP phải, trước pager — mới densify CSS; pages vẫn để StatActions trong sheet
- [x] Notebook underline 2px purple (`.console-notebook`)
- [ ] eLearning-style card (ribbon PUBLISHED) — chưa có UI courses kiểu pack `29`

## Files

- `packages/ui/src/console/console-kanban.tsx` (grid variant)
- `packages/ui/src/components/progress-steps.tsx` / `workflow-statusbar.tsx`
- `packages/ui/src/components/cmc-tabs.tsx`
- `apps/admin/src/pages/students/index.tsx`

## Acceptance

- [ ] Screenshot students kanban vs `02` at 1280
- [ ] Admission-register-like form vs `14`: ribbon phải, sheet, không search trên CP
