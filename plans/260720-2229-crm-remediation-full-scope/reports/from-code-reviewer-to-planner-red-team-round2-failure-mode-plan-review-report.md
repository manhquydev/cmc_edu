# Red-team round 2 — Failure Mode + Flow Trace review

Plan: `260720-2229-crm-remediation-full-scope`. Read-only advisory. Round-1 fixes verified where claimed; findings below are NEW holes surviving the rewrite, each grounded in code read in-session.

Round-1 closures confirmed (not re-reported): Phase 1 no longer duplicates the shipped C1 remediation and drops the void-violating force-withdraw; Phase 5 no longer references `ParentAccount.name` and its provisioning-order premise is corrected; Contact IS facility-RLS'd (migration `20260706054322_p1_remediation_wave1_schema_rls`:105-108) and `runMoneyTransaction` runs under `withFacility` (finance/router.ts:863), so Phase 5's walk-in Contact insert passes RLS; the H5 partial-unique is keyed on `(facilityId, receiptId, kind)` WHERE open (migration `20260715170000`:31-33), so abort-handler + reconciler double-emission of the SAME kind dedups and the new kind coexists with `cancelled_receipt_active_enrollment` — the double-flag concern is genuinely closed. Phase 2's approve-side FOR UPDATE follows the same Receipt→Opportunity lock order as the cancel path (finance/router.ts:304 then :320-ish vs :415 then :434) — no deadlock.

---

## Finding 1: Phase 1 new flag kind violates the ReconciliationFlag CHECK constraint; plan says "no migration"
**Severity:** Critical
**Location:** phase-01 lines 23-24, 31, 43, 50 ("Rollback ... no migration"); plan.md:51. Constraint: migration `20260715160000_c1_reconciliation_flag_cancelled_kind/migration.sql`:7-8.
**Flaw:** `ReconciliationFlag.kind` is guarded by `ReconciliationFlag_kind_check CHECK (kind IN ('self_approved','exceeds_threshold','excess_refunds','missing_provisioning','cancelled_receipt_active_enrollment'))`. Phase 1 emits a brand-new kind `cancelled_receipt_partial_provisioning` from BOTH the abort handler and the reconciler, but lists no migration and its Rollback note asserts "no migration." Adding a new kind REQUIRES a migration extending this CHECK — that is exactly what migration `20260715160000` did for the previous new kind.
**Failure scenario:** At runtime the flag INSERT fails with a CHECK violation (SQLSTATE 23514), which is NOT a P2002 — the `maybeCreateFlag` P2002-catch does not swallow it. In the reconciler this throws per-row and aborts the scan; in the abort handler (inside `receiptApprove`'s catch, finance/router.ts:886-916) the throw escapes the intended clean-abort path and surfaces as a 500 to the approving user, or leaves provisioning state inconsistent. The phase's core deliverable (make the partial state visible) never lands.
**Evidence file:line:** `packages/db/prisma/migrations/20260715160000_.../migration.sql:8` (allowed set); phase-01-p0-cancel-provisioning-race-fix.md:50 ("no migration").
**Suggested fix:** Add a migration to Phase 1 that DROP/ADD `ReconciliationFlag_kind_check` including `cancelled_receipt_partial_provisioning`; remove the "no migration" rollback claim (rollback = revert app code AND drop/re-add the CHECK to the prior 5-kind set).

---

## Finding 2: Phase 1 falsely asserts the Guardian and StudentAccount steps "already run under withFacility"
**Severity:** High
**Location:** phase-01 line 22 ("Inside each step's own transaction (they already run under `withFacility` — verify per step) ... `findOrCreateStudent`, the standalone Guardian step, and the StudentAccount step").
**Flaw:** Only `findOrCreateStudent` actually runs under `withFacility` (provision-from-receipt.ts:165). The standalone Guardian step (`findOrCreateGuardian(db, ...)`, called with plain `db` at :328) and the StudentAccount step (`findOrCreateStudentAccount(db, ...)` at :343) are single auto-committed plain-client statements — NOT inside any transaction. StudentAccount additionally carries no `facilityId` column at all (:245-251). The prescribed guard "re-read `Receipt.status` with `FOR SHARE` inside the step's own transaction" has no transaction to attach to for 2 of the 3 named steps.
**Failure scenario:** An implementer trusting "they already run under withFacility" adds a `FOR SHARE` Receipt read as a separate plain-`db` statement. Receipt is RLS-protected; a plain `ctx.db` read with no facility GUC set returns ZERO rows → the guard either always throws (breaks every approve) or is a no-op with the TOCTOU wide open. The "verify per step" hedge does not rescue this because the requirement's whole mechanism is premised on a transaction that does not exist.
**Evidence file:line:** `apps/api/src/provisioning/provision-from-receipt.ts:328` (Guardian, plain db), :343 (StudentAccount, plain db), :232-252 (StudentAccount has no facilityId); contrast :165 (Student under withFacility).
**Suggested fix:** Rewrite requirement 1 to state that the Guardian and StudentAccount steps must be WRAPPED in a new `withFacility(db, receipt.facilityId, tx => ...)` block (setting the GUC so a `FOR SHARE` read of the RLS'd Receipt returns the row), with the create moved inside; note StudentAccount's write itself is facility-agnostic but the guard read is not. Or fold both into the same guarded tx as the Student step.

---

## Finding 3: Phase 2 leaves opportunityMarkLost able to stamp lostReason onto an O5 opportunity — reverse TOCTOU still open (and broken even sequentially)
**Severity:** High
**Location:** phase-02 requirement (b) + success criterion "Grep proves no O5 write path leaves lostReason non-null" + step 3b concurrency test. Unfixed code: crm/router.ts:167-174.
**Flaw:** Phase 2 hardens only the approve/finance direction (FOR UPDATE on the opportunity before the O5 write, plus clearing `lostReason` on advance). It does not touch `opportunityMarkLost`, which does `findOpportunityOrThrow` (no lock) then UNCONDITIONALLY sets `lostReason` + `closedAt` with NO stage check (:171-174). A markLost on any O5 opportunity therefore still produces the exact "O5 + lostReason" corrupt row the phase targets — this is not even purely a race: marking an already-enrolled O5 opp lost corrupts it directly.
**Failure scenario:** Approve wins the FOR UPDATE, advances the opp to O5 and clears lostReason, commits. A concurrent (or subsequent) `opportunityMarkLost` — whose plain SELECT read stage=O2 before, or which is simply called on the now-O5 opp — runs its unconditional UPDATE and stamps `lostReason`+`closedAt` onto the O5 row. Phase 2's step-3b test ("no O5-with-lostReason row possible") is unsatisfiable against the described implementation; the implementer must add a stage guard to markLost that the requirements never call for.
**Evidence file:line:** `apps/api/src/crm/router.ts:171-174` (unconditional lostReason write, no stage check, no FOR UPDATE); phase-02-p0-lost-opportunity-receipt-gate.md:22,37,42.
**Suggested fix:** Extend Phase 2 to harden `opportunityMarkLost`: acquire the opportunity `FOR UPDATE` and reject (or no-op) when `stage == 'O5_ENROLLED'` (an enrolled opp cannot be "lost"). This closes the symmetric direction the receipt-side gate cannot.

---

## Finding 4: Phase 5 link-existing branch — "let the existing O5-advance block run" is ordering-impossible; linked opp stays un-advanced
**Severity:** Medium
**Location:** phase-05 requirement 2 ("set `receipt.opportunityId` to it and let the existing O5-advance block run").
**Flaw:** The existing O5-advance block (finance/router.ts:319-338) runs at the TOP of `runMoneyTransaction`, gated on `approved.opportunityId`. For a walk-in receipt `opportunityId` is null there, so the block is skipped. Phase 5 places its walk-in block AFTER the advance block ("after the existing opportunity-advance block, same transaction"). Setting `receipt.opportunityId` in the walk-in block cannot make an already-executed, already-skipped block "run" again.
**Failure scenario:** A walk-in receipt matched to an existing OPEN opportunity at O2 gets `receipt.opportunityId` linked but the opp is never advanced to O5 — it stays at O2 with `closedAt` null. Funnel conversion (the stated intent: "lead conversion, attribution preserved") silently does not happen for the link-existing path. The create-new path (requirement 3) is unaffected because it writes `stage: O5_ENROLLED` directly.
**Evidence file:line:** `apps/api/src/finance/router.ts:319-338` (advance block position + null-guard); phase-05-p1-walk-in-auto-opportunity-o5.md:21-23.
**Suggested fix:** Have the walk-in block perform the O5 advance inline (same update shape as :330-336 with `lostReason: null` and closedAt-once semantics) rather than deferring to a block that already ran; or restructure so opportunity resolution precedes the advance block.

---

## Minor (non-blocking)
- Phase 7 frontmatter declares `dependencies: [3]` but its stage-sync audit reuses the `crm.opportunityAdvance` audit behavior CREATED in Phase 4 (phase-07 line 31). Execution order (…4…7…) keeps this safe, but the declared dependency omits 4 — add it so a reorder can't run 7 before 4.

## Unresolved questions
- Finding 3: does PO intend markLost on an O5 opp to be a hard reject or a silent no-op? Either closes the hole; the plan should state which.

Status: DONE_WITH_CONCERNS
