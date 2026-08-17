# Red-team round 1 — Audit, RBAC and tenant isolation

**Date:** 2026-08-17  
**Scope:** `AuditLog`, `RecordEvent`, Staff/AppUser actor-target policy, tenant isolation and
record-link safety. Read-only source/plan review; no product code changed.

## Verdict

**REQUEST PLAN CHANGES.** The dual-ledger direction is sound: `AuditLog` remains global and
super-admin-only, while `RecordEvent` is facility-scoped, FORCE-RLS and append-only. Five
medium-severity gaps must be resolved in the plan before implementation.

## Findings

### M1 — Hidden `super_admin` can reappear in manager rosters and related summaries

**Evidence**

- D2 promises that non-super-admin callers do not advertise privileged targets
  (`decisions.md:23-25`).
- Phase 2 only mandates filtering `user.list` and vaguely asks for safe manager/subordinate
  summaries (`phase-02-staff-authorization-and-api-contract.md:24-35`).
- Phase 3 edits `managerId` but does not lock which endpoint or target filtering supplies the
  manager options (`phase-03-staff-routes-forms-and-navigation.md:17-23,53-58`).
- The current `user.pickList` returns every same-facility AppUser, including roles, with no
  `super_admin` exclusion (`apps/api/src/user/router.ts:233-264`).

**Impact**

A director can lose `super_admin` rows from the Staff list/detail yet still discover them in a
manager dropdown or through a manager/subordinate summary. That contradicts the locked target
visibility policy and creates inconsistent authorization UX.

**Required plan change**

Specify one reusable `visible staff target` predicate for every roster and related summary used by
the Staff feature. For non-super-admin callers it must exclude rows containing `super_admin`.
Add tests for list, get manager summary, manager options and direct IDs. Do not silently change
unrelated payroll/teacher picker semantics; either use the filtered `user.list` contract for the
Staff form or add an explicitly scoped Staff manager-picker procedure.

### M2 — Staff activity can disclose the raw identity of a hidden platform admin

**Evidence**

- D2 hides `super_admin` targets from directors (`decisions.md:18-25`).
- Staff timelines are intentionally readable by directors
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:21-23,69-79`).
- `RecordEvent.actor` is an unrestricted string (`packages/db/prisma/schema.prisma:317-325`).
- The existing timeline contract returns `actor` verbatim to the client
  (`apps/api/src/crm/router.ts:901-911`).
- Phase 4 defines payload secrecy but does not define an authorization-aware actor projection
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:18-20,31-37,95-98`).

**Impact**

When a platform admin creates, resets or edits an ordinary employee, a director reading that
employee's timeline can receive the platform admin's raw `userId`, even though the same account is
hidden from list/detail/manager targeting.

**Required plan change**

Lock the Staff timeline actor projection. A non-super-admin response must render a hidden actor as a
neutral server-owned label such as `Quản trị hệ thống`/`Hệ thống`, not a raw user identifier. Keep
the stored actor for compliance correlation, but test the API response for director versus
super-admin callers. Apply the same rule to any event payload field that references an AppUser.

### M3 — AppUser event payloads are not concrete enough to prove data minimization

**Evidence**

- The plan says only “define AppUser event kinds and allowlisted payloads”
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:17-20`).
- The proposed kinds include profile, roles, password, active state and manager changes, but no
  per-kind stored field matrix is specified
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:57-61`).
- The current CRM implementation achieves the intended safety by constructing each payload field
  explicitly in a closed discriminated union and exhaustive switch
  (`apps/api/src/crm/record-event.ts:73-92,112-138`).

**Impact**

An implementer can satisfy the words “allowlist” while retaining old/new email, name or other
historical PII indefinitely. The plan also cannot generate a precise negative-key test without an
approved payload contract.

**Required plan change**

Add an AppUser `kind -> exact stored payload` table. Prefer metadata required to explain the event:
for example `profile_updated` stores changed field names rather than full old/new profile values;
`activated`, `deactivated` and `password_reset` carry no credential/profile payload; role and
manager references follow the D2 visibility projection. Add recursive negative-key tests and a
serialized-response allowlist test.

### M4 — Audit entity-link correction has an example, not a complete ambiguity inventory

**Evidence**

- The generic helper chooses the first input `id`/`*Id` before the returned record ID
  (`apps/api/src/audit/audit-helpers.ts:32-49`), and the middleware persists that value
  (`apps/api/src/trpc.ts:164-180`).
- This is concretely wrong for multiple create/schedule mutations: `afterSale.create` accepts a
  `studentId` and returns a new case (`apps/api/src/after-sale/router.ts:92-113`);
  `parentMeeting.schedule` accepts a `studentId` and returns a new meeting
  (`apps/api/src/meeting/router.ts:74-110`); `testAppointment.schedule` accepts an
  `opportunityId`/`studentId` and returns a new appointment
  (`apps/api/src/appointment/router.ts:25-34,92-133`).
- Phase 4 calls for an action-aware registry but its test matrix names only `user.create`
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:24-27,57-65,67-79`).

**Impact**

The plan can pass its named test while continuing to link audit rows to a student/opportunity
instead of the created case/meeting/appointment. That leaves the requested system-wide audit
navigation unreliable.

**Required plan change**

Add a source-derived inventory of every mutation eligible for a canonical audit link and classify
its entity/id source as `input`, `result`, `inline-owned`, or `unlinked`. The action-aware registry
and tests must cover the full manifest, including the three concrete ambiguous creates above.
Unknown actions keep the current default and render no link unless both entity mapping and UUID are
validated.

### M5 — Global audit rows do not carry facility context, so canonical links may be unresolvable

**Evidence**

- `AuditLog` has no `facilityId` (`packages/db/prisma/schema.prisma:1118-1125`).
- `audit.list` intentionally reads the global table without RLS/facility filtering
  (`apps/api/src/audit/router.ts:1-4,19-48`).
- Domain detail procedures derive one facility from the current session
  (`apps/api/src/trpc.ts:277-287`).
- Phase 4 proposes safe record links but does not define current-facility resolvability or
  cross-facility behavior
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:24-27,36-37,64-65`).

**Impact**

In a multi-facility audit result, a super admin can be shown a syntactically valid link to a record
outside the session's current facility; the detail API then returns not found. Adding a plain link
mapping does not fulfill “open the audited component” and can encourage unsafe attempts to widen
domain APIs globally.

**Required plan change**

Choose and document one bounded behavior before implementation:

1. Link only when the target is verified resolvable in the current facility; otherwise show plain
   text, or
2. Add an explicit, separately authorized facility-context switching contract.

Do not infer facility from `AuditLog.data`, and do not widen ordinary detail procedures to global
lookup. Add same-facility, other-facility, deleted-target and unknown-entity tests.

## Confirmed strengths

- `audit.list` is gated by a permission with no ordinary-role roster
  (`packages/auth/src/index.ts:110-114,185-200`).
- `RecordEvent` already has FORCE RLS and `cmc_app` receives only SELECT/INSERT
  (`packages/db/prisma/migrations/20260813143000_record_event/migration.sql:23-37`).
- The plan correctly rejects a generic client-selectable `entity/entityId` timeline endpoint
  (`decisions.md:39-45`).
- The plan correctly requires event writes in the same transaction as the domain mutation
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:19,57-62,69-75`).

## Residual accepted decision

D2 intentionally preserves `FORBIDDEN` for director mutation attempts against a known
`super_admin`, while list/get hide that target. This leaves a narrow existence signal for a caller
who already knows the UUID, but it is an explicit locked decision rather than an unreviewed plan
gap (`decisions.md:16-25`; `phase-02-staff-authorization-and-api-contract.md:59-67`).

Status: DONE_WITH_CONCERNS
Summary: Dual-ledger and RLS direction is valid, but the plan needs explicit privileged-identity
projection, exact AppUser payload schemas, a complete audit-link manifest, and cross-facility link
behavior.
Concerns/Blockers: M1-M5 above.
