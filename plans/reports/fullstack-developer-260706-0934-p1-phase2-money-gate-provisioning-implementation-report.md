# P1 Phase 2 — Money Gate Spine (WF-P1-03/04/05) Implementation Report

Status: **DONE**

## Summary
Implemented `finance.receiptApprove` (money gate), idempotent provisioning (`provisionFromReceipt`),
and `enrollment.enroll` + Receipt-driven `reserved->active` activation. All invariants (I1/I2/I4,
ADR 0041 separation + idempotency + race handling, no-orphan-student, ADR-A) have dedicated
integration tests against dev Postgres. Also fixed a pre-existing Phase 1 bug (global vs
per-facility receipt-code counter) that was blocking money-gate tests from running alongside
Phase 1's.

## Files Modified / Created

### New package `@cmc/domain-identity`
- `packages/domain-identity/package.json`, `tsconfig.json`
- `packages/domain-identity/src/normalize-login-phone.ts` — `normalizeLoginPhone(raw)` -> `84xxxxxxxxx`, `InvalidPhoneError`
- `packages/domain-identity/src/normalize-login-phone.test.ts` (6 tests)
- `packages/domain-identity/src/index.ts`, `src/index.test.ts` (barrel + smoke test)

### `@cmc/domain-finance` (existing package, extended)
- `packages/domain-finance/src/receipt-kind.ts` — `computeReceiptKind(hasPriorApproved)` -> `'new'|'renewal'`
- `packages/domain-finance/src/receipt-kind.test.ts` (2 tests)
- `packages/domain-finance/src/index.ts`, `src/index.test.ts` — re-export + barrel test update

### `apps/api`
- `apps/api/src/finance/router.ts` — added `receiptApprove` (money tx + post-commit provisioning/outbox
  in a separate try/catch), `SELF_APPROVE_THRESHOLD` const, `toReceiptDto` helper (DRY with `receiptCreate`).
  Also fixed the `receiptCreate` code-counter to use one **global** key
  (`GLOBAL_RECEIPT_CODE_COUNTER_KEY`) instead of `facilityId` (see Deviations below).
- `apps/api/src/provisioning/provision-from-receipt.ts` (new) — `provisionFromReceipt(db, receipt)`:
  find-or-create ParentAccount (P2002 catch+refetch race handling) -> find-or-create Student
  (keyed `createdByReceiptId`) -> activate Enrollment -> find-or-create StudentAccount.
- `apps/api/src/enrollment/activate-enrollment.ts` (new) — `activateEnrollmentForReceipt`, the only
  code path that sets `Enrollment.status = 'active'`.
- `apps/api/src/enrollment/router.ts` (new) — `enrollment.enroll` (creates `reserved` only).
- `apps/api/src/router.ts` — mounted `enrollmentRouter`.
- `apps/api/package.json` — added `@cmc/domain-identity` dependency (outside `src/**`, unavoidable for wiring).

### Tests (new)
- `apps/api/src/finance/approve.test.ts` (7 tests)
- `apps/api/src/provisioning/idempotent.test.ts` (4 tests)
- `apps/api/src/enrollment/reserved-active.test.ts` (8 tests)

## Invariant -> Test Mapping
- I1 (sale FORBIDDEN on approve): `approve.test.ts` "forbids sale ... — I1"
- I2 (auto-O5 + closedAt, same tx): `approve.test.ts` "approves a draft: ... I2/I4"
- I4 (netAmount frozen): same test, asserts `netAmount` unchanged; also asserted in the provisioning-failure test.
- Kind computed before stage mutation: `approve.test.ts` "computes kind=renewal ... kind=new for the first"
- ADR-B self-approve audit flag (under threshold): `approve.test.ts` "records 'created & self-approved' ..."
- ADR-B threshold FORBIDDEN (over threshold): `approve.test.ts` "forbids self-approval above the threshold ..."
- ADR 0041 separation (provisioning failure does not roll back money): `idempotent.test.ts` "does not roll back ... recovers idempotently on retry"
- ADR 0041 idempotent replay (no dup): `idempotent.test.ts` "is idempotent: calling provisionFromReceipt twice ..."
- ADR 0041 race on new phone (P2002 catch+refetch, exactly one ParentAccount): `idempotent.test.ts` "resolves a race on a brand-new phone ..."
- No orphan student (`createdByReceiptId` always set): every provisioning test asserts `student.createdByReceiptId`/`findUnique({where:{createdByReceiptId}})`.
- ADR-A (`active` <=> approved Receipt; no direct set-active): `reserved-active.test.ts` (8 tests, incl. "exposes no direct mutation to set an enrollment active").

## Tests Status
- `pnpm --filter @cmc/api exec vitest run src/finance/approve.test.ts` — 7/7 pass
- `pnpm --filter @cmc/api exec vitest run src/provisioning/idempotent.test.ts` — 4/4 pass
- `pnpm --filter @cmc/api exec vitest run src/enrollment/reserved-active.test.ts` — 8/8 pass
- `pnpm --filter @cmc/api exec vitest run` (full suite incl. Phase 0/1) — 6 files, 31/31 pass
- `pnpm typecheck` — 12/12 tasks green
- `pnpm build` — 7/7 tasks green
- `pnpm test` (turbo, all packages) — 9/9 tasks green (auth 8, domain-finance 23, domain-identity 7, api 31)

## Deviations / Assumptions (flag for review)

1. **`SELF_APPROVE_THRESHOLD = 20,000,000 VND`** — docs/16 ADR-B and docs/23 WF-P1-03 name a money
   threshold ("nguong tien X") requiring GDDT second-approval but never pin a concrete figure anywhere
   in `docs/`. I added a documented module-level placeholder constant per the task's explicit
   instruction to do so. **Needs a real business number from the user/PM before this ships.**

2. **Pre-existing Phase 1 bug fixed in-file**: `receiptCreate`'s `ReceiptCodeCounter` upsert was keyed
   by `facilityId` (one counter row per facility), but `Receipt.code` is globally unique
   (`@unique`, not `@@unique([facilityId, code])`) and docs/19 §2 "Quy tac chung" states receipt
   codes use a single global atomic counter (unlike class codes). Two different facilities' first
   receipts deterministically both computed code `PT-000001`, tripping the unique constraint —
   reproduced by running `create-from-opp.test.ts` + `approve.test.ts` together (pre-existing, not
   introduced by this phase). Fixed by keying the counter row with a shared
   `GLOBAL_RECEIPT_CODE_COUNTER_KEY` constant instead of `facilityId` (no schema change, no format
   change — `PT-XXXXXX` contract preserved). This was necessary to satisfy the phase's own acceptance
   criterion "pnpm test all green (... Phase 1 tests still pass)" since Phase 1 and Phase 2 tests now
   run in the same vitest process.

3. **`EmailOutbox.status`**: task text says "status queued"; the actual `EmailOutboxStatus` enum
   (schema.prisma, not editable) is `pending | sent | failed`. Used `status: 'pending'` (the queued
   equivalent) rather than editing the schema.

4. **`EmailOutbox.to` field**: `ParentAccount` has no email address in this schema (only `phone`,
   consistent with SMS/phone-based LMS identity, docs/19 §2). Used `receipt.parentPhone` as the
   outbox recipient identifier since no email field exists anywhere on the money-gate path. This is
   a non-blocking placeholder — email domain/transport wiring is out of this phase's scope.

5. **`@cmc/domain-identity` chosen over extending `@cmc/domain-finance`** for `normalizeLoginPhone` —
   the task offered either; phone-login normalization is an identity concern (also needed later by
   WF-P1-07 LMS auth), not a finance one.

6. **Renewal/existing-student receipts**: the current schema has no `Receipt.studentId` — every
   Receipt provisions exactly one **new** `Student` (`createdByReceiptId` unique). `ReceiptKind.renewal`
   is a reporting classification (same parent phone has a prior approved receipt), not a "reuse the
   existing Student" mechanism. This means `activateEnrollmentForReceipt`'s "flip an existing
   `reserved` enrollment to `active`" branch can never be reached via the current `receiptApprove` ->
   `provisionFromReceipt` path (since the student is always new) — I tested that branch directly
   against `activateEnrollmentForReceipt` (the exact function `receiptApprove` provisioning calls) in
   `reserved-active.test.ts`, which is the correct seam given the schema. Flagging in case product
   intent is actually "renewals reuse the existing Student" — that would need a schema change
   (`Receipt.studentId`) outside this phase's file ownership.

## Unresolved Questions
- Confirm/replace `SELF_APPROVE_THRESHOLD` (20,000,000 VND placeholder) with the real business figure.
- Confirm whether "renewal" receipts should eventually link to an *existing* Student (would need a
  future schema change, `Receipt.studentId`) rather than always provisioning a new one.
- Confirm `EmailOutbox.to`/transport choice (phone vs. a future Contact.email lookup) once the email
  domain phase is scoped.
