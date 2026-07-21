# Deep-Review Remediation Wave C — Merge-Gating Fixes (P1 Identity/Enrollment)

Status: DONE

## Summary

Fixed all 5 merge-gating findings from adversarial verification of P1 remediation (money/children-data critical): R1 (HIGH, partial-provisioning orphan detection), R2 (MEDIUM, facility bootstrap deadlock), R5 (LOW, email-enqueue mislabels provisioning), R3 (LOW-MED, outbox double-send race). R4 (unbounded failed-audit spam) left unfixed on purpose, per task's "optional" note — documented in code comments instead.

All fixes preserve I1–I5, ADR-A/0041, RLS (`withFacility`), atomic-claim pattern, refund cap, fail-closed dev-auth, K5 least-privilege. `typecheck`/`test`/`build` green; 137/137 tests pass; coverage thresholds hold (finance 97.88%/89.36% branches ≥ 90/80 gate; provisioning 95.9%/77.77% branches ≥ 90/75 gate).

## Files Changed

- `apps/api/src/worker/reconcile-orphaned-receipts.ts` (+69/-15) — R1: broadened orphan-detection query.
- `apps/api/src/worker/reconcile-orphaned-receipts.test.ts` (+66) — R1 test.
- `apps/api/src/trpc.ts` (+16/-3) — R2: `super_admin` bypass in `requireValidFacility`.
- `apps/api/src/facility/facility.test.ts` (+27) — R2 tests.
- `apps/api/src/finance/router.ts` (+38/-13) — R5: extracted `enqueueReceiptEmailBestEffort`, moved outside the provisioning try/catch.
- `apps/api/src/finance/enqueue-receipt-email-best-effort.test.ts` (new, 53 lines) — R5 tests.
- `apps/api/src/worker/relay-email-outbox.ts` (+22/-6) — R3: atomic claim via `updateMany`.
- `apps/api/src/worker/relay-email-outbox.test.ts` (+21) — R3 concurrency test.
- `packages/db/prisma/schema.prisma` (+6) — added `EmailOutboxStatus.sending`.
- `packages/db/prisma/migrations/20260706160000_p1_remediation_wavec_outbox_atomic_claim/migration.sql` (new) — hand-written `ALTER TYPE ... ADD VALUE 'sending'`; applied via `prisma migrate deploy`. No GRANT changes needed (`EmailOutbox` UPDATE already granted to `cmc_app` from the prior wave-A migration).

## Per-Fix → Test Mapping

**R1** (`reconcile-orphaned-receipts.ts`): query changed from `WHERE studentId IS NULL AND no Student` to a CTE resolving the student per receipt (`createdByReceiptId` for new-kind, `receipt.studentId` for renewal reuse) then `WHERE resolvedStudentId IS NULL OR NOT EXISTS(Guardian) OR NOT EXISTS(StudentAccount) OR (classBatchId IS NOT NULL AND NOT EXISTS(active Enrollment for that classBatchId))`. Guardian/StudentAccount existence checked by resolved studentId alone (not also matched to the paying parent) — deliberately permissive, since any gap re-runs `provisionFromReceipt`, which is idempotent regardless.
- Test: `reconcile-orphaned-receipts.test.ts` new case "R1: mid-provision failure (Student committed, but Guardian/Enrollment/StudentAccount are not)…" — seeds an approved Receipt + committed Student directly (simulating the crash point), asserts zero Guardian/Enrollment/StudentAccount beforehand, runs the reconciler, asserts Guardian/active-Enrollment/StudentAccount now exist, `enrollment.mine` (LMS) shows the child, and a second run creates no duplicates (counts stay 1).
- All 4 pre-existing tests in that file still pass unmodified (marker case, crash-no-marker case, fully-provisioned no-touch, renewal no-touch).

**R2** (`trpc.ts`): `requireValidFacility` now returns `next()` immediately when `ctx.subject?.roles.includes('super_admin')`, before the `Facility` existence lookup — `super_admin` already bypasses the entire `@cmc/auth` registry (`can()`), so this does not weaken authorization for any other role.
- Test: `facility.test.ts` — "R2: super_admin bootstraps the very first facility" (facilityId = a nonexistent bootstrap string, `facility.create` still succeeds and persists); "R2: a non-super_admin with an unknown facilityId is still rejected" (`giam_doc_kinh_doanh` + ghost facilityId → `UNAUTHORIZED`, confirming the bypass is super_admin-only).
- Pre-existing `security/facility-validation.test.ts` (ghost facilityId + `sale` role → `UNAUTHORIZED`) still passes unmodified.
- Dev seed (`packages/db/prisma/seed.mjs`) verified unaffected by reading it: it writes `Facility` directly via `PrismaClient`, never through the tRPC API/`requireValidFacility`, so it was never blocked by this bug and needs no change.

**R5** (`finance/router.ts`): extracted `enqueueReceiptEmailBestEffort(db, receipt, enqueue = enqueueReceiptEmail)` — a dependency-injected wrapper that runs `enqueue` in its own try/catch, recording failures under a new `email.enqueue_failed` marker (never `provisioning.retry_pending`). `receiptApprove` now calls it only when `provisioning === 'ok'`, entirely outside the provisioning try/catch.
- Test: `enqueue-receipt-email-best-effort.test.ts` — a throwing `enqueue` stub resolves without propagating, writes `email.enqueue_failed`, and writes NO `provisioning.retry_pending` marker; a succeeding stub writes no failure marker. Dependency injection was used (not a real forced Postgres insert failure) because the codebase has no existing mocking infrastructure and this isolates the exact invariant under test without one.
- Pre-existing `finance/approve.test.ts` "F8… idempotent" test (calls `enqueueReceiptEmail` directly) still passes unmodified — untouched by this refactor.

**R3** (`relay-email-outbox.ts`): each candidate row is now claimed via `updateMany({ where: { id, status: { in: ['pending','failed'] } }, data: { status: 'sending' } })` before `transport.send()`; `claim.count !== 1` skips the row (already claimed by a concurrent replica). Required a new `EmailOutboxStatus.sending` enum value (migration above).
- Test: `relay-email-outbox.test.ts` — "R3: two concurrent drains never double-send the same row" — `Promise.all([relayEmailOutbox(...), relayEmailOutbox(...)])` on the same row, asserts exactly one transport recorded the send and the row ends `sent`.
- All 4 pre-existing tests in that file still pass unmodified.

**R4**: left unfixed per task's explicit "OPTIONAL" — a receipt permanently missing `classBatchId` will still fail every drain cycle forever (documented in a code comment in `reconcile-orphaned-receipts.ts`); not a regression (same permanent-failure shape existed before, just undetected).

## Verify / Coverage Output

```
pnpm typecheck        → 12/12 tasks successful (turbo)
pnpm --filter @cmc/api exec vitest run
  → 24 test files, 137 tests, all passed
pnpm --filter @cmc/api exec vitest run --coverage → exit 0, all thresholds pass
  All files            95.11% stmts / 83.18% branch / 91.48% funcs / 95.11% lines
  src/finance          97.88% / 89.36% / 100% / 97.88%   (gate: 90/80/90/90)
  src/provisioning     95.9%  / 77.77% / 100% / 95.9%    (gate: 90/75/90/90)
pnpm build             → 7/7 tasks successful (turbo)
prisma migrate deploy  → applied 20260706160000_p1_remediation_wavec_outbox_atomic_claim
prisma migrate status  → "Database schema is up to date!"
```

## Assumptions

- R1: "missing Guardian/StudentAccount" is checked by resolved `studentId` alone, not also re-verified against the specific paying parent's `ParentAccount` — any gap still safely re-runs the fully-idempotent `provisionFromReceipt`, so this is a completeness bias toward "definitely re-check", not a correctness gap.
- R2: bypass is scoped to `requireValidFacility` only (facility-existence check), not a broader RLS/permission bypass — `super_admin` still goes through `can()` for every actual mutation exactly as before; this only lets the session itself be accepted with an unresolved/bootstrap facilityId.
- R5: chose dependency injection over forcing a real Postgres insert failure for the test, since the codebase has zero existing mock/spy infrastructure and no natural data-driven way to make `emailOutbox.create` fail deterministically without one.
- R3: added `sending` as a genuinely new, hand-written migration (not reusing an existing status) since it is a real transient claim state, matching the money-gate `status: 'draft'` claim-predicate pattern already used elsewhere in this codebase.

No unresolved questions.
