---
title: "ERP Prototype UI Alignment — Sale to Student Flow"
description: "Align the admin ERP UI with the approved Jul-7 prototype for the Sale→student journey: opportunity-prefilled receipts, unified Ghi danh entry, approve-screen transparency, 4-group nav with deferred roles hidden, role cockpits. Backed fields only; Odoo-vision fields deferred. TDD: lock money-gate/SoD/RLS contracts first."
status: done
priority: P1
branch: "main"
tags: [ui, erp, sale-flow, prototype-alignment, tdd]
blockedBy: []
blocks: []
created: "2026-07-08T13:25:50.271Z"
createdBy: "ck:plan"
source: skill
---

# ERP Prototype UI Alignment — Sale to Student Flow

## Overview

The shipped admin ERP drifted from the approved prototype (`Thiết kế UIUX LMS và ERP`, 2026-07-07).
The friction the user reported ("luồng Sale → học sinh quá nhiều khâu, UI rườm rà") is exactly that
gap. This plan closes the **backed** portion of the gap — presentation, data reuse, and nav — WITHOUT
touching the financial control model. Non-backed prototype fields (order-lines, MPOS, pricelist/tax,
e-invoice, promotions, gender/profile/member-rank demographics) are explicitly **deferred** per the
brainstorm FINAL SCOPE DECISION.

Source of truth: `plans/reports/brainstorm-260708-1454-erp-prototype-alignment-sale-flow-report.md`.

**TDD framing:** each phase writes/confirms tests that lock current behavior (especially the money-gate,
second-eye, RLS, funnel integrity) BEFORE changing code, then adds tests for the new behavior. Backend
contracts are locked first (Phase 1) because most UI phases only re-present data those contracts return.

## Hard Constraints (locked by tests, never changed)

- **ADR-B money-gate SoD** — sale creates `draft` ≠ director approves. `apps/api/src/finance/router.ts`.
- **Second-eye threshold** — 20M VND; only `giam_doc_dao_tao` + `super_admin` approve above it
  (`finance/router.ts:41,214`, strict `>`). UI reads it from `session.me.config.approvalSecondEyeThreshold`.
- **Money-gated enrollment** — `O5_ENROLLED` only via `finance.receiptApprove`; never a manual advance
  (`crm/router.ts:122-124`).
- **RLS / facility scoping** — every query/mutation stays `scoped(ctx)`.
- **Funnel stage integrity** — O1→O4 linear advance stays server-enforced (`crm/router.ts:130-136`).

## Ground-Truth Corrections (from scout, refine the report)

- **G7 is largely DONE.** `receipt-detail.tsx:166-171` already renders the over-threshold banner from
  `me.config.approvalSecondEyeThreshold`. Remaining G7 = dedup warning surfacing only.
- **G5 is partially DONE.** The approve `ConfirmDialog` (`receipt-detail.tsx:275`) already lists the
  automation ("tự động tạo tài khoản LMS và gửi email"). Remaining G5 = an always-visible pre-approval
  explainer box (prototype shows it before the click) + fuller automation wording.
- **G6 nav caveat.** "Nhân sự" (hr) appears because `checkIn.punch` is granted to ALL 8 staff roles
  (`packages/auth/src/index.ts:128`), so permission-gating alone won't hide it. Hiding hr per ADR-D
  requires an explicit nav-registry restructure, not a permission tweak.
- **Cockpit filter bug (D-UI-1)** confirmed: `cockpit.tsx` filters `status === 'pending'`; enum is
  `draft/approved/sent/cancelled` — always 0.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Lock-Contracts-And-Prefill](./phase-01-lock-contracts-and-prefill.md) | Done |
| 2 | [Enroll-Entry-And-Approve-Transparency](./phase-02-enroll-entry-and-approve-transparency.md) | Done |
| 3 | [Nav-Consolidation-Role-Gating](./phase-03-nav-consolidation-role-gating.md) | Done |
| 4 | [Role-Cockpit-Task-Queues](./phase-04-role-cockpit-task-queues.md) | Done |

**Order rationale:** P0 quick wins (Ph1) → money-flow UX (Ph2) → nav restructure (Ph3, touches every
route) → cockpits (Ph4). Land Ph1/Ph2 before Ph3 nav change to avoid churn.

## Acceptance Criteria (whole plan)

- [x] Sale creates a student from an O4 opportunity WITHOUT re-typing contact data (name/phone/email prefilled).
- [x] A single "+ Ghi danh" entry launches the prefilled receipt-from-opportunity flow.
- [x] Approve screen shows, before the click, an always-visible plain-language box of what activation does.
- [x] Dedup (existing-phone) warning surfaces non-blocking on receipt create.
- [x] Receipt detail shows class **code**, not a raw uuid.
- [x] Cockpit "Phiếu thu chờ duyệt" counts real draft receipts (not 0).
- [x] Nav shows prototype's 4 groups; "Nhân sự"(hr) hidden; students under "Lớp & Học sinh".
- [x] Role cockpit shows the full panel (stat cards + "Việc cần bạn xử" queue + O1→O5 pipeline side panel) per active role.
- [x] `pnpm test` green — ADR-B, second-eye, money-gate, RLS, funnel tests unchanged and passing.
- [x] `pnpm --filter @cmc/admin typecheck` + `build` clean.

## Out of Scope (deferred — separate product + schema decision)

Order-lines, pricelist/tax engine, MPOS payment method, e-invoice (sinvoice), promotions, member rank,
gender, profile type (B2C). Also **G6 side-effect stage-advancement** (auto-advance O3 on test scheduled,
etc.) — backend semantics change; this plan only de-emphasizes the CRM Kanban visually and keeps manual
advance. Revisit after go-live.

## Dependencies

- Related: `plans/260707-2308-golive-sprint-land-sso-env-uat/` — its Phase-3 UAT Section 2 lists deferred
  roles (cskh/ctv_mkt/hr) as if active. This plan's G1/G6 (hide deferred roles in nav) is the UI-layer
  counterpart of the report's recommended UAT trim. No file overlap; not a hard blocker.

## Validation Log

### Verification Results (Session 1)
- Tier: Standard (4 phases → Fact Checker + Contract Verifier)
- Claims checked: ~14 · Verified: 14 · Failed: 0 · Unverified: 0
- Evidence: `duplicatePhoneWarning` @ `packages/domain-finance/src/duplicate-phone.ts` (exported via index);
  `finance.receiptGet` gated + RLS-scoped (`finance/router.ts:588`), `Receipt.classBatch` relation exists
  (`schema.prisma:336`) → class-code join feasible; `crm.opportunityLookup` roster `[GĐKD, sale, ke_toan]`
  (`index.ts:43`) == `finance.receiptCreate` roster → dedup reuse permission-safe; `checkIn.punch` granted
  to all 8 roles (`index.ts:128`); `cockpit.tsx` filters non-existent `'pending'`; `submission.listForGrading`
  + students route exist. **0 failures → plan eligible for implementation.**

### Decisions (Session 1)
1. **UI testing:** Defer frontend component tests. Lock testable logic at the API layer (opportunityGet,
   dedup existence, counter predicate as a pure fn) + typecheck + manual verify for pure-UI. No RTL harness
   this round. → applies to all UI phases.
2. **Dedup endpoint (Ph2/G7):** REUSE `crm.opportunityLookup` (`{ exists }` by phone). Roster verified to
   match the receipt-create actor's — no new endpoint, no permission widening. Removes the Ph2 fallback
   ambiguity.
3. **G6 stage-advance:** Defer FULLY. Keep manual advance; only de-emphasize CRM Kanban visually. No
   backend funnel-semantics change this plan. (Confirms existing Out-of-Scope.)
4. **Cockpit depth (Ph4/G4):** FULL PANEL — role "Việc cần bạn xử" queue **+ stat cards + pipeline O1→O5
   side panel** per active role, matching the prototype cockpit. (Upgrades Ph4 from the light queue-only
   scope; still uses only existing endpoints, all `canDo`-gated.)

<!-- Updated: Validation Session 1 — Ph2 dedup locked to opportunityLookup; Ph4 upgraded to full panel -->
<!-- Whole-Plan Consistency Sweep: see below -->

### Whole-Plan Consistency Sweep (Session 1)
- Ph2 "or add `finance.parentPhoneExists`" fallback → removed; locked to `crm.opportunityLookup` reuse.
- Ph4 "queue + counts + deep-links only" / "richer panels are a follow-up" → upgraded to full panel
  (stats + pipeline) per Decision 4.
- G6 defer statement consistent across plan.md Out-of-Scope + Ph3. No contradiction.
- No stale API/file/field names remain. **0 unresolved contradictions.**
