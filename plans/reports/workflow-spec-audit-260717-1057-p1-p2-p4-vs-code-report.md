# Audit: docs/23, 24, 26, 28 (workflow specs) vs actual code

Scope: docs/23-workflow-spec-template-va-p1-plan.md, docs/24-workflow-spec-p1.md,
docs/26-workflow-spec-p2.md, docs/28-workflow-spec-p4.md vs apps/api/src/**/router.ts,
packages/auth/src/index.ts, apps/admin/src/routes, apps/lms/src/routes.

Most tRPC procedure names and permission rosters check out (crm.*, finance.receiptCreate/
Approve/Cancel/refundCreate, enrollment.enroll/mine, attendance.mark/markAll, submission.
saveDraft/submit/grade, assessment.draftComment/confirm, sessionEvidence.upsert/publish,
classBatch.create, schedule.generateSessions, rewards.redeem/approve/reject/deliver,
parentMeeting.schedule/complete/cancel, testAppointment.schedule/complete/noShow,
afterSale.create/advance/resolve, student.setLifecycle — all match code 1:1). The gaps below
are the ones that would genuinely mislead a reader/builder.

## HIGH — systemic LMS URL pattern is fictional (docs/24, 26, 28)

Every LMS workflow in these docs uses a `/child/:id[...]` URL pattern and a `/select-child`
picker route. **Neither exists.** Real LMS route tree is `apps/lms/src/routes/index.tsx:37-84`:
`/login`, `/parent/home`, `/parent/evidence/:studentId`, `/parent/report-card/:studentId`,
`/parent/homework/:studentId`, `/parent/consent/:studentId`, `/parent/reset-password/:studentId`,
`/student/home`, `/student/exercise/:exerciseId`, `/student/gifts`, `/student/change-password`.
No `/select-child` route — child-picking is inline UI state on `/parent/home`, not a route.

Affected doc lines (all wrong, same root cause):
- docs/24:213 (WF-P1-07): `/login` (2 tab) · `/select-child` · `/child/:id`
- docs/24:172 (WF-P1-06): LMS `/child/:id/link-request`
- docs/26:99 (WF-P2-03): LMS `/child/:id/exercises`
- docs/26:156 (WF-P2-05): LMS `/child/:id/exercises/:exerciseId` — real: `/student/exercise/:exerciseId`
- docs/26:235 (WF-P2-08): LMS `/child/:id` — real: `/parent/evidence/:studentId`
- docs/28:28 (WF-P4-01): LMS `/child/:id/rewards` — real: `/student/gifts`

## HIGH — lmsAuth procedure names inverted (docs/24:213, WF-P1-07)

Doc cites `lmsAuth.requestEmailOtp`, `lmsAuth.verifyEmailOtp`, `lmsAuth.studentLogin`. Actual
exported procedures are `requestOtpEmail`, `verifyOtpEmail`, `loginStudent`
(apps/api/src/lms-auth/router.ts:333, 452, 516). Word order is swapped in all three — a caller
copy-pasting the doc's names would get a tRPC 404.

## HIGH — WF-P4-03 / WF-P4-05: UI is a no-op EmptyState stub, doc implies a working screen

docs/28:60-64 (WF-P4-03) and :101-105 (WF-P4-05) describe full swimlanes/state machines and cite
UI at `/parent-meetings` and `/crm/aftersale?queue=open`. Reality:
- The APIs are real and wired (`meeting/router.ts` schedule/complete/cancel,
  `after-sale/router.ts` create/advance/resolve/close — both registered in
  `apps/api/src/router.ts:104-107`, shipped in commit 44f26b9, 2026-07-07).
- The actual routes are `/crm/post-sale-meeting` and `/crm/aftersale`
  (apps/admin/src/routes/crm.routes.tsx:35,43), NOT `/parent-meetings`, and neither supports a
  `?queue=open` param.
- Both pages render a static `EmptyState` with **zero backend calls** — no form, no list, no
  action buttons (apps/admin/src/pages/crm/post-sale-meeting.tsx:1-23,
  apps/admin/src/pages/crm/aftersale.tsx:1-23). The page header comments even claim "No backend
  procedure exists for this flow yet" — itself stale (the router has existed for 10 days) — but
  the practical result is the same: a user visiting these routes cannot exercise WF-P4-03/05 at
  all. Doc 28 gives no hint these are stubs; they read as fully built.

## HIGH — WF-P1-08 refund: doc implies a working screen, real page is a stub (docs/24:245-246)

Doc cites UI `/finance/refunds` (plural). Real route is `/finance/refund` (singular,
apps/admin/src/routes/finance.routes.tsx:46) and it is an `EmptyState` stub
(apps/admin/src/pages/finance/refund.tsx:1-29) — the comment confirms `finance.refundCreate`
mutation is fully implemented (apps/api/src/finance/router.ts:954) but there is no
receipt-search or approval UI wired to it yet. WF-P1-08's happy path ("tạo RefundRecord ...
cập nhật số dư") reads as an operable flow; it is API-only today.

## MEDIUM — WF-P4-02 gift catalog: UI location and `gift.archive` don't exist as described

docs/28:43 (WF-P4-02): "**API:** `gift.upsert/archive`" and "**UI/URL:** `/engagement/rewards`
(tab quản lý)". Both details are off:
- There is no `gift.archive` procedure — archiving is `gift.upsert` with `isActive:false`
  (apps/api/src/rewards/gift-router.ts:1-4, 31-61). Only `upsert`/`list`/`listForStudent` exist.
- The real route is a separate page, `/admin/engagement/gifts` (GiftsPage), distinct from
  `/admin/engagement/rewards` (RewardsQueuePage) — not a "tab" inside the rewards page
  (apps/admin/src/routes/admin.routes.tsx:67-68).

## LOW — minor procedure/route name drift

- docs/24:172 (WF-P1-06) cites `guardian.approveLink`/`reject`; the actual procedure is
  `rejectLink`, not `reject` (apps/api/src/guardian/router.ts:250).
- docs/24:172 (WF-P1-06) cites nhân viên UI at `/parents/:id` (hàng đợi duyệt); the real admin
  route is `/admin/parents` only — no `:id` sub-route. The approval queue/detail is handled via
  an in-page `Dialog` modal, not route navigation (apps/admin/src/routes/admin.routes.tsx:57,
  apps/admin/src/pages/parents/index.tsx).
- docs/26:127 (WF-P2-04) cites API `exercise.create/upload/publish`; there is no separate
  `upload` procedure — `basePdfRef` is a field on `exercise.create`'s input, not its own
  mutation (apps/api/src/exercise/router.ts:104-197, only `list/create/publish/close`).

## Confirmed accurate (spot-checked, no action needed)

Roles cited as "deferred" (ctv_mkt in docs/24:11, cskh in docs/28:86) correctly match
`ACTIVE_ROLES` in packages/auth/src/index.ts:27-33 — both really are dormant, 0 permissions.
`finance.receiptApprove` roster (GĐKD + GĐĐT, sale excluded) matches docs/24 WF-P1-03 SoD
description exactly (packages/auth/src/index.ts:63).

Status: DONE
Summary: Found one systemic issue (every LMS `/child/:id` URL across docs/24, 26, 28 is
fictional — real routes are `/parent/...` and `/student/...`), inverted lmsAuth procedure
names, and two P4 workflows (WF-P4-03, WF-P4-05) plus the P1 refund flow (WF-P1-08) presented
as working screens when the actual pages are no-op EmptyState stubs despite real backend APIs.
