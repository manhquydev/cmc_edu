# Ship note — Teaching spine phases 4–7 (partial cook)

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Plan:** `plans/260811-1118-lms-teaching-spine-api-ui-family/`  
**Brainstorm:** `plans/reports/brainstorm-260811-teaching-spine-phases-4-7.md`

## Delivered

| Phase | Delivered |
|-------|-----------|
| 4 Family principal | `ParentAccount.isActive` + `tokenVersion`; tokens embed `tv`; `lmsProcedure` validates; login rejects inactive; `parentAccount.setActive` bumps tv on deactivate |
| 5 Attendance / journal | `listForChild` hides cancelled sessions; photoConsent already green; attendance window [start−30m, end+2h] with director override; `ATTENDANCE_WINDOW_ENFORCED` (prod default ON) |
| 6 Exercise delivery | Kill-switch already shipped; **SessionExercise model deferred** (Submission still exercise-scoped) |
| 7 UI spines | Attendance panel prefers `lmsOps.rosterForSession`; session detail cancel → `cancelSessionAndRestamp` |

## Validation

```
auth matrix: 542 pass
api focused: 74 pass (session-token, set-active, window, publish, open-tier, lms-ops)
attendance gate: 22 pass
```

## Env

| Var | Default | Effect |
|-----|---------|--------|
| `ATTENDANCE_WINDOW_ENFORCED` | prod ON / else OFF | Teacher attendance time window |
| `LMS_OPEN_TIER_ENABLED` | ON | Homework open-tier kill-switch |
| `LMS_ENTITLEMENT_GATE` | OFF | Range ∩ open units |

## Remaining

- Full SessionExercise library + delivery cron + grading path
- Class create UI → `createClassWithUnits` (still `classBatch.create` default)
- Parent phone+password (OTP path remains primary; student password exists)
- Unify legacy `classSession.cancel` with restamp
- Family UI polish for multi-child (already no silent studentIds[0] except single-child default)
