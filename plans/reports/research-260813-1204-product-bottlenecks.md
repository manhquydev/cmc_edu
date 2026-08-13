# Research Report: CMC EDU v2 remaining PRODUCT bottlenecks

**Date:** 2026-08-13 12:04 ICT  
**HEAD measured:** `bc3f473` (`develop`)  
**Lane:** product (ERP+LMS). Design-system out of scope.  
**Method:** code/schema/tests/acceptance scripts only. Plans/reports/*.md not used as numbers.

## Executive Summary

The product is not blocked by "missing screens" the ledger still lists. Class create, attendance picker, unit-assign, course create, and exercise-sequence **already exist**. The ledger's `no-ui-path` / `DOCUMENTED_GAPS` reasons are stale on several of those.

What still blocks **completing** ERP+LMS is the teaching→student loop: homework is open **only after** `lmsOps.deliverSessionExercise`, which has **no UI**. Entitlement (`EnrollmentUnitRange`) is required on the open path and is written only by receipt provisioning + lmsOps grant APIs that also have **no UI**. Parent cannot request a child link in LMS. Student has no unique business identifier.

`pnpm acceptance:report` at HEAD: **43/43 built**, **0 untriaged orphans**, **0/43 proven** this run (local `journeys.json` SHA ≠ HEAD). Merge-green CI can pass that bar. It does not mean the product is finished.

## Research Methodology

- Sources: `scripts/acceptance-report/*`, `scripts/business-verify/verify.ts`, `packages/db/prisma/schema.prisma`, `apps/{admin,lms,e2e,api}`, `.github/workflows/ui-e2e.yml`. Regenerated gitignored `acceptance-report/verification.json` at HEAD.
- Date range: HEAD 2026-08-13. Local `business-verification.json` is **unusable** (2026-08-04, 38 flows, commit `d359249`).
- Search terms (code): `DOCUMENTED_GAPS`, `assertBusinessInvariant`, `deliverSessionExercise`, `classBatch.create`, `guardian.requestLink`, `ComingSoon`, `EnrollmentUnitRange`.
- Recency: HEAD only. Old ledger files treated as contaminated.

## What `acceptance:report` actually requires

Entry: `package.json` → `tsx scripts/acceptance-report/verify.ts`.

**Always does (static):**
1. Scan tRPC / UI routes / Prisma models.
2. Match 43 manifest flows. Empty expected set → throw. Dead whitelist/gap keys → throw.
3. Write `/acceptance-report/` (gitignored, `.gitignore:174`). `verification.json` is an artifact, never source of truth.
4. Exit 1 only if: untriaged orphans, unresolved namespaces, broken journey files, or `h2-mismatch`.

**Does not require:** `journeys.json` present. Missing results → every flow "chưa chứng minh". SHA mismatch → same (verify.ts:353-355).

**Does not fail on:** red journeys, `no-ui-path` author notes, documented gaps, missing `assertBusinessInvariant`.

**CI (`ui-e2e.yml:197-200`):** after Playwright, `acceptance:report` then `business:verify --strict`. Strict fails if money/state-critical flows are `reachable-only`, or zero money/state `verified-correct`, or results SHA ≠ ledger commit.

Local run 2026-08-13T05:08Z: `43 built, 0 partial, 0 missing, 17 documented orphans, 0 untriaged`. Evidence 0/43 proven (results @ `b5bd0cc`-dirty ≠ HEAD). Dirty worktree warning fired.

**Flows:** 43 (`flow-manifest.ts:19`). Journey declared: 36/43. No journey: P2-01, P2-02, P2-03, P2-05, P2-09, P3-10, P3-11. Author `statusReason no-ui-path`: 6 (not P2-09). Scanner found **0 placeholder routes** on claimed paths.

`no-ui-path` is **hand-written**, not re-measured. Several are false at HEAD (see table).

## tRPC orphans / DOCUMENTED_GAPS

17 keys in `verify.ts:59-115`. HEAD scan: 17 documented, **0 untriaged**. CI orphan ratchet is quiet.

| Procedure | Gap reason still true? | Evidence |
|---|---|---|
| `lmsOps.deliverSessionExercise` | **YES — real blocker** | API `lms-ops/router.ts:674-703`. `rg` in `apps/admin/src` = 0 |
| `lmsOps.addWithUnits` / `grantPast` / `archiveEnrollment` / `unarchiveEnrollment` / `revokeFromNext` | **YES** | grant writer `grant-units.ts:1,217`. No admin UI |
| `schedule.addSlot` / `updateSlot` / `archiveSlot` | **YES** | `rg` admin+lms = 0 |
| `classSession.assignTeacher` | **YES** (session-level). Class-level assign exists | `class-detail.tsx:78` is `classBatch.assignTeacher` |
| `exercise.update` | **YES** | `rg` admin+lms = 0 |
| `enrollment.mine` | **YES** | `rg` `apps/lms/src` = 0. Parent children cached at login (`parent/home.tsx:3-5`) |
| `course.create` | **LIE** | `courses/index.tsx:95` `trpc.course.create.useMutation` |
| `lmsOps.createClassWithUnits` | **LIE** | `classes/index.tsx:260` — this IS the create-class form |
| `lmsOps.cancelSessionAndRestamp` | **LIE** | `session-detail.tsx:79` |
| `lmsOps.rosterForSession` | **LIE** | `attendance-panel.tsx:111` |
| `curriculumUnit.list` | **LIE as "no flow"** — used | `class-detail.tsx:240` SessionUnitPicker |

Claimed-but-no-UI (not orphans, so ratchet cannot see them): `guardian.requestLink` (P1-06), `enrollment.blockLms` / `student.resetPassword` (P1-05; journey header already recorded this). Staff lifecycle uses `student.setLifecycle` (`student-detail.tsx:105`), not `blockLms`.

## Prisma vs UI

### Exercise
- Unique: `@@unique([folderId, orderInFolder])` (`schema.prisma:852`). Titles not unique. Status enum draft/published/closed.
- Delivery: `SessionExercise.classSessionId @unique` (881-889) — one homework instance per session.
- Submission: `@@unique([sessionExerciseId, studentId])` (947).
- Open path is **delivery-only**, not assignUnit: `open-tier.ts:3-8`. Unit stamp still needed for entitlement via session's `curriculumUnitId`.

### Class / session lifecycle
- `ClassBatch.status` is unconstrained `String @default("active")` (665). Comment: not exercised by P2-Foundation procedures.
- `ClassSession.status` enum: planned / confirmed / cancelled / done (137-142). Unique `(classBatchId, sessionDate, startTime)` (772).
- Create UI exists: `lmsOps.createClassWithUnits` (not claimed `classBatch.create`). Confirm/cancel/assignUnit UI on `class-detail.tsx:185-255`.
- Running-class schedule **edit** APIs exist, **no screen** (`schedule.*Slot`).
- Session `done` / auto-cancel: workers P3-10/P3-11, no UI by design (`rg runDoneSweep` admin+lms = 0). Worker does **not** call `deliverSessionExercise`.

### Parent / student identity
- `Student`: UUID + `fullName`. **No student code.** `createdByReceiptId @unique` (430). Lifecycle enum active/blocked_lms/withdrawn.
- Lookup UI: name or parent phone (`students/index.tsx:42`). No create-student screen; students come from receipt provisioning (`schema.prisma:427-429`, `enrollment/router.ts:7-8`).
- `ParentAccount.phone @unique` system-wide; `email @unique` nullable (452-458).
- `Guardian @@unique([parentAccountId, studentId])` (533). `GuardianLinkRequest` has **no** unique on `(parent, studentRef)` — duplicate pending requests allowed by schema.
- Link request UI: none. Parent home empty state: "Liên hệ nhân viên" (`parent/home.tsx:146-150`).
- `Enrollment`: reserved→active only via receipt approve. Partial unique `enrollment_active_reserved_unique` in SQL (`migration.sql:80-82`), not Prisma `@@unique`.
- `EnrollmentUnitRange`: required for `openForStudent` roster (`open-tier.ts:6-8`). `enrollment.enroll` does **not** write ranges. Writers: `provision-from-receipt.ts:441`, `lmsOps` grant/add (no UI).

## LMS app — pages vs stubs

Router: `apps/lms/src/routes/index.tsx` (10 pages). **Zero ComingSoon.**

| Route | File | Real? |
|---|---|---|
| `/login` | `login.tsx` | Real OTP+student login. DEV banner: email OTP not E2E (`login.tsx:80-85`). Prod worker uses Brevo (`worker/index.ts:91-98`); Graph still throw-on-send. |
| `/parent/home` | `home.tsx` | Real child chips from **login cache**, not `enrollment.mine`. No request-link form. |
| `/parent/evidence/:studentId` | `session-evidence.tsx` | Real `sessionEvidence.listForChild` + consent strip |
| `/parent/report-card/:studentId` | `report-card.tsx` | Real `reportCard.getForChild` |
| `/parent/homework/:studentId` | `homework-results.tsx` | Real `submission.listForChild` |
| `/parent/consent/:studentId` | `consent-settings.tsx` | Real `guardian.setPhotoConsent` (write-only; no GET of current state) |
| `/parent/reset-password/:studentId` | `reset-child-password.tsx` | Real `lmsAuth.resetChildPassword` |
| `/student/home` | `home.tsx` | Real `exercise.openForStudent` + star balance. Empty until delivery exists (`home.tsx:49-54`) |
| `/student/exercise/:sessionExerciseId` | `exercise.tsx` | Real `saveDraft`/`submit` |
| `/student/gifts` | `gifts.tsx` | Real `rewards.redeem` |
| `/student/change-password` | `change-password.tsx` | **Informational stub.** No mutation. Tells student to ask parent (`change-password.tsx:5-7,39+`) |

Admin placeholders that are not LMS: `/admin` index ComingSoon (`admin.routes.tsx:53`), `/ops` index (`ops.routes.tsx:13`), catch-all `*` (`routes/index.tsx:88`), `/admin/engagement/leaderboard` EmptyState no API (`leaderboard.tsx:3-29`). Deliberately off nav (`nav-registry.ts:125-127`).

## `business:verify` coverage

Gate: journey must be ledger-`proven` **and** executed `assertBusinessInvariant` annotation (`business-verify/verify.ts:10-14,95-118`).

**Source count (HEAD, independent of stale JSON):**
- 38 journey spec files under `apps/e2e/tests/journeys/`.
- **14 files** call `assertBusinessInvariant` (coverage grep).
- Those 14 cover **17 of 36** journey-declared flows (shared specs P3-03/04/07 and P3-06/08).
- **19 journey-declared flows have zero invariant in source.**
- 7 flows have no journey at all.

Money/state keyword matcher (`verify.ts:44-47`): `phiếu|học phí|duyệt|lương|payroll|hoàn|refund|đối soát|reconcil|sao|star|quà|reward|kpi`. False positive: P3-10 "hoàn thành". False negative: P1-09 displayName "Giám sát bất thường tài chính" (journey still has an invariant).

All keyword-critical flows that **have journeys also have invariants in source**. `--strict` can go green without covering stars-on-grade, recon action, payslip.reopen, kpi.override, aftersale/meeting state, or P2-08 consent.

## Ranked bottlenecks

| Rank | Item | Blocker vs defer | Why it blocks completing the product | Evidence |
|---|---|---|---|---|
| 1 | Homework **deliver** has no screen | **BLOCKER** | Student home/submit UI is dead until `SessionExercise` exists. No worker delivers. Sequence UI only **freezes order**. | `open-tier.ts:3-8`; `lms-ops/router.ts:674`; `rg deliverSessionExercise apps/admin/src` = 0; `exercise-sequence.tsx` assigns, does not deliver |
| 2 | Unit-range **grant/archive** has no screen | **BLOCKER** | Open list requires `EnrollmentUnitRange` covering session unit. `enrollment.enroll` does not grant. Second class / ops corrections = API-only. | `open-tier.ts:6-8`; `enrollment/router.ts:16-18`; `grant-units.ts:1,217`; no admin `lmsOps.grantPast`/`addWithUnits` |
| 3 | Ledger `no-ui-path` + gap reasons **stale** | **BLOCKER (visibility)** | Operator cannot trust remaining-work list. P2-01/02/03 tagged no-ui-path while UI exists. 5 DOCUMENTED_GAPS claim "no UI" with live call sites. | P2-01 `classes/index.tsx:260`; P2-02 `attendance.tsx:160-226`; P2-03 `class-detail.tsx:208`; gaps: `courses/index.tsx:95`, `session-detail.tsx:79`, `attendance-panel.tsx:111` |
| 4 | Parent↔child link has no parent UI | **BLOCKER (LMS identity)** | Empty parent home is "call staff". `requestLink` only via API (journey cheats with `createLmsClient`). No student code to type. | `parent/home.tsx:146-150`; `rg guardian.requestLink apps/lms/src` = 0; `Student` has no code `schema.prisma:423-448` |
| 5 | P2-05 student submit unproven E2E | **BLOCKER (same loop as #1)** | Submit page exists; flow still `no-ui-path` because delivery never happens in UI. Grading journey seeds submissions. | `flow-manifest.ts:428-445`; `exercise.tsx:48-57`; grading journey seeds, does not student-submit |
| 6 | P2-09 sequence UI, no journey | **BLOCKER-lite** | Only path to freeze homework order. Untested as acceptance flow. Reachable from class detail. | `flow-manifest.ts:546-560`; `class-detail.tsx:532`; `exercise-sequence.tsx:111` |
| 7 | Schedule mutate APIs, no UI | **DEFER** unless classes must be retimed after create | Create-time slots exist. Change weekday/time of a running class = API. | `verify.ts:66-71`; `rg schedule.addSlot apps/admin/src` = 0 |
| 8 | P2-02/P2-01 journeys unwritten | **DEFER after #3** | UI now exists; writing journeys unblocks ledger honesty, not missing product. | `attendance.tsx` picker; `classes/index.tsx` create dialog |
| 9 | Money surfaces without invariants | **DEFER (correctness, not missing feature)** | Stars on grade not asserted. Recon action/dismiss, `payslip.reopen`, `kpi.override`, P2-08 consent, P2-07 `assessment.*` (journey drives attendance roster instead). | `grading-submission` asserts score/status only (`:138-139`); `flow-manifest.ts:461-468,491-502`; P2-08 journey has 0 `assertBusinessInvariant` |
| 10 | P3-10/P3-11 session workers | **DEFER** | System sweeps. No user screen by design. Session `done` ≠ homework deliver. | `flow-manifest.ts:756-794`; worker grep deliver = 0 |
| 11 | Leaderboard / ComingSoon indexes | **DEFER** | EmptyState, off-nav. `/admin` `/ops` index ComingSoon. Not in teaching loop. | `leaderboard.tsx:5-29`; `admin.routes.tsx:53`; `ops.routes.tsx:13` |
| 12 | `enrollment.mine` unused | **DEFER** (tied to #4) | Parent children stale until re-login. | `verify.ts:91`; `parent/home.tsx:3-5` |
| 13 | `ClassBatch.status` string, unused close | **DEFER** | Schema allows anything; no close-class UI/procedure exercised. | `schema.prisma:662-665` |
| 14 | Student change-password no mutate | **DEFER** | Intentional parent-mediated. UX dead-end, not a missing ERP feature. | `change-password.tsx:5-7` |
| 15 | Email OTP blocked-on-comms in non-prod | **DEFER for UAT/prod check** | Prod path is Brevo; Graph sender still incomplete. Parent login journey does not prove real mail. | `login.tsx:80-85`; `worker/index.ts:91-107`; `lms-parent-otp-login` header |

## Comparative analysis (what "done" would mean)

| Dimension | Ledger (`acceptance:report`) | Product-complete (this research) |
|---|---|---|
| Homework loop | P2-03/05 `no-ui-path` (stale reason) | Deliver UI + unit-grant UI still missing |
| Class create | P2-01 `no-ui-path` | Form ships via `lmsOps.createClassWithUnits` |
| Attendance | P2-02 `no-ui-path` | In-page class/session picker ships |
| Orphans | 0 untriaged → CI green | 5 "no UI" gap reasons are false |
| Money correctness | `--strict` on keyword displayNames | Stars-on-grade, recon action, reopen/override unchecked |
| Proven | CI artifact SHA-pinned; local 0/43 | Merge-green ≠ this worktree |

**Recommendation (ranked, YAGNI):**
1. Build **one** "Phát bài" control on session hub calling `lmsOps.deliverSessionExercise`. Wire P2-03/P2-05 journeys through that, not seeds.
2. Expose **grant/archive unit range** on student or enrollment detail (or fold into receipt-already-paid path and document that unpaid second-class never opens LMS).
3. Fix ledger lies in the same PR: drop stale `no-ui-path`, move live lmsOps/course.create onto flows, keep true gaps.
4. Parent `requestLink` form **or** staff-only policy written as product rule (today the banner pretends staff-only while API exists).
5. Everything else in the defer rows: do not start.

## Trade-offs

| Option | Completes LMS? | Complexity | Honest ledger? |
|---|---|---|---|
| Deliver button + journeys | Yes (if ranges exist from receipt) | Low | Yes if P2-03/05 updated |
| Auto-deliver in session-done worker | Yes, hidden | Medium; couples P3-10 to LMS | Journeys still hard |
| Seed-only forever | No | Zero | No |
| Grant-units UI | Needed for unpaid/ops cases | Medium | Closes 5 gap entries |

Adoption risk: APIs already tested (`exercise-delivery.int.test.ts`, `grant-units.int.test.ts`). Risk is product wiring, not invention.

Architectural fit: session hub already loads `lmsOps.rosterForSession` and cancel-restamp. Deliver belongs there. Do not add a new app.

## Implementation notes (not implementing)

- Do **not** claim P2-01 via `classBatch.create` — UI calls `lmsOps.createClassWithUnits`.
- Do **not** treat assignUnit as open-tier. `open-tier.ts` is delivery-only; class-detail comment at `:185-188` is outdated.
- `business-verification.json` on disk was 38 flows / Aug 4. Ignore until regenerated after a SHA-matching ui-e2e run.

## Common pitfalls

- Reading `plans/reports/*` "31/38 proven" — contaminated; HEAD is 43 flows, local proven 0.
- Treating `43 built` as shipped. Built = symbols exist.
- `--strict` green ≠ stars/refunds/recon actions all checked.
- `DOCUMENTED_GAPS` as a silent whitelist: reasons rot, CI stays green.

## Resources

- `scripts/acceptance-report/verify.ts` — gate contract
- `scripts/acceptance-report/flow-manifest.ts` — 43 flows
- `scripts/business-verify/verify.ts` — correctness tier
- `apps/api/src/exercise/open-tier.ts` — actual LMS open rule
- `apps/api/src/lms-ops/router.ts` — create/deliver/sequence
- `.github/workflows/ui-e2e.yml:188-200` — CI chain

## Unresolved questions

1. Is homework delivery **manual ops** or should session-done auto-deliver? Code comments say "manual / ops" (`router.ts:674`) but no product owner file was treated as authority here.
2. After `enrollment.enroll` (reserved, unpaid), should LMS stay closed until receipt? If yes, grant UI is ops-only. If no, loop is more broken than rank 2 states.
3. Latest **CI** `journeys.json` SHA for `bc3f473` was not fetched (no network artifact pull). Local file is `b5bd0cc`-dirty. Do not quote proven counts from this machine.
4. `actorAudit.ungatedProcedureCount = 29` — not triaged this pass. Could hide LMS-session procedures.
5. Whether `student.setLifecycle(blocked_lms)` is the intended replacement for `enrollment.blockLms` (two writers).

## Limitations

Did not run Playwright. Did not pull CI artifacts. Did not execute `business:verify` against a SHA-matched ledger (would be `not-proven` × 43 here). GitNexus MCP unavailable; filesystem/grep only. Did not audit every finance/HR procedure beyond money-keyword + known state machines.
