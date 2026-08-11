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

### Optional polish (not Plan 3 blockers)

| Item | Note |
|------|------|
| Admin assignExerciseSequence UI | API ready |
| Submission per SessionExercise | Still unique(exerciseId, studentId) |
| Human staging UAT | Journey smoke ≠ business UAT |
| Money → units | **Plan 3** |

## Verdict

- Plan 1: complete.
- Plan 2: **complete for monorepo teaching spines** (delivery + dual homework models).
- Plan 3: **ready to start** — see `plan3-entry-checklist-from-plan2.md`.
