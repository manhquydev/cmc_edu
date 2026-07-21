# Deep Review — Data Integrity & System Integrity (CMC EDU v2, P1 backend)

Scope: `apps/api/src/finance/router.ts`, `apps/api/src/provisioning/provision-from-receipt.ts`,
`apps/api/src/enrollment/activate-enrollment.ts`, `packages/db/src/index.ts`,
`packages/db/prisma/schema.prisma`, 3 migrations under `packages/db/prisma/migrations/`.
Lens: states where data becomes INCONSISTENT / UNRECOVERABLE / ORPHANED.
Read actual code + schema + migrations (not docs/claims). Branch: `feat/p1-identity-enrollment`.

Method note: verified `provisionFromReceipt` call graph by grep — it is invoked from exactly one
production site (`finance.receiptApprove`) plus test files. `server.ts` only calls `server.listen`;
`router.ts` mounts crm/finance/enrollment/guardian/lmsAuth and nothing else. No worker, scheduler,
cron, queue library, or replay endpoint exists in the repo.

---

## Ranked integrity risks

### CRITICAL-1 — Money-without-student orphan: the ADR 0041 recovery consumer does not exist. CONFIRMED
Trigger: `finance.receiptApprove` commits the money transaction (Receipt→`approved`, Opportunity→
`O5_ENROLLED`, audit row — all durable), then runs `provisionFromReceipt` in a separate try/catch
(`router.ts:626-648`). Any failure in provisioning (transient DB error, connection drop, P2002 that
does not resolve, `activateEnrollmentForReceipt` error, partial-unique-index collision) is caught,
`provisioning` is set to `'pending'`, and a `provisioning.retry_pending` audit row is written.

Resulting bad state: money is committed and the receipt is permanently `approved`, but no
Student / ParentAccount / Enrollment / StudentAccount (LMS login) exists, or only some of them do.
The row is `approved`, so a second `receiptApprove` call is rejected (`router.ts:156-158`,
status must be `draft`). There is **no other code path that re-runs `provisionFromReceipt`** — no
outbox worker, no scheduler, no admin/replay tRPC procedure. The `retry_pending` audit marker is
written but nothing ever consumes it.

Recoverable? No — not through any application path. Recovery requires manual DBA/SQL intervention.
The idempotent find-or-create design (correct in isolation, proven by `idempotent.test.ts`) is built
to be safely replayed by "outbox/agent retry" (per the file's own doc comment and ADR 0041 /
docs/22 "provisioning idempotent chịu retry"), but that retry actor is unimplemented. The C4 diagram
(docs/09 line 49) shows an "Outbox Worker (email relay, idempotent)" that is not in the codebase.

Severity: CRITICAL. This is the exact "money taken, no student, permanently orphaned" failure the
task asks about, and the P1 acceptance invariant "không student mồ côi; toàn vẹn tiền" (docs/22) is
only satisfied on the happy path.

Note on the specific "missing classBatchId" trigger: unreachable via the normal API because
`receiptCreate` hard-requires `classBatchId` (`router.ts:517-519`); the realistic triggers are
infra/transient failures and the crash window in CRITICAL-2.

### HIGH-2 — Crash between money-commit and provisioning leaves an orphan with NO marker at all. CONFIRMED
Trigger: process dies (deploy, OOM, pod evict) after the money `$transaction` commits but before or
during the `provisionFromReceipt` call / its catch block (`router.ts:626-648`).

Resulting bad state: same orphan as CRITICAL-1, but now even the `provisioning.retry_pending` audit
row is never written (the catch never runs, or the catch's own `auditLog.create` also fails). The
approved+O5 receipt is indistinguishable from a fully-provisioned one; there is no signal that
provisioning is owed. Any future reconciliation has to derive "approved receipt with no Student" by
scanning, because the marker cannot be relied on.

Recoverable? No automatic path; and harder to even detect than CRITICAL-1.
Severity: HIGH (compounds CRITICAL-1).

### HIGH-3 — Append-only ledgers (RefundRecord, AuditLog) are convention only, not DB-enforced. CONFIRMED
Trigger: the wave-1 migration grants `SELECT, INSERT, UPDATE, DELETE ON ALL TABLES` to the runtime
role `cmc_app` (`20260706054322_...migration.sql:158`) with no REVOKE and no trigger. RLS `USING`
policies on RefundRecord permit UPDATE/DELETE of in-facility rows; AuditLog has no RLS at all.

Resulting bad state: the money ledger (`RefundRecord`) and audit trail (`AuditLog`) — both documented
as append-only ("corrections are new rows, never edits", schema.prisma:205; TL10 §4 / I5) — can be
updated or deleted by the ordinary application role. Nothing but application convention prevents it.
A bug, a future careless query, or a compromised app path could rewrite refund amounts or delete
audit rows, defeating the invariant and any forensic recovery.

Recoverable? Deleted audit/refund rows are unrecoverable. Severity: HIGH (the append-only invariant is
a stated integrity guarantee that has no enforcement behind it).

### MEDIUM-4 — EmailOutbox `pending` rows are written but never processed. CONFIRMED
Trigger: `enqueueReceiptEmail` inserts an `EmailOutbox` row with `status: 'pending'`
(`router.ts:703-710`). Grep shows no code ever reads `EmailOutbox` for pending rows, transitions
`pending → sent | failed`, or relays anything. The `sent`/`failed` enum values are never written.

Resulting bad state: every approval-notification email is a permanent dead-letter — recorded, never
delivered. Parents are never notified. This is a data dead-end, not corruption, but it is an
unactioned side-effect the design assumes a relay handles.
Recoverable? Yes once a relay lands (rows persist). Severity: MEDIUM (functional dead-end).

### MEDIUM-5 — `classBatchId` is an unvalidated free string; cross-facility / dangling refs possible now, FK migration hazard later. CONFIRMED (present) / SUSPECTED (future)
Trigger: `receiptCreate` accepts `classBatchId` as `z.string().min(1)` with no existence or facility
check (`router.ts:74`, `517-519`); `enrollment.enroll` likewise (`enrollment/router.ts:18,46-53`).
Both `Receipt.classBatchId` and `Enrollment.classBatchId` are plain scalars, no FK (schema.prisma
:187-188, :335-336, confirmed absent in migration FK list).

Resulting bad state: a receipt/enrollment in facility A can carry a `classBatchId` that belongs to
facility B or to no class at all — money and seats bound to a class reference nothing validates.
When the academic phase adds `ClassBatch` + real FKs, existing rows whose `classBatchId` does not
resolve will (a) block `ADD CONSTRAINT ... FOREIGN KEY` (migration aborts) or (b) require a
reconciliation/backfill. Cross-facility class references would also violate the facility boundary the
rest of the system enforces.
Recoverable? Yes with a backfill/repair before the FK migration. Severity: MEDIUM.

### MEDIUM-6 — `createdById` / `approvedById` unvalidated scalars → future AppUser FK migration risk. CONFIRMED (latent)
Trigger: `Receipt.createdById` (required) and `approvedById` (nullable) are plain uuids referencing
the dev-session `userId`, no FK (schema.prisma:189-192). Values are whatever the `x-dev-user` header
supplied.
Resulting bad state: rows can hold ids that never correspond to a real `AppUser`. When the HR/identity
phase adds `AppUser` + FK, non-resolving rows block the constraint or need backfill. Same class of
issue as MEDIUM-5.
Recoverable? Yes with backfill. Severity: MEDIUM (latent).

### MEDIUM-7 — `cmc_app` is over-granted relative to what it needs. CONFIRMED
Trigger: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES ... TO cmc_app` plus the same in
ALTER DEFAULT PRIVILEGES (`20260706054322_...:158-161`).
Resulting bad state: the runtime role can DELETE `Receipt` (money), DELETE/UPDATE `RefundRecord` and
`AuditLog` (append-only), and DELETE `Student`/`Enrollment` — none of which any application path does
or should. The task asks for "exactly the grants it needs (not more, not less)"; this is more. It is
the enabling condition for HIGH-3.
Recoverable? N/A (grant posture). Severity: MEDIUM (least-privilege violation, defense-in-depth).

### MEDIUM-8 — `RefundRecord.facilityId` added NOT NULL with no default/backfill: deploy-blocker on non-empty data. CONFIRMED (greenfield-safe)
Trigger: `ALTER TABLE "RefundRecord" ADD COLUMN "facilityId" TEXT NOT NULL`
(`20260706054322_...:58`) — no DEFAULT, no `USING` backfill. The migration's own warning header flags
it. Same shape for `LoginOtp` DROP `code` + ADD `codeHash TEXT NOT NULL` (`:35-36`).
Resulting bad state: if either table is non-empty at apply time, the migration aborts (Postgres
refuses a NOT NULL add without default on populated tables). On the current greenfield DB both are
empty, so it applies; but re-baselining or applying to any environment that already issued refunds/
OTPs fails hard. LoginOtp additionally drops existing OTP codes (ephemeral, acceptable).
Recoverable? Yes (manual backfill then re-run). Severity: MEDIUM (latent; greenfield-safe today).

### LOW-9 — `timestamptz` conversions lack an explicit `USING ... AT TIME ZONE`: time-shift risk on populated data. SUSPECTED (greenfield-safe)
Trigger: wave-1 does `ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3)` across ~12 tables with no
`USING` clause. Postgres reinterprets existing `timestamp without time zone` values as being in the
session `TimeZone` when converting.
Resulting bad state: if applied to a DB with rows and a session TZ ≠ UTC, all historical timestamps
shift by the offset silently. Zero rows today → no impact. Severity: LOW (latent).

### LOW-10 — Guardian / GuardianLinkRequest carry `facilityId` but have no RLS backstop. CONFIRMED (documented tradeoff)
Trigger: both tables have a `facilityId` column but RLS is intentionally not enabled (migration
comment `:89-95`), because the parent-facing read path spans facilities by `parentAccountId`
ownership. Staff-side `approveLink`/`rejectLink` rely solely on the app-level `scoped()` +
`where facilityId` filter (`guardian/router.ts:104-171`).
Resulting bad state: the facility boundary for these two tables has only the app-level filter; a
future staff-side query that forgets the facility predicate leaks/crosses facilities with no DB
backstop — unlike the six RLS-protected tables. Current code does filter correctly, so no live leak.
Severity: LOW (defense-in-depth gap on a documented exemption; worth a targeted test guard).

### LOW-11 — False `pending` when provisioning succeeds but email enqueue throws. CONFIRMED
Trigger: `enqueueReceiptEmail` is inside the same try as `provisionFromReceipt` (`router.ts:636`). If
provisioning succeeds but the enqueue throws, the catch sets `provisioning: 'pending'` and writes a
retry marker for work already done.
Resulting bad state: a misleading `pending` signal + duplicate marker. Harmless under idempotent
replay (which would no-op) — but there is no replay actor (CRITICAL-1), so the only effect today is a
misleading status/marker. Severity: LOW.

### LOW-12 — refund-then-cancel double money-out (semantic). SUSPECTED
Trigger: `refundCreate` requires `approved` and caps `SUM(refund) ≤ netAmount`. `receiptCancel` with
`void:false` is documented as "hoàn tiền thật" (genuine refund) but writes no `RefundRecord`
(`router.ts:277-389`) and does not check existing refunds. So one can refund the full `netAmount`
via `refundCreate`, then also `receiptCancel` (a second conceptual refund).
Resulting bad state: the money ledger and the cancel action represent two separate refunds of the same
receipt with no cross-check; conceptually money-out can exceed `netAmount` even though the
`RefundRecord` cap alone is respected. Whether this is real depends on how cancel-refund vs
RefundRecord map to actual disbursement (product intent). Severity: LOW / needs product confirmation.
(cancel-then-refund is correctly blocked: refund requires `approved`, cancel sets `cancelled`.)

---

## Integrity guarantees CONFIRMED to hold

- Money transaction atomicity: `runMoneyTransaction` uses an atomic `updateMany WHERE status='draft'`
  claim; a concurrent double-approve loses (count≠1 → CONFLICT) and cannot double-provision on a stale
  read (`router.ts:194-200`). Approve + O5 advance + audit commit together; provisioning is correctly
  outside the tx per ADR 0041.
- Refund cap is race-safe: `SELECT ... FOR UPDATE` on the Receipt serialises concurrent refunds, so
  two refunds that each fit alone but together exceed `netAmount` can only have one succeed
  (`router.ts:435-505`). Cap logic delegated to `assertRefundWithinCap`.
- Refund idempotency: app-level `(receiptId, idempotencyKey)` check plus a DB unique index
  (`RefundRecord_receiptId_idempotencyKey_key`) — a concurrent replay cannot race past it.
- Cancel opp-revert race: `SELECT ... FOR UPDATE` on the Opportunity before deciding to revert O5→O4
  prevents two concurrent cancels from both skipping the revert and stranding the opp at O5 with zero
  approved receipts (`router.ts:313-333`).
- Provisioning is genuinely idempotent (find-or-create by phone / `createdByReceiptId` / studentId;
  P2002-refetch in a fresh transaction) — replay creates no duplicates. The design is sound; only the
  retry actor is missing (CRITICAL-1).
- No-orphan-student at the app layer: a new Student is always created with `createdByReceiptId`
  (unique), and renewal reuse only ever reuses a Student validated in-facility at `receiptCreate`
  (`router.ts:544-551`) and re-validated in-facility at provisioning
  (`provision-from-receipt.ts:96-110`). `Receipt.studentId` cannot be set cross-facility via the API.
- RLS coverage is complete for the six tables whose access boundary is a single facility (Contact,
  Opportunity, Receipt, RefundRecord, Student, Enrollment), each with a `facility_isolation` policy;
  and it fails CLOSED — a query outside `withFacility()` has no GUC and returns 0 rows, not
  unrestricted (verified by policy shape + `rls-enforcement.test.ts`). The three `facilityId`-bearing
  tables without a policy are ReceiptCodeCounter (global sentinel key) and Guardian/GuardianLinkRequest
  (documented cross-facility parent path — see LOW-10).
- `app.bypass_rls` is only set inside `withFacility(..., { bypass: true })` as a transaction-LOCAL
  GUC, and every call site is server-side and gated by `parentAccountId` ownership or a server-derived
  facility (enrollment.mine, getApprovedChildren, guardian.requestLink, tests). No untrusted/
  client-controlled path can turn it on. LOCAL scope prevents leakage across pooled connections.
- Partial unique index `enrollment_active_reserved_unique` enforces at most one reserved/active
  Enrollment per (facility, student, class) while allowing re-enrollment after withdrawn/completed;
  `activateEnrollmentForReceipt` only ever treats reserved/active as "existing" (M8 fix), never a
  terminal row.

---

## Severity counts

- CRITICAL: 1 (money orphan / no retry consumer)
- HIGH: 2 (marker-less crash-window orphan; append-only not DB-enforced)
- MEDIUM: 5 (outbox dead-end; unvalidated classBatchId; unvalidated createdById/approvedById;
  over-granted cmc_app; NOT NULL add without backfill)
- LOW: 4 (timestamptz conversion; Guardian/GuardianLinkRequest no-RLS; false pending; refund+cancel)

## Verdict

NOT production-ready for the data-integrity/recovery bar it sets for itself. The concurrency,
RLS, idempotency, and atomic-claim work is genuinely strong and mostly correct — but the entire
ADR 0041 story ("money atomic, provisioning idempotent + retryable, no orphan student") depends on a
retry/relay consumer that is **not implemented**. Today, any provisioning failure or a crash in the
post-commit window permanently orphans committed money with no automated recovery, and in the crash
case with no marker to reconcile from. That single gap turns an otherwise well-built money gate into a
source of unrecoverable inconsistency. Secondary but real: the append-only ledgers have no DB
enforcement and the runtime role is over-privileged, so the "append-only" and "least-privilege"
invariants are asserted but not backed.

Top fixes, in order: (1) implement (or gate approvals behind) a provisioning retry/outbox consumer
that drains `provisioning.retry_pending` and `EmailOutbox.pending` idempotently; (2) add a
reconciliation query/job that finds `approved` receipts with no resolved Student/Enrollment
(covers the marker-less crash case); (3) REVOKE UPDATE/DELETE on RefundRecord and AuditLog from
cmc_app (or enforce append-only via trigger) and trim cmc_app grants to least privilege.

## Unresolved questions

- Is a provisioning/outbox worker planned for a later wave, or is P1 expected to ship the money gate
  without one? If later, approvals should arguably be blocked or flagged until it exists.
- Product intent for cancel(void:false) vs RefundRecord: are they two disbursement events or one? This
  determines whether LOW-12 is a real double-refund.
- Is the `APPROVAL_SECOND_EYE_THRESHOLD` placeholder (20,000,000 VND) acceptable to ship, or does it
  need a decision doc (flagged as an assumption in code)?

Status: DONE
