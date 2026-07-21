---
phase: 1
title: "P0 Cancel-provisioning race fix"
status: done
priority: P1
dependencies: []
effort: "3-4h"
---

# Phase 1: P0 Cancel-provisioning race fix

> Rewritten after red-team 2026-07-20: original draft duplicated the shipped C1 remediation, cited wrong file paths, and its force-withdraw cleanup contradicted the LOCKED void-vs-cancel semantics. Scope narrowed to what is actually missing.

## Overview
Finding F2 (CRITICAL), recalibrated. The cancel-vs-provisioning race is **already partially fixed**: the enrollment step holds a `FOR UPDATE` guard (`apps/api/src/enrollment/activate-enrollment.ts:106`, throws `ReceiptNoLongerApprovedError`), a reconciler backstop exists (`reconcileCancelledButProvisioned`, `apps/api/src/worker/reconcile-orphaned-receipts.ts:262`), and a concurrency test exists (`apps/api/src/finance/receipt-cancel-provisioning-race.test.ts`). **What remains unprotected:** the earlier self-committing steps — ParentAccount, Student(+Guardian), standalone Guardian (`provision-from-receipt.ts:328`), StudentAccount (`:343`) — can still durably commit AFTER `receiptCancel` flips the receipt, leaving a cancelled receipt with a half-provisioned, guardian-visible, login-capable child and no Enrollment; the existing reconciler scanner inner-joins an active Enrollment (`reconcile-orphaned-receipts.ts:225-228`) so it CANNOT see this state.

## Semantics constraint (LOCKED — do not violate)
Non-void cancel deliberately keeps the Student active with LMS access; only the seat (Enrollment) is withdrawn (`finance/router.ts:487-495`; `reconcile-orphaned-receipts.ts:190-195`). Therefore this phase must **NOT auto-withdraw** Students. The defect is the *inconsistent partial state* (e.g. Student without StudentAccount, no Enrollment, no reconciler visibility) — the fix is (a) stop new post-cancel commits, (b) make the partial state visible for staff decision.

## Requirements
- Functional:
  1. **Extend the in-transaction guard to every self-committing provisioning step.** Reality check (red-team round 2): ONLY `findOrCreateStudent` runs under `withFacility` (`provision-from-receipt.ts:165`); the standalone Guardian step (:328) and StudentAccount step (:343) are plain auto-committed `ctx.db` calls with no transaction — and StudentAccount has no facilityId column. Therefore: (a) `findOrCreateStudent` — add the `FOR SHARE` Receipt read inside its existing withFacility tx; (b) **wrap the Guardian and StudentAccount steps in a new `withFacility(receipt.facilityId)` block** so the guard's Receipt read passes RLS and the step + guard commit atomically (a bare `ctx.db` Receipt read has no facility GUC → returns zero rows → guard would always throw or silently no-op); (c) `findOrCreateParentAccount`: ParentAccount is global (not facility-RLS) — guard by a receipt-status read in the caller's facility context immediately before invoking, NOT inside (`provision-from-receipt.ts:94-128` has no facility tx). Throw `ReceiptNoLongerApprovedError` when status ≠ `approved` in all cases.
  2. **Reconciler branch for the partial state**: extend `reconcileCancelledButProvisioned` in `apps/api/src/worker/reconcile-orphaned-receipts.ts` (NOT reconcile-finance-flags.ts) with a second scan: cancelled receipt + Student exists via `createdByReceiptId` + **no** active Enrollment for that (student, classBatch) → emit `ReconciliationFlag` kind `cancelled_receipt_partial_provisioning` with deepLink. Flag only — no auto-withdraw (void semantics above). Respect the H5 partial-unique open-flag dedup (`maybeCreateFlag` P2002 no-op pattern).
  2b. **Migration REQUIRED for the new flag kind** (red-team round 2 CRITICAL): `ReconciliationFlag.kind` is locked by `ReconciliationFlag_kind_check` CHECK (migration 20260715160000/migration.sql:8, 5 allowed kinds) — inserting the new kind without DROP/ADD CHECK fails with 23514 at runtime (NOT a P2002 — `maybeCreateFlag`'s catch would not swallow it, and an abort-handler throw would escape as a 500 to the approver). Add a migration extending the CHECK with `cancelled_receipt_partial_provisioning`, following the precedent of the prior kind-addition migration.
  3. Abort marker unchanged (`provisioning.aborted_receipt_not_approved`) — but the abort handler additionally emits the same reconciliation flag so the partial state is visible immediately, not only on next worker run. The flag write must run in its own `withFacility` transaction (bare `ctx.db` writes outside RLS scope no-op silently — red-team, `finance/router.ts:876,895,906`).
- Non-functional: preserve ADR 0041 per-step idempotent replay; no behavior change for the void:true path (it already withdraws); zero changes to enrollment/activate-enrollment.ts guard semantics.

## Related Code Files
- Modify: `apps/api/src/provisioning/provision-from-receipt.ts` (per-step status guard; withFacility wrap for Guardian/StudentAccount steps)
- Modify: `apps/api/src/worker/reconcile-orphaned-receipts.ts` (partial-provisioning scan + flag kind)
- Modify: `apps/api/src/finance/router.ts` (abort handler flag emission, withFacility-wrapped)
- Create: migration extending `ReconciliationFlag_kind_check` with the new kind
- Tests: **extend** `apps/api/src/finance/receipt-cancel-provisioning-race.test.ts` (do NOT create a parallel cancel-race.test.ts) + reconciler test in the worker's existing test file

## Implementation Steps (TDD)
1. Baseline: run the existing race + reconciler suites green.
2. Failing test in receipt-cancel-provisioning-race.test.ts: cancel lands after money-commit but before `findOrCreateStudent` → resumed provisioning must abort BEFORE creating Student; assert no Student row, flag emitted.
3. Failing test: cancel lands after Student commit, before StudentAccount → StudentAccount/Guardian steps abort; partial state flagged `cancelled_receipt_partial_provisioning`; Student remains active (void semantics).
4. Implement per-step guards; implement reconciler branch; implement abort-handler flag.
5. Idempotency: double-run reconciler → one open flag (H5 unique).
6. `gitnexus_impact` upstream on `provisionFromReceipt` + `reconcileCancelledButProvisioned` before edits; full `pnpm -F @cmc/api test`; `gitnexus_detect_changes`.

## Success Criteria
- [ ] No provisioning step can durably create ParentAccount/Student/Guardian/StudentAccount after receipt leaves `approved` (race tests prove per-step).
- [ ] Partial states (pre-fix or residual window) surface as `cancelled_receipt_partial_provisioning` flags; no auto-withdraw anywhere in this phase.
- [ ] Existing C1 race test file extended, still green; no duplicate test file.
- [ ] void:true cancel behavior byte-identical to today.

## Risk Assessment
- **Risk**: residual check-then-commit window inside a step between FOR SHARE read and commit — closed for Student/Guardian/StudentAccount because the read shares the step's own transaction; ParentAccount retains a small window (global table, no tx context) — acceptable: a dangling ParentAccount is reusable-by-design (find-or-create by phone) and harmless without children links; documented.
- **Risk**: new flag kind unknown to admin UI — ReconciliationFlag list renders kind strings generically (verify at implementation; if enum-mapped, add label).
- **Rollback**: guards + flag branch revertible per commit; the CHECK-extension migration is additive-permissive (old kinds still valid) — rollback of app code is safe without reverting it.
