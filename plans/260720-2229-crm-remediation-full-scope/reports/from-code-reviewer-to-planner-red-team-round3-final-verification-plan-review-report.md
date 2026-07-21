# Red-Team Round 3 — Final-Gate Verification: CRM Remediation Full-Scope Plan

Hostile final-gate review (Failure Mode + Fact Checker). Scope: verify round-2 deltas correctly applied and internally consistent; hunt surviving/new Critical/High. Read plan.md + all 10 phase files; grep/read verified against the live codebase. Read-only advisory.

## Verification results (lead's 5 required checks)

### 1. Phase 1 — PASS
- CHECK-extension migration listed (phase-01:24, 32). Real constraint confirmed: `packages/db/prisma/migrations/20260715160000_c1_reconciliation_flag_cancelled_kind/migration.sql:8` holds 5 allowed kinds, drop/add pattern present — plan's "extend the CHECK, following the prior kind-addition precedent" is accurate.
- withFacility reality matches code: `provision-from-receipt.ts:165` `findOrCreateStudent` runs `await withFacility(...)`; Guardian step `findOrCreateGuardian(db, ...)` at `:328` and StudentAccount `findOrCreateStudentAccount(db, ...)` at `:343` are bare `db` calls (auto-commit, no tx). Plan's wrap prescription is correct.
- Abort-handler flag emission: plan requires the flag write in its own `withFacility` tx (phase-01:25); confirmed the existing abort audit at `finance/router.ts:895` uses bare `ctx.db.auditLog.create` (AuditLog is global/non-RLS, so it works) — the nuance that the RLS-protected ReconciliationFlag needs withFacility is correct.
- No auto-withdraw language anywhere in Phase 1 (grep clean; :18, :23, :45 explicitly flag-only).

### 2. Phase 2 — PASS
- Both directions closed: approve gate replaces the plain `findFirst` at `finance/router.ts:320` with `SELECT ... FOR UPDATE` (phase-02:22, 38); markLost O5 hard-reject + FOR UPDATE (phase-02:23). Live code confirms markLost at `crm/router.ts:171-174` writes `lostReason+closedAt` unconditionally with no stage check, read via unlocked `findOpportunityOrThrow` (:155) — the flaw the delta closes.
- receiptCancel-reverts-O5→O4 claim verified: `finance/router.ts:434-453` locks the opp `FOR UPDATE` (:434-438) and, when it is the sole approved receipt, writes `stage: 'O4_TESTED', closedAt: null` (:448). Supports the "reject-over-noop, receiptCancel is the sanctioned undo" rationale. (Revert is correctly conditional on no other approved receipt — does not undermine the rationale.)
- Tests (a)-(e) coherent with both gates and the lostReason-clear; sibling-O5 no-overwrite preserved (:334 guard confirmed).

### 3. Phase 5 — PASS
- Walk-in block placed BEFORE the advance block; advance block gate `if (approved.opportunityId)` confirmed at `finance/router.ts:319`, fires once (phase-05:21).
- In-memory `approved.opportunityId` update called out (phase-05:23-24); confirmed `approved` is a full `findFirstOrThrow` at `:314` carrying `opportunityId`/`parentPhone`/`studentName`, so both the row and in-memory update are needed and sound.
- Both link and create branches funnel through the single existing advance block (phase-05:23-24); test (b) asserts no O2-stranding (phase-05:36).
- No stale "after the advance block" text (grep clean). Idempotency/no-replay claim (phase-05:27) matches the single-shot atomic claim at `finance/router.ts:304-313`.

### 4. Cross-file dependencies — PASS
Frontmatter vs narrative (plan.md:45) vs execution order 1→2→3→4→8→5→6→7→9→10 all consistent:
| Phase | frontmatter deps | narrative | order-valid |
|---|---|---|---|
| 4 | [1, 2] | 1,2→4 | yes |
| 5 | [2, 8] | 2,8→5 | yes |
| 6 | [3] | 3→6 | yes |
| 7 | [3, 4] | 3→7, 4→7 | yes |
| 8 | [3] | 3→8 | yes |
| 9 | [3] | 3→9 | yes |
| 10 | [3, 5, 7] | 5,7→10, 3→10 | yes |
Every dependency precedes its dependent in the linear order. No mismatch.

### 5. Fresh-eyes Critical/High hunt — none found
Phase 4 stale "checklist test per router" line correctly negated (phase-04:35 "NOT a bespoke checklist test per router file"). Phase 7 evidence confirmed (`appointment/router.ts:3-4` invariant comment, `:12-16` scheduleInput requires studentId). Phase 8 normalizer claim confirmed against source: `packages/domain-identity/src/normalize-login-phone.ts:3-4` comment explicitly anticipates CRM's `normalizeContactPhone` (`+84` form, "lives with the CRM domain when it exists"); CRM stores raw `input.phone` at `crm/router.ts:92,94` with no P2002 catch (the race the phase fixes).

---

## Finding 1: Phase 8 states two contradictory home directories for `normalizeContactPhone`
Severity: Low (informational — does not affect verdict)
Location: `phase-08-p2-contact-unique-phone.md:24` vs `:42`
Flaw: Line 24 says create it "co-located with `normalize-login-phone.ts`" — that file lives in `packages/domain-identity/src/`. Line 42 says "it lives with the CRM domain (`apps/api/src/crm/`)". Line 38 adds a third option ("from provisioning util or extract to packages/domain-*/local util"). Three location statements, two of them mutually exclusive.
Failure scenario: Implementer places the util in `packages/domain-identity` per line 24; Phase 5 (`phase-05:32`) and the CRM domain expect it in `apps/api/src/crm/`. Both compile, but it fragments the "single normalizer" DRY goal and mildly complicates the Phase 5 import. No runtime defect.
Evidence: Source-of-truth comment `packages/domain-identity/src/normalize-login-phone.ts:3-4` = "lives with the CRM domain when it exists" — authoritative intent matches line 42.
Suggested fix: Reword phase-08:24 from "co-located with normalize-login-phone.ts" to "as a CRM-domain sibling of the login normalizer (apps/api/src/crm/), per that file's guidance comment"; drop the packages/domain-* option at :38.

---

## Notes (non-blocking, no action required)
- Phase 4 provisioning-success audit row (phase-04:21 "inside the same transaction as the mutation" vs :36 "written by the final step, idempotent") — provisioning has no single tx by design (ADR 0041 per-step commit); the :36 wording governs and is correct. No contradiction in effect.
- Phase 7 O2→O3/O3→O4 sync uses re-read via `findOpportunityOrThrow` (plain read, not FOR UPDATE); acceptable because double-advance is idempotent (target-stage no-op), unlike Phase 2's O5 case which needs the lock. Correctly scoped.

Status: DONE
Summary: All round-2 deltas correctly applied and internally consistent; every plan file:line citation for Phases 1/2/5/7/8 verified against live code. Zero surviving or newly-introduced Critical/High. One Low wording inconsistency (Phase 8 normalizer location).

VERDICT — CRITICAL: 0, HIGH: 0
