---
phase: 4
title: Tests and design-lab
status: completed
priority: P1
effort: S
dependencies:
  - 3
---

# Phase 4: Tests and design-lab

## Overview

Lock adapter + schedule FC mount; optional design-lab demo; docs note VIEW-GRAMMAR exception.

## Requirements

- schedule-fc-events tests (phase 1) green
- schedule page test: with mocked trpc, week view renders FC root (class `ck-fc` or role) without throw
- Mock `@fullcalendar/react` in vitest if heavy (jest-like module mock returning div)
- Optional: design-lab small demo SoftOpsFullCalendar with fake events
- Update VIEW-GRAMMAR one line: calendar body may use SoftOpsFullCalendar (FC) under ListPage
- `pnpm check:ui-frames` still green

## Related Code Files

- Create/modify tests under `apps/admin/src/pages/teaching/`
- Optional: `design-lab.tsx` calendar section note
- Modify: `design-system/cmc-edu/VIEW-GRAMMAR.md` calendar row

## Implementation Steps

1. Adapter tests complete.
2. Page test with FC mock.
3. VIEW-GRAMMAR note (not re-skin).
4. Run admin vitest scoped + check:ui-frames.
5. Manual smoke checklist in report.

## Success Criteria

- [ ] Unit + page tests pass
- [ ] frames strict pass
- [ ] VIEW-GRAMMAR updated
- [ ] Short cook report in `plans/260804-xia-fullcalendar-soft-ops/reports/`

## Risk Assessment

FC mock fragility — prefer testing adapter thoroughly; light page smoke.

## Rollback

Revert docs + tests if feature rolled back.
