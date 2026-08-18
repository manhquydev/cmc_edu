# Red-team round 1 — Resource architecture and detail-depth completeness

**Date:** 2026-08-17  
**Scope:** record versus workspace/config/queue taxonomy, discovery completeness, detail/API/link/
timeline contracts, and source-to-plan consistency. Read-only source/plan review; no product code
or phase plan changed.

## Verdict

**REQUEST PLAN CHANGES.** The plan correctly rejects a blanket “one detail page per UUID” rule and
has strong source-backed decisions for Staff, ParentMeeting, Course, Gift, and the dual-ledger
model. However, its discovery and future coverage mechanisms begin from declared SPA routes. That
is insufficient for the stated system-wide outcome: model/API-owned lifecycle records can be
embedded in another record's UI and therefore never appear in a route-complete ledger.
`TestAppointment` is the concrete current miss.

## Findings

### H1 — The route-complete inventory is not resource-complete and omits `TestAppointment`

**Evidence**

- The inventory explicitly covers declared Admin SPA routes
  (`reports/source-current-resource-depth-inventory.md:14-18`), not all model/API-owned resources.
- D5 classifies a first-class record by stable identity plus lifecycle, relational work, durable
  navigation, timeline value, or downstream references (`decisions.md:49-61`).
- `TestAppointment` has a UUID, facility ownership, notes, a
  `scheduled -> done | no_show` lifecycle, and Opportunity/Student ownership
  (`packages/db/prisma/schema.prisma:1740-1763`).
- Its router schedules and transitions individual appointment records
  (`apps/api/src/appointment/router.ts:25-44,74-152,154-224`) and an entrance appointment advances
  the owning Opportunity stage (`apps/api/src/appointment/router.ts:1-15,118-133,180-193`).
- The current UI reads and acts on appointments only inside Opportunity detail
  (`apps/admin/src/pages/crm/opportunity-detail.tsx:157-206,318-325`), so there is no route row from
  which the inventory can discover the resource.
- `@cmc/links` has no `testAppointment` canonical builder
  (`packages/links/src/index.ts:16-37`), and Phase 6's rollout matrix omits it
  (`phase-06-remaining-first-class-record-rollout.md:23-35`).

**Impact**

The plan can declare system-wide inventory complete while leaving a real lifecycle record
unclassified. This does not prove that `TestAppointment` needs an independent detail page: it may
legitimately be an Opportunity-/Student-owned subrecord. It does prove that the current inventory
cannot support that decision or detect future resources with the same shape.

**Required plan change**

Expand Phase 1 discovery from route-complete to resource-complete. Generate candidates from at
least:

1. declared production routes;
2. mounted domain API routers and record-shaped procedures;
3. persisted models with stable IDs and lifecycle/relational signals;
4. canonical link builders and existing exception entries.

Add `TestAppointment` to the ledger and explicitly decide, with source-backed rationale, whether it
is:

- an Opportunity-/Student-owned subordinate record whose lifecycle remains inline, or
- a first-class record requiring `get`, canonical link, detail and timeline.

Either outcome is acceptable if its ownership, share/back/F5 behavior, audit-link behavior and
timeline ownership are explicit.

### H2 — `ReconciliationFlag` is conditionally exempted without applying the locked D5 criteria

**Evidence**

- The inventory says `/ops/recon` remains a queue “unless ReconciliationFlag becomes a shared
  record” (`reports/source-current-resource-depth-inventory.md:63-66`).
- The source already gives each flag a UUID, facility scope, receipt reference, resolver identity,
  timestamps, `deepLink`, and terminal `open -> dismissed | actioned` lifecycle
  (`packages/db/prisma/schema.prisma:1789-1815`).
- The API lists flags and mutates an individual `flagId`, including lifecycle validation and audit
  identity (`apps/api/src/reconciliation/router.ts:14-22,24-128`).
- D5 requires stable identity plus at least two qualifying signals; it does not require the record
  to be shared across modules (`decisions.md:49-61`).

**Impact**

The classification rationale conflicts with the plan's own taxonomy. This may cause either
under-design—losing addressability/history for a genuine review case—or over-design later when an
implementer assumes every lifecycle row must have a new page.

**Required plan change**

Apply D5 explicitly to `ReconciliationFlag` and record a deliberate exception decision. It is
reasonable for a queue to own a short, terminal row lifecycle inline, but the exception must state
why independent share/back/F5 and operational timeline do not add enough value, how its existing
`deepLink` is used, and where resolver/action history remains inspectable. Do not use “not yet
shared” as the criterion.

### M1 — The planned Staff API retrieves subordinate summaries without a demonstrated consumer

**Evidence**

- Phase 2 requires only the safe manager identity needed by the form
  (`phase-02-staff-authorization-and-api-contract.md:22-31`).
- Its architecture additionally says `user.get` joins safe manager **and subordinate** summaries
  (`phase-02-staff-authorization-and-api-contract.md:33-38`).
- Phase 3's profile contract edits `managerId`; it does not define a subordinate roster or
  reporting-tree work surface (`phase-03-staff-routes-forms-and-navigation.md:15-29`).
- `AppUser` has a subordinate relation, but the current browser-safe DTO exposes neither manager
  nor subordinate objects (`packages/db/prisma/schema.prisma:1251-1253`;
  `apps/api/src/user/router.ts:61-91`).

**Impact**

This broadens data returned by the new detail API without an approved UI need, increases
privileged-target projection complexity, and creates an unnecessary authorization contract that
later phases must preserve.

**Required plan change**

Remove subordinate summaries from Phase 2. If a reporting-tree surface is genuinely required, add
it as an explicit use case with fields, pagination, actor-target visibility, hidden privileged
identity behavior, UI consumer and tests. Do not fetch the relation speculatively.

### M2 — Phase 7 repeats the route-only blind spot in the permanent coverage gate

**Evidence**

- Phase 7 says its resource-depth audit consumes route/link/exception data
  (`phase-07-coverage-gates-e2e-and-documentation.md:27-31`).
- The root API mounts lifecycle resources independently of SPA route ownership, including
  `parentMeeting`, `testAppointment`, `afterSale`, and `reconciliation`
  (`apps/api/src/router.ts:38-49,108-125`).
- The pass condition only requires zero unknown routes and duplicate canonical paths
  (`phase-07-coverage-gates-e2e-and-documentation.md:60-71`).

**Impact**

Even after implementation, the static gate could pass while a new API/model lifecycle resource is
popup-only, embedded, or entirely missing from the canonical resource ledger. It would prevent
route drift, not the broader popup-only regression named by the plan.

**Required plan change**

Make the machine-readable gate compare two sets:

- candidate resources derived from route + API/model declarations; and
- approved classifications (`record`, owned subrecord, workspace, config, queue, dashboard, or
  explicit exception).

For approved first-class records, then assert the required API/link/route/detail/timeline depth.
For subordinate or compact queue exceptions, assert the recorded owner and rationale. A route-only
unknown count is necessary but not sufficient.

### M3 — One existing RBAC red-team report is stale relative to the adjudicated D2 policy

**Evidence**

- The earlier report states that D2 hides or must filter `super_admin` targets from directors and
  manager-related responses
  (`reports/red-team-round-1-audit-rbac-tenant.md:15-40,42-66,167-172`).
- The locked D2 now preserves same-facility read-only visibility of `super_admin` profiles for
  directors; only mutation and manager-picker eligibility are denied (`decisions.md:12-30`).

**Impact**

An implementer or validator reading all reports can apply mutually incompatible target-visibility
rules. That can lead to incorrect list/get filtering or validation failures against the final
policy.

**Required plan change**

Keep the report as historical evidence, but mark its conflicting target-visibility findings as
superseded by adjudication and D2. Validation matrices and implementation steps must cite
`decisions.md` as the current authority.

## Confirmed strengths

- Staff is correctly treated as the P0 record-depth failure: the as-built surface has no canonical
  detail route and collapses creation/row work into dialogs.
- ParentMeeting is correctly included as a missing first-class detail record rather than left as a
  schedule/complete popup queue.
- Course and Gift exemptions are source-backed catalog/config decisions. Their UUIDs alone do not
  satisfy the record-depth rule; transactional lifecycle belongs to ClassBatch and Reward.
- The plan correctly keeps Class, Student and Receipt as existing detail records and scopes their
  problem to addressable sections, missing content, and operational timelines rather than
  duplicating their pages.
- The dual-ledger architecture is correct: global compliance `AuditLog` and facility-scoped
  operational `RecordEvent` have different readers and purposes.
- RefundRecord need not be promoted by this plan without an independent lifecycle/product
  decision; receipt-owned navigation remains a defensible current classification.

## Exit assessment

The plan is not yet architecture-complete because its evidence set and permanent audit cannot see
all resource candidates. Correcting H1/H2 and Phase 7's candidate-discovery contract should happen
before implementation. The Staff, URL-history, RBAC, and dual-ledger directions can otherwise
remain intact.

Status: DONE_WITH_CONCERNS
Summary: The taxonomy is sound, but route-led discovery misses model/API lifecycle resources; the
plan must classify `TestAppointment` and `ReconciliationFlag` and expand the future coverage gate.
Concerns/Blockers: H1 and H2 block a truthful claim of system-wide resource-depth completeness;
M1-M3 should be resolved during plan adjudication.
