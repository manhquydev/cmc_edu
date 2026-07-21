# Red-Team (Failure Mode Analyst) — CRM remediation full-scope plan review

Perspective: Murphy's Law — races, data loss, migration failure, rollback holes. Every finding grep/read-verified against code. Focus hotspots: phases 1, 5, 7, 8.

Flow trace baseline (verified):
- `receiptApprove` commits money tx, THEN runs `provisionFromReceipt` in its own try/catch (finance/router.ts:863-876). Provisioning is strictly AFTER the money tx, never before.
- Provisioning order: ParentAccount → Student(+Guardian) → standalone Guardian → Enrollment → StudentAccount (provision-from-receipt.ts:326-347).
- `ReceiptNoLongerApprovedError` guard exists ONLY at the enrollment step (activate-enrollment.ts:101-107).
- `runCancelTransaction` is one atomic tx; withdraws Student lifecycle ONLY when `void:true` (finance/router.ts:487-495).

---

## Finding 1: Phase 1 layer 2 force-withdraws Students, reversing a locked PO decision
- **Severity:** Critical
- **Location:** phase-01 §Architecture layer 2 ("set lifecycle `withdrawn` + withdraw Enrollment ... same Student-withdraw logic as the cancel rollback")
- **Flaw:** The plan claims layer 2 mirrors "the normal cancel rollback exactly." It does not. `runCancelTransaction` withdraws the Student lifecycle ONLY when `voidFlag` is true (finance/router.ts:487-495); a genuine (non-void) cancel deliberately leaves the Student `active`. The locked product rule is explicit: "a cancelled receipt withdraws the class seat but keeps LMS access so the family can review history" (reconcile-orphaned-receipts.ts:190-195). Layer 2 unconditionally sets `lifecycle='withdrawn'`.
- **Failure scenario:** Sale/refund cancel (void=false) of a receipt whose provisioning aborted mid-flight. Cancel's own rollback correctly leaves the Student active (LMS history preserved). Layer 2 then fires in the provisioning catch and force-withdraws the Student — silently killing a family's LMS access that the PO decided to keep. If void=true, cancel already withdrew the Student, so layer 2 is pure redundancy. Layer 2's student-withdraw is therefore EITHER wrong (non-void) OR redundant (void) — never the correct fix.
- **Evidence:** finance/router.ts:487-495 (void-only student withdraw); reconcile-orphaned-receipts.ts:190-195 (PO keep-LMS decision).
- **Suggested fix:** Drop the student-withdraw from layer 2 entirely. The only orphan cleanup actually needed is the stray Enrollment (which in the abort case doesn't even exist yet). Do NOT touch Student lifecycle from a provisioning catch that cannot know the racing cancel's void intent.

## Finding 2: Phase 1 layer 3 targets the wrong file and duplicates an existing scanner
- **Severity:** High
- **Location:** phase-01 §Architecture layer 3 + §Related Code Files ("Modify: apps/api/src/worker/reconcile-finance-flags.ts (new flag kind)"; "same shape as existing `cancelled_receipt_active_enrollment`")
- **Flaw:** The `cancelled_receipt_active_enrollment` flag kind and its scanner (`reconcileCancelledButProvisioned`) already live in `reconcile-orphaned-receipts.ts:205-280` (flag emitted at :262), NOT in `reconcile-finance-flags.ts` (whose only kinds are self_approved / exceeds_threshold / excess_refunds / missing_provisioning, lines 6-10). Editing the wrong file risks a parallel reimplementation of a scanner that already exists.
- **Failure scenario:** Implementer adds a new scan to reconcile-finance-flags.ts modeled on a flag kind that isn't there, producing a second, divergent cancelled-receipt scanner. Worse: the plan's target orphan (Student active, NO enrollment) is exactly what the existing `reconcileCancelledButProvisioned` CANNOT detect — it inner-JOINs an `active` Enrollment (reconcile-orphaned-receipts.ts:225-228), so a receipt with no enrollment row is invisible to it. The plan doesn't note this, so a reviewer can't tell whether to extend the existing scanner or add a new predicate.
- **Evidence:** reconcile-orphaned-receipts.ts:205-280 (existing scanner + flag :262, active-enrollment JOIN :225-228); reconcile-finance-flags.ts:6-10 (kinds list, not incl. that flag).
- **Suggested fix:** Extend `reconcileCancelledButProvisioned` in reconcile-orphaned-receipts.ts with a LEFT-JOIN branch for "cancelled + resolved Student exists + no active enrollment," and correct the Related Code Files reference.

## Finding 3: Phase 5 evidence is false — ParentAccount has no name; Contact.name will always be a junk placeholder
- **Severity:** High
- **Location:** phase-05 §Evidence line 18 ("ParentAccount ... has a name field usable for Contact.name") + §Requirements #3 ("name := ParentAccount name when provisioning already resolved it")
- **Flaw:** ParentAccount has NO name column — only phone, email, passwordHash, timestamps, relations (schema.prisma:424-437). Two independent reasons the "ParentAccount name" branch is dead: (a) the field does not exist; (b) provisioning runs AFTER runMoneyTransaction commits (finance/router.ts:863 vs :876), while the phase-5 auto-create sits INSIDE runMoneyTransaction — so "when provisioning already resolved it" is never true at that point. Even if a name column existed, `findOrCreateParentAccount` only ever writes `{ phone }` / email (provision-from-receipt.ts:106,121-124), never a name.
- **Failure scenario:** Every walk-in auto-created Contact falls to the `"PH " + studentName` placeholder. The funnel the plan claims makes "100% revenue truth" is populated with unusable contact names (e.g. "PH Nguyen An"), and Contact edit UI is explicitly out of scope (phase-05 risk note) — so they stay junk. Directly undermines the sale-KPI attribution goal (plan decision #3).
- **Evidence:** schema.prisma:424-437 (no name); provision-from-receipt.ts:106,121-124 (name never written); finance/router.ts:863,876 (provisioning after money tx).
- **Suggested fix:** Capture a parent name at receiptCreate (Receipt currently has parentPhone/parentEmail/studentName only, schema.prisma:329-333) or accept the placeholder explicitly and drop the false "ParentAccount name" evidence and requirement branch.

## Finding 4: Phase 7 migration is not reversible and its CHECK sits on a free-text column
- **Severity:** High
- **Location:** phase-07 §Requirements (schema) + §Risk ("Rollback: ... down path = restore NOT NULL after backfill")
- **Flaw:** Two migration hazards. (1) Irreversible: once any pre-payment `entrance` appointment exists with `studentId=null` (the entire point of the redesign), the stated down-migration "restore NOT NULL" cannot run — those rows have no student to backfill. The "reversible notes inline" claim is false. (2) `TestAppointment.type` is a free `String` with no enum/DB constraint (schema.prisma:1535). A CHECK of the form `(type='entrance' AND opportunityId IS NOT NULL) OR (type='periodic' AND studentId IS NOT NULL)` will FAIL to create if any existing row has a type value other than those two literals; and the plan's own "relaxed CHECK to also accept `type='entrance' AND studentId IS NOT NULL`" lets NEW entrance rows be written with a studentId and no opportunityId, defeating the redesign it is meant to enforce.
- **Failure scenario:** Migration deploys, users schedule pre-payment entrance tests, then a rollback is attempted after an unrelated incident — the down path aborts on the NOT NULL restore, leaving the DB stuck mid-migration. Or the CHECK create aborts the whole migration on a single legacy row with a stray `type`.
- **Evidence:** schema.prisma:1531-1542 (studentId non-null, type free String, index is (facilityId, scheduledAt) not (facilityId, opportunityId)).
- **Suggested fix:** State plainly the migration is forward-only; gate `type` with an enum or a separate CHECK on allowed values FIRST; make the new-row CHECK strict (entrance ⇒ opportunityId NOT NULL) and handle legacy entrance rows via a nullable-tolerant partial constraint or a one-time backfill flag, not by permanently relaxing the invariant.

## Finding 5: Phase 1 layer 1 leaves the standalone Guardian and StudentAccount steps unguarded
- **Severity:** High
- **Location:** phase-01 §Architecture layer 1 ("before EACH committing step (createParentAccount, findOrCreateStudent) ...")
- **Flaw:** Layer 1 only re-checks receipt status before ParentAccount and Student. But provisioning also commits a standalone Guardian (provision-from-receipt.ts:328) and a StudentAccount (:343) AFTER the Student step and BEFORE the enrollment guard. Both are independent auto-committing writes. The plan's own requirement is "no later provisioning step may durably create ParentAccount/Student/**Guardian**" — layer 1 as scoped violates it.
- **Failure scenario:** Cancel commits in the window after Student commit but before the enrollment step. Student was created (and per Finding 1 correctly kept active by a non-void cancel). Provisioning continues past the unguarded standalone Guardian (:328) and StudentAccount (:343) calls, durably creating a Guardian + LMS login for a cancelled receipt, THEN the enrollment step throws. Result: a guardian-visible, login-capable child on a cancelled receipt — the exact F2 shape, only now created by steps layer 1 never checked.
- **Evidence:** provision-from-receipt.ts:328 (standalone guardian), :343 (studentAccount), :336 (enrollment — the only currently-guarded step).
- **Suggested fix:** Put the status re-check at the single entry (before provisioning does any write) AND immediately before enrollment, or gate every committing step. Note the existing `reconcileOrphanedReceipts` will happily REPLAY these steps for an approved receipt, so the guard must also stop replay from re-creating them for a since-cancelled receipt.

## Finding 6: Phase 8 depends on Phase 5, so the second Contact writer ships before the unique index — dedup fights itself
- **Severity:** Medium
- **Location:** phase-08 frontmatter `dependencies: [5]` + phase-05 §Risk ("interplay with phase 8 unique(facilityId, phone) ... sequence phases 5 → 8 or guard now")
- **Flaw:** Phase 5 introduces a second Contact writer (walk-in auto-create) and phase 8 (which adds the `@@unique(facilityId, phone)` + P2002 protection) is sequenced AFTER it. Until phase 8 lands, phase 5's "P2002-catch-refetch" has no constraint to catch — it is dead code, and the existing find-or-create is still a check-then-insert race (crm/router.ts:91-95).
- **Failure scenario:** Between phase 5 and phase 8 shipping, two concurrent approvals (or an approve racing an opportunityCreate) for the same new phone each find no Contact and both insert — duplicate Contacts with no guard. Phase 8's dedup migration then has to reconcile dupes that phase 5 itself manufactured, on live data.
- **Evidence:** crm/router.ts:91-95 (unguarded find-or-create); phase-08 depends-on 5; schema.prisma:258-269 (no unique on Contact today).
- **Suggested fix:** Land the unique index + P2002 handling (phase 8) BEFORE or in the same change as the phase-5 auto-create writer, not after.

## Finding 7: Phase 8 treats destructive data cleanup + schema change as one Prisma migration with conditional abort
- **Severity:** Medium
- **Location:** phase-08 §Requirements (single ordered migration: normalize → dedup → CREATE UNIQUE INDEX) + §Risk ("abort on unexpected dupe volume (>5% rows)", "wrap in transaction")
- **Flaw:** Prisma migrations are declarative forward SQL with no branching/conditional-abort; "abort if >5% of rows are dupes" is imperative logic that needs a procedural PL/pgSQL block or a manual pre-check step — the plan doesn't specify which. A combined bulk-DELETE + FK-repoint + CREATE UNIQUE INDEX on live Contact/Opportunity data takes heavy locks with no batching or lock_timeout plan.
- **Failure scenario:** Migration runs on production, dupe volume is higher than expected, but there is no mechanism to actually halt inside a plain SQL migration — it deletes anyway; or the CREATE UNIQUE INDEX blocks writes on a large table long enough to stall approvals. The "keep pre-migration dump per runbook" is the only stated rollback for a destructive delete — manual and easy to skip.
- **Evidence:** existing migrations are plain SQL dirs (packages/db/prisma/migrations/*); Contact→Opportunity FK at schema.prisma:274,281.
- **Suggested fix:** Split into (a) a data-cleanup step run/verified manually or via a guarded script with the >5% check, then (b) a separate `CREATE UNIQUE INDEX CONCURRENTLY` migration. Specify the exact normalizer function referenced (the plan says "document exact function" but doesn't name it).

## Finding 8: Phase 5's stated idempotency mechanism is unreachable
- **Severity:** Medium
- **Location:** phase-05 §Requirements non-functional ("idempotent under approve replay (opportunityId now set → block skipped)") + §Steps 1(d)
- **Flaw:** `receiptApprove` is not replayable in the first place: runMoneyTransaction's atomic claim `updateMany WHERE status='draft'` matches 0 rows on an already-approved receipt and throws CONFLICT (finance/router.ts:304-313) before ever reaching the O5/auto-create block. The "opportunityId now set → block skipped" guard the plan relies on for idempotency is dead — the money tx never re-executes. (Replay happens via `reconcileOrphanedReceipts`, which calls `provisionFromReceipt`, not runMoneyTransaction — so it never touches the auto-create block at all.)
- **Failure scenario:** Not a runtime bug, but the plan will drive test 1(d) ("approve replay → no duplicate opp") to assert protection from a mechanism that isn't exercised, giving false confidence — a phantom test that passes because the CONFLICT throws, not because the opportunityId guard works.
- **Evidence:** finance/router.ts:304-313 (draft-only claim → CONFLICT on replay); reconcile-orphaned-receipts.ts:136 (replay path calls provisionFromReceipt only).
- **Suggested fix:** State the real single-run guarantee (the draft→approved atomic claim) and drop or reframe the opportunityId-idempotency claim; ensure the replay test actually drives a second approve and asserts the CONFLICT path.

---

## Unresolved questions
1. Does F2's "active Student on a cancelled receipt" actually violate policy, given the locked "cancel keeps LMS access, only withdraws the seat" decision (reconcile-orphaned-receipts.ts:190-195)? If the only true defect is a missing/absent Enrollment (benign — nothing to withdraw), phase 1's severity and layer-2 scope should be reconsidered.
2. Phase 7 claims an RLS policy "already exists on TestAppointment" — not verified in this pass; confirm before asserting "RLS untouched."

## Status
Status: DONE_WITH_CONCERNS
Summary: 8 findings (1 Critical, 4 High, 3 Medium), all with file:line evidence. Phase 1's 3-layer fix is the weakest: layer 2 reverses a locked PO decision and is either wrong or redundant, layer 3 points at the wrong file and duplicates an existing scanner, layer 1 leaves 2 committing steps unguarded. Phase 5 rests on a non-existent ParentAccount.name field, phase 7 migration is irreversible with a CHECK on free-text type, phase 8 sequences its dedup after the writer it must protect.
