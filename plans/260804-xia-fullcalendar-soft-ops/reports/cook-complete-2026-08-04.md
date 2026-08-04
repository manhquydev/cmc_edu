# Cook complete — FullCalendar B-lite Soft Ops

**Date:** 2026-08-04  
**Plan:** `plans/260804-xia-fullcalendar-soft-ops/plan.md`  
**Mode:** B-lite (approved) · `--auto`

## Delivered

| Phase | Result |
|-------|--------|
| 1 Data adapter | `schedule-fc-events.ts` + 6 unit tests |
| 2 Deps + bridge | `@fullcalendar/*@6.1.21` (pinned same major) · `SoftOpsFullCalendar` + `.ck-fc` CSS |
| 3 Wire schedule | week → `dayGridWeek` · calendar → `dayGridMonth` · list/kanban Soft Ops |
| 4 Tests + docs | schedule tests 7/7 · VIEW-GRAMMAR calendar row |

## Versions

Pinned **6.1.21** for core/react/daygrid/timegrid/list/interaction (avoid FC v7 headless API + plugin peer mismatch).

## Data honesty

- Events = **classBatch all-day** periods (start→exclusive end).  
- Callout on page states not ClassSession hours.  
- `editable: false`.

## Validation

```text
vitest schedule-fc-events + schedule.test  → 13/13 pass
tsc admin typecheck                        → pass
check-ui-frames --strict                   → pass (dualTitle 0, bulkListsOk)
```

## Files

- `apps/admin/src/pages/teaching/schedule-fc-events.ts`
- `apps/admin/src/pages/teaching/schedule-fc-events.test.ts`
- `apps/admin/src/pages/teaching/schedule.tsx`
- `apps/admin/src/pages/teaching/schedule.test.tsx`
- `apps/admin/src/components/soft-ops-fullcalendar.tsx`
- `apps/admin/src/components/soft-ops-fullcalendar.css`
- `apps/admin/package.json` (FC deps)
- `package.json` pnpm overrides react/react-dom 19.2.8 (dedupe hooks)
- `design-system/cmc-edu/VIEW-GRAMMAR.md`

## Residual

- Session-range timed events (future API)  
- Optional listWeek FC view  
- React dual-version residual in lockfile until clean install  
- Visual QA in browser recommended  

## Rollback

Remove FC deps + SoftOpsFullCalendar; restore WeekSchedule/ScheduleMonth branches from git.
