---
phase: 3
title: "Wire schedule UI"
status: completed
priority: P1
effort: "2h"
dependencies: [1, 2]
---

# Phase 3: Wire schedule UI

## Overview

Week and month calendar views load `classSession.listInRange` driven by FullCalendar `datesSet`, and render timed events. List/kanban remain batch Soft Ops.

## Requirements

- Default range ~ previous month start → +2 months (before first datesSet).
- On `datesSet`, update `{from,to}` only when date-only strings change.
- Pass `courseId` filter from URL when set.
- Loading state via SoftOpsFullCalendar.
- Update Callout honesty: events are ClassSession timed, not batch all-day.
- Do **not** mix all-day batch bars with timed sessions in v1 (clarity).

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/schedule.tsx`
- Touch (optional): `apps/admin/src/components/soft-ops-fullcalendar.tsx` only if datesSet typing needs export (already has `onDatesSet`)

## Implementation Steps

1. Replace `FullCalendarBatchView` data source with `listInRange` + range state.
2. Wire `onDatesSet` → setRange.
3. Map via `classSessionToEvents`.
4. Keep list/kanban on `classBatch.list`.
5. Update Callout + subtitle if needed.

## Success Criteria

- [ ] timeGrid receives timed events when sessions exist
- [ ] eventClick → attendance with session+batch
- [ ] No infinite refetch loop on datesSet
- [ ] courseId filter still applies

## Risk Assessment

Medium UX: empty calendar if no sessions generated for visible window — mitigated by callout. Refetch thrash mitigated by string compare.
