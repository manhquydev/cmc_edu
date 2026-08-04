---
phase: 2
title: Deps and SoftOps FC bridge
status: completed
priority: P1
effort: M
dependencies:
  - 1
---

# Phase 2: Deps and SoftOps FC bridge

## Overview

Add FullCalendar packages to admin (or ui if wrapper is package-level). Ship Soft Ops CSS bridge + presentational wrapper component.

## Requirements

- Install (pin):  
  `@fullcalendar/react` `@fullcalendar/core` `@fullcalendar/daygrid` `@fullcalendar/timegrid` `@fullcalendar/list` `@fullcalendar/interaction`
- Import FC skeleton CSS + Soft Ops override file once from wrapper
- Wrapper props: `events`, `initialView`, `headerToolbar`, `onEventClick`, `height`/`contentHeight`, locale `vi` if available
- `editable={false}` `selectable={false}` default
- Soft Ops: canvas, brand buttons, borders warm, radius 12, Inter inherit
- Prefer putting wrapper in `packages/ui` as `SoftOpsFullCalendar` **only if** package.json can own deps; else admin-local component under `apps/admin/src/components/` to avoid forcing FC on LMS

**Recommendation:** **admin-local** first (YAGNI — LMS out of scope). Optional promote to `@cmc/ui` later.

## Related Code Files

- Modify: `apps/admin/package.json`
- Create: `apps/admin/src/components/soft-ops-fullcalendar.tsx`
- Create: `apps/admin/src/components/soft-ops-fullcalendar.css` (or under pages/teaching)
- Modify: app CSS import path if needed (only when schedule mounts — import CSS from component file)

## Implementation Steps

1. `pnpm --filter admin add` packages (workspace filter name from package.json).
2. Build SoftOpsFullCalendar wrapping `<FullCalendar plugins={[dayGrid, timeGrid, list, interaction]} … />`.
3. CSS: wrap root `.ck-fc` and override FC variables/classes to Soft Ops tokens (`var(--cmc-*)`).
4. plugins: dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin (for dateClick only if needed; keep editable false).
5. locale: Vietnamese labels via `locale` prop if `@fullcalendar/core/locales/vi` exists.

## Success Criteria

- [ ] Deps install; admin builds
- [ ] SoftOpsFullCalendar renders empty calendar in isolation
- [ ] Visual uses Soft Ops canvas/brand (spot check)
- [ ] LMS package.json **unchanged**

## Risk Assessment

- Peer dep React version — verify FC supports project React.
- CSS specificity war — scope under `.ck-fc`.

## Rollback

pnpm remove packages; delete wrapper + css.
