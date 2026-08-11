# Gap analysis — Plan 1 + Plan 2 vs implementation (2026-08-11)

## Plan 1 — Foundation (`260811-1117`) — **DONE**

| Success criterion | Status |
|-------------------|--------|
| ADRs + freezes | Done |
| domain-lms package + tests | Done (+ exercise-sequence) |
| Migration unit-range + FORCE RLS | Done |
| Spike create/grant/roster | Done + UI createClassWithUnits |
| Ship note for plan 2/3 | Done |

## Plan 2 — Teaching spine (`260811-1118`) — **DONE (spines)**

| Phase | Status |
|-------|--------|
| 1–5 | done |
| 6 Exercise delivery | **done** — SessionExercise + sequence + worker + open-tier OFF |
| 7 UI spines | **done** — dual-gate, cancel, createClass |

## Plan 3 readiness

See `plans/reports/plan3-entry-checklist-from-plan2.md`.

**Single range writer:** `lmsOps.addWithUnits` / `grantPast` / `revokeFromNext` only.  
**Money path:** wire `provisionFromReceipt` to that writer (do not invent a second grant path).

## Optional polish (not Plan 3 blockers)

- Admin UI for assignExerciseSequence / grant ranges
- Submission keyed by SessionExercise (if needed later)
- Worker auto-cancel restamp
- Human staging UAT
