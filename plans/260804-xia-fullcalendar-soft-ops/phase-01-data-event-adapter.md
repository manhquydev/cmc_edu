---
phase: 1
title: Data event adapter
status: completed
priority: P0
effort: S
dependencies: []
---

# Phase 1: Data event adapter

## Overview

Pure functions mapping CMC schedule domain → FullCalendar `EventInput[]`. v1 uses **classBatch** as all-day events (honest labels). Optional extension point for ClassSession when range API exists.

## Requirements

- Functional: `classBatchToEvents(rows): EventInput[]` with id, title, start, end (allDay), extendedProps (batchId, program, status, href)
- Functional: end date exclusive/inclusive documented (FC allDay end is exclusive — convert)
- Functional: timezone note — use date-only strings `YYYY-MM-DD` for all-day to avoid TZ shift
- Non-functional: no FC import in domain package if possible — types can be local `ScheduleFcEvent` mirror

## Related Code Files

- Create: `apps/admin/src/pages/teaching/schedule-fc-events.ts` (or `packages/ui` only if shared)
- Create: `apps/admin/src/pages/teaching/schedule-fc-events.test.ts`
- Read: `schedule.tsx` ClassBatchRow shape · `trpc.classBatch.list`

## Implementation Steps

1. Define `ScheduleFcEvent` type compatible with FC EventInput subset.
2. Implement mapper from ClassBatchRow (code, program, startDate, endDate, status, id).
3. Title: e.g. `{code} · {program}`; classNames by status for CSS hooks.
4. extendedProps.href = `/teaching/attendance?classBatch={id}`.
5. Unit tests: empty, single batch spanning week, end exclusive handling, missing dates.

## Success Criteria

- [ ] Mapper pure + unit tests pass
- [ ] Comments state v1 = batch all-day, not session hours
- [ ] No drag-related fields

## Risk Assessment

Wrong end-date exclusivity → off-by-one on month grid. Mitigate with tests + FC docs.

## Rollback

Delete adapter file + tests.
