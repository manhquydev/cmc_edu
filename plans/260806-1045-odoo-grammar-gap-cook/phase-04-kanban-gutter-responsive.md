---
phase: 4
title: Kanban responsive width
status: completed
priority: P1
effort: 2-4h
dependencies: []
---

# Phase 4: Kanban responsive width

## Overview

Wire unused `--odoo-kanban-card-width-sm` / viewport-friendly column width. **Do not** cook “double gutter removal” — col-body already zeroes card margin (`odoo.css` ~507–510). Optional 5-min DevTools confirm on CRM pipeline only.

## Requirements

- Functional: below lg/md, columns not stuck at fixed 320px overflow-only
- Non-functional: desktop 320px language kept; kanban unit tests green

## Related Code Files

- Modify: `packages/ui/src/odoo.css` kanban section
- Read: `packages/ui/src/odoo/odoo-kanban.tsx`, `apps/admin/src/pages/crm/pipeline.tsx`
- Tests: `packages/ui/src/odoo/odoo-kanban.test.tsx`

## Implementation Steps

1. DevTools confirm gutter ~8px on CRM board (document in PR; no CSS if OK).
2. Add `@media` column/card width using `--odoo-kanban-card-width-sm` and/or `min(90vw, …)`.
3. Unit assert media/token usage.
4. Manual narrow CRM pipeline.

## Success Criteria

- [ ] Responsive width shipped
- [ ] No drive-by gutter refactor
- [ ] Tests green

## Risk Assessment

Snap-scroll YAGNI — width only.

<!-- Updated: Red Team Session 1 - drop double-gutter cook -->
