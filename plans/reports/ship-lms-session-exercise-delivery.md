# Ship note — SessionExercise delivery (Plan 2 phase 6)

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Closes:** Plan 2 phase 6 delivery spine (library folders UI still light)

## Delivered

| Area | What |
|------|------|
| Domain | `@cmc/domain-lms` exercise-sequence (build/plan/nextPosition) |
| Schema | `ClassExerciseItem` + `SessionExercise` + FORCE RLS |
| API | `lmsOps.assignExerciseSequence`, `listExerciseSequence`, `deliverSessionExercise` |
| Worker | `deliverDueExercises` in worker `drainOnce` |
| Open-tier | When `LMS_OPEN_TIER_ENABLED=0`, open set = dual-gate delivered exercises only |

## Delivery rules

1. Cancelled sessions never deliver.
2. At most one `SessionExercise` per `ClassSession` (unique).
3. Sequence freeze: reassignment keeps positions ≤ MAX(delivered position).
4. Unit restamp does **not** move sequence pointer.
5. Fallback without sequence: published `homework` for session `curriculumUnitId`.
6. Worker scans ended sessions without delivery (multi-facility bypass).

## Validation

```
domain-lms: 45 pass (incl. sequence)
exercise-delivery.int: 5 pass
open-tier: 16 pass (defaults unchanged)
```

## Plan 3 readiness (money bridge)

| Prerequisite | Status |
|--------------|--------|
| Unit grant surface (`addWithUnits` / grantPast / revoke) | Ready — single writer for ranges |
| Dual-gate roster D1 | Ready |
| Teaching create/cancel stamp | Ready |
| Exercise delivery when open-tier off | Ready |
| Receipt → auto range | Plan 3 |
| Import live LMS | Plan 3 |

**Single range writer for Plan 3:** staff/admin grant procedures on `lmsOps` only; `enrollment.enroll` remains reserved-only. Wire `provisionFromReceipt` to the same grant service.

## Deferred (not blocking Plan 3 entry)

- Full folder library UI (admin assigns exercise list via API for now)
- SessionExercise-keyed Submission (still exerciseId unique — re-delivery same exercise shares submission row)
- Worker auto-cancel restamp (staff cancel unified; worker path documented earlier)
