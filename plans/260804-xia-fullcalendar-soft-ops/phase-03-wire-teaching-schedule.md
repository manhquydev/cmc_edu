---
phase: 3
title: Wire teaching schedule
status: completed
priority: P1
effort: M
dependencies:
  - 1
  - 2
---

# Phase 3: Wire teaching schedule

## Overview

Replace `week` + `calendar` body branches in `teaching/schedule.tsx` with SoftOpsFullCalendar views. Keep list + kanban. Callout honesty about batch all-day.

## Requirements

- `view=week` → `timeGridWeek` (or `dayGridWeek` if time slots empty looks better for all-day only — **prefer dayGridWeek for all-day batch v1**, document choice)
- `view=calendar` → `dayGridMonth`
- Optional: add `list` subview or map existing list DataTable stay as is
- FilterBar courseId still drives `classBatch.list`
- eventClick / eventDidMount → navigate attendance href from extendedProps
- Callout update: explain FC Soft Ops + batch period events until session API
- Keep WeekSchedule code path only if product wants Soft Ops board toggle — default **B-lite: FC replaces week+month**

**All-day batches on timeGridWeek look sparse** — if UX poor, use:
- week → `dayGridWeek`
- month → `dayGridMonth`
- optional listWeek via FC list plugin as third FC view

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/schedule.tsx`
- Modify: `apps/admin/src/pages/teaching/schedule.test.tsx` if exists
- Read: VIEW-GRAMMAR (note calendar body can be FC inside ListPage)

## Implementation Steps

1. Build events via phase-1 adapter from query data.
2. Replace WeekSchedule / ScheduleMonth render with SoftOpsFullCalendar + initialView from URL.
3. Sync URL view param with FC view (headerToolbar view switch or keep external ck-view-toggle).
4. Prefer **external** Soft Ops view toggle driving `initialView` / `key={view}` remount to avoid dual toolbars — hide FC header right view buttons or set headerToolbar left/center only.
5. Preserve density=ops ListPage chrome.

## Success Criteria

- [ ] week + calendar views show FC chrome
- [ ] list + kanban unchanged behavior
- [ ] Click event → attendance deep-link
- [ ] Callout honest about data grain
- [ ] editable false

## Risk Assessment

- Double toolbar if both Soft Ops toggle and FC header show views — **single chrome owner** (Soft Ops toggle wins).

## Rollback

Restore previous WeekSchedule/ScheduleMonth branches from git.
