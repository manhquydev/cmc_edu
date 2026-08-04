# Cook fix — multi-agent review findings

**Date:** 2026-08-04  
**Source review:** `code-review-multi-agent-2026-08-04.md`  
**Mode:** ak-cook fix (auto)

## Outcome / acceptance (this cook)

| ID | Finding | Fix | Status |
|----|---------|-----|--------|
| C1 | `loading={isLoading}` unmounts FC on range change | `placeholderData`; blocking load only when no events; `fetching` overlay | Fixed |
| I1 | batch list error hid week/month | Calendar views no longer gated on batch error | Fixed |
| I2 | always fetch classBatch on calendar | `enabled: list \|\| kanban` | Fixed |
| I3 | datesSet untested | Mock fires onDatesSet; assert exclusive→inclusive | Fixed |
| I5 | cross-facility untested | API test second facility isolation | Fixed |
| I7 | event payload / href unproven in page test | Assert timed + dual deep-link on FC props | Fixed |
| nit | href navigate guard | relative path only in SoftOpsFullCalendar | Fixed |

## Files touched

- `apps/admin/src/components/soft-ops-fullcalendar.tsx` — loading vs fetching; href guard
- `apps/admin/src/components/soft-ops-fullcalendar.css` — fetching overlay styles
- `apps/admin/src/pages/teaching/schedule.tsx` — placeholderData, batch enabled split
- `apps/admin/src/pages/teaching/schedule.test.tsx` — expanded wire tests
- `apps/api/src/class/list-in-range.test.ts` — facility isolation + inclusive `to`

## Validation

- Admin: schedule + adapter **24** tests green (includes C1 contract: placeholderData + fetching flags)  
- API: listInRange **11** tests green (incl. cross-facility + inclusive `to`)  
- Re-review agent: **APPROVE_WITH_NITS** → nits closed with C1 contract tests  

## Residual (deferred)

- Row `take` cap inside 120-day window  
- ICT-forced `timeZone` for non-VN browsers  
- Secondary `orderBy` tie-break on API  
- Prisma `select` projection hygiene  
- act() noise from mock datesSet microtask (tests still green) 
