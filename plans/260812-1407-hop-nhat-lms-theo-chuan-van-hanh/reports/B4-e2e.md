# B4-e2e — Submission → SessionExercise seed/cleanup alignment

**Branch:** `feat/lms-delivery-only-homework`  
**Owner:** `apps/e2e/**` only (no apps/api, admin, lms, packages)  
**Commit:** none  
**Date:** 2026-08-12  

Skills: `/ak:scout` → `/ak:fix`

---

## Context

Product B4: `Submission` attaches to **`sessionExerciseId`** (delivery instance), not catalog `exerciseId`.  
`submission.saveDraft` / `submit` take `sessionExerciseId`.

E2E helpers still wrote `exerciseId` on Submission (schema gone) → typecheck/runtime break.

---

## Changes

### `apps/e2e/src/db.ts`

| Helper / path | Change |
|---------------|--------|
| `seedSubmittedSubmission` | Requires `classBatchId`; creates minimal `ClassSession` + `SessionExercise` then Submission with `sessionExerciseId` (optional reuse via `sessionExerciseId` arg). Returns `{ submissionId, sessionExerciseId }`. Pattern matches API teacher-scoping / grade tests. |
| `cleanupExercises` | Delete via `SessionExercise` → submissions by `sessionExerciseId`, then deliveries, `ClassExerciseItem`, Exercise, units |
| `cleanupCurriculumUnits` | Same delivery-first chain before Exercise delete |
| `cleanupFacility` | Explicit `sessionExercise` + `classExerciseItem` delete after submissions (before ClassSession cascade) |

### Spec call sites (signature `classBatchId` added)

| File | Note |
|------|------|
| `tests/attendance-grading.spec.ts` | Pass `classBatchId` from provision |
| `tests/journeys/grading-submission.journey.ui.spec.ts` | Pass `batch.classBatchId` |
| `tests/journeys/lms-stars-redeem-cycle.journey.ui.spec.ts` | Pass `batch.classBatchId` |
| `tests/journeys/lms-grade-parent-view.journey.ui.spec.ts` | Pass `batch.classBatchId` |
| `tests/kind-isolation.spec.ts` | `saveDraft` input: `exerciseId` → `sessionExerciseId` (dummy UUID; parent kind gate still first) |

---

## Acceptance journeys / proof count

**No journey removed or skipped.** All four grading/stars/parent-view consumers still seed a submitted row and exercise the same UI/API paths; only the seed attachment model changed.

| Scenario | Still proven? |
|----------|----------------|
| Attendance + grade + stars (`attendance-grading`) | Yes — seed now delivery-backed |
| Teacher grades queue (`grading-submission` journey) | Yes |
| Parent sees score after grade (`lms-grade-parent-view`) | Yes |
| Stars redeem after grade (`lms-stars-redeem-cycle`) | Yes |
| Parent cannot `saveDraft` (`kind-isolation`) | Yes — input field name only |

---

## Validation

```text
cd apps/e2e && npx tsc -p tsconfig.json --noEmit
→ EXIT:0
```

---

## Status: DONE

E2E Submission seeds/cleanup aligned with B4 `sessionExerciseId`; typecheck clean; no acceptance-journey count reduction; no commit.
