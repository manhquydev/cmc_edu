# Validation — API, RBAC, tenant and timeline contracts

**Date:** 2026-08-17  
**Scope:** active plan, D2/D3/D4/D9/D10, Phases 2/4/5/6, current API/auth/UI/schema/tests.  
**Method:** source verification plus a focused runtime-test attempt. No product code or plan edited.

## Verdict

**FAILED pending four plan corrections.**

The main architecture is viable and source-backed: directors already hold `user.manage`;
same-facility `super_admin` visibility with read-only sensitive actions matches current behavior;
ParentAccount needs a distinct read permission; Class sections do have different API gates;
`AuditLog` is global/super-admin-only; and `RecordEvent` is FORCE-RLS, append-only and transaction
compatible.

The plan is not execution-safe yet for:

1. direct Staff `managerId` authorization;
2. exact Class write gates;
3. multi-facility ParentAccount timeline semantics and transaction ownership;
4. closed AppUser event/actor response contracts.

## Validation matrix

### Staff / `user.manage`

#### VERIFIED — Directors currently hold `user.manage`

- Registry: `user.manage` includes both `giam_doc_kinh_doanh` and `giam_doc_dao_tao`
  (`packages/auth/src/index.ts:139-144`).
- `super_admin` bypasses the registry; other roles require an explicit roster entry
  (`packages/auth/src/index.ts:185-200`).
- API procedures call the same registry through `requirePermission`
  (`apps/api/src/trpc.ts:264-274`).
- Plan D2 preserves, rather than invents, this business authority
  (`decisions.md:12-21`; `phase-02-staff-authorization-and-api-contract.md:12-13`).

#### VERIFIED — Current same-facility `super_admin` visibility is read-only for directors

- `user.list` is facility-scoped and does not filter `super_admin`
  (`apps/api/src/user/router.ts:268-294`).
- Non-super-admin callers cannot create an account with `super_admin`
  (`apps/api/src/user/router.ts:150-164`).
- Non-super-admin callers cannot update a target already holding `super_admin`
  (`apps/api/src/user/router.ts:296-310`).
- Non-super-admin callers cannot reset that target's password
  (`apps/api/src/user/router.ts:422-438`).
- Non-super-admin callers cannot grant or revoke `super_admin`
  (`apps/api/src/user/router.ts:461-484`).
- The revised D2 and Phase 2 matrix now match those source facts
  (`decisions.md:16-27`; `phase-02-staff-authorization-and-api-contract.md:61-69`).

#### VERIFIED — Existing target lookups fail closed by facility

- `update`, `resetPassword`, and `updateRoles` load the target with both ID and facility and return
  `NOT_FOUND` when absent
  (`apps/api/src/user/router.ts:299-304,425-430,469-475`).
- Create/update manager lookup also includes facility
  (`apps/api/src/user/router.ts:153-157,312-317`).
- This supports the Phase 2 cross-facility contract
  (`phase-02-staff-authorization-and-api-contract.md:24-30,61-69`).

#### VERIFIED — Safe AppUser serialization seam exists

- `APP_USER_SELECT` explicitly includes profile/role/status fields and omits password hash,
  must-change-password, attempts and lockout state
  (`apps/api/src/user/router.ts:61-91`).
- Existing returned list/update/create/role DTOs use that select
  (`apps/api/src/user/router.ts:175-192,268-292,327-337,521-532`).
- Reusing it for `user.get` is feasible as Phase 2 requires
  (`phase-02-staff-authorization-and-api-contract.md:24-25,51-55`).

#### FAILED — Manager eligibility is specified as a picker rule, not an API target rule

- D2 says a non-super-admin's Staff manager picker excludes `super_admin`
  (`decisions.md:23-27`).
- Phase 2 names “manager-picker eligibility” but does not state what direct `create.managerId` or
  `update.managerId` must do (`phase-02-staff-authorization-and-api-contract.md:24-30,40-45`).
- Current create/update APIs validate only same-facility existence, not target roles
  (`apps/api/src/user/router.ts:153-157,312-317`).
- The existing generic `user.pickList` also returns roles without excluding `super_admin`
  (`apps/api/src/user/router.ts:233-264`).

**Plan correction required:** define this as a server-side target contract, not only a dropdown
filter. For a non-super-admin caller, both manager-option discovery and a direct `managerId` payload
must reject/exclude a target containing `super_admin`; add create and update bypass tests. Keep the
existing payroll/teacher `user.pickList` behavior unchanged unless separately authorized.

#### UNVERIFIED — `user.get`, Staff manager picker and actor-target integration tests do not exist yet

- No current `user.get` or `user.timeline` procedure exists under `apps/api/src/user/router.ts`.
- Phase 2 correctly schedules the new procedure and matrix
  (`phase-02-staff-authorization-and-api-contract.md:24-30,49-69`).
- Runtime proof remains future work.

### ParentAccount read/action split

#### VERIFIED — Current action rosters differ exactly as the plan states

- `parentAccount.updateEmail`: GĐKD + sale
  (`packages/auth/src/index.ts:130-133`).
- `parentAccount.setActive`: GĐKD + GĐĐT
  (`packages/auth/src/index.ts:130-133`).
- Current `get` and `list` incorrectly reuse `updateEmail`
  (`apps/api/src/parentAccount/router.ts:45-50,109-117`).
- Current detail route also gates the whole shell on `updateEmail`
  (`apps/admin/src/routes/admin.routes.tsx:75-94`).
- D9's proposed `read` roster—GĐKD, GĐĐT and sale—is a coherent union for discovery/detail while
  preserving the narrower mutations (`decisions.md:100-105`).

#### UNVERIFIED — The proposed ParentAccount split needs an explicit executable actor/action matrix

- The current detail always shows the email action; only the active toggle is conditionally gated
  (`apps/admin/src/pages/parents/parent-detail.tsx:127-129,170-189`).
- Phase 6 only gives the generic instruction to freeze a matrix
  (`phase-06-remaining-first-class-record-rollout.md:45-49,79-89`).

**Plan correction required:** add the exact cases to Phase 6:

- GĐKD: read + updateEmail + setActive;
- GĐĐT: read + setActive, no email action/API;
- sale: read + updateEmail, no active action/API;
- ordinary role: no read;
- cross-facility parent: `NOT_FOUND`.

Name the route shell, list discovery, `get`, timeline, email button and active button in the proof
matrix so the current always-visible email button cannot survive the read split.

#### FAILED — ParentAccount timeline has no multi-facility event semantics

- ParentAccount is a system-wide login identity with no `facilityId`
  (`packages/db/prisma/schema.prisma:469-488`).
- One parent can have approved Guardian rows in multiple facilities by design
  (`packages/db/prisma/schema.prisma:518-526,534-553`).
- `updateEmail` and `setActive` mutate the one global ParentAccount, so the result affects login in
  every linked facility (`apps/api/src/parentAccount/router.ts:167-215,218-257`).
- Phase 6 proposes email/active/child-link events on a facility-scoped `RecordEvent` timeline but
  does not choose how a global state change is represented to other linked facilities
  (`phase-06-remaining-first-class-record-rollout.md:25-31,36-49,116-119`).

**Plan correction required:** freeze one explicit ParentAccount rule before its module wave:

- either fan out a secret-free operational event to every currently linked facility in the same
  transaction, or
- define the timeline as caller-facility-only and state clearly that global account changes made
  elsewhere are intentionally absent.

The first option better matches an operational history claim, but it must not include child data
from another facility.

#### FAILED — ParentAccount mutations currently have no transaction that can own `RecordEvent`

- `updateEmail` performs authorization, ParentAccount update and AuditLog writes through separate
  `ctx.db` calls (`apps/api/src/parentAccount/router.ts:180-215`).
- `setActive` has the same split shape (`apps/api/src/parentAccount/router.ts:223-256`).
- Phase 6 generally requires producer/transaction ownership
  (`phase-06-remaining-first-class-record-rollout.md:45-49,65-73`) but does not call out this
  required transaction refactor.

**Plan correction required:** name ParentAccount `updateEmail`/`setActive` as transaction-boundary
refactors. Guardian authorization, global ParentAccount mutation, existing inline AuditLog row and
all facility-scoped RecordEvent inserts must commit or roll back together.

### Class shell, sections and actions

#### VERIFIED — Current API already has separate read boundaries

- Class list/get/session list use `class.read`; the roster uses the narrower `classRoster.read`
  (`packages/auth/src/index.ts:116-125`;
  `apps/api/src/class/class-batch-router.ts:225-274,303-314`;
  `apps/api/src/class/class-session-router.ts:143-163`).
- The role behavior is encoded in integration tests: sale/GĐKD cannot read the roster, while
  teacher/GĐĐT can; sale and teacher can read classes/sessions
  (`apps/api/src/class/class-read-permission.test.ts:86-106,108-156`).
- The route shell already uses `class.read`
  (`apps/admin/src/routes/admin.routes.tsx:98-114`).

#### VERIFIED — Current component-level guard is the mismatch Phase 5 must remove

- `ClassDetailPage` currently rejects every caller without `class.create`, overriding the wider
  route/API read contract (`apps/admin/src/pages/classes/class-detail.tsx:401-428`).
- StudentsTab calls `classBatch.listStudents` with no section-specific UI gate
  (`apps/admin/src/pages/classes/class-detail.tsx:118-157`).
- Phase 5 correctly requires section-owned gates rather than a single parent gate
  (`phase-05-existing-detail-url-and-cross-link-normalization.md:17-30,96-99`).

#### FAILED — “edit controls `class.create`” is not the actual Class contract

- Class teacher assignment uses `class.create`
  (`apps/api/src/class/class-batch-router.ts:316-338`).
- Session confirm, cancel and unit assignment use `schedule.generate`
  (`apps/api/src/class/class-session-router.ts:302-360`).
- Session teacher assignment uses `class.create`
  (`apps/api/src/class/class-session-router.ts:391-423`).
- Exercise-sequence entry uses `exercise.manage` in the UI
  (`apps/admin/src/pages/classes/class-detail.tsx:431-435,525-534`).
- Phase 5 compresses all edit controls into `class.create`
  (`phase-05-existing-detail-url-and-cross-link-normalization.md:29-30`).

**Plan correction required:** replace the blanket rule with the exact section/action matrix:

- overview/sessions read: `class.read`;
- students read: `classRoster.read`;
- class/session teacher assignment: `class.create`;
- session confirm/cancel/unit assignment: `schedule.generate`;
- exercise sequence: `exercise.manage`.

Add negative UI tests proving a read-only role does not see controls whose API it cannot call.

### AuditLog

#### VERIFIED — AuditLog is global and super-admin-only

- `audit.list` has an empty ordinary-role roster, while `super_admin` bypasses the registry
  (`packages/auth/src/index.ts:110-114,185-200`).
- The router gates with `audit.list` and intentionally performs an unscoped global query
  (`apps/api/src/audit/router.ts:1-4,19-48`).
- The schema has no `facilityId` or RLS-bearing relation
  (`packages/db/prisma/schema.prisma:1118-1133`).
- Plan D3/D10 and Phase 4 preserve this limitation and prohibit director exposure
  (`decisions.md:32-47,107-113`;
  `phase-04-operational-timeline-and-compliance-audit-separation.md:29-43,112-115`).

#### VERIFIED — Current ID derivation needs the planned closed action manifest

- Middleware uses input-first generic ID extraction
  (`apps/api/src/audit/audit-helpers.ts:32-49`;
  `apps/api/src/trpc.ts:164-180`).
- Phase 4 now requires an action manifest and names the known ambiguous create/schedule actions
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:74-79,92-96`).

#### UNVERIFIED — Current-facility link resolvability is only a decision, not an API contract yet

- D10 correctly says other-facility/deleted/unknown targets stay plain text
  (`decisions.md:107-113`).
- No current `audit.list` response contains a server-produced resolvability/link field, and
  `entityId` is not yet an input filter (`apps/api/src/audit/router.ts:9-17,23-48`).

**Plan correction required:** Phase 4B should state that resolvability is computed server-side by an
allowlisted per-entity resolver under the current facility, returning either a validated canonical
link key or `null`. The client must not infer resolvability from `entity`, `entityId`, or
`AuditLog.data`.

### RecordEvent and AppUser timeline

#### VERIFIED — RecordEvent tenant and append-only substrate

- Table carries `facilityId`, entity, entityId, kind, actor and payload
  (`packages/db/prisma/schema.prisma:314-329`).
- Migration enables and forces RLS, with both `USING` and `WITH CHECK` bound to the facility GUC
  (`packages/db/prisma/migrations/20260813143000_record_event/migration.sql:23-34`).
- `cmc_app` has SELECT/INSERT only; UPDATE/DELETE are revoked
  (`packages/db/prisma/migrations/20260813143000_record_event/migration.sql:36-37`).
- Existing tests attempt update/delete through the application role
  (`apps/api/src/crm/record-event.test.ts:262-282`).

#### VERIFIED — Existing timeline authorizes the parent and hardcodes the entity

- CRM timeline first loads the same-facility Opportunity, then queries only
  `entity='Opportunity'` and that ID
  (`apps/api/src/crm/router.ts:859-897`).
- Cross-facility and confused-deputy cases are represented in tests
  (`apps/api/src/crm/record-event.test.ts:154-165,182-193`).
- D4/Phase 4 require the same domain-owned pattern for AppUser
  (`decisions.md:41-47`;
  `phase-04-operational-timeline-and-compliance-audit-separation.md:34-39,83-96`).

#### VERIFIED — Cursor ordering is deterministic in source

- Query orders by `createdAt DESC, id DESC` and cursor comparison uses the same tuple
  (`apps/api/src/crm/router.ts:876-913`).
- Cursor parser rejects malformed date/shape
  (`apps/api/src/crm/router.ts:922-936`).
- Existing tests cover non-overlapping pages
  (`apps/api/src/crm/record-event.test.ts:218-236`).

#### VERIFIED — Same-transaction event emission is feasible and already used

- The emitter requires a `Prisma.TransactionClient`
  (`apps/api/src/crm/record-event.ts:141-155`).
- Opportunity create writes record and event inside one `withFacility` transaction
  (`apps/api/src/crm/router.ts:180-222`).
- Staff create/update/reset/roles already execute inside `withFacility` transaction callbacks
  (`apps/api/src/user/router.ts:150-154,296-300,422-426,461-470`).
- Phase 4's same-transaction requirement therefore fits the current Staff mutation structure
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:17-24,67-72,83-90`).

#### FAILED — AppUser payload and actor response are not fully closed

- Phase 4 narrows payloads substantially, but `profile_updated {fields[]}` does not define a closed
  field enum, and “safe identity/label” does not define the returned DTO/fallback
  (`phase-04-operational-timeline-and-compliance-audit-separation.md:21-25`).
- Current shared timeline renders whatever string is supplied as `actor`
  (`packages/ui/src/components/record-timeline.tsx:4-11,108-118`).
- Existing CRM timeline returns stored actor verbatim
  (`apps/api/src/crm/router.ts:901-911`).

**Plan correction required:** freeze:

- `profile_updated.fields` as a closed enum, excluding `managerId`, `isActive`, credentials and
  unknown strings because those have dedicated event kinds;
- the API response field as `actorLabel` or an explicitly documented safe `actor` label;
- lookup/fallback behavior for deleted, missing, cross-facility and system actors;
- a test proving raw stored `userId` never reaches the Staff timeline response.

#### UNVERIFIED — Runtime database tests could not execute in this session

Focused Vitest execution was attempted. The exact blocker was:

```text
createPrismaClient: neither APP_DATABASE_URL nor DATABASE_URL is set.
```

The single-file command `pnpm exec vitest run src/audit/router.test.ts --reporter=verbose` therefore
failed before assertions. Source and test existence are verified above; runtime outcomes remain
unverified, not passed.

## Required plan corrections

1. Make Staff manager eligibility an API target guard for direct create/update payloads.
2. Add the exact ParentAccount actor/action UI+API matrix.
3. Define ParentAccount multi-facility timeline fanout/visibility and transaction ownership.
4. Replace Class's blanket `class.create` edit gate with the real per-action permissions.
5. Specify server-produced audit-link resolvability.
6. Close AppUser `fields[]` and actor projection DTO/fallback semantics.

## Final status

Status: DONE_WITH_CONCERNS
Summary: Core RBAC, tenant and dual-ledger assumptions are source-valid, but four material contract
areas and two proof details still require plan edits before implementation.
Concerns/Blockers: Direct managerId bypass; ParentAccount global identity versus facility timeline;
incorrect Class edit-gate simplification; incomplete AppUser actor/payload closure; runtime DB env
missing.
