# Module list FilterBar gap (after D4)

**Date:** 2026-08-06  
**Authority:** G1 playbook + debt D13 (FilterBar only when list API supports filters)

## Closed this session

| Debt | Status |
|------|--------|
| D1 Parents ControlBar | FIXED (`4c78c31`) |
| D2 Gifts select all | FIXED (`4c78c31`) |
| D3 Pipeline lost clear | FIXED (`4c78c31`) |
| D4 Audit date from≤to | FIXED (this cook) |

## ListPage without FilterBar (no API search params)

| Page | API | Action |
|------|-----|--------|
| `admin/facilities.tsx` | `facility.list` + `search` | **SHIPPED** 2026-08-07 FilterBar |
| `admin/users.tsx` | `user.list` + `search` | **SHIPPED** 2026-08-07 FilterBar |
| `courses/index.tsx` | `course.list` + `search`/`program` | **SHIPPED** 2026-08-07 FilterBar |
| `classes/index.tsx` | `classBatch.list` + `search` | **SHIPPED** 2026-08-07 FilterBar |
| `engagement/leaderboard.tsx` | empty shell | intentional |
| `finance/refund.tsx` | empty shell | intentional |
| `enrollment/class-placement.tsx` | form-as-list hybrid | document hybrid |
| `teaching/attendance|exercises|grading` | ops pickers | hybrid / not multi-record filter lists |
| `hr/payroll.tsx` | staff pick | hybrid |

**Do not** invent FilterBar without server domain — D13.

## Next API-backed FilterBar candidates (future)

1. `user.list` + `q` / role  
2. `facility.list` + name/code  
3. `course.list` + program  
4. `classBatch.list` + course/status  

## D4 acceptance

- Inverted audit dates → Banner warning  
- `audit.list` not called with both bounds inverted (`enabled: !dateRangeInvalid`)  
- Unit test green

## Payroll / teaching ops (2026-08-07)

| Surface | API | Status |
|---------|-----|--------|
| `hr/payroll` staff list | `user.pickList` + `search` | **SHIPPED** |
| `teaching/exercises` | `exercise.list` + status/type | **SHIPPED** |
| `teaching/attendance` class pick | `classBatch.list` + `search` | **SHIPPED** |
| `teaching/grading` queue | `submission.listForGrading` + status/search | **SHIPPED** |
