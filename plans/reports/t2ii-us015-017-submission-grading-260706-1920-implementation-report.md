# T2-II — US-015/016/017 Submission + Grading + Stars — Implementation Report

Status: DONE

## Summary

Implemented the full student learning loop on top of `main` (P1+P2-Foundation+T1+T2-I):
`exercise.openForStudent`/`listForStudent` (ADR 0038 Tier A/B), `submission.saveDraft`/
`submit`, `submission.grade`/`listForGrading` (+ idempotent star award + FinalGrade
recompute via a new `@cmc/domain-grading` pure package). All 3 story-verify test files +
domain-grading units pass; full workspace typecheck/build/test green; migration applied
and `migrate status` clean.

## Files

**New**
- `packages/domain-grading/{package.json,tsconfig.json,vitest.config.ts}`
- `packages/domain-grading/src/{index.ts,compute-final-grade.ts,compute-final-grade.test.ts}`
- `packages/db/prisma/migrations/20260706200000_t2ii_submission_grading_stars/migration.sql`
- `apps/api/src/exercise/open-tier.ts` (ADR 0038 Tier A/B logic + `exerciseOpenTierRouter`)
- `apps/api/src/exercise/open-tier.test.ts` (US-015, 11 tests)
- `apps/api/src/submission/router.ts` (`submissionRouter`)
- `apps/api/src/submission/annotate-submit.test.ts` (US-016, 9 tests)
- `apps/api/src/submission/grade.test.ts` (US-017, 11 tests)

**Modified**
- `packages/db/prisma/schema.prisma` — `SubmissionStatus`/`StarTxnType` enums;
  `Submission`/`FinalGrade`/`StarTransaction` models (facilityId+RLS); back-relations on
  `Student`/`ClassBatch`/`Exercise`.
- `apps/api/src/trpc.ts` — `mergeRouters` export (t.mergeRouters); `requireLmsStudent(ctx)`
  helper (the LMS analogue of `scoped(ctx)`).
- `apps/api/src/class/ict-time.ts` — `ictMonthBounds(period)` helper (month start/end UTC
  instants for the `FinalGrade` recompute window).
- `apps/api/src/exercise/router.ts` — exported `toExerciseDto`; updated header comment
  pointing at `./open-tier.ts`.
- `apps/api/src/router.ts` — mounts `submission` router; merges `exerciseRouter` +
  `exerciseOpenTierRouter` under `exercise` via `mergeRouters`.
- `apps/api/src/test/db.ts` — teardown for the 3 new (no-DELETE-grant) tables via the
  privileged connection; `seedClassSession` helper.
- `packages/auth/src/index.ts` — `submission.grade`: `['giao_vien', 'giam_doc_dao_tao']`
  (super_admin bypasses via `can()`, omitted per existing convention).
- `apps/api/package.json` — `@cmc/domain-grading: workspace:*`.

## Tasks completed

- [x] Schema + hand-written migration, RLS + GRANT on Submission/FinalGrade/StarTransaction
      (Exercise/CurriculumUnit stay global, unchanged).
- [x] `@cmc/domain-grading` `computeFinalGrade` pure function, 100% coverage (threshold ≥90
      set in the package's own `vitest.config.ts`).
- [x] `exercise.openForStudent` / `listForStudent` — ADR 0038 Tier A/B exact.
- [x] `submission.saveDraft` (upsert, version++, 1MB cap, blocked after submit) /
      `submission.submit` (draft→submitted, immutable).
- [x] `submission.grade` (submitted|graded→graded, score≤maxScore, idempotent star award,
      FinalGrade recompute) / `submission.listForGrading`.
- [x] `submission.grade` added to the `@cmc/auth` permission registry.
- [x] Routers mounted; `migrate deploy` + `migrate status` clean.

## Verify / test output

```
pnpm --filter @cmc/domain-grading test        -> 1 file, 14 tests pass
pnpm --filter @cmc/domain-grading test:coverage -> 100% stmts/branch/funcs/lines (>=90 gate)
pnpm --filter @cmc/api build                  -> tsc clean
pnpm -r typecheck                             -> all 10 packages/apps clean
pnpm --filter @cmc/api test                   -> 30 files, 223 tests pass (incl. the 3 new
                                                  story-verify files: open-tier.test.ts 11,
                                                  annotate-submit.test.ts 9, grade.test.ts 11)
pnpm --filter @cmc/api test:coverage          -> exit 0, thresholds hold (finance/provisioning
                                                  90/90/90/80-75, src/** 70/70/70/60)
pnpm -r build                                 -> all packages/apps build clean
pnpm -r test                                  -> domain-grading/domain-finance/domain-identity/
                                                  storage/api (223) + e2e (2 playwright) all pass
prisma migrate status                          -> "Database schema is up to date!"
```

## Invariant -> test mapping

| Invariant | Test |
|---|---|
| Tier A: unit hidden until non-makeup session teaching it has ENDED (ICT) | `open-tier.test.ts` "Tier A: hides the exercise until..." |
| Tier A: opens for the WHOLE batch once ended | `open-tier.test.ts` "Tier A: opens for the WHOLE batch..." (2 independent students both see it) |
| Tier A: cancelled session never opens, even past endTime | `open-tier.test.ts` "Tier A: a cancelled session never opens..." |
| Tier B: makeup+present opens ONLY for that student | `open-tier.test.ts` "Tier B: a makeup session the student attended present/late opens...ONLY for that student" (bystander excluded) |
| Tier B: makeup+late also opens | `open-tier.test.ts` "Tier B: ...attended LATE also opens..." |
| Tier B: makeup+absent does not open | `open-tier.test.ts` "Tier B: ...marked ABSENT does not open..." |
| Non-makeup attendance never triggers Tier B | `open-tier.test.ts` "attendance on a NON-makeup session never triggers Tier B" |
| blocked_lms -> empty list | `open-tier.test.ts` "blocked_lms students see an empty list..." |
| draft exercise never appears | `open-tier.test.ts` "a draft (unpublished) exercise never appears..." |
| `listForStudent` alias | `open-tier.test.ts` "listForStudent is an alias..." |
| version increments on redraft | `annotate-submit.test.ts` "creates a draft, then re-saves it..." |
| immutable after submit | `annotate-submit.test.ts` "blocks saveDraft once the submission has been submitted" |
| unique 1/(exercise,student) | `annotate-submit.test.ts` "unique (exercise, student): two students each get their own..." |
| exercise-not-open blocks saveDraft | `annotate-submit.test.ts` "rejects a draft on an exercise that is not open yet" |
| 1MB annotationLayer cap | `annotate-submit.test.ts` "rejects an annotationLayer larger than 1MB" |
| only `submitted` (or already-graded, for regrade) gradable, `draft` rejected | `grade.test.ts` "rejects grading a draft..." |
| score > maxScore rejected; boundary (=maxScore) allowed | `grade.test.ts` "rejects a score above exercise.maxScore" / "allows a score exactly at maxScore" |
| stars awarded exactly once across regrades (idempotent) | `grade.test.ts` "awards starReward exactly once, even across a regrade" |
| FinalGrade recompute | `grade.test.ts` "recomputes FinalGrade for the student/classBatch/ICT-month period" |
| `submission.grade` permission gate | `grade.test.ts` "forbids a role without submission.grade permission" |
| RLS negative (app-filter path) | `grade.test.ts` "a different facility's staff cannot grade or read..." |
| RLS negative (app-filter REMOVED, raw query) | `grade.test.ts` "RLS enforces the boundary even if the app-level facilityId filter were removed" |
| LMS session shape (no student selected) | both `open-tier.test.ts` and `annotate-submit.test.ts` "rejects a call with no selected student profile" |

## Assumptions (flag for review)

1. **FinalGrade weighting** (TL19 §6 does not pin exact weights): documented default in
   `@cmc/domain-grading/src/compute-final-grade.ts` — `final = 0.7 * avgExerciseScore(0-10
   normalized) + 0.3 * (attendanceRate * 10)`. A student with zero graded exercises this
   period gets exerciseComponent=0 (not skipped). Revisit if the business pins an exact
   formula.
2. **FinalGrade period grain**: `period` = ICT calendar month (`ictMonthOf`) of the grading
   instant — the SAME monthly bucket `Attendance` already uses. A regrade re-buckets by
   WHEN IT WAS GRADED (added `Submission.gradedAt`, not in the original phase-03 field
   list, needed to distinguish this from `submittedAt`).
3. **FinalGrade classBatch attribution**: derived from the student's `active` Enrollment in
   the grading facility at grade-time. If none exists, `submission.grade` still succeeds
   (score + star award are durable) but the FinalGrade recompute silently no-ops — grading
   a submission must not fail because a student's enrollment later lapsed.
4. **annotationLayer shape**: validated as a JSON object (`z.record(z.string(),
   z.unknown())`) — TL19 §3 says "JSON" without pinning object-vs-array; object is the more
   common annotation-overlay shape (`{ strokes: [...] }`).
5. **Star idempotency**: app-level check-then-create inside the SAME transaction as the
   grade update, backstopped by a hand-added partial unique index
   (`StarTransaction_homework_completed_ref_key` on `(refType, refId)` where
   `type='homework_completed'`) — same H2-remediation pattern as
   `enrollment_active_reserved_unique`.
6. **`exercise.openForStudent`/`listForStudent` placement**: kept as a SEPARATE file
   (`exercise/open-tier.ts`) merged into the `exercise` router key via `t.mergeRouters`
   (new `mergeRouters` export in `trpc.ts`), rather than added to `exercise/router.ts`
   directly — matches that file's own T2-I-era comment reserving open-tier for a "distinct
   router."

## Unresolved questions

None blocking — all 3 story-verify test files + domain-grading units pass; the 5
assumptions above are documented defaults per the phase brief's explicit permission
("pick a sensible documented default if not pinned").
