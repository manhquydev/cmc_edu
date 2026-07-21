---
phase: 10
title: "P3 Owner + lead source + schema cleanup"
status: done
priority: P3
dependencies: [3, 5, 7]
effort: "5-7h"
---

# Phase 10: P3 Owner + lead source + schema cleanup

> Rescoped after red-team 2026-07-20: **OpportunityNote model + noteAdd/noteList CUT** — the PO-approved decision #3 covered `assignedToId` + `source` only; notes were plan-author scope creep with no finding demanding them (revisit only on explicit PO request). `opportunityAssign` authorization is now fully specified (the registry `can()` is role-only — packages/auth/src/index.ts:137-149 — so row-level ownership MUST be a coded check in the procedure). `remindedAt` evidence corrected: it IS present in parentMeeting API return payloads (meeting/router.ts:61,82-83) even though nothing reads it downstream — phase 9 builds the meeting UI without it, then this phase drops it.

## Overview
PO decision #3 + findings F13/F15 (LOW). Add `assignedToId` (owner) + `source` to Opportunity — the data foundation for sale KPI attribution (KPI auto-score exists from plan 260711-1752; NO payroll code changes here). Clean dead schema: drop `ParentMeeting.remindedAt`; add FKs for the three post-sale `studentId` scalars.

## Evidence (verified in-session)
- Opportunity has no owner/source (schema.prisma:271-286).
- `remindedAt`: zero readers/writers of the VALUE (grep repo — only schema + migration); it does flow through meeting router return payloads as always-null (meeting/router.ts:61,82-83). Phase 9's UI is built to ignore it → drop is a additive-payload-field removal with no consumer.
- Scalar-no-FK: ParentMeeting.studentId (:1519), TestAppointment.studentId (:1534, nullable after phase 7), AfterSaleCase.studentId (:1550). Students are never hard-deleted (lifecycle withdrawn) → FK is defense-in-depth.
- Nullable-AppUser-FK + backfill pattern exists (Receipt.createdByAppUserId, schema.prisma:343-345) — reuse for assignedToId.
- Registry test exists: packages/auth/src/index.test.ts (5-role matrix pattern).

## Requirements
- Schema (one migration):
  - `Opportunity.assignedToId String?` + relation to AppUser (nullable — historical rows unowned; follow Receipt's nullable-FK pattern).
  - `Opportunity.source String?` — values enforced at API layer via zod enum `referral|walkin|fanpage|hotline|event|other`; no DB enum (KISS).
  - Backfill `source:'walkin'` for opportunities auto-created by phase 5 (identify via receiptApprove audit rows' `autoCreatedOpportunityId`).
  - Drop `ParentMeeting.remindedAt`.
  - Add FKs: ParentMeeting.studentId → Student, TestAppointment.studentId → Student, AfterSaleCase.studentId → Student. Pre-validate zero orphan rows (migration DO-block aborts with counts if found).
- API:
  - `opportunityCreate`: accept optional `source`; default `assignedToId := ctx.subject.userId` when caller role is `sale`; giam_doc_kinh_doanh creates unassigned or picks.
  - New `crm.opportunityAssign` — registry key `crm.opportunityAssign: ['giam_doc_kinh_doanh', 'sale']` (ONE new key), with the row-level rule **coded in the procedure** (can() cannot express it): `sale` may set `assignedToId` ONLY to their own userId AND only when the opportunity is currently unassigned or already theirs; `giam_doc_kinh_doanh` may assign anyone. Violations → FORBIDDEN. Matrix-tested (sale-steal attempt, sale-self-claim, GĐ-reassign).
  - Walk-in (phase 5 path): new opportunities get `source:'walkin'` at creation (phase 5 omits the column until this phase lands; going forward the walk-in block sets it — one-line follow-up here).
- UI: create-lead form (phase 3) gains source select; pipeline card shows owner initials; detail gains owner select (per permission matrix).
- Audit rows per phase 4 pattern for assign.

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma` + migration; `packages/auth/src/index.ts` + `index.test.ts`
- Modify: `apps/api/src/crm/router.ts` + tests; `apps/api/src/finance/router.ts` (walk-in source, one line)
- Modify: `apps/admin/src/pages/crm/pipeline.tsx`, `opportunity-detail.tsx` + tests
- Docs sync after: docs/10 (data model), docs/14 (permission catalog) — per documentation-management rules.

## Implementation Steps
1. Migration (FK orphan pre-validation DO-block first, abort with counts; staging dry run).
2. Registry key + auth matrix tests (5 roles — role-reality: no new roles).
3. Router TDD: source persist + zod enum reject; assign matrix (sale self-claim OK, sale steal FORBIDDEN, GĐ any, unassigned-claim OK); creator-default rule.
4. UI wiring; component tests.
5. Full suites; `gitnexus_detect_changes`; docs sync.

## Success Criteria
- [ ] New lead by sale → owner = creator; GĐ reassigns; sale cannot reassign others' leads (matrix test proves all cells).
- [ ] `remindedAt` gone from schema and all payload types; FK constraints active.
- [ ] KPI attribution query (owner → approved receipt revenue) documented in docs/10 note — NO payroll code changed.
- [ ] Exactly ONE new permission key added; registry test updated.

## Risk Assessment
- **Risk**: FK addition fails on hidden orphans → pre-validation surfaces counts; fix data before constraint.
- **Risk**: assignedToId nullable forever on old rows — acceptable; KPI queries treat null as unattributed.
- **Rollback**: columns/FKs droppable; `remindedAt` restore = re-add nullable column (all values were NULL — zero writers ever).
