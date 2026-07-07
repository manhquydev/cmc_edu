# US-UI-05 Teaching screens — schedule + attendance + grading

## Status

done

## Lane

normal

## Product Contract

Three teaching screen groups in `apps/admin/src/pages/teaching/`:

1. **Schedule** — calendar view (week/month) + list view of class sessions.
2. **Attendance tablet form** — check-in form with IP validation (request IP must match
   registered facility subnet); saves attendance record to DB.
3. **Grading** — PDF annotation layer (`teacherAnnotationLayer`) + star rating (1–5 stars,
   write-once: once set, star rating cannot be overwritten).

## Relevant Product Docs

- `docs/11-api-contract.md`
- `docs/18-tech-stack-va-chuan-ky-thuat.md`

## Risk Flags

- Data model (`teacherAnnotationLayer` JSON blob; `starRating` immutable after first set)
- Existing behavior (IP check-in shares IP validation logic with HR attendance)

## Acceptance Criteria

- Attendance form saves record to DB with `checkedInAt` timestamp.
- IP mismatch → request rejected with `IP_NOT_ALLOWED` error.
- Star rating saved once; subsequent `grading.setStarRating` calls for same record return
  `ALREADY_RATED` error.
- PDF annotation saves as `teacherAnnotationLayer` JSON on the submission record.

## Design Notes

- Commands: `attendance.checkIn`, `grading.setStarRating`, `grading.saveAnnotation`.
- Queries: `schedule.list`, `attendance.sessionRoster`, `grading.submissionDetail`.
- API: tRPC procedures.
- Tables: `Attendance` (existing), `GradingSubmission.teacherAnnotationLayer JSONB`,
  `GradingSubmission.starRating INT NULL`.
- Domain rules: star-once = `starRating IS NULL` guard before write.
- UI surfaces: `pages/teaching/schedule/`, `pages/teaching/attendance/`, `pages/teaching/grading/`.

## Validation

When updating durable proof status, use numeric booleans:
`scripts/bin/harness-cli story update --id US-UI-05 --unit 0 --integration 1 --e2e 1 --platform 1`.

| Layer | Expected proof |
| --- | --- |
| Unit | n/a. |
| Integration | `grading.setStarRating` second call returns error; IP mismatch returns error. |
| E2E | `attendance-grading.spec.ts` — 4 tests: check-in, IP block, star-once, annotation save. |
| Platform | `pnpm build` green for `apps/admin`. |
| Release | `pnpm test` passes all attendance-grading specs. |

## Harness Delta

Adds `attendance-grading.spec.ts`. No harness rule changes.

## Evidence

Add commands, reports, screenshots, or links after validation exists.
