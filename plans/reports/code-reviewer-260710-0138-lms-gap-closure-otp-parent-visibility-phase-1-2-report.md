# Code Review: LMS gap closure — Phase 1 (OTP email delivery) + Phase 2 (parent visibility)

Plan: `plans/260710-0005-lms-gap-closure-otp-parent-visibility/plan.md` (+ phase-01, phase-02)

## Scope
- `apps/api/src/lms-auth/router.ts` (requestOtpEmail)
- `apps/api/src/worker/email-templates.ts`, `apps/api/src/worker/relay-email-outbox.ts`
- `apps/api/src/lms-auth/login.test.ts`, `apps/api/src/worker/relay-email-outbox.test.ts`, `apps/api/src/worker/email-templates.test.ts`
- `apps/api/src/submission/router.ts`, `apps/api/src/attendance/router.ts` (+ their `list-for-child.test.ts`)
- `apps/lms/src/pages/parent/session-evidence.tsx`, `homework-results.tsx`, `home.tsx`, `apps/lms/src/routes/index.tsx`

## Verification performed
- Read plan.md + phase-01 + phase-02 in full (red-team findings C1/C2/H1/H2/M1/M2/F1/F4, validation log).
- Read every changed file end-to-end, cross-checked against `assessment/router.ts:listForChild` (the pattern both new procedures were told to copy).
- Verified field names against `packages/db/prisma/schema.prisma` directly (`EmailOutbox.to`, `Submission.score`, `Exercise.starReward`, `Exercise` has no `title` — confirmed `CurriculumUnit.title` is the correct join target, which the code uses correctly even though the plan prose said `exercise.title`).
- Confirmed `Submission`/`Attendance` both have `@@index([studentId])` — no N+1/missing-index concern.
- `tsc --noEmit` clean on both `apps/api` and `apps/lms`.
- Attempted to run the new integration test suites against the local-sim DB (socat-forwarded `:15432`) — could not authenticate with the credentials in root `.env` (`cmc_app` auth failed). This appears to be a local credential/environment mismatch, not a defect in the diff — flagged as an unresolved verification gap below, not a code finding. The DB-independent unit-mock tests in `relay-email-outbox.test.ts` (RT-6/RT-8 block) passed.

## Invariant checklist (from plan red-team findings)
| # | Invariant | Verdict |
|---|---|---|
| C1 | Scrub on both `sent` and `dead`, `failed` keeps code, age-based sweep | **Implemented correctly** — `relay-email-outbox.ts:161-214`, `sweepStaleOtpPayloads` (see Medium-1 below for a real gap in the sweep's *interaction* with the drain loop) |
| C2 | Global fail-closed cap + send-gated on ParentAccount, response always `{ok:true}` | **Implemented correctly** — `lms-auth/router.ts:310-363`. Response is unconditional; only the `emailOutbox.create` is gated. Test `login.test.ts:359-381` verifies the cap. |
| H1 | `withFacility(student.facilityId)` re-established after `getApprovedChildren` bypass | **Implemented correctly** in both `submission/router.ts:421-429` and `attendance/router.ts:310-318`, full body copied as instructed |
| H2 | Parent-only `requireLmsParent`, not the assessment student-allowing variant | **Implemented correctly** — both procedures use `requireLmsParent`, tests assert student-kind → FORBIDDEN |
| M2/F1 | `to`, `score`, `Exercise.starReward` field names | **Correct**, verified against schema |
| Field-leak | No `gradedById`/`teacherAnnotationLayer`/`annotationLayer`/`answerText` in `ChildSubmissionDto` | **Correct** — interface and Prisma `select` both narrow explicitly; test asserts `not.toHaveProperty` |
| F4 | `attendance.listForChild` filters by `studentId`, not `classSessionId` | **Correct** — `where: { studentId: input.studentId }`; test seeds a classmate in the same session and asserts their row never leaks |

## Medium Priority

**1. Sweep can scrub a row's payload in the same drain cycle it's about to be (re)sent, producing a content-less "Thông báo" email instead of the row being dead-lettered.**
`relay-email-outbox.ts`: `sweepStaleOtpPayloads` runs *before* the `findMany({ where: { status: { in: ['pending','failed'] } } })` candidate query, in the same `relayEmailOutbox` invocation (lines 131-138). If a `pending`/`failed` OTP row is older than `OTP_PAYLOAD_TTL_MINUTES` (5 min — e.g. a worker outage, or a `failed` row waiting out its exponential backoff, which can be up to 30 min per `backoffMs`), the sweep scrubs its payload to `{kind:'otp',scrubbed:true}` first, then the very same cycle's drain loop claims that row and calls `transport.send()` on it. `renderOutboxEmail` no longer matches `isOtpPayload` (no `code` field) so it falls through to the generic "CMC EDU — Thông báo" branch (`email-templates.ts:97-101`) — the parent receives an empty, actionable-content-free email, the row is marked `sent`, and a real Brevo send is wasted. No security defect (no plaintext leak — that invariant holds), but this is a genuine behavior gap the red-team review didn't consider: swept rows should be moved straight to a terminal state (e.g. `dead`) rather than left `pending`/`failed` to be retried/sent with garbage content. Recommend either (a) `sweepStaleOtpPayloads` also sets `status: 'dead'` for non-terminal rows it scrubs, or (b) the send loop skips/dead-letters rows whose OTP payload is already `scrubbed:true` before calling `t.send()`.

**2. Phase 2 stated success criterion "Test RLS: read chạy trong `withFacility(student.facilityId)` — assert facility GUC được set" has no corresponding assertion.**
Both `submission/list-for-child.test.ts` and `attendance/list-for-child.test.ts` verify end-to-end *behavior* (correct child, sibling FORBIDDEN, student-kind FORBIDDEN) but never assert that the facility GUC was actually re-established (e.g. no test attempts a cross-facility read or checks `current_setting`). The code itself is correct (verified by reading), but the explicit defense-in-depth acceptance criterion from the phase file is not exercised by an automated assertion — a future regression that silently drops the `withFacility` wrapper (still passing the studentId-filter-based tests) would not be caught.

## Low / Informational

- **Timing side-channel (accepted, not re-litigating):** `requestOtpEmail` now does one extra `ParentAccount.findUnique` on the account-exists path only (to gate the outbox insert), which is a small latency delta vs. the no-account path. This was explicitly reviewed and accepted by the plan's red-team pass (C2: "lookup trước = leak là SAI — chỉ đúng cho response") — flagging only as informational per the review-audit-self-decision rule (verified decision, not reversing without new evidence).
- **No index backs the new JSONB-path queries.** The global-cap count (`lms-auth/router.ts:316`, `payload: { path: ['kind'], equals: 'otp' }`) and `sweepStaleOtpPayloads` (`relay-email-outbox.ts:74-78`) both filter on a JSONB path with no supporting index; `EmailOutbox` also carries receipt-email rows. At pilot volume (200/hr cap) this is a non-issue; worth a backlog note if `EmailOutbox` volume grows materially.
- **Could not independently execute the new integration test suites** — local-sim Postgres (forwarded via socat on `:15432`) rejected the `cmc_app` credentials found in root `.env`. `tsc --noEmit` is clean for both packages, and all DB-independent unit tests in the touched files pass. Recommend confirming green CI/local-sim run before merge since this reviewer could not directly execute the new DB-backed assertions.

## Positive Observations
- All 7 red-team findings (C1, C2, H1, H2, M1, M2/F1) and the 3 validation-log decisions are faithfully implemented in code, not just in comments — verified line-by-line against the plan's prescribed architecture.
- `ChildSubmissionDto`/`ChildAttendanceDto` use explicit narrow `select` clauses (not a wide select + destructure), so the field-leak red-team concern is structurally hard to reintroduce by accident.
- The code correctly deviated from one incorrect plan detail (`exercise.title` doesn't exist on `Exercise`; the code correctly used `exercise.curriculumUnit.title`) — good sign the author checked the schema rather than blindly following plan prose.
- Ordering invariant (LoginOtp created before EmailOutbox, template branch landing in the same PR as the outbox insert) is respected.

## Recommended Actions
1. (Medium) Fix the sweep/drain interaction so a stale OTP row is dead-lettered rather than sent as a content-less notification — see Medium-1.
2. (Medium) Add the missing facility-GUC defense-in-depth assertion to `submission/list-for-child.test.ts` and `attendance/list-for-child.test.ts`, or explicitly note in the phase file that this criterion was descoped.
3. (Low) Confirm the new integration tests actually pass against a live local-sim DB before merge — this reviewer's local DB access failed on credentials, environment-specific and unrelated to the diff.

## Unresolved Questions
- Was the local-sim Postgres credential mismatch (`cmc_app` auth failed via `:15432` forward) known/expected, or did the review environment reach the wrong DB? Recommend the author re-run `pnpm test` against the actual local-sim stack and confirm the new tests are green.
- Is the "swept row still gets sent with generic content" behavior (Medium-1) acceptable as-is for the pilot, or should it be fixed before merge? No data leak either way, but it silently wastes a Brevo send and could confuse a parent.
