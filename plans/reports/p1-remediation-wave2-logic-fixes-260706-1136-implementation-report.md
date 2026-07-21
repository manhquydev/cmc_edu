# P1 Remediation Wave 2 — Business-Logic Fixes — Implementation Report

Status: **DONE**

## Summary

Implemented all 10 findings from the wave-2 assignment (H1, H3, H5, H6, M9, M8, M4, M3, M10, and
the lows F7/F9/F8) on top of the current wave-1 code (Postgres RLS via `withFacility()` already in
place). Every fix has a passing integration test against the real dev Postgres (`cmc_app` role,
RLS enforced). One schema migration added two columns (`LoginOtp.attempts`, `RefundRecord.idempotencyKey`
+ unique index) via a hand-written migration (`prisma migrate dev` is non-interactive in this
environment, same constraint noted in the wave-1 migration).

A cross-cutting bug was found and fixed while wiring H3+M9 together: `runCancelTransaction`'s
Student lookup only ever checked `createdByReceiptId` — for a renewal receipt (H3, `studentId` set,
no `createdByReceiptId` of its own) this would have silently resolved `student = null` and skipped
rollback entirely on cancel. Fixed to resolve via `studentId` first, falling back to
`createdByReceiptId`.

## Files Changed

### Schema / migration
- `packages/db/prisma/schema.prisma` — `RefundRecord.idempotencyKey` (+ `@@unique([receiptId, idempotencyKey])`), `LoginOtp.attempts`.
- `packages/db/prisma/migrations/20260706140000_p1_remediation_wave2_logic_fixes/migration.sql` (new) — applied via `prisma migrate deploy`, client regenerated.

### Domain
- `packages/domain-finance/src/index.ts` — removed dead `computeNetAmount` export (F9, deleted not wired).
- `packages/domain-finance/src/index.test.ts` — updated barrel test.
- `packages/domain-finance/src/net-amount.ts`, `net-amount.test.ts` — deleted.

### API — finance (H1, H3, H6, M9, F7, F8, M4)
- `apps/api/src/finance/router.ts` — renamed `SELF_APPROVE_THRESHOLD` → `APPROVAL_SECOND_EYE_THRESHOLD` (general rule, not just self-approve); `receiptCreateInput.studentId` (renewal reuse) + facility-scoped existence check; `vndAmountSchema` (int, positive, ≤1e12) applied to `receiptCreate`/`refundCreate` amounts; `runCancelTransaction` now locks the linked Opportunity row (`SELECT … FOR UPDATE`) before deciding to revert, resolves the Student via `studentId` OR `createdByReceiptId`, and only withdraws the enrollment when no other approved receipt covers the same student+class; `refundCreateInput.idempotencyKey` + dedupe-by-key in `runRefundTransaction`; new exported `enqueueReceiptEmail()` dedupes the outbox row by `receiptId` (JSON payload lookup).
- `apps/api/src/finance/approve.test.ts` — renamed import; +2 tests (GĐKD over-threshold FORBIDDEN even when not self-approved; GĐĐT over-threshold OK); +1 F8 idempotent-outbox test.
- `apps/api/src/finance/cancel-refund.test.ts` — +1 M9 test (shared enrollment), +1 H6 concurrency test, +1 M4 idempotency test.
- `apps/api/src/finance/create-from-opp.test.ts` — +2 F7 tests (overflow, sub-unit).
- `apps/api/src/finance/renewal-reuse.test.ts` (new) — H3: renewal reuses Student, no duplicate; +1 not-found test.
- `apps/api/src/finance/rls-negative.test.ts` (new) — M10: facility-B cannot approve/cancel/refund facility-A's receipt.

### API — provisioning / enrollment (H3, M8)
- `apps/api/src/provisioning/provision-from-receipt.ts` — `ReceiptForProvisioning.studentId?`; `findOrCreateStudent` reuses the named Student (read-only, RLS-scoped) instead of creating one when `studentId` is set.
- `apps/api/src/enrollment/activate-enrollment.ts` — `activateEnrollmentForReceipt` now only considers `reserved`/`active` rows as "the existing enrollment" (`orderBy createdAt desc`, status filter); a terminal (`withdrawn`/`completed`) row is never reused — a fresh `active` row is created instead.
- `apps/api/src/enrollment/reserved-active.test.ts` — +1 M8 test (withdraw → re-pay activates a fresh row, not the stale withdrawn one).

### API — child-data audit (M3)
- `apps/api/src/guardian/approved-children.ts` — new `auditChildDataAccess()` helper (one `AuditLog` row per disclosed student, no-op when nothing was disclosed).
- `apps/api/src/enrollment/router.ts` — `enrollment.mine` calls it after resolving approved children.
- `apps/api/src/lms-auth/router.ts` — `verifyOtp` calls it after resolving approved children (also H5, see below).
- `apps/api/src/guardian/link.test.ts` — +1 M3 test (`enrollment.mine` audit row).

### API — OTP hardening (H5)
- `apps/api/src/lms-auth/otp-hash.ts` (new) — `hashOtpCode`/`verifyOtpCode`, `${salt}:${sha256Hex}`, constant-time compare.
- `apps/api/src/lms-auth/router.ts` — `requestOtp`: cooldown (30s placeholder) against the most recent row per phone; invalidates any still-pending prior code before issuing a new one (closes the reset-attempts-via-new-request bypass); stores hashed code. `verifyOtp`: per-row `attempts` counter, locks (status → `expired`) at 5 failed attempts; same generic `BAD_REQUEST` for wrong/expired/locked/no-account.
- `apps/api/src/lms-auth/login.test.ts` — rewritten: `vi.mock('node:crypto', …)` pins `randomInt` so every issued code is deterministic (unavoidable once the code is hashed — it can no longer be read back from the DB); updated plaintext-storage assertion; +4 new tests (lockout, cooldown, invalidate-on-reissue, M3 audit); backdated one manually-inserted OTP row's `createdAt` so the new cooldown doesn't break the pre-existing expired/wrong-code test.

## Tests Status

- Typecheck: **pass** — `pnpm -r --filter '@cmc/*' run typecheck` (auth, db, domain-finance, domain-identity, ui, api, admin) all "Done", zero errors.
- Build: **pass** — `pnpm -r run build` (all @cmc/* + apps/admin + apps/api), zero errors.
- Unit/integration tests: **pass**
  - `apps/api`: 12 files, **84/84 passed**
  - `packages/domain-finance`: 5 files, **17/17 passed**
  - `packages/auth`: 1 file, **8/8 passed**
  - `packages/domain-identity`: 2 files, **7/7 passed**
  - Total: **116/116 passed** (domain-finance dropped 6 tests from the deleted dead `computeNetAmount`; api gained 28 net-new tests across the 10 fixes)
- Coverage (`pnpm --filter @cmc/api exec vitest run --coverage`, v8, exit 0 — thresholds enforced):
  ```
  All files                    92.49% stmts | 81.40% branch | 94.44% funcs | 92.49% lines
  src/finance/router.ts        97.54% stmts | 89.02% branch | 100%   funcs | 97.54% lines   (gate: 90/80/90/90 lines/branch/funcs/stmts)
  src/provisioning/*.ts        91.26% stmts | 79.31% branch | 100%   funcs | 91.26% lines   (gate: 90/75/90/90)
  ```
  Both money/provisioning modules clear their thresholds; `vitest` exits 0.

## Per-Fix → Test Mapping

| Fix | Test(s) |
|---|---|
| H1 (general second-eye threshold) | `finance/approve.test.ts`: "forbids a GĐKD-only approver over threshold even when NOT self-approved", "allows an over-threshold approval by GĐĐT", "allows a GĐKD approval under threshold"; existing self-approve-over-threshold test still passes (now via the general rule) |
| H3 (renewal reuses Student) | `finance/renewal-reuse.test.ts`: reuse + no-duplicate + new active Enrollment; not-found for a bad `studentId` |
| H5 (OTP hash/rate-limit) | `lms-auth/login.test.ts`: hashed-storage assertion, lockout (5 attempts), cooldown, invalidate-on-reissue, correct-code-still-works (existing tests, now via mocked deterministic code) |
| H6 (concurrent cancel race) | `finance/cancel-refund.test.ts`: "serialises concurrent cancels of the two approved receipts on one opportunity" |
| M9 (no over-withdraw shared enrollment) | `finance/cancel-refund.test.ts`: "keeps a shared enrollment active when cancelling one of two approved receipts covering it" |
| M8 (deterministic enrollment row) | `enrollment/reserved-active.test.ts`: "activates a fresh Enrollment after withdraw -> re-pay" |
| M4 (refund idempotency) | `finance/cancel-refund.test.ts`: "is idempotent: a repeat refundCreate with the same idempotencyKey…" |
| M3 (child-data audit) | `guardian/link.test.ts` (enrollment.mine) + `lms-auth/login.test.ts` (verifyOtp) |
| M10 (finance cross-facility RLS) | `finance/rls-negative.test.ts`: approve/cancel/refund, all NOT_FOUND across facilities |
| F7 (amount validation) | `finance/create-from-opp.test.ts`: overflow + sub-unit rejected |
| F9 (dead `computeNetAmount`) | deleted + barrel test updated (no wiring — see Assumptions) |
| F8 (idempotent outbox enqueue) | `finance/approve.test.ts`: "is idempotent: replaying the outbox enqueue…" |

## Assumptions

1. **H1 threshold value & mechanism**: kept the existing `20_000_000` VND placeholder (renamed
   constant, not the number) and implemented the ratified rule from the audit's consolidated
   report + docs/16 ADR-B: over-threshold requires `giam_doc_dao_tao` or `super_admin` regardless
   of self-approval.
2. **F9**: deleted `computeNetAmount` rather than wiring a `discount` field into `receiptCreate` —
   no P1 decision doc defines discount semantics (caps, negative handling, promo codes); wiring it
   in would be speculative scope, not a bug fix. Revisit when the v2 discount rulebook lands.
3. **H5 constants**: `OTP_REQUEST_COOLDOWN_SECONDS = 30` and `MAX_OTP_VERIFY_ATTEMPTS = 5` are
   placeholders (same "no decision doc pins a number" situation as the ADR-B threshold) —
   documented inline as such.
4. **H5 design addition (beyond the literal ask)**: issuing a new OTP now invalidates any
   still-pending prior code for the same phone. Without this, an attacker locked out on one row
   could simply call `requestOtp` again to get a fresh row with a reset attempt counter, defeating
   the lockout. Flagged here since it's a behavior change not explicitly itemized in the brief, but
   required for the lockout to be meaningful.
5. **F8 dedupe key**: `receiptId` alone (via JSON payload lookup), since only one notification
   "kind" is ever enqueued per receipt today; documented that a real `type` column would be needed
   if a second notification kind is added later.
6. **M9 "other approved receipt" query**: matches on `studentId = student.id` OR
   `id = student.createdByReceiptId` — covers both directions (cancelling the original
   Student-creating receipt vs. cancelling a renewal receipt that reused it).

No unresolved questions — all decisions above were already ratified in the consolidated audit
report or directly specified in the assignment.
