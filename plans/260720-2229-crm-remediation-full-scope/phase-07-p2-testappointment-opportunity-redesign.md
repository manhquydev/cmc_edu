---
phase: 7
title: "P2 TestAppointment opportunity redesign"
status: done
priority: P2
dependencies: [3, 4]
effort: "6-8h"
---

# Phase 7: P2 TestAppointment opportunity redesign

## Overview
Finding F5 (HIGH), PO decision #2. `TestAppointment` requires `studentId`, but Students exist only AFTER receipt approval — so a lead at O3_TEST_SCHEDULED (pre-payment) cannot have a test appointment. Redesign: `entrance` appointments attach to an **Opportunity**; `periodic` keep attaching to a Student. Stage O3/O4 sync from real appointment lifecycle. This **intentionally replaces** the old invariant "entrance never mutates CRM" (appointment/router.ts:3-4) — record as a contract change.

## Evidence (verified in-session)
- `scheduleInput` requires `studentId` (`apps/api/src/appointment/router.ts:12-16`); Student provisioned only at approve (`provision-from-receipt.ts` chain).
- O3/O4 advanced manually with no appointment behind them (`crm/router.ts:115-147`); TestAppointment has zero UI (grep `apps/admin/src`).
- Schema: `TestAppointment.studentId String` non-null, no relation (schema.prisma:1531-1542).

## Requirements
- Schema (migration — **strict CHECK, no relaxed legacy arm**; red-team: a relaxed arm would permanently permit new entrance rows without opportunityId, defeating PO decision #2 at the DB layer):
  1. Pre-validate `type` values: abort migration if any row has `type NOT IN ('entrance','periodic')` (column is free-text String, schema.prisma:1535 — stray values would break the CHECK create).
  2. Add `opportunityId String?`; make `studentId String?`; index `(facilityId, opportunityId)`.
  3. **Backfill legacy entrance rows**: `opportunityId := (SELECT r."opportunityId" FROM "Student" s JOIN "Receipt" r ON r.id = s."createdByReceiptId" WHERE s.id = ta."studentId")`; entrance rows with no resolvable opportunity are retyped `periodic` (they are post-enrollment tests by definition — Student existed when they were scheduled). Log counts.
  4. Apply STRICT CHECK: `(type='entrance' AND "opportunityId" IS NOT NULL) OR (type='periodic' AND "studentId" IS NOT NULL)` — raw-SQL CHECK is on-pattern for this repo (see migrations/20260707030000*).
- Router:
  - `schedule`: input `{type, scheduledAt, opportunityId?, studentId?}` with zod refinement matching the CHECK; entrance validates Opportunity in facility, **not lost** (phase 2 helper), stage in O2_CONTACTED|O3_TEST_SCHEDULED; periodic unchanged (Student in facility, not withdrawn — add `assertStudentActive`, currently missing there). Legacy entrance rows (backfilled or retyped by the migration) load through the same read paths — no dual-shape handling in code.
  - **Stage sync (one-step rule preserved)**: entrance schedule while opp at O2 → advance O2→O3 (reuse the linear-advance logic, do NOT bypass it); entrance `complete` while opp at O3 → advance O3→O4. `no_show` → no stage change. If opp already at/past target stage → no-op (idempotent).
  - Manual `opportunityAdvance` to O3/O4 remains allowed (KISS — no hard coupling; funnel truth improves, doesn't lock).
- UI: "Đặt lịch test" action on pipeline card/detail for O2/O3 opportunities (date-time picker); appointment shown on opportunity-detail with complete/no-show actions. Periodic scheduling UI deferred to phase 9 (student-scoped screens).
- Audit: the appointment mutation itself is NOT audited (post-sale audit deferred, validation decision) — but when a schedule/complete triggers a stage advance, `advanceOpportunityOneStep` emits the same CRM stage-change audit row as `crm.opportunityAdvance` (phase 4 helper): CRM stage history stays complete regardless of which door advanced it.

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma` + new migration (CHECK per above; RLS untouched — policy verified to exist: migration 20260707050000_p4_meetings_appointments:37,43)
- Modify: `apps/api/src/appointment/router.ts` (+ header comment rewritten to the NEW contract), `apps/api/src/appointment/appointment-lifecycle.test.ts`
- Modify: `apps/api/src/crm/router.ts` only if advance logic needs extraction into a shared helper (`advanceOpportunityOneStep`)
- Modify: `apps/admin/src/pages/crm/pipeline.tsx`, `opportunity-detail.tsx` (+tests)

## Implementation Steps
1. Migration + schema; regenerate client; verify CHECK via raw insert tests.
2. TDD router: entrance-on-opportunity happy path (+O2→O3 sync), complete (+O3→O4 sync), no_show (no sync), lost-opp rejected, wrong-stage rejected; periodic regression suite; migration test on seeded legacy data (entrance-with-receipt → backfilled; entrance-orphan → retyped periodic).
3. Extract `advanceOpportunityOneStep` helper (DRY with crm.opportunityAdvance) — `gitnexus_impact` on `opportunityAdvance` first.
4. UI scheduling + lifecycle actions; component tests.
5. Full api+admin suites; `gitnexus_detect_changes`.

## Success Criteria
- [ ] A lead never enrolled can be scheduled, tested, and reach O4 purely through appointment lifecycle.
- [ ] One-step stage rule never violated; scheduling entrance while opp at O1_LEAD is **rejected** with an actionable error (validation decision 2026-07-20: sale must mark O2 "đã liên hệ" first). <!-- Updated: Validation Session 1 - O1 schedule rejected -->
- [ ] Old invariant comment removed; new contract documented in router header; no test still asserts "entrance never mutates CRM".
- [ ] Legacy rows load and complete without error.

## Risk Assessment
- **Risk**: contract flip surprises other flows — grep for consumers of TestAppointment (none beyond router/tests today, verified); acceptance manifest (`scripts/acceptance-report/flow-manifest.ts`) may reference WF-P4-04 — update the flow entry.
- **Risk**: double-advance race (manual advance + appointment sync concurrently) → advance helper must re-read stage in-transaction (existing findOpportunityOrThrow pattern within withFacility tx).
- **Rollback**: migration is **forward-only** (red-team: once pre-payment entrance rows exist with `studentId=null`, NOT NULL cannot be restored without destroying them). Mitigate with the pre-validation + backfill-count logging above and a staging (`cmc_staging`) dry run before prod; rollback = revert app code while leaving the widened schema in place (old router code never wrote opportunityId, remains compatible).
