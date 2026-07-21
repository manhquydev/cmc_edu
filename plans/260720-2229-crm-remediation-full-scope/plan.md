---
title: "CRM remediation full-scope: integrity races, lost-gate, lead intake UI, walk-in funnel, TestAppointment redesign, owner/source"
description: "Fix 15 findings from CRM assessment (brainstorm-260720-2229): orphan-Student cancel race, lost-opportunity receipt gate, missing lead-intake UI, walk-in funnel blindspot, TestAppointment entrance-before-payment redesign, AuditLog gaps, Contact dedup, owner/source foundation for sale KPI."
status: done
priority: P1
branch: "main"
tags: [crm, finance, data-integrity, admin-ui, schema, audit, tdd]
blockedBy: []
blocks: [260720-1230-independent-runtime-verification-38-flows]
created: "2026-07-20T15:46:39.720Z"
createdBy: "ck:plan"
source: skill
---

# CRM remediation full-scope

## Overview

Input: `plans/reports/brainstorm-260720-2229-crm-operational-integrity-assessment-report.md` (findings F1–F15, §5 P0→P3, 3 PO decisions locked 2026-07-20). Evidence rule: **code/schema only — docs are claims, not evidence**; every phase cites file:line verified in-session.

**PO decisions locked:**
1. Walk-in receipts → auto-create/link Contact+Opportunity closed at O5 on approve (funnel = 100% revenue).
2. Entrance test happens BEFORE payment → TestAppointment gets `opportunityId` for `entrance` type; stage O3/O4 sync from real appointments. This **deliberately supersedes** the old "entrance never mutates CRM" invariant (appointment/router.ts:3-4).
3. Owner (`assignedToId`) + `source` + minimal notes on Opportunity land in this plan (foundation for sale KPI attribution).

**Execution order (≠ file numbering):** 1 → 2 → 3 → 4 → **8** → 5 → 6 → 7 → 9 → 10. Phase 8 moved before 5 (red-team: walk-in adds a second Contact writer — normalizer + unique index must exist first). Phases 3 and 6 back-to-back, same implementer (shared pipeline.tsx cache pattern). Money-path phases (1, 2, 5) are TDD: lock current behavior with tests before changing it (existing suites: `apps/api/src/finance/approve.test.ts`, `cancel-refund.test.ts`, `receipt-cancel-provisioning-race.test.ts`, `apps/api/src/provisioning/idempotent.test.ts`).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [P0 Cancel-provisioning race fix](./phase-01-p0-cancel-provisioning-race-fix.md) | Done |
| 2 | [P0 Lost-opportunity receipt gate](./phase-02-p0-lost-opportunity-receipt-gate.md) | Done |
| 3 | [P0 Lead intake UI (create/lost/search)](./phase-03-p0-lead-intake-ui-create-lost-search.md) | Done |
| 4 | [P1 AuditLog coverage](./phase-04-p1-auditlog-coverage.md) | Done |
| 5 | [P1 Walk-in auto-opportunity O5](./phase-05-p1-walk-in-auto-opportunity-o5.md) | Done |
| 6 | [P1 Lost funnel separation + pagination](./phase-06-p1-lost-funnel-separation-pagination.md) | Done |
| 7 | [P2 TestAppointment opportunity redesign](./phase-07-p2-testappointment-opportunity-redesign.md) | Done |
| 8 | [P2 Contact unique phone](./phase-08-p2-contact-unique-phone.md) | Done |
| 9 | [P2 Aftersale + meeting UI wiring](./phase-09-p2-aftersale-meeting-ui-wiring.md) | Done |
| 10 | [P3 Owner + lead source + schema cleanup](./phase-10-p3-owner-lead-source-schema-cleanup.md) | Done |

## Dependencies

- **Intra-plan (full fan-out):** 1, 2 → 4 (audits the hardened paths); 2, 8 → 5 (walk-in builds on hardened `runMoneyTransaction` + shared `findOrCreateContact`/`normalizeContactPhone`); 3 → 6, 7, 8, 9, 10 (pipeline UI + consolidated `opportunityList` contract); 4 → 7 (shared CRM stage-audit helper used by `advanceOpportunityOneStep`); 5, 7 → 10 (source backfill + TestAppointment FK shape). Linear execution order 1→2→3→4→8→5→6→7→9→10 places every dependency before its dependent (verified).
- **Cross-plan:** aftersale/post-sale-meeting stub screens were **never owned by any prior plan** (premium-erp-buildout phase-08's effective scope is network-ip only — corrected after red-team; nothing here touches or closes that phase). Blocks re-run of `260720-1230-independent-runtime-verification-38-flows` (flows change).
- **UI standard:** all new screens use `@cmc/ui` single-door barrel + premium template layer (`ListPage`/`DetailPage`/`FormPage`), light mode, LineIcon only (locked baseline 2026-07-10).

## Acceptance criteria (plan-level)

- [ ] No provisioning step can durably commit ParentAccount/Student/Guardian/StudentAccount after its receipt leaves `approved`; partial states surface as `cancelled_receipt_partial_provisioning` flags (no auto-withdraw — void semantics preserved).
- [ ] Receipt create AND approve rejected on a lost opportunity (closedAt set, stage ≠ O5); lostReason cleared on legitimate O5 advance.
- [ ] A sale rep completes lead→(lost|enrolled) entirely in the UI: create, search by phone, advance, mark lost, reopen.
- [ ] Every money mutation (refundCreate, receiptCreate) and every CRM stage-change writes AuditLog.
- [ ] Approved receipt without opportunity auto-creates/links Opportunity at O5 — funnel covers all revenue.
- [ ] Funnel/byStage counts exclude lost; lost is filterable.
- [ ] Entrance TestAppointment attaches to Opportunity pre-payment; O3/O4 sync from appointment lifecycle; UI exists.
- [ ] `Contact@@unique(facilityId, phone)` enforced after dedup migration.
- [ ] Aftersale + parent-meeting screens operate against existing backends (list procedures added); stubs gone.
- [ ] Opportunity has assignedToId (FK AppUser) with coded ownership rules + source; `ParentMeeting.remindedAt` dropped; studentId FKs added on ParentMeeting/TestAppointment/AfterSaleCase.
- [ ] `pnpm -F @cmc/api test`, `pnpm -F @cmc/admin test`, typecheck, lint green; `gitnexus_detect_changes` scope matches phase files.

## Red Team Review

### Session — 2026-07-20
**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope & Complexity Critic (4× code-reviewer, hostile, evidence-gated)
**Findings:** 30 raw → 15 deduplicated clusters (15 accepted — 4 as modified, 0 rejected; every cluster carried file:line evidence)
**Severity breakdown:** 3 Critical, 8 High, 4 Medium
**Reports:** `reports/from-code-reviewer-to-planner-red-team-*-plan-review-report.md`, `reports/rt-failure-260720-2253-*.md`

| # | Finding (deduped cluster) | Severity | Disposition | Applied To |
|---|---------------------------|----------|-------------|------------|
| 1 | Phase 1 duplicated shipped C1 remediation; wrong paths (enrollment/activate-enrollment.ts, reconcile-orphaned-receipts.ts) | Critical | Accept | Phase 1 (rewritten) |
| 2 | Phase 1 layer-2 force-withdraw contradicted LOCKED void-vs-cancel semantics | Critical | Accept | Phase 1 (flag-only, no auto-withdraw) |
| 3 | Phase 5 ordering false (provisioning runs AFTER money tx) + `ParentAccount.name` does not exist | Critical | Accept | Phase 5 (rewritten) |
| 4 | Phase 1 missed Guardian/StudentAccount unguarded steps | High | Accept | Phase 1 |
| 5 | Phase 1 cleanup outside withFacility → silent RLS no-op | High | Accept | Phase 1 |
| 6 | Phase 2 approve-gate TOCTOU open without FOR UPDATE | High | Accept | Phase 2 |
| 7 | Phase 5/8 normalizer `normalizeContactPhone` doesn't exist; Contact stored raw | High | Accept | Phase 8 (creates it), Phase 5 (dep) |
| 8 | Phase 7 relaxed CHECK = permanent integrity hole | High | Accept | Phase 7 (strict CHECK + backfill/retype) |
| 9 | Phase 7 migration forward-only, type free-text unvalidated | High | Accept | Phase 7 |
| 10 | plan.md false "takes over premium phase-08" claim (phase-08 = network-ip only) | High | Accept | plan.md, Phase 9 |
| 11 | Phase 10 `opportunityAssign` impossible under role-only `can()` — escalation or dead key | High | Accept | Phase 10 (coded row-level rule) |
| 12 | Phase 10 over-bundled; OpportunityNote beyond PO decision #3 | High | Accept (modified: notes CUT, rest stays one phase) | Phase 10 |
| 13 | Phase 6 pipelineStats redundant + default `include` bakes F7 bug in; cross-phase input churn | Medium | Accept (fold into opportunityList in Phase 3; default `exclude`) | Phases 3, 6 |
| 14 | Phase 9 scope creep (periodic tab, speculative student.search) + Phase 5 replay-test phantom | Medium | Accept (cut; use student.lookup; drop phantom test) | Phases 9, 5 |
| 15 | Phase 4 blanket per-router checklist tests disproportionate; Phase 8 migration mechanics (DO-block, no CONCURRENTLY) | Medium | Accept (modified: shared helper + one parameterized test; DO-block guard) | Phases 4, 8 |

### Session — 2026-07-20 (round 2, post-rewrite verification)
**Reviewers:** Failure Mode Analyst + Flow Tracer; Assumption Destroyer + Fact Checker (2× code-reviewer)
**Findings:** 7 raw → 6 deduplicated (6 accepted, 0 rejected). Round-1 fixes independently re-verified as closed; all round-1 file:line citations in rewritten phases confirmed accurate.
**Severity breakdown:** 1 Critical, 2 High (+1 High dup of a Medium), 2 Medium/Low
**Reports:** `reports/from-code-reviewer-to-planner-red-team-round2-*.md`

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| R2-1 | New flag kind violates `ReconciliationFlag_kind_check` CHECK (migration 20260715160000:8) — runtime 23514, "no migration" claim false | Critical | Accept | Phase 1 (CHECK-extension migration added) |
| R2-2 | Guardian/StudentAccount steps NOT under withFacility — guard mechanism had no tx; bare read = RLS no-op | High | Accept | Phase 1 (withFacility wrap) |
| R2-3 | `opportunityMarkLost` can stamp lostReason onto O5 (unlocked, no stage check — even sequentially) | High | Accept | Phase 2 (O5 hard-reject + FOR UPDATE; auto-resolved reject-vs-noop: receiptCancel is the sanctioned undo path) |
| R2-4 | Walk-in auto-link positioned AFTER the once-only advance block → linked opp strands at O2 | High (dup Medium) | Accept | Phase 5 (block moved BEFORE advance; single O5-writer preserved) |
| R2-5 | Phase 4 stale "checklist test per router" risk line contradicts accepted #15 | Medium | Accept | Phase 4 |
| R2-6 | Dependency narrative under-declared (3→8/9, 1,2→4, 4→7); normalizer form/location note | Low | Accept | plan.md, phase-07 deps, phase-08 |

### Whole-Plan Consistency Sweep (round 2)
Deltas propagated: phase 1 (migration file added to Related Code Files, rollback claim corrected, withFacility wraps); phase 2 (bidirectional lost-gate, test (e), success criterion both-directions); phase 5 (ordering inverted, both branches funnel through the single existing advance block, test (b) asserts no-strand); phase 4 wording; phase 7 deps [3,4]; phase 8 normalizer domain/form note; plan.md dependency fan-out. Grep sweep: no remaining "after the existing opportunity-advance block", no "no migration" claim in phase 1, no per-router checklist language. Zero unresolved contradictions.

### Session — 2026-07-21 (round 3, final gate)
**Reviewer:** combined Failure Mode + Fact Checker (1× code-reviewer, hostile, evidence-gated)
**Result:** all round-2 deltas verified correctly applied; every citation in phases 1/2/5/7/8 re-verified against live code; cross-file dependency matrix consistent; **VERDICT — CRITICAL: 0, HIGH: 0**. One Low (contradictory normalizer home dir in phase 8) fixed post-verdict: `normalizeContactPhone` lives in `apps/api/src/crm/`.
**Report:** `reports/from-code-reviewer-to-planner-red-team-round3-final-verification-plan-review-report.md`
**Loop status:** red-team → validate → red-team mandate SATISFIED (3 rounds, 15+6+1 findings adjudicated, 0 Critical/High remaining). Plan is implementation-eligible.

## Validation Log

### Session 1 — 2026-07-20 (post red-team round 1)
**Questions asked:** 4 (mode=prompt, range 3-8). Verification pass skipped per guard — Red Team Review already carries file:line evidence.

| # | Decision point | PO answer | Propagated to |
|---|----------------|-----------|---------------|
| 1 | Walk-in Contact name (Receipt has no parent-name field) | Placeholder `"PH <studentName>"`; no schema addition | Phase 5 (as written) |
| 2 | Entrance test scheduling while opp at O1_LEAD | **Rejected** — sale must advance to O2 first (one-step rule intact) | Phase 7 success criteria |
| 3 | Destructive Contact dedup migration mode | Automatic rule-based merge (keep-oldest, >5% abort guard, staging dry-run, pre-migration backup) | Phase 8 (as written) |
| 4 | Post-sale audit rows (meeting/appointment/afterSale) | **Deferred** — audit money + CRM-stage only; F9 deliberately part-open for post-sale until after go-live | Phase 4 (rescoped, effort 2-3h) |

**Recommendation:** proceed — pending red-team round 2 confirmation (loop mandate: repeat until 0 Critical/High).

#### Whole-Plan Consistency Sweep (validation session 1)
Deltas propagated: post-sale audit language removed/marked deferred in phase 4 (overview, requirements, files, steps, criteria, effort); phase 7 audit line rewritten (appointment mutation unaudited, stage-sync advance still emits CRM audit via shared helper); phase 7 O1-schedule = rejected. Grep sweep over plan.md + 10 phases: zero unresolved contradictions (sole remaining "phase 4 pattern" ref is `opportunityAssign` — in-scope CRM mutation).

## Red Team Review — Consistency Sweeps

### Whole-Plan Consistency Sweep (round 1)
Delta list applied across all files: execution order 8→5; `opportunityList` contract consolidated into Phase 3 (Phase 6 UI-only); no `pipelineStats` procedure anywhere; no OpportunityNote/noteAdd/noteList anywhere; no auto-withdraw language in Phase 1; no `ParentAccount.name` reference; premium phase-08 claim removed; `remindedAt` evidence corrected (payload passthrough, no readers) + Phase 9 UI must ignore it; strict CHECK wording in Phase 7; correct file paths (`apps/api/src/enrollment/activate-enrollment.ts`, `apps/api/src/worker/reconcile-orphaned-receipts.ts`). Swept plan.md + all 10 phase files — zero unresolved contradictions.
