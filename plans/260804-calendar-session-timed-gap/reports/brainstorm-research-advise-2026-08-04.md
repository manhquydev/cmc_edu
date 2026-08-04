# Brainstorm · Research · Advise — Calendar timed ClassSession gap

**Date:** 2026-08-04  
**Problem:** FullCalendar timeGrid empty-ish because events are **classBatch all-day**, not **ClassSession** timed.

---

## Scout summary (verified)

| Layer | State |
|-------|--------|
| Schema `ClassSession` | Has `startTime`/`endTime` timestamptz (ICT) |
| Index | `[facilityId, sessionDate]` ready for range |
| API `classSession.list` | **Only** `{ classBatchId }` — no facility range |
| UI schedule | Only `classBatch.list` → all-day FC events |
| Attendance | Supports `?classBatch=` + `?session=` (session alone insufficient) |

---

## Brainstorm options

| | A N+1 fan-out list per batch | B New `listInRange` API | C Keep all-day only |
|--|------------------------------|-------------------------|---------------------|
| Value | Timed without API change | Correct calendar | Status quo |
| Cost | 50 queries/page | 1 procedure + tests | 0 |
| Risk | Slow, unbounded history | Low–med | timeGrid useless |
| YAGNI | Bad | **Best** | Avoids fix |

**Recommendation: B**

---

## Research notes

- FC docs: timed events need `start`/`end` Instant (ISO); `allDay: false`; `timeZone` or correct offsets.
- CMC: `ictToUtc` already used at generation; expose ISO from API as Date → JSON ISO.
- Index supports `sessionDate` window filter; include `classBatch` join for code/program/room/teacher.

---

## Advise

### Exact requirements

1. `classSession.listInRange({ from, to, courseId?, includeCancelled? })` → sessions + batch denorm.  
2. Permission: `class.read` (same as list).  
3. Adapter `classSessionToEvents` → timed EventInput, href `?classBatch=&session=`.  
4. Schedule page: load range from FC `datesSet` (default ±2 months).  
5. Prefer timed events; optional all-day batch background **off** for clarity (or display:background low opacity later).  
6. Tests: API listInRange + adapter + schedule mock.  
7. Non-goals: drag reschedule, resource timeline, premium plugins, N+1.

### Success metrics

- timeGrid shows timed blocks when sessions exist  
- eventClick opens attendance with session+batch  
- typecheck + targeted tests green  

### Work checklist

- [x] API listInRange + test  
- [x] session→FC adapter + test  
- [x] schedule.tsx wire datesSet + listInRange  
- [x] deep-link session  
- [x] VIEW-GRAMMAR / callout honesty update 
