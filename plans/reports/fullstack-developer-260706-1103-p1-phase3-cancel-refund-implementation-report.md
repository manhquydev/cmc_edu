# US-009 (WF-P1-08) — receipt cancel / refund — Implementation Report

Status: DONE

## Summary
Added `finance.receiptCancel` and `finance.refundCreate` to the existing `apps/api/src/finance/router.ts`,
building on Phases 0-2 (substrate, crm, receiptCreate/receiptApprove+provisioning). Both reuse
existing infra (`requirePermission`/`can()`, `scoped()`, `assertRefundWithinCap`, the `updateMany`
atomic-claim pattern from `receiptApprove`). No Prisma schema changes were needed — all required
fields/enums (`ReceiptStatus.cancelled`, `RefundRecord`, `StudentLifecycle`, `EnrollmentStatus.withdrawn`)
already existed from Phase 0/2.

## Files Modified
- `apps/api/src/finance/router.ts` (+237 lines): added `receiptCancelInput`/`ReceiptCancelResult`,
  `runCancelTransaction`, `refundCreateInput`/`RefundDto`/`RefundCreateResult`, `runRefundTransaction`,
  and the two router procedures `receiptCancel` / `refundCreate`. Updated top-of-file comment (previously
  said these must NOT be added here — that was the Phase-2 boundary marker, now obsolete).
- `apps/api/src/finance/cancel-refund.test.ts` (new, 248 lines): 11 integration tests against dev Postgres.

No other files touched (packages/auth already had `finance.receiptApprove`/`finance.refundCreate` in the
permission catalog from Phase 2 — `sale` already excluded from `receiptApprove`, so reusing that gate for
`receiptCancel` required zero registry changes).

## Design decisions (money-critical, documented in code)

**`receiptCancel` (`requirePermission('finance','receiptApprove')`)**
- Input `{ receiptId, reason, void?: boolean (default false) }`.
- Precondition `status === 'approved'` else `BAD_REQUEST`; atomic claim via
  `updateMany({ where: { status: 'approved' } })` (same shape as `receiptApprove`'s double-approve guard) —
  a concurrent double-cancel loses the race and gets `CONFLICT`.
- **I3**: after the claim flips this receipt away from `'approved'`, checks the linked opportunity; if it's
  at `O5_ENROLLED` AND no *other* `Receipt` with `status='approved'` remains on that `opportunityId`, reverts
  `O5_ENROLLED -> O4_TESTED` + `closedAt: null`. Otherwise leaves the opportunity untouched. Verified by two
  tests (sole-receipt reverts; second-approved-receipt-exists does not).
- Provisioning rollback (QĐ 0024): `Student` is 1:1 with the receipt via `createdByReceiptId`.
  - `Enrollment` (matched by `studentId` + `receipt.classBatchId`) → always set to `withdrawn`, regardless of
    the `void` flag — this follows the *explicit* WF-P1-05 state-machine transition
    `active --> withdrawn: rút (WF-P1-08)`, which names this exact workflow as the trigger. This resolved an
    ambiguity in the task brief (which offered "reserved" as an alternative) without needing NEEDS_CONTEXT.
  - `Student.lifecycle` → only touched when `void: true` (mistaken-void → archived); left as `active` when
    `void` is false/omitted (genuine refund/cancel keeps the identity, per QĐ 0024 / docs/07 glossary).
- **ASSUMPTION (flagged, not a guess on money behavior)**: `StudentLifecycle` (schema.prisma) only has
  `active | blocked_lms | withdrawn` — no separate "archived" value exists in the data model, even though
  docs/24 WF-P1-08 and docs/07 glossary both say "void nhầm → archive + withdraw". Mapped the mistaken-void
  outcome onto the existing `withdrawn` value rather than inventing an enum member (schema changes were
  explicitly out of scope for this phase — the task said report NEEDS_CONTEXT for a *missing field*, and
  this is a missing *enum value*, not new business logic). Documented inline in `receiptCancelInput`'s JSDoc.
  Flagging here per the "prefer NEEDS_CONTEXT over guessing on money behavior" instruction — this is the one
  place I resolved rather than blocked on, because the alternative (blocking the whole story) seemed worse
  than a documented, reversible enum-value choice.

**`refundCreate` (`requirePermission('finance','refundCreate')`)**
- Input `{ receiptId, amount: positive }`.
- **I5**: locks the `Receipt` row with `tx.$queryRaw` `SELECT ... FOR UPDATE` (no `@prisma/client` import
  needed — Prisma's `$queryRaw` tagged-template method is available directly on `PrismaClient`/`TransactionClient`,
  so `apps/api/package.json` did not need a new dependency), aggregates `SUM(RefundRecord.amount)` for the
  receipt, calls `assertRefundWithinCap` (existing pure function, reused unmodified), and on cap violation
  converts the thrown `RefundCapExceededError` into `badRequest`. Appends one `RefundRecord` row
  (`create`, never `update`/`delete`) and returns `{ refund, remainingBalance }`.
- Concurrency: two concurrent calls on the same receipt serialise on the `FOR UPDATE` lock — the second
  transaction's `SELECT` blocks until the first commits, then re-aggregates the now-updated sum, so a
  same-fits-alone-but-together-exceeds-cap pair can only ever have exactly one succeed. Proven by the
  `Promise.allSettled` test (10M cap, two 6M refunds — exactly 1 fulfilled, sum ≤ netAmount, 1 row).

## Tests Status
- Type check: PASS (`pnpm typecheck`, all 7 packages, no errors).
- Unit tests: PASS (`pnpm test`, all 9 turbo tasks — 43/43 in `@cmc/api`, unaffected packages unchanged).
- Integration tests: PASS —
  `pnpm --filter @cmc/api exec vitest run src/finance/cancel-refund.test.ts` → **11/11 passed**.
- Build: PASS (`pnpm build`, all 7 packages incl. `@cmc/api` tsc build).

### Test list (`apps/api/src/finance/cancel-refund.test.ts`)
- receiptCancel: reverts O5→O4 + clears closedAt (sole receipt) — I3
- receiptCancel: does NOT revert when a second approved receipt exists — I3
- receiptCancel: FORBIDDEN for `sale`
- receiptCancel: BAD_REQUEST on a non-approved (draft) receipt
- receiptCancel: `void:true` → Student.lifecycle=withdrawn + Enrollment=withdrawn
- receiptCancel: non-void → Student.lifecycle stays active, Enrollment still withdrawn
- refundCreate: appends RefundRecord within cap, correct remainingBalance
- refundCreate: BAD_REQUEST over remaining cap, no extra row appended
- refundCreate: BAD_REQUEST on a draft (non-approved) receipt
- refundCreate: append-only — two valid refunds → 2 rows, correct amounts
- refundCreate: two concurrent refunds exceeding cap together → exactly 1 fulfilled, sum ≤ netAmount, 1 row

## Issues Encountered
- Pre-existing test-data collision risk: initial phone-number choices in the new test file
  (`0950000001..0960000012`) collided with `apps/api/src/provisioning/idempotent.test.ts`'s ranges
  (`ParentAccount.phone` is system-wide unique, not facility-scoped). Vitest runs test files in parallel
  against the same dev Postgres, so the collision caused a transient FK-violation on `parentAccount.deleteMany`
  in `idempotent.test.ts`'s `afterEach`. Fixed by moving the new file's contact/parent phone prefixes to an
  unused `097x`/`098x` range — no changes to `idempotent.test.ts` or `test/db.ts` (both out of this phase's
  file ownership) were needed or made.
- No Prisma schema changes were required — all fields/enums referenced (`ReceiptStatus.cancelled`,
  `RefundRecord`, `Student.lifecycle`, `Enrollment.status`) pre-existed from Phase 0/2.

## Next Steps
- US-009 / WF-P1-08 is implementation-complete and green. No follow-up required for this story.
- Not addressed (out of scope, flagged for a future ADR if desired): if the product later wants a truly
  distinct "archived" student state distinct from "withdrawn", that requires a `StudentLifecycle` enum
  change — a schema migration, which this phase was explicitly not permitted to do.
