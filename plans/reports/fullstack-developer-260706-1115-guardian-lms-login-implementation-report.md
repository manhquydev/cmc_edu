# US-007 / US-008 — Guardian Link + LMS Parent Login — Implementation Report

Date: 2026-07-06

## Status: DONE

## Summary

Implemented WF-P1-06 (guardian link request/approve/reject) and WF-P1-07 (LMS parent
phone+OTP login with profile picker), plus `enrollment.mine`. Both story-verify commands
green; full monorepo `typecheck`/`test`/`build` green (56/56 API tests, no regressions).

## Files changed

- `apps/api/src/guardian/router.ts` (new, 163 lines) — `guardian.requestLink` (lms),
  `guardian.approveLink` / `guardian.rejectLink` (staff, `requirePermission('guardian','approveLink')`).
- `apps/api/src/guardian/approved-children.ts` (new, 33 lines) — shared child-data read
  gate (`getApprovedChildren`), used by both `enrollment.mine` and `lmsAuth.verifyOtp`.
- `apps/api/src/guardian/link.test.ts` (new, 7 tests) — US-007 verify file.
- `apps/api/src/lms-auth/router.ts` (new, 143 lines) — `lmsAuth.requestOtp` / `verifyOtp`
  (both `publicProcedure`).
- `apps/api/src/lms-auth/login.test.ts` (new, 6 tests) — US-008 verify file.
- `apps/api/src/enrollment/router.ts` — added `enrollment.mine` (`lmsProcedure` query),
  `EnrollmentMineDto`.
- `apps/api/src/router.ts` — mounted `guardian` and `lmsAuth` routers.
- `apps/api/src/test/db.ts` — added `buildLmsContext`, `seedParentAccount`,
  `seedGuardianLink`, `cleanupLoginOtpsByPhone`.

No Prisma schema changes (as instructed) — `GuardianLinkRequest.studentRef`, `LoginOtp`,
`Guardian`, `GuardianLinkStatus` (`pending|approved|rejected`), `LoginOtpStatus`
(`pending|verified|expired`), `StudentLifecycle.blocked_lms` all pre-existed from the
Phase 0–3 substrate and are reused as-is.

## Tasks completed

- [x] `guardian.requestLink` — creates `pending` `GuardianLinkRequest`, no child data in response.
- [x] `guardian.approveLink` / `rejectLink` — staff-gated, facility-scoped, atomic claim (no double-review race).
- [x] Child-data boundary enforced via one shared gate (`getApprovedChildren`) used by `enrollment.mine` and `lmsAuth.verifyOtp`.
- [x] `lmsAuth.requestOtp` — always issues a 6-digit OTP, generic `{ok:true}` regardless of account existence.
- [x] `lmsAuth.verifyOtp` — atomic one-shot claim (no replay), generic failure for wrong/expired code and for a phone with no `ParentAccount`.
- [x] Profile picker: `needsPicker = children.length >= 2`.
- [x] `enrollment.mine` — approved-guardian children only, excludes `blocked_lms`.
- [x] Login phone normalized via `normalizeLoginPhone` consistently in both procedures.

## Tests status

- Type check: **pass** (`pnpm typecheck` — all 7 packages).
- Unit/integration tests: **pass** (`pnpm test` — all 9 packages/apps, 87 total tests incl. 56 in `@cmc/api`).
- Build: **pass** (`pnpm build` — all 7 packages, incl. `@cmc/admin` vite build).

Exact verify output:

```
$ pnpm --filter @cmc/api exec vitest run src/guardian/link.test.ts
✓ src/guardian/link.test.ts (7 tests) 406ms
Test Files  1 passed (1)
     Tests  7 passed (7)

$ pnpm --filter @cmc/api exec vitest run src/lms-auth/login.test.ts
✓ src/lms-auth/login.test.ts (6 tests) 318ms
Test Files  1 passed (1)
     Tests  6 passed (6)

$ pnpm --filter @cmc/api exec vitest run
✓ 9 test files, 56 tests passed (includes both new files + all Phase 0-3 tests unmodified)

$ pnpm typecheck   -> 12/12 tasks successful
$ pnpm test        -> 9/9 tasks successful
$ pnpm build       -> 7/7 tasks successful
```

## Assumptions (documented in code comments too)

1. **`studentRef` = `Student.id` (UUID).** The parent supplies the target student's real
   DB id (plausibly known from a front-desk handout / enrollment confirmation). The
   server resolves it ONLY to read `facilityId` (server-derived, never client-trusted)
   and to confirm it names a real student — no name/schedule/grade data is ever returned
   to the parent at this step. Staff still perform the real identity cross-check
   ("đối chiếu", per WF-P1-06 happy path) out of band before clicking approve; the
   `studentRef` narrows the request to one child, it is not proof of relation. This
   choice makes `Guardian` creation on approval trivial (`studentId = request.studentRef`)
   and lets `requestLink` correctly detect "already-linked" / "duplicate pending"
   without inventing a second lookup key. Minor accepted risk: an authenticated parent
   guessing a valid UUID gets a `NOT_FOUND` vs no-error signal (existence oracle only,
   no data) — infeasible over a 122-bit ID space and gated behind an already-authenticated
   LMS session, so not treated as a child-data leak.

2. **OTP status uses the pre-existing schema enum values `pending`/`verified`/`expired`**
   (not the workflow doc's informal `issued`/`verified`/`expired` wording) — `pending` is
   used as the "just issued" state. No background job flips rows to `expired`; expiry is
   enforced by an `expiresAt > now()` filter at verify time, which is behaviorally
   equivalent without adding a cron dependency (documented in `lms-auth/router.ts`).

3. **`sessionToken` shape:** base64url encoding of `{parentAccountId}` — a deliberate
   placeholder mirroring the existing dev-only `x-dev-lms-user` header shape
   (`apps/api/src/context.ts`) that already carries `{parentAccountId, studentId?}` for
   `lmsProcedure` calls in this phase. Not signed or expiring; real session infra
   (JWT/cookie) is explicit follow-up debt, not hidden — called out in both the router
   comment and here.

4. **OTP delivery** is recorded as an `AuditLog` row (`lmsAuth.requestOtp`) rather than a
   new SMS transport, since no SMS provider is named anywhere in the docs (unlike email's
   `graph`/`brevo` `EmailTransport` enum). The OTP code is only ever readable from
   `LoginOtp` directly (tests do this), never returned in any response.

5. **Guardian relation on approve** is a required input (`father|mother|guardian`) rather
   than inferred — the schema has no default and WF-P1-06 doesn't specify one; staff pick
   it during the "đối chiếu" review, consistent with `GuardianRelation` existing purely as
   a staff-entered classification.

6. Test phone range `0991xxxxxx` (guardian) / `0992xxxxxx` (lms-auth) — deviated from the
   brief's suggested `096x` since that range is already used by
   `apps/api/src/provisioning/idempotent.test.ts` (`0960000001..4`); `099x` was unused
   across all existing test files (checked via grep before picking it).

## Issues encountered

None — no file ownership conflicts, no schema gaps found (all needed models/enums already
existed from Phase 0–3 substrate work).

## Unresolved questions

None blocking. If product later wants OTP `expired` to be an observable status (e.g. an
admin dashboard listing expired codes), a small cron/backfill would be needed — flagged
as follow-up, not a gap in this phase's acceptance criteria.
