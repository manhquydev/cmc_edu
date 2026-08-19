# Phase 6 · Module 2 (Student) — frozen event map and PII ceiling

Frozen 2026-08-19, before edits. Pre-edit GitNexus impact evidence for the
runtime symbols was:

| Symbol | Direct upstream | Affected processes | Risk |
|---|---:|---:|---|
| `studentRouter` | 0 | 0 | LOW |
| `enrollmentRouter` | 0 | 0 | LOW |
| `activateEnrollmentForReceipt` | 0 | 0 | LOW |
| `StudentDetailPage` page function | 0 | 0 | LOW |
| `runCancelTransaction` | 1 (`finance/router.ts`) | 0 | LOW |
| `provisionFromReceipt` | 1 (`finance/router.ts`) | 0 | LOW |
| `guardianRouter` | 0 | 0 | LOW |
| `reconcileCancelledButProvisioned` | 0 | 0 | LOW |

The impact queries were exact symbol matches. Test helpers, test-only symbols,
the manifest constant, and plan/report sections were not treated as runtime
callers. Post-edit `gitnexus/detect_changes(scope=all)` is the broader
evidence: 26 changed symbols across 12 files, 5 affected processes, aggregate
risk MEDIUM. Affected processes were `DrainOnce → ReceiptNoLongerApprovedError`,
`DrainOnce → IsUniqueConstraintViolation`, `StudentDetailPage → PathHasUnsafeChars`,
`StudentDetailPage → RunGrant`, and `DrainOnce → MaybeCreateFlag`. The aggregate
result is intentionally not substituted for per-symbol impact evidence.

## Entity and read contract

- `RecordEvent.entity = 'Student'` (server-fixed).
- New read `student.timeline` gated by `requirePermission('student', 'lookup')`
  — the SAME read roster already authorizing `student.get`/`lookup`
  (giam_doc_kinh_doanh, giam_doc_dao_tao, sale, giao_vien; cskh denied).
  This is a read key, not a mutation key (`setLifecycle`/`resetPassword` stay
  director-only and are NOT reused for timeline reads).
- Facility-scoped parent authorization: student row must exist in caller
  facility, else NOT_FOUND (out-of-facility indistinguishable from missing).
- Actor projection, unknown-kind fallback label, `created`-anchored
  `historySince` epoch `2026-08-19T00:00:00.000+07:00` — identical to the
  proven classBatch.timeline read shape.
- No child-data audit row per timeline page: payloads carry no child identity
  (see ceiling); the identity disclosure already happens (and is audited) in
  `student.get` on the same page. Adding a second audit per view would
  double-count docs/08 §7.

## Event kinds × producers × transaction owner

| Kind | Payload (allowlist) | Producer | Transaction owner |
|---|---|---|---|
| `created` | `{}` | `provisionFromReceipt → findOrCreateStudent` fresh-create branch (reuse/renewal/P2002-refetch branches emit nothing) | the `withFacility` tx that creates the Student |
| `guardian_linked` | `{parentAccountId, relation}` | `guardian.approveLink` (only when the Guardian row is newly created, not on upsert no-op; same-pair approvals are serialized by a transaction-scoped advisory lock); `findOrCreateGuardian` create branch (both provisioning call sites) | approveLink's `withFacility` tx / provisioning's tx (renewal path: the create and event share a facility-scoped atomic unit) |
| `enrolled` | `{enrollmentId, classBatchId}` | `enrollment.enroll` | enroll's `withFacility` tx — dual view: ClassBatch side keeps its existing `student_enrolled` event, unchanged |
| `enrollment_activated` | `{enrollmentId, classBatchId}` | `activateEnrollmentForReceipt` reserved→active flip and fresh-`active` create; NOT on idempotent already-active return or P2002 refetch | the `withFacility` tx performing the write |
| `enrollment_withdrawn` | `{classBatchId}` | `finance.receiptCancel` rollback and `reconcileCancelledButProvisioned` active-seat cleanup, only when the M9 no-other-approved-receipt guard passes and the update changes a row | receiptCancel's facility tx / reconciliation worker's bypass `withFacility` tx |
| `lifecycle_changed` | `{from, to}` | `student.setLifecycle` (skip no-op), `enrollment.blockLms` (skip no-op), `finance.receiptCancel` void path | each mutation's own tx |
| `password_reset` | `{}` | `student.resetPassword` | new `withFacility` transaction wrapping the StudentAccount update + event (mutation previously ran outside any tx; event commits with the write, auditLog row stays where it was) |

System-driven producers (provisioning, outbox worker replay) record actor
`'system'` — same precedent as class `session_completed` from the sweep.
Exactly-once rule: emit only on the branch that actually wrote; every
idempotent-return / race-refetch branch emits nothing.

## PII ceiling (frozen)

Payloads may contain ONLY: UUIDs (`parentAccountId`, `enrollmentId`,
`classBatchId`), lifecycle enum strings (`active`/`blocked_lms`/`withdrawn`),
relation enum (`father`/`mother`/`guardian`). NEVER: student or parent names,
phones, emails, addresses, free-text notes, money/amounts, receipt codes,
password material. Timeline must not widen what `student.get` already exposes.

## UI contract

- `StudentActivitySection` (new `apps/admin/src/pages/students/student-activity.tsx`),
  same shape as `class-activity.tsx`, rendered as a "Lịch sử hoạt động"
  SectionBlock on the existing `profile` section of `/admin/students/:id`.
- No route, link, or shared-file changes this module: Phase 5 already
  canonicalized `/admin/students/:id/:section`; `record-timeline.tsx` is used
  as-is; `packages/links` and `apps/api/src/router.ts` untouched.

## Coverage gates

- `scripts/acceptance-report/flow-manifest.ts`: P1-05 claims `student.timeline`
  (its journey already drives `/admin/students/:id`); `pnpm acceptance:report`
  must stay 0-orphan after the claim.
- Denied-role timeline coverage included from the start (module-1 follow-up
  lesson applied).

## Concurrency hardening applied

- `guardian.approveLink` and provisioning share the same facility/parent/student
  advisory-lock key, so cross-producer Guardian creation cannot duplicate the
  event.
- Student lifecycle mutations lock the Student row before reading state.
- Enrollment activation uses `UPDATE ... WHERE status = 'reserved'` and emits
  only when one row changed.
- Receipt cancellation emits `enrollment_withdrawn` only when `updateMany`
  reports a changed enrollment row.
- A separate pre-existing M9 concern remains outside this module: sibling
  receipt cancellation can race its approved-receipt check when no shared
  Opportunity row serializes the calls. This module does not redesign finance
  cancellation; it only prevents false Student timeline events for no-op
  enrollment updates.
