# FullCalendar llms.txt → CMC deep implement

**Source:** https://fullcalendar.io/docs/llms.txt (+ react.md)  
**Stack:** `@fullcalendar/*@6.1.21` (MIT standard; **no** Scheduler premium)  
**Date:** 2026-08-04  

## Docs → implementation map

| llms.txt topic | CMC implementation |
|----------------|-------------------|
| Initialize ES6 / React | `SoftOpsFullCalendar` + Vite |
| Plugin Index daygrid/timegrid/list/interaction | All four plugins registered |
| headerToolbar / buttons | left prev,next today · center title · right month/week/day/list |
| View-specific options | `views={{ dayGridMonth, timeGridWeek, … }}` |
| Month: fixedWeekCount, showNonCurrentDates | `fixedWeekCount: false` |
| TimeGrid: slotMin/Max, scrollTime, allDaySlot, expandRows, nowIndicator | 07:00–21:00, allDayText “Cả ngày” |
| List: listDayFormat | weekday long + month short |
| Localization: locale, firstDay | `vi` locale, `firstDay: 1` (Monday) |
| Week numbers | `weekNumbers` + ISO + `weekText: 'Tuần'` |
| businessHours | Mon–Sat 07:30–20:30 |
| navLinks | true (dateClick drill) |
| events as function + lazyFetching | range filter in `eventsFn` |
| eventDisplay / dayMaxEvents / moreLinkClick | block, true, `popover` |
| eventContent (content-injection) | React JSX title/time/status |
| eventClick | SPA navigate attendance |
| dateClick | `changeView('timeGridDay', date)` via Calendar API ref |
| datesSet | optional callback prop |
| eventInteractive | true (a11y) |
| editable / drag | **false** (no reschedule API) |
| Premium timeline/resources | **out of scope** (license) |

## Non-goals (docs premium)

- resourceTimeline, resourceTimeGrid, schedulerLicenseKey  
- External event dragging, multi-calendar DnD  
- RRule recurrence plugin  

## Residual product

- ClassSession **timed** events → feed `start`/`end` with times into EventInput  
- Optional `events` JSON feed from API when range query exists  

## Files

- `apps/admin/src/components/soft-ops-fullcalendar.tsx`  
- `apps/admin/src/components/soft-ops-fullcalendar.css`  
- `apps/admin/src/pages/teaching/schedule-fc-events.ts`  
- `apps/admin/src/pages/teaching/schedule.tsx`  
