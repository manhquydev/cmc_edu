# Money/Finance Correctness Audit — CMC EDU v2 P1 backend

READ-ONLY adversarial audit. Branch `feat/p1-identity-enrollment`. Verified against actual code, not docs/comments/tests.

Scope read: `apps/api/src/finance/router.ts`, `apps/api/src/provisioning/provision-from-receipt.ts`, `apps/api/src/enrollment/{router,activate-enrollment}.ts`, `packages/domain-finance/src/*`, `packages/db/prisma/schema.prisma`, `packages/auth/src/index.ts`, and all named tests.

---

## Findings (most severe first)

### F1 — ADR-B threshold second-eye is NOT enforced generally; only the self-approve sub-case is gated — HIGH (Critical-adjacent) — CONFIRMED
`apps/api/src/finance/router.ts:134-140`.
```
const selfApproved = receipt.createdById === approverId;
if (selfApproved && netAmount > SELF_APPROVE_THRESHOLD) { throw forbidden(...); }
```
ADR-B (docs/16, decision bullet 3) and docs/01:42,49 require: **any receipt over threshold X needs an independent second eye — specifically GĐĐT or super_admin (roles with no sales quota)**. The whole point is that GĐKD is the sale's manager and is conflicted on large deals.

The code only blocks when creator == approver. The normal, higher-risk path is unguarded:
- Scenario: `sale` (userId A) drafts a 500,000,000 VND receipt on a real opportunity. `giam_doc_kinh_doanh` (userId B) calls `receiptApprove`. `selfApproved === false` → threshold check skipped entirely → approved with no independent second eye. Exactly the conflict-of-interest ADR-B exists to control, unmitigated.
- There is also no check that an over-threshold approver is GĐĐT/super_admin; the registry (`packages/auth/src/index.ts:50`) grants `receiptApprove` to `giam_doc_kinh_doanh`, `giam_doc_dao_tao`, `ke_toan`, so GĐKD alone can approve any amount.

Secondary: `SELF_APPROVE_THRESHOLD = 20_000_000` (router.ts:29) is a self-admitted placeholder ("no decision doc fixes the number"). The one control that does fire uses an unratified constant. `auth/src/index.test.ts:32` labels GĐĐT approve rights the "second-eyes gate" but no test asserts the general over-threshold routing — the gate is asserted only as "GĐĐT *can* approve", never "over-threshold *must* be GĐĐT/super_admin".

Impact: the core money-gate compensating control is effectively absent for the common case. Recommend: enforce threshold on every approval regardless of self/other, and require approver role ∈ {giam_doc_dao_tao, super_admin} above threshold; pin X in a decision doc.

---

### F2 — Provisioning is NOT idempotent for the Enrollment step under concurrent replay; no unique constraint backstop — HIGH — CONFIRMED
`apps/api/src/enrollment/activate-enrollment.ts:29-46`; schema `Enrollment` (`packages/db/prisma/schema.prisma:284-298`).

`activateEnrollmentForReceipt` does `findFirst(...)` then `create(...)`. Unlike every other provisioning step, there is **no unique constraint** on `Enrollment(facilityId, studentId, classBatchId)` (schema has only `@@index`, no `@@unique`) and **no P2002 catch**. `findOrCreateParentAccount`/`findOrCreateStudent`/`findOrCreateStudentAccount` all rely on a unique column + P2002 refetch (`provision-from-receipt.ts:50-116`) — the enrollment step has neither.

The module's own comments (`provision-from-receipt.ts:85-87`) state it is built to survive "approve retry racing the outbox worker", and `receiptApprove` writes a `provisioning.retry_pending` marker (router.ts:535-543) precisely so a retry can re-run `provisionFromReceipt`. Under that exact scenario:
- Two concurrent `provisionFromReceipt` calls for the same receipt/student/class both run `findFirst` before either commits → both see no enrollment → both `create` → **two `active` Enrollment rows** for one paid seat. No constraint stops it.

The idempotency tests do not cover this: `idempotent.test.ts:170-201` calls `provisionFromReceipt` **sequentially** (second call's `findFirst` sees the first's row); `idempotent.test.ts:203-236` races two **different** students (different `studentId`), so no shared enrollment key. The concurrent-same-receipt enrollment path is untested.

Impact: duplicate active enrollments (double seat / double attendance / downstream double-billing) under the retry path the system is designed around. Recommend: add `@@unique([facilityId, studentId, classBatchId])` + P2002 refetch in `activateEnrollmentForReceipt`, matching the other steps.

---

### F3 — `activateEnrollmentForReceipt` uses unordered `findFirst`; with multiple rows for a key it can silently skip activation — MEDIUM — CONFIRMED (non-determinism) / SUSPECTED (trigger frequency)
`apps/api/src/enrollment/activate-enrollment.ts:29-55`.

Because there is no unique constraint, a (student, class) key can accumulate rows over a cancel→re-enroll→re-pay cycle: `receiptCancel` sets the enrollment `withdrawn` (router.ts:302-307), then a fresh `enrollment.enroll` inserts a new `reserved` row (enrollment/router.ts:44-51). Now two rows exist for the same key. `findFirst` has **no `orderBy`**, so it returns an arbitrary row:
- If it returns the `withdrawn` row → matches neither `!existing` nor `status==='reserved'` → hits `return existing` untouched. The new `reserved` seat is never activated even though a new receipt was approved → paid student stays `reserved`, gated out of attendance/grading (ADR-A gates class on `active`).

Impact: a re-paying student can be left inactive depending on row order. Fixing F2's unique constraint also removes this ambiguity.

---

### F4 — Concurrent cancel of two receipts on the same opportunity can strand it at O5 (I3 violation) — MEDIUM — CONFIRMED (race window) / SUSPECTED (interleaving-dependent)
`apps/api/src/finance/router.ts:277-294`.

The "sole approved receipt" check reads other approved receipts with an **unlocked** `findFirst` (no `FOR UPDATE`, and each cancel only row-locks its own receipt via `updateMany`). Two concurrent cancels of receipts A and B on the same opportunity (both approved):
- Cancel-A flips A→cancelled, then reads "other approved" and sees B still approved (B not yet committed) → skips revert.
- Cancel-B flips B→cancelled, then reads "other approved" and sees A still approved → skips revert.
- Both commit → zero approved receipts remain, opportunity stuck at `O5_ENROLLED` with `closedAt` set. I3 requires revert to O4 when the last advancing receipt is cancelled.

Not in the accepted-races list (docs/01:73-88, which names only the ParentAccount-phone and Receipt.parentPhone races). Recommend: lock the opportunity row (`FOR UPDATE`) at the start of the cancel tx, or re-check under a serialized lock.

---

### F5 — Cancel withdraws the shared enrollment even when another approved receipt still covers that student+class — MEDIUM — CONFIRMED
`apps/api/src/finance/router.ts:300-307`.

Rollback does `enrollment.updateMany({ where: { facilityId, studentId, classBatchId }, data: { status: 'withdrawn' } })` unconditionally. The opportunity-revert logic (F4 area) is careful about "other approved receipts", but the enrollment withdrawal is not. If a student has two approved receipts for the same class (possible — no uniqueness prevents it; e.g. renewal on the same batch), cancelling one receipt withdraws the enrollment that the still-approved receipt paid for. It also force-overwrites `completed`/`transferred` states to `withdrawn`. Recommend: only withdraw when no other approved receipt covers that student+class, and guard against overwriting terminal non-active states.

---

### F6 — Refund cap and balance computed in JS float over `Decimal(14,2)` — LOW/MEDIUM — SUSPECTED
`apps/api/src/finance/router.ts:385,391,394,414`; `packages/domain-finance/src/refund-cap.ts:27-35`.

`netAmount` and refund sums are `Decimal(14,2)` but the cap check (`existingSum + amount > netAmount`) and `remainingBalance` run on `Number(...)`/`toNumber()` floats. For whole-VND amounts this is safe (well within 2^53). But the schema explicitly permits 2 decimal places, and `refundCreateInput.amount = z.number().positive()` accepts fractional input; classic float error (e.g. sums like `0.1 + 0.2`) could admit a refund a cent over cap or reject a valid one, and stored value may differ from the checked value after DB rounding to 2dp. Recommend: do cap arithmetic in Prisma `Decimal`, and constrain input to 2dp.

---

### F7 — `receiptCreate.amount` / `refundCreate.amount` lack upper bound and precision validation — LOW — CONFIRMED
`apps/api/src/finance/router.ts:49,335`. `z.number().positive()` allows values above `Decimal(14,2)` range (>~10^12) → Prisma numeric overflow → unhandled 500 rather than a clean `BAD_REQUEST`; and sub-cent values (e.g. `0.004`) round to `0.00`, creating a zero-net receipt. Recommend `.max()` + 2dp/integer validation.

---

### F8 — `emailOutbox.create` failure after successful provisioning mislabels state as `pending` — LOW — CONFIRMED
`apps/api/src/finance/router.ts:513-544`. The outbox insert shares the try with provisioning. If provisioning commits but `emailOutbox.create` throws, `provisioning` is reported `'pending'` and a retry marker is written even though enrollment is already `active`. A later retry re-runs `provisionFromReceipt` (idempotent for most steps) and would `create` a **second** outbox row (no dedupe on outbox). Minor state/notification inconsistency. Recommend: separate the outbox write from the provisioning try, or make it idempotent.

---

### F9 — `computeNetAmount` is dead code; `netAmount` is the raw gross input — LOW/INFORMATIONAL — CONFIRMED
`receiptCreate` stores `netAmount: input.amount` directly (router.ts:472); `computeNetAmount` (`packages/domain-finance/src/net-amount.ts`) is referenced only by its own test and the barrel `index.ts` (grep: no router usage). Acceptable for a no-discount P1, but "net" is a misnomer and the discount path is unwired — flag so it isn't assumed active.

---

### F10 — `kind` (new/renewal) can be wrong under concurrent approvals of two receipts on the same new phone — LOW — SUSPECTED
`apps/api/src/finance/router.ts:143-152`. `computeReceiptKind` keys off a prior *approved* receipt for the phone. Two receipts on a brand-new phone approved concurrently both read "no prior approved" (neither committed yet; the atomic claim only serializes each receipt's own row) → both tagged `new`. Only mis-tags win-back analytics, not money. Likely acceptable but not documented as an accepted race.

---

### F11 — First-ever `ReceiptCodeCounter` upsert can 500 under a concurrent cold-start; schema doc comment is stale — LOW — SUSPECTED
`apps/api/src/finance/router.ts:461-465`; schema `ReceiptCodeCounter` (`schema.prisma:150-159`). Steady-state is sound (atomic `increment` under row lock inside the tx). But on the very first two concurrent `receiptCreate` calls system-wide (no counter row yet), depending on how Prisma compiles this upsert, the loser can hit P2002 on the unique `facilityId` key — uncaught here → 500 for that request. One-time window. Also the schema comment "One row per facility" (schema.prisma:150) is now false: the router uses a single global key `GLOBAL_RECEIPT_CODE` (router.ts:43,462) so `Receipt.code` stays globally unique — worth correcting the comment to avoid a future maintainer re-keying by facility.

---

## Invariants CONFIRMED sound
- **I1 (money gate / SoD basic):** `sale` excluded from `finance.receiptApprove` in the registry (`packages/auth/src/index.ts:50`); enforced by `requirePermission` (router.ts:497). Test at approve.test.ts:71.
- **I2 (approve auto-advances opp → O5 + `closedAt` in the same tx):** done inside `runMoneyTransaction` (router.ts:179-183), atomic with the status flip.
- **I4 (`netAmount` frozen after approve — never mutated):** verified by tracing every writer. `receiptApprove` writes only `status/approvedById/kind` (router.ts:162); `receiptCancel` writes only `status` (router.ts:265); refund never touches Receipt. No path mutates `netAmount` post-create.
- **I5 (refund append-only, cap SUM ≤ netAmount, atomic) for single-receipt concurrency:** `SELECT ... FOR UPDATE` on the Receipt row (router.ts:373-377) serializes concurrent refunds and cancel (both lock the same row); loser re-reads the committed sum and is rejected. Append-only (new `RefundRecord`, never update/delete). Sound. (Precision caveat: F6.)
- **I3 single-receipt revert:** correct for the non-concurrent case — reverts O5→O4 + clears `closedAt` only when no other approved receipt remains (router.ts:281-292). (Concurrency caveat: F4.)
- **ParentAccount / Student / StudentAccount idempotency:** unique-column + P2002-refetch handles the accepted first-phone race (docs/01:77-81) and same-receipt replay (provision-from-receipt.ts:50-116). Matches accepted-races contract.
- **Money-tx / provisioning separation (ADR 0041):** provisioning + outbox run after commit, outside the money tx, in their own try/catch; a provisioning failure does not roll back approve/`netAmount` (router.ts:509-544; verified by idempotent.test.ts:120-168). Note: docs/01 I6 says provisioning "in the approve transaction", which conflicts with ADR 0041; code correctly follows the newer ADR 0041 per the audit contract.
- **Global receipt-code counter (steady state):** atomic `increment` under row lock inside the create tx yields distinct sequential codes; `nextReceiptCode` formatting correct (`PT-000001` from value 1). (Cold-start caveat: F11.)

## Test-quality note
Tests exercise real DB paths and prove the happy paths and the single-key concurrency cases they target (double-approve, double-refund). Gaps: no test drives **concurrent same-receipt** provisioning (the F2 enrollment hole), **concurrent multi-receipt cancel** (F4), multi-row enrollment `findFirst` (F3), or the general (non-self) over-threshold path (F1). These are the invariants most at risk and are the ones the suite does not actually pin.

---

## Verdict
Core money arithmetic and the single-actor invariants (I2/I4/I5, code counter, provisioning separation) are sound, but the headline money-gate control (ADR-B over-threshold second-eye) is effectively unimplemented for the normal path, and provisioning idempotency has a real Enrollment-duplication hole under the very retry scenario the module advertises — both need fixing before this is production-trustworthy.

Severity count: Critical 0 · High 2 (F1, F2) · Medium 3 (F3, F4, F5) · Low 6 (F6–F11).

Status: DONE
