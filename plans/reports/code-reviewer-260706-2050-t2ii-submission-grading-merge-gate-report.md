# T2-II Merge Gate — Adversarial Review (READ-ONLY)

Branch `feat/t2ii-submission-grading` (uncommitted working tree) → main.
Scope: `exercise.openForStudent` (ADR 0038), submission annotate/submit/grade, stars, `computeFinalGrade`, schema/migration.
Reviewer posture: hostile. file:line + severity + scenario + CONFIRMED/SUSPECTED + one-line fix.

---

## Ranked Findings

### F1 — CRITICAL — Child-data authorization gate is ABSENT in the entire T2-II LMS surface — CONFIRMED
`apps/api/src/exercise/open-tier.ts:41-52` (`loadLmsStudent`), used by `open-tier.ts:153-166` and `submission/router.ts:162-228`.

The project already has ONE documented child-data boundary: `apps/api/src/guardian/approved-children.ts:1-10,43-59` — *"an APPROVED `Guardian` row is the ONLY thing that grants a parent read access to a student's data"*, and `enrollment.mine` + LMS login both route through `getApprovedChildren`. **T2-II never calls it.** `requireLmsStudent` (`trpc.ts:154-162`) returns `{parentAccountId, studentId}` but never verifies the pair; `loadLmsStudent` then loads the student **by id with `{ bypass: true }` RLS-bypass** (`open-tier.ts:42-47`) and returns facility/lifecycle with zero parent-ownership check.

Failing scenario: a parent LMS session sets `studentId` to a child that is NOT theirs (any other family, any facility — RLS is bypassed in `loadLmsStudent`). `openForStudent` returns that child's open exercise list; `saveDraft`/`submit` create and submit work **as** that child. Full cross-family read + write of child data — the single highest-risk lens in this diff.

Secondary: `auditChildDataAccess` (M3 remediation, `approved-children.ts:106-121`, docs/08 §7 "Nhật ký truy cập dữ liệu trẻ") is mandatory on every child-data disclosure and is **not** called by `openForStudent`, so these reads are unlogged.

Mitigation (why not flagged as immediately-exploitable-in-prod): transport auth is the dev-header stub and `DEV_AUTH_ENABLED` is fail-closed in prod (`context.ts:40-41,101-108`). But the parent→student *authorization* is a business gate that belongs in this layer and is simply missing; it goes live the moment SSO lands, and it IS exploitable today in any non-prod/`ALLOW_DEV_AUTH=1` environment. For a merge gate on child data this is blocking.

One-line fix: in `loadLmsStudent`/`requireLmsStudent`, assert an approved `Guardian` row exists for `(parentAccountId, studentId)` (reuse `getApprovedChildren` / the `parentAccountId_studentId` unique) before returning, and call `auditChildDataAccess` on `openForStudent`.

---

### F2 — HIGH — `recomputeFinalGrade` counts CANCELLED-session attendance into the denominator — CONFIRMED
`apps/api/src/submission/router.ts:139-148`.

The attendance query filters only `classSession: { endTime: { gte, lt } }` with **no `status != 'cancelled'` filter** — unlike Tier A (`open-tier.ts:80` filters `status: { not: 'cancelled' }`) and unlike the stated domain rule ("Cancelled sessions are excluded from attendance", `class-session-router.ts:77-78`, `attendance/router.ts:74-82`). Cancel only flips `status` (`class-session-router.ts:95-98`); it never deletes existing `Attendance` rows.

Failing scenario: teacher marks attendance for a session (rows created), session is later cancelled. Those rows still match the recompute window, so a cancelled session's attendance rows enter the denominator (and, for absent rows, drag the rate down) — the FinalGrade attendance component is computed against sessions the business says don't count. Silent grade skew.

One-line fix: add `status: { not: 'cancelled' }` to the `classSession` relation filter in the attendance query.

---

### F3 — MEDIUM — FinalGrade classBatch attribution is nondeterministic for multi-enrollment students — SUSPECTED
`apps/api/src/submission/router.ts:110-112,152-156`.

`recomputeFinalGrade` picks the enrollment via `findFirst({ status: 'active' })` with **no `orderBy`**. Schema places no unique constraint preventing a student from holding multiple active `Enrollment` rows (different `classBatchId`s). When two exist, (a) which `classBatchId` the FinalGrade is attributed to is arbitrary DB order, and (b) *all* graded submissions in the period are lumped into that one batch's FinalGrade regardless of which class each exercise belongs to, while attendance is scoped to only the one picked enrollment (`enrollmentId: enrollment.id`, line 143). Inconsistent, order-dependent grade.

One-line fix: iterate all active enrollments (deterministic order) and attribute per-batch, or document + enforce single-active-enrollment as a precondition.

---

### F4 — LOW — Tier A "ENDED" uses `lte` (includes the exact end instant) — SUSPECTED
`apps/api/src/exercise/open-tier.ts:82`. Spec says unit opens when endTime is "in the past"; `endTime: { lte: new Date() }` treats `endTime == now` as ended. One-millisecond boundary, practically negligible, but not literally "past". Fix: `lt` if strict past is intended.

---

### F5 — LOW — `annotationLayer` 1MB cap is enforced only after full parse — SUSPECTED
`apps/api/src/submission/router.ts:23,85-90`. `saveDraftInput` parses the whole `z.record` body before `assertAnnotationLayerSize` runs; no transport-level JSON body cap was found for the tRPC handler (the PDF upload route has its own byte guard, `exercise/upload-route.ts:33-40`, but that path is separate). A multi-MB body is fully buffered/parsed before rejection. Minor DoS surface. Fix: add a request body-size limit at the tRPC HTTP adapter.

---

## CONFIRMED-Sound (attacked, held up)

- **Star idempotency across regrades** — `submission/router.ts:263-277`. App-level `findFirst`-then-skip inside the txn, backstopped by the partial unique index `StarTransaction_homework_completed_ref_key ON (refType, refId) WHERE type='homework_completed'...` (`migration.sql:102-104`). `refId = submission.id` (globally unique), so the facility-less index is correct. Regrade (status already `graded`) re-runs grade but finds the existing txn → no second award.
- **Concurrent double-grade race** — two simultaneous `grade()` calls both see no StarTransaction and both insert; the partial unique index rejects the second insert, aborting that txn. No double-award (loser errors out, which is the safe outcome for soft-money).
- **Grade gate** — only non-draft gradable (`:245-247`); `score` is `int().nonnegative()` and `score > maxScore` rejected (`:253-255`); `computeFinalGrade` re-asserts bounds. Immutability: `saveDraft` blocks non-draft edits (`:177-179`), `submit` requires draft (`:218-220`).
- **Cross-facility grade** — `scoped(ctx)` derives facilityId server-side; `findFirst({ id, facilityId })` (`:241`) + RLS `WITH CHECK` (`migration.sql:112-115`) is real defense-in-depth, not app-filter-only.
- **RLS fail-closed** — all three tables `ENABLE ROW LEVEL SECURITY` with `USING`+`WITH CHECK` on `current_setting(..., true)`; unset GUC → NULL → false. `cmc_app` gets UPDATE only where needed, no DELETE, StarTransaction append-only (`migration.sql:141-143`).
- **Tier B per-student isolation** — keyed on `Attendance.studentId` with `status IN (present, late)` and `classSession.isMakeup=true` (`open-tier.ts:94-105`). Absent-from-makeup excluded (status filter); non-makeup can't trigger B (isMakeup filter); B never widens to the batch.
- **Tier A makeup/cancel/publish/blocked exclusions** — `isMakeup:false`, `status != cancelled`, `curriculumUnitId != null` (`:78-82`); `blocked_lms` short-circuits to empty set (`:61-63`); unpublished filtered in `listOpen` (`:128`) and `assertExerciseOpenForStudent` (`:142-144`).
- **computeFinalGrade div-by-zero** — zero graded exercises → component 0 (documented), zero attendance → rate 0 (`router.ts:148`, `compute-final-grade.ts:54-58`). No NaN.
- **Submission ownership** — student writers key on `exerciseId_studentId` with the authenticated `studentId`; `saveDraft` gates through `assertExerciseOpenForStudent` (bypass-by-arbitrary-exerciseId blocked). (Ownership-of-student itself is F1.)

---

## Unresolved Questions

1. Is a student ever allowed >1 active Enrollment concurrently? Answer decides whether F3 is MEDIUM or a non-issue.
2. Does the real (post-SSO) session layer intend to bind `studentId`→`parentAccountId` itself, or is that expected in `requireLmsStudent`? F1 severity assumes this layer owns the check (matching the existing `enrollment.mine`/login pattern).
3. `submit` (`router.ts:207-228`) does not re-check `assertExerciseOpenForStudent`; acceptable only if units never close after opening — confirm ADR 0038 has no close transition.

---

## Severity Counts
- CRITICAL: 1 (F1)
- HIGH: 1 (F2)
- MEDIUM: 1 (F3)
- LOW: 2 (F4, F5)

## Verdict: **FIX-BEFORE-MERGE**
F1 (missing child-data Guardian authorization + missing audit) is blocking on its own for a child-data feature; F2 silently corrupts FinalGrade. Star soft-money invariants and RLS are sound.

Status: DONE
