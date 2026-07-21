---
phase: 5
title: "P1 Walk-in auto-opportunity O5"
status: done
priority: P2
dependencies: [2, 8]
effort: "3-4h"
---

# Phase 5: P1 Walk-in auto-opportunity O5

> Rewritten after red-team 2026-07-20: original draft assumed `ParentAccount.name` exists (it does not — schema.prisma:424-437) and that provisioning runs before the money transaction (it runs AFTER — finance/router.ts:864 vs :876). Now depends on phase 8 (phone normalizer + Contact unique) landing FIRST.

## Overview
Finding F4 (HIGH), PO decision #1. Receipts without `opportunityId` are approvable and invisible to the CRM funnel. On **approve** of an unlinked receipt, auto-link (existing open opportunity for that phone) or auto-create Contact+Opportunity closed at O5.

## Verified execution order (governs design)
`finance.receiptApprove` → `runMoneyTransaction` commits (finance/router.ts:864) → `provisionFromReceipt` runs after (:876). At auto-create time NO ParentAccount/Student exists for a new family. **Contact.name can only come from Receipt fields** (`parentPhone`, `parentEmail?`, `studentName` — schema.prisma:329-333; there is no parent-name field). Naming rule: existing Contact keeps its name; auto-created Contact gets `"PH " + studentName` placeholder (documented limitation; editable later via normal CRM usage — no Contact-edit UI in this plan).

## Requirements
- Functional, inside `runMoneyTransaction`, **BEFORE the existing opportunity-advance block** (red-team round 2: that block is gated on `if (approved.opportunityId)` at finance/router.ts:319 and runs exactly once — setting opportunityId after it has passed can never advance the opp; the walk-in resolution must run first so the existing advance block then fires on the now-linked id):
  1. If `receipt.opportunityId == null`: normalize `parentPhone` with `normalizeContactPhone` (created in phase 8 — Contact rows are stored normalized from phase 8 onward) and find Contact by (facilityId, normalizedPhone) via the **shared `findOrCreateContact` helper extracted in phase 8** (single implementation with `crm.opportunityCreate` — no inline reimplementation in finance).
  2. Contact found AND has an open opportunity (`closedAt == null`): update `receipt.opportunityId` (row + in-memory `approved` object) to it — the existing O5-advance block, which runs NEXT, performs the advance (lead conversion, attribution preserved; single advance implementation, no duplicate O5-write logic). If multiple open opps, pick most recent `createdAt` (document).
  3. Else: `findOrCreateContact` (name per rule above, email := parentEmail) + create Opportunity at `O1_LEAD` equivalent shape but immediately linked — link receipt (row + in-memory) and let the same downstream advance block set `{stage: O5_ENROLLED, closedAt, lostReason: null}` (one O5-writer; the advance block's phase-2 hardening applies uniformly). `source: 'walkin'` column exists only after phase 10 — until then omit; phase 10 backfills via the audit rows below.
  4. Audit: extend the existing receiptApprove audit row data with `autoLinkedOpportunityId` | `autoCreatedOpportunityId`.
- Lost-consistency: a lost opportunity is never auto-linked (predicate from phase 2); a fresh one is created instead.
- Idempotency: approve is single-shot (draft-only atomic claim → second approve = CONFLICT, finance/router.ts:304-313) — **no replay path exists**; do not write replay tests for it (red-team: phantom test).
- Cancel interplay: cancelling an auto-created-O5 receipt follows existing revert rules (O5→O4 when sole approver) — opportunity remains as a normal record; add one test asserting no crash and sane end state.

## Related Code Files
- Modify: `apps/api/src/finance/router.ts` (runMoneyTransaction walk-in block)
- Reuse: `apps/api/src/crm/opportunity-lost.ts` (phase 2), `findOrCreateContact` + `normalizeContactPhone` (phase 8)
- Tests: `apps/api/src/finance/approve.test.ts` (+walk-in cases), `apps/api/src/finance/cancel-refund.test.ts` (auto-created cancel case)

## Implementation Steps (TDD)
1. Failing tests: (a) approve unlinked receipt, no matching contact → Contact (`PH <student>` name, normalized phone) + Opportunity created and ending at O5 via the shared advance block, receipt linked, closedAt set, lostReason null; (b) contact exists with open opp at O2 → linked AND advanced to O5 (asserts the ordering fix — opp must NOT strand at O2); (c) contact's only opp is lost → lost untouched, new opp created ending O5; (d) phone formatting variant of an existing contact → matches (normalizer), no duplicate Contact; (e) cancel of auto-created-O5 receipt → existing revert semantics, no error.
2. Implement block; wire audit data fields.
3. `gitnexus_impact` upstream on `runMoneyTransaction`; full finance suite; `gitnexus_detect_changes`.

## Success Criteria
- [ ] Invariant test: any newly-approved receipt ends with non-null `opportunityId`.
- [ ] Lead-conversion path preserves the lead's original createdAt/stage history.
- [ ] Exactly one Contact per (facility, normalized phone) across both writers (walk-in + opportunityCreate) — covered by (d) plus phase 8's concurrency test.
- [ ] No reference to ParentAccount naming anywhere in the implementation.

## Risk Assessment
- **Risk**: `"PH <student>"` placeholder names pollute Contact display — accepted trade-off (no parent-name source field exists); revisit only if PO adds parent name capture to receiptCreate.
- **Risk**: most-recent-open-opp pick links the "wrong" sibling lead — impact benign (both belong to same household/phone); documented.
- **Rollback**: logic revert; auto-created rows remain, correctly shaped.
