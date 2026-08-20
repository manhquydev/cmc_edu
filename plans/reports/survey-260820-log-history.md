# Survey — LOG/HISTORY coverage (2026-08-20)

Read-only source survey of the two product ledgers, per-entity operational-event coverage, registered timeline-gap exceptions, and app observability. GitNexus index was 33 commits behind HEAD; citations are from current source.

Authority for the two-ledger split: `docs/system-architecture.md:653`.

---

## 1. The two ledgers

| | RecordEvent | AuditLog |
|---|---|---|
| Role | Facility-scoped operational timeline (user-facing “dòng thời gian”) | Global compliance ledger of successful mutations |
| Audience | Staff who can `get`/`read` the parent record | Super-admin only (`audit.list`) |
| Scope | One facility, one `(entity, entityId)` | Platform-wide; no `facilityId` |
| Shape | Closed per-domain `kind` + allowlisted `payload` | `action` = tRPC path; `entity` = first path segment |
| Mutability | Append-only (SELECT+INSERT) | Append-only (SELECT+INSERT); privileged 12-month delete |
| RLS | ENABLE + FORCE | None (deliberately global) |

They are not interchangeable. Directors must not be shown `AuditLog` as a record timeline (`docs/system-architecture.md:653`; `plans/260817-1354-resource-detail-and-operational-timeline-depth/plan.md:30-31`).

### 1.1 RecordEvent — schema

`packages/db/prisma/schema.prisma:314-329`

```
id, facilityId, entity, entityId, kind, actor, payload Json?, createdAt
@@index([facilityId, entity, entityId, createdAt])
```

`entity` is a free string, not an enum. Only seven values are written today (see §2). Notes are one `kind`, not a separate table (`schema.prisma:315`).

Created in `packages/db/prisma/migrations/20260813143000_record_event/migration.sql:5-37`.

### 1.2 RecordEvent — who writes

Single persistence seam: `appendRecordEvent` (`apps/api/src/record-event/store.ts:41-62`). It takes the caller’s `Prisma.TransactionClient` so the event commits or rolls back with the domain mutation (`store.ts:39-40`). No authorization inside the seam (`store.ts:12-13`); `entity` is fixed server-side and never taken from the client (`store.ts:10-11`).

Seven domain emitters wrap it:

| Emitter | Entity string | Module |
|---|---|---|
| `emitRecordEvent` | `'Opportunity'` (caller-supplied, always this) | `apps/api/src/crm/record-event.ts:142-155` |
| `emitStaffRecordEvent` | `'AppUser'` | `apps/api/src/user/record-event.ts:16,106-119` |
| `emitStudentRecordEvent` | `'Student'` | `apps/api/src/student/record-event.ts:18,118-131` |
| `emitClassRecordEvent` | `'ClassBatch'` | `apps/api/src/class/record-event.ts:19,131-144` |
| `emitReceiptRecordEvent` | `'Receipt'` | `apps/api/src/finance/record-event.ts:8,67-80` |
| `emitParentRecordEvent` | `'ParentAccount'` | `apps/api/src/parentAccount/record-event.ts:10,64-77` |
| `emitParentMeetingRecordEvent` | `'ParentMeeting'` | `apps/api/src/meeting/record-event.ts:6,50-63` |

No middleware writes RecordEvent. Workers/system paths that emit use actor `'system'` (e.g. `apps/api/src/class/session-done.ts:215-218`, `apps/api/src/enrollment/activate-enrollment.ts:123-126`, `apps/api/src/provisioning/provision-from-receipt.ts:265-268`).

Reads go through domain-owned `*.timeline` / `opportunityTimeline` / `receiptTimeline` queries. Each authorizes the **parent record** first (`findFirst({ id, facilityId })` → `NOT_FOUND`), then `listRecordEventPage` (`store.ts:67-97`, newest-first `createdAt|id` cursor). There is no generic `entity`/`entityId` timeline router.

### 1.3 RecordEvent — RLS and privileges

`packages/db/prisma/migrations/20260813143000_record_event/migration.sql:23-37`

- `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- Policy `RecordEvent_facility_isolation`: `facilityId = current_setting('app.current_facility_id') OR bypass_rls = 'on'` (USING + WITH CHECK)
- `GRANT SELECT, INSERT ON "RecordEvent" TO cmc_app`
- `REVOKE UPDATE, DELETE ON "RecordEvent" FROM "cmc_app"`

App-layer reads still pass `facilityId` from `scoped(ctx)` / `withFacility`. Cross-facility id → `NOT_FOUND`, same as a missing row.

`ParentAccount` itself is a global identity table (no RLS; `migration.sql` wave-1 comment at `packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:96-97`). Parent **events** are still written with the acting facility’s `facilityId`.

### 1.4 AuditLog — schema

`packages/db/prisma/schema.prisma:1118-1133`

```
id, actor, action, entity, entityId, data Json?, createdAt
@@index([entity, entityId])
@@index([createdAt])
@@index([actor])
```

No `facilityId`. Indexes for the viewer + retention sweep added in `packages/db/prisma/migrations/20260716130000_audit_log_indexes/migration.sql:1-6`.

Field derivation (`apps/api/src/audit/audit-helpers.ts`):

- `actor`: staff `userId` / `parent:<id>` / `student:<id>` / `'anonymous'` (`:13-22`)
- `action`: tRPC path (source of truth) (`trpc.ts:175`)
- `entity`: first path segment (`deriveEntity`, `:27-30`)
- `entityId`: input `id` or first `*Id`, with result-id registries for ambiguous creates (`:52-98`)
- `data`: sanitized input; keys matching `/password|otp|token|secret/i` or exact `code` stripped recursively (`:100-147`)

### 1.5 AuditLog — who writes

**Default path — middleware.** `auditLogMiddleware` on `basedProcedure` (`apps/api/src/trpc.ts:164-192`) wraps every public/protected/lms procedure. After `next()`: if `type === 'mutation'` and `result.ok` and path ∉ `AUDIT_EXCLUDED_PATHS`, `ctx.db.auditLog.create(...)`. Failures are `console.error`’d, never thrown (`:181-186`). Queries and failed mutations are not logged.

`AUDIT_EXCLUDED_PATHS` (`trpc.ts:98-139`) are paths that write a **richer inline** row (or must not persist secret-bearing raw input). Survey comment: grep `auditLog.create` as of 2026-07-16 (`:95-96`).

**Inline / extra writers** (not exhaustive of every site; these are the production `auditLog.create` families):

| Family | Files | Why inline |
|---|---|---|
| Facility / network / geofence | `facility/router.ts`, `network-router.ts`, `geofence-router.ts` | Excluded + richer |
| CRM create | `crm/router.ts:225` | Excluded |
| Finance approve/cancel + provisioning/email failures | `finance/router.ts:470,691,1210+` | Excluded + system rows |
| LMS auth / OTP / child password | `lms-auth/router.ts` | Excluded; secret-free rows |
| Parent email/active | `parentAccount/router.ts:283,338` | Excluded |
| Enrollment LMS block + unit grants / archive | `enrollment/router.ts:142`, `lms-ops/router.ts` | Excluded / richer LMS ops |
| Attendance mark / markAll | `attendance/router.ts:240,359` | Excluded |
| Reconciliation | `reconciliation/router.ts:73,116` | Excluded |
| Staff password login | `auth/password-routes.ts:123` | Raw HTTP, not tRPC |
| Guardian child-data read | `guardian/approved-children.ts:86` (`createMany`, action `guardian.childDataRead`) | Read audit, not a mutation |
| Assessment LLM egress | `assessment/router.ts:269` | Extra row beside auto-audit |
| Appointment stage side-effect | `appointment/router.ts:61` | Writes `crm.opportunityAdvance` |
| Provisioning completed | `provisioning/provision-from-receipt.ts:507` | System |

Coverage test owner: `apps/api/src/audit/mutation-audit-coverage.test.ts`.

**Who reads.** `audit.list` (`apps/api/src/audit/router.ts:89-135`): `requirePermission('audit','list')`, no `withFacility` on the log itself (`:1-4`). Registry `'audit.list': []` (`packages/auth/src/index.ts:113`) — empty roster + `super_admin` bypass (`:73-75,197`) ⇒ super-admin only. Viewer: `apps/admin/src/pages/admin/audit-log.tsx:200-219` (`canDo('audit','list')`). Safe detail links only for `user` / `afterSale` / `parentAccount` when the target still exists in the caller’s facility (`router.ts:35-39,118-129`).

**Retention.** `apps/api/src/worker/audit-log-retention-sweep.ts`: delete rows older than 12 months (`:14,33-41`) via a **privileged** Prisma client (`:6-9,18-23`). This is the only delete path; request-path `cmc_app` cannot UPDATE/DELETE (`packages/db/prisma/migrations/20260706150000_p1_remediation_wavea_privilege_hardening/migration.sql:18-19`; asserted in `apps/api/src/security/append-only-privilege.test.ts`).

### 1.6 AuditLog — RLS

None. Wave-1 comment lists AuditLog with ParentAccount / StudentAccount / LoginOtp / EmailOutbox as global identity/audit tables (`packages/db/prisma/migrations/20260706054322_p1_remediation_wave1_schema_rls/migration.sql:96-97`). Schema comment on `ReceiptCodeCounter` groups AuditLog the same way (`schema.prisma:341`).

---

## 2. Per-entity coverage matrix

`RecordEvent.entity` values that exist in code: **Opportunity, AppUser, Student, ClassBatch, Receipt, ParentAccount, ParentMeeting**. Every other Prisma model does **not** emit operational events.

Shared UI: `RecordTimeline` (`packages/ui/src/components/record-timeline.tsx:46-54`, `data-testid="record-timeline"`). Only Opportunity wires `onAddNote` (`opportunity-detail.tsx:768+`).

### 2.1 Entities that emit + show timeline

| Entity | Emits? | Timeline UI | Endpoint | History epoch | Kinds |
|---|---|---|---|---|---|
| Opportunity | yes | `/crm/opportunities/:id` (`opportunity-detail.tsx:768`) | `crm.opportunityTimeline` (`crm/router.ts:860`) | `2026-08-13T00:00+07` (`crm/record-event.ts:40`) | `created`, `reopened`, `marked_lost`, `assigned`, `next_action_set`, `next_action_cleared`, `stage_advanced`, `enrolled`, `enrollment_reverted`, `note` (`:9-19`) |
| AppUser (Staff) | yes | `/hr/staff/:staffId/activity` (`hr/staff/activity.tsx:78`) | `user.timeline` (`user/router.ts:436`) | `2026-08-18T00:00+07` (`user/record-event.ts:43`) | `created`, `profile_updated`, `roles_updated`, `password_reset`, `activated`, `deactivated`, `manager_changed` (`:18-25`) |
| Student | yes | `/admin/students/:id` overview (`student-detail.tsx:223`) | `student.timeline` (`student/router.ts:361`) | `2026-08-19T00:00+07` (`student/record-event.ts:45`) | `created`, `guardian_linked`, `enrolled`, `enrollment_activated`, `enrollment_withdrawn`, `lifecycle_changed`, `password_reset` (`:20-27`) |
| ClassBatch | yes | `/admin/classes/:id` overview (`class-detail.tsx:520`) | `classBatch.timeline` (`class-batch-router.ts:378`) | `2026-08-19T00:00+07` (`class/record-event.ts:56`) | `created`, `teacher_changed`, `sessions_generated`, `slot_added`, `slot_updated`, `slot_archived`, `session_confirmed`, `session_cancelled`, `session_unit_assigned`, `session_teacher_changed`, `session_completed`, `student_enrolled` (`:21-33`) |
| Receipt | yes | `/finance/:id` panel (`receipt-detail.tsx:562`) | `finance.receiptTimeline` (`finance/router.ts:922`) | `2026-08-19T00:00+07` (`finance/record-event.ts:9`) | `created`, `approved`, `cancelled`, `refunded`, `provisioned` (`:11-16`) |
| ParentAccount | yes | `/admin/parents/:parentId` (`parent-detail.tsx:272`) | `parentAccount.timeline` (`parentAccount/router.ts:175`) | `2026-08-19T00:00+07` (`parentAccount/record-event.ts:13`) | `child_linked`, `email_updated`, `active_changed` (`:15-18`) |
| ParentMeeting | yes | `/crm/post-sale-meeting/:meetingId/activity` (`parent-meeting-detail.tsx:103`) | `parentMeeting.timeline` (`meeting/router.ts:111`) | `2026-08-19T00:00+07` (`meeting/record-event.ts:7`) | `created`, `completed`, `cancelled` (`:9`) |

`DETAIL_DEPTH` in `scripts/resource-depth-audit.mjs:33-44` matches this set (Staff profile/access are `get` only; activity is the timeline surface).

### 2.2 Emit writers by kind (not a second entity)

One mutation can write **multiple** entity timelines.

**Opportunity** — `emitRecordEvent(..., entity: 'Opportunity')`:

| Kind | Writer |
|---|---|
| `created` | `crm/router.ts:217` (walk-in), `crm/bulk-import-opportunities.ts:419`, `finance/router.ts:403` (auto-created on approve) |
| `stage_advanced` | `crm/advance-opportunity.ts:65` |
| `reopened` / `marked_lost` / `assigned` / `next_action_*` | `crm/router.ts` (~353, 386, 445, 654, 687) |
| `note` | `crm/router.ts:848` (`opportunityAddNote`) |
| `enrolled` | `finance/router.ts:459` (receipt approve) |
| `enrollment_reverted` | `finance/router.ts:583` (receipt cancel) |

**AppUser** — `user/router.ts`: create (`:244`, plus optional `roles_updated` `:256`, `password_reset` `:274`); update profile/manager/active (`:572,582,592`); `updateRoles` (`:704`); `resetPassword` (`:789`).

**Student** — provision create (`provision-from-receipt.ts:265`); guardian link (`guardian/router.ts:211`); enroll (`enrollment/router.ts:85`); activate (`activate-enrollment.ts:123`); withdraw (`finance/router.ts:641`, `worker/reconcile-orphaned-receipts.ts:318`); lifecycle (`student/router.ts:178`, `enrollment/router.ts:132`, `finance/router.ts:658`); password (`student/router.ts:118`).

**ClassBatch** — create + teacher (`class-batch-router.ts:231,363`); slots/sessions generate (`schedule-router.ts:148,196,230,262`); session confirm/cancel/unit/teacher (`class-session-router.ts:317,354,399,443`); session completed (`session-done.ts:215`); student enrolled (`enrollment/router.ts:75`). Session lifecycle is recorded **on the class**, not as `entity='ClassSession'`.

**Receipt** — create (`finance/router.ts:1138`); approve (`:356`); cancel (`:683`); refund (`:824`); provisioned (`provision-from-receipt.ts:540`).

**ParentAccount** — child link (`guardian/router.ts:219`, `provision-from-receipt.ts:387`); email (`parentAccount/router.ts:277`); active (`:331`).

**ParentMeeting** — schedule / complete / cancel (`meeting/router.ts:192,224,251`).

### 2.3 First-class detail pages that do NOT emit and do NOT show RecordTimeline

These have a canonical detail route and `get`, but no domain `record-event.ts` and no `RecordTimeline`. Six are registered `timeline-gap` (§3). ClassSession is classified `workspace-detail` instead.

| Entity | Detail route | Emits RecordEvent? | RecordTimeline? |
|---|---|---|---|
| AfterSaleCase | `/crm/aftersale/:caseId` (`aftersale-detail.tsx:1`) | no | no |
| Reward | `/admin/engagement/rewards/:rewardId` | no | no |
| Exercise | `/teaching/exercises/:exerciseId` | no | no |
| ManualAttendanceTicket | `/hr/checkin/:ticketId` (`check-in-ticket-detail.tsx:1`) | no | no |
| ShiftRegistration | `/hr/shifts/:registrationId` (`shifts-detail.tsx:1`) | no | no |
| KpiScore | `/hr/kpi/:scoreId` (`kpi-detail.tsx:1`) | no | no |
| ClassSession | `/teaching/sessions/:sessionId` (query-tab workspace) | no as own entity; some kinds land on ClassBatch | no |

### 2.4 Other Prisma models — no operational ledger, no timeline UI

No `record-event` module and no detail `RecordTimeline`. Grouped by why they are out of the resource-depth “record” set.

**Embedded / child of a covered parent**

Contact, Enrollment, EnrollmentUnitRange, ScheduleSlot, ClassExerciseItem, SessionExercise, Submission, FinalGrade, StarTransaction, Attendance, QualitativeAssessment, SessionEvidence, SessionEvidencePhoto, Guardian, GuardianLinkRequest, TestAppointment, RefundRecord, ShiftRegistrationEntry.

Enrollment and slot/session writes that matter operationally already fan into Student / ClassBatch / Opportunity / Receipt (see §2.2). TestAppointment lives on the Opportunity form; no standalone timeline.

**Config / counters / infrastructure**

Facility, FacilityNetwork, FacilityGeofence, Course, Room, CurriculumUnit, ExerciseFolder, Gift, CompensationPolicy, SalaryTier, SalaryRate, ShiftGroup, ShiftTemplate, ReceiptCodeCounter, ClassBatchCodeCounter, EmployeeCodeCounter.

**Identity / transport / HR punches (not record chatter)**

StudentAccount, LoginOtp, EmailOutbox, TimePunch, Payslip, ReconciliationFlag.

These still generate **AuditLog** rows on successful mutations via middleware (or inline). That is compliance, not an operational timeline.

---

## 3. `timeline-gap` exceptions (`scripts/resource-depth-audit.mjs`)

Registry: `EXCEPTIONS` at `scripts/resource-depth-audit.mjs:46-60`. Category `timeline-gap` means: detail route exists and is retained; domain timeline is a documented follow-up. Owner string is `'Phase 6 Module 6'`.

| Route | Entity | What is missing |
|---|---|---|
| `/crm/aftersale/:caseId` (`:53`) | AfterSaleCase | No `emit*` / kinds / `*.timeline` / `RecordTimeline`. Lifecycle (open → in_progress → resolved → closed) is only current-state + AuditLog. |
| `/teaching/exercises/:exerciseId` (`:54`) | Exercise | Same. Exercise is global (no facilityId); a future timeline would need a different substrate or a facility-scoped projection. |
| `/hr/checkin/:ticketId` (`:55`) | ManualAttendanceTicket | Same. Approve/reject/resubmit are AuditLog-only (`manualPunch.*` excluded paths write inline). |
| `/hr/shifts/:registrationId` (`:56`) | ShiftRegistration | Same. Submit/approve/reject/cancel are AuditLog-only. |
| `/hr/kpi/:scoreId` (`:57`) | KpiScore | Same. Confirm/override/refresh are AuditLog-only. |
| `/admin/engagement/rewards/:rewardId` (`:58`) | Reward | Same. Redeem/approve/deliver/reject are AuditLog-only. |

Narrative twin: `plans/reports/phase-06-module-6-gap-only-audit.md:9-19` (also lists Session as a workspace gap, classified separately below).

**Not `timeline-gap` but related exceptions** (`resource-depth-audit.mjs:47-52,59`):

| Route | Category | Meaning |
|---|---|---|
| `/go/:entity/:id` | resolver | Deep-link router, not a record |
| `/teaching/sessions/:sessionId` | workspace-detail | Query-tab session hub; no Session timeline (session events → ClassBatch) |
| `/teaching/classes/:classBatchId/exercise-sequence` | subresource-workspace | Not an independent record |
| `/hr/staff/:staffId`, `/admin/students/:id`, `/admin/classes/:id` | compatibility | Redirects onto profile/overview (those overviews **do** mount timeline) |
| `/admin/users/:staffId` | compatibility | Redirects to `/hr/staff/:staffId` |

The audit fails CI if a new `:` route is neither in `STATIC_ROUTE_CATEGORIES`, `DETAIL_DEPTH`, nor `EXCEPTIONS` (`:77-95`; `scripts/resource-depth-audit.test.mjs:5-16`).

---

## 4. App logging / observability (not a product ledger)

Three tiers. None of this is RecordEvent or AuditLog.

### 4.1 Structured server logs (Tier 0)

`apps/api/src/lib/logger.ts:1-49` — pino JSON on stdout, `LOG_LEVEL` (default `info`), ISO timestamps, `service` child (`api` | `worker`). No file transport.

Correlation: per-request `reqId` UUID on `IncomingMessage` (`apps/api/src/server.ts:43-52`). tRPC `onError` stamps `{ reqId, path, type, code }` (`:106-122`). Expected client codes (`UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`, `NOT_FOUND`, …) → `log.debug`; others → `log.error`.

**No general HTTP access log.** Successful requests are not written as request lines. Audit of “who did what” is AuditLog (mutations only), not pino.

Worker uses the same logger (`apps/api/src/worker/index.ts` via `serviceLogger('worker')`).

Leftover `console.error` still exists on the audit-middleware failure path (`trpc.ts:185`) and a few domain sites (LLM audit fail, exercise delivery).

### 4.2 Error tracking (Tier 1)

`apps/api/src/lib/instrument.ts:1-69` — `@sentry/node` → self-hosted GlitchTip via `SENTRY_DSN`. Manual `captureException` only; **no OpenTelemetry / tracing** (`:5-10`). Fail-open if DSN unset (`:20-23`). `beforeSend` strips cookies, auth, request body/query, breadcrumbs, user email/IP (`:39-64`).

Wired at: raw-http `reportRouteError` (`server.ts:58-65`), tRPC unexpected errors (`:114-121`), worker drain failures (same instrument import).

### 4.3 Client → server error reports

Admin `window.onerror` / `unhandledrejection` (`apps/admin/src/main.tsx:31-58`) and React `ErrorBoundary` (`apps/admin/src/lib/error-boundary.tsx:40-41`) POST to `POST /api/track-error` (`apps/api/src/lib/track-error-route.ts:23,60-71`). Unauthenticated by design; nginx rate-limited. Same `reqId` on the pino line and Sentry tags. LMS has a parallel ErrorBoundary (`apps/lms/src/lib/error-boundary.tsx:73-77`).

### 4.4 What this is not

- Not a request/audit access log of reads (except guardian `childDataRead`).
- Not distributed tracing.
- Not a substitute for RecordEvent on gap entities: those mutations are in AuditLog (super-admin, 12-month retention) and invisible on the record page.

---

## 5. Coverage snapshot

```
Emit + timeline UI (7):  Opportunity, AppUser, Student, ClassBatch,
                         Receipt, ParentAccount, ParentMeeting
Detail, no timeline (6 registered gaps + Session workspace):
                         AfterSaleCase, Reward, Exercise,
                         ManualAttendanceTicket, ShiftRegistration,
                         KpiScore, ClassSession
Everyone else:           AuditLog only (if they mutate), no RecordEvent
```

Resource-depth Phase 7 “source-derived coverage and URL/history gates remain open” (`docs/system-architecture.md:656,661`).
}}
}