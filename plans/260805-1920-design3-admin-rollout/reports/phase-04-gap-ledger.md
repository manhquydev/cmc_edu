# Phase 4 gap ledger — CRM pilot (design3)

Date: 2026-08-05

## Delivered

| Item | Detail |
|------|--------|
| Kanban | `pipeline.tsx` board ported to `KanbanBoard` / `KanbanColumn` / `KanbanCard` |
| Color map | O1→1, O2→3, O3→4, O4→5, O5→6, lost→2 (`--odoo-kanban-color-N`) |
| List view | DataTable columns: Học viên, SĐT, Giai đoạn, Phụ trách, Nguồn |
| Switcher | `?view=table` / default kanban (TL6); ControlBar header toggle |
| Cache | Shared `listInput` (no view key); optimistic advance hits both views |
| Detail statusbar | Display-only (advance remains explicit buttons — no click-to-advance wire) |
| E2E | Smoke switcher steps added to `crm-receipt.journey.ui.spec.ts` |

## Gaps / follow-ups

1. **No drag-drop** between columns (plan non-goal) — advance via "Chuyển lên" only.
2. **List row actions** (advance/mark-lost/schedule) only on kanban cards — list is navigate-on-click identity table.
3. **ui-e2e full suite** not run in cook session — still merge gate for branch.
4. **CRM dialogs** (7 files) still premium/bespoke chrome — Phase 5/6 if needed.
5. **Kanban card nested interactive** uses outer `role="button"` + stopPropagation on real buttons (a11y acceptable; not pure native card).

## Acceptance checklist

- [x] Kanban keeps advance, counts (stageCounts), funnel, lost filter
- [x] List view + switcher, deep-link `?view=table`
- [x] Shared listInput (unit tests assert no `view` in query)
- [x] No backend change; check-ui-frames green
- [ ] Full ui-e2e green vs main (open)
