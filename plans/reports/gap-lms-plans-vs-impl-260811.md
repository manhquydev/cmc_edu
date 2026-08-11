# Gap analysis — Plan 1 + Plan 2 vs implementation (2026-08-11)

## Plan 1 — Foundation (`260811-1117`) — **DONE on branch**

| Success criterion | Status | Evidence |
|-------------------|--------|----------|
| ADRs + freezes | Done | `docs/decisions/0045`, `0046`; ship-lms-foundation-spike |
| domain-lms package + tests | Done | `@cmc/domain-lms` 38 tests |
| Migration unit-range + FORCE RLS | Done | `20260811120000_lms_foundation_unit_range` |
| Int tests range/roster/sale | Done | `lms-ops.int.test.ts`, on-roster |
| Real create stamps sessions | Done | `lmsOps.createClassWithUnits` + **UI now calls it** |
| Finance regression | Done earlier cook | foundation ship note |
| Ship note for plan 2/3 | Done | foundation + teaching spine ships |

## Plan 2 — Teaching spine (`260811-1118`)

| Phase | Status | Remaining |
|-------|--------|-----------|
| 1 Start | done | — |
| 2 Class engine cancel restamp | **done (unified)** | realignHistory optional deferred |
| 3 Enrollment grant/revoke/archive | done API | expiring list UI deferred |
| 4 Family principal | done API | phone+password parent optional (OTP primary) |
| 5 Attendance journal photoConsent | done | — |
| 6 Exercise library delivery | **partial** | SessionExercise model + cron still open |
| 7 UI spines | **partial → improved** | dual-gate roster, cancel restamp, **unit-aware create** |

### This cook closed

1. **Cancel-unify:** `classSession.cancel` ≡ restamp + FinalGrade via `cancelSessionWithRestamp`
2. **createClass UI:** admin form → `lmsOps.createClassWithUnits` + start unit picker

### Still open for “full day staging” / plan success criteria

| Criterion | Gap |
|-----------|-----|
| Teacher full day staging | SessionExercise delivery + grading path; maybe makeup policy UI |
| Family homework when entitled | Entitlement gate default OFF; money→units is Plan 3 |
| SessionExercise 1/session end | Not ported (monorepo Submission still exercise-scoped) |
| Admin library folders | Not started |

## Verdict

- Plan 1 foundation: **implementation complete** for cook scope.
- Plan 2 teaching spine: **API + core UI spines largely done**; phase 6 library/delivery and full staging acceptance still open (honest partial).
