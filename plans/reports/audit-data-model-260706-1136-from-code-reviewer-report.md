# Data-Model / Schema Fidelity Audit — CMC EDU v2 P1 (identity · enrollment)

Read-only audit. Compares the actual Prisma schema + migration against docs 01/07/08/10/16/22/24/30.

- Scope: `packages/db/prisma/schema.prisma`, migration `20260706025956_p1_identity_enrollment`, `packages/db/src/index.ts`, cross-checked against `apps/api/src/**`.
- Probes: `prisma validate` → valid; `prisma migrate status` → up to date (1 migration applied to `cmc_edu`).

---

## Ranked divergences (most severe first)

### D1 — No `Receipt.studentId`: every approved receipt provisions a NEW Student; renewal duplicates the child — CONFIRMED — HIGH
- Location: `schema.prisma` `Receipt` (no `studentId`), `Student.createdByReceiptId @unique`; `provisioning/provision-from-receipt.ts:67-95` `findOrCreateStudent` keys solely on `receipt.id`.
- Evidence: `findOrCreateStudent` looks up `where: { createdByReceiptId: receipt.id }`. Because each receipt has a distinct id, a second (renewal) receipt for the same child finds no existing student and creates a brand-new `Student` row. `computeReceiptKind` detects `renewal` via `parentPhone` match (`finance/router.ts:143-152`) but nothing links the renewal receipt back to the existing Student.
- Why it matters: Domain (docs/07 §4 "createdByReceipt"; docs/22 ADR-0041; docs/10 ERD `Receipt ||--o| Student`) treats renewal = same child. Schema forces one Student per receipt, so a renewing child fragments into N Student rows — split enrollment/attendance/assessment history, inflated headcount, broken guardian links. This is the single most severe fidelity defect: the money-gate provisioning cannot express "same child, new term."
- Note: 1:1 `Student.createdByReceiptId` is correct for provenance of *new* enrollment but is structurally unable to model renewal. A renewal path needs either `Receipt.studentId` (nullable, set on renewal) or a separate provisioning branch that resolves an existing Student before create.

### D2 — Missing Enrollment uniqueness `(facilityId, studentId, classBatchId)` → duplicate/`active` races — CONFIRMED — HIGH
- Location: `schema.prisma` `Enrollment` (only `@@index([facilityId])`, `@@index([studentId])`; no `@@unique`); `enrollment/activate-enrollment.ts:29-46`; `enrollment/router.ts:44-51`.
- Evidence: `activateEnrollmentForReceipt` does `findFirst(...)` then `create(...)` with no DB constraint. Provisioning is explicitly idempotent-by-replay (approve retry racing the outbox worker, per ADR-0041), but the enrollment step has no unique guard — two concurrent replays both miss the `findFirst` and both `create` an `active` row. Separately, `enrollment.enroll` can create unlimited `reserved` rows for the same student+batch.
- Why it matters: Task-flagged invariant. Duplicate enrollments double-count a student in a class, and duplicate `active` rows break the "active ⇔ one approved receipt" model (ADR-A). The idempotency claim in `provision-from-receipt.ts` header ("replay không nhân đôi") is *false* for the enrollment step under concurrency — it relies on the missing unique index. All other provisioning steps (ParentAccount.phone, Student.createdByReceiptId, StudentAccount.studentId) DO have unique constraints and correctly catch `P2002`; Enrollment is the one gap.
- Fix direction: add `@@unique([facilityId, studentId, classBatchId])` (or partial unique on active) and convert the create to catch `P2002`+refetch like the sibling steps.

### D3 — RLS is application-convention only; no Postgres row-level security — CONFIRMED — HIGH
- Location: migration has zero `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY`; `trpc.ts:30-33` + `scoped()` comment: "RLS is enforced by convention: filter every domain query by facilityId."
- Evidence: grep of `packages/db/prisma/` finds no RLS DDL. Isolation depends on every query manually including `where: { facilityId }`.
- Why it matters: docs/10 §4 invariant, docs/01 I10, docs/08 §3, docs/30 T12 all name "RLS theo facilityId" as a hard invariant; T12/T9/T13 rank children-data cross-facility leakage as a HIGH-priority asset (P0–P1). "RLS" in a Postgres context means database-enforced policies (defense-in-depth); the implementation provides none. A single query that forgets the filter, or any future `$queryRaw`, leaks across facilities with no backstop. `refundRecord.aggregate` (`finance/router.ts:387`) and `enrollment.mine` (`enrollment/router.ts:62`) already query without a `facilityId` predicate (safe today only because they key off an already-scoped id / cross-facility-by-design identity, respectively) — exactly the pattern that a DB policy would harden.
- Caveat: This may be an accepted P1 deferral (schema comment frames it as convention). Flagging because the invariant text says RLS, not "app-level filtering," and the sensitive asset is children data. Recommend an explicit ADR if DB-level RLS is deferred.

### D4 — `RefundRecord` has no `facilityId` (violates "every business model has facilityId") — CONFIRMED — MEDIUM
- Location: `schema.prisma` `RefundRecord` (fields: `receiptId, amount, createdAt` only).
- Why it matters: docs/10 §4 "Mọi bảng nghiệp vụ có facilityId (RLS)". RefundRecord is a money-ledger business table (I5). Without `facilityId` it cannot participate in any facility RLS policy directly and cannot be facility-filtered without a join to Receipt. Once D3's DB-RLS is added, RefundRecord will need a denormalized `facilityId` (standard pattern for ledger children) or a policy via `receiptId` subquery. `AuditLog` similarly lacks `facilityId` (arguably acceptable for a global audit trail, but note it means cross-facility audit reads are unrestricted).

### D5 — Loose string scalars for real entities → no FK integrity — CONFIRMED (acknowledged as phased) — MEDIUM
- Location / risk list:
  - `Receipt.classBatchId`, `Enrollment.classBatchId` → `ClassBatch` (not modeled). No FK; any string is accepted (`enrollment.enroll` input is `z.string().min(1)`, not a uuid). Dangling/typo class ids are silently persisted.
  - `Receipt.createdById` (NOT NULL), `Receipt.approvedById` → `AppUser` (not modeled). No FK; these hold the dev-session `userId` from `context.ts`. `AuditLog.actor` likewise a free string.
- Why it matters: The schema comments document this as deliberate (models land in academic/HR phases). Real risk is at the *later* migration: when `ClassBatch`/`AppUser` arrive, existing rows may hold ids that don't resolve, blocking FK addition without a data-cleaning backfill. Also `Receipt.classBatchId` is nullable in schema but treated as required by business rule (`finance/router.ts:428` throws if absent) — the nullability/`NOT NULL` mismatch is enforced only in app code. Acceptable for P1 if tracked; listing per task instruction.
- Also not-yet-modeled but referenced by P1 workflow docs: `TestAppointment` (docs/24 WF-P1-01 O3), `OpportunityAssignment` + `Voucher` (docs/10 dictionary). O3_TEST_SCHEDULED has no backing appointment record — stage advances with no persisted trial-class entity. Deferred; note only.

### D6 — `StudentLifecycle` cannot distinguish "void/archive" from ordinary "withdrawn" — SUSPECTED — MEDIUM
- Location: enum `StudentLifecycle { active, blocked_lms, withdrawn }`; `finance/router.ts:214-223, 308-316`.
- Evidence: docs/24 WF-P1-08 + docs/07 §4 QĐ0024 specify two distinct cancel outcomes — genuine refund → *keep* lifecycle; mistaken void → *archive + withdraw*. The code (honestly documented as an ASSUMPTION) collapses "archive" onto `withdrawn` because no `archived` value exists. Result: a student void-cancelled and a student who legitimately withdrew end up in the same terminal state; the archive/withdraw distinction QĐ0024 asks for survives only in the `AuditLog.data.void` flag, not queryable on the Student.
- Why it matters: Task asked "missing 'archived'?" — no doc formally enumerates `archived`, so this is not strictly a spec violation, but the domain intent (QĐ0024) is not representable in the current enum. Decide: add `archived`, or accept audit-log-only provenance.

### D7 — Timestamps are `timestamp(3)` (no time zone), not `timestamptz` — CONFIRMED — MEDIUM/LOW
- Location: every `DateTime` column → `TIMESTAMP(3)` in migration (Prisma default).
- Why it matters: docs/10 §5 mandates "lưu UTC, bucket theo ICT (UTC+7) — nhất là biên tháng lương (QĐ0025)". Prisma writes UTC values, but a `timestamp`-without-tz column carries no offset, so any raw-SQL consumer or DB-side date bucketing (`date_trunc`) operates in the session zone and can bucket ICT-boundary rows into the wrong month. `timestamptz` is the safer default for the payroll/ICT bucketing requirement. Latent (payroll is a later phase) but the substrate is being set now.

### D8 — Missing composite index for the renewal/dup-detection queries — CONFIRMED — LOW (performance)
- Location: `finance/router.ts:143-151` (`findFirst where facilityId, parentPhone, status`) and `:447-450` (dup check `where facilityId, parentPhone`). `Receipt` only indexes `facilityId` and `opportunityId`.
- Why it matters: The renewal-kind lookup runs on *every* `receiptApprove` and scans by `(facilityId, parentPhone)` with no supporting index → sequential-ish scan that degrades as receipt volume grows. Add `@@index([facilityId, parentPhone])`.

### D9 — `Receipt.netAmount`/`RefundRecord.amount` = `Decimal(14,2)`; input is JS `number` — LOW
- Location: `schema.prisma:166,193`; `finance/router.ts:49` `amount: z.number().positive()`.
- Why it matters: VND is an integer currency (no minor units); scale `2` is unnecessary (harmless). Precision 14 allows ~1 trillion VND — adequate. Larger concern is the boundary: amounts arrive as JS floats and are handed to Prisma Decimal; within `Number.MAX_SAFE_INTEGER` this is fine for realistic tuition, but summing floats client-side before submit risks rounding. Money-in-JS-float is a known smell; not a schema bug. Note only.

### D10 — Minor enum-name divergences vs docs — LOW
- `LoginOtpStatus { pending, verified, expired }` — docs/24 WF-P1-07 + docs/07 state machine call the initial state `issued` (glossary: "LoginOtp: issued → verified | expired"). Code uses `pending`. Semantically equivalent; name drifts from ubiquitous-language doc.
- `enrollment.enroll` input accepts `opportunityId` (`enrollment/router.ts:18`) and docs/11 lists it, but `Enrollment` has no `opportunityId` column → silently dropped. Either model it or drop from the input contract.

---

## What MATCHES the docs correctly

- `EnrollmentStatus { reserved, active, completed, transferred, withdrawn }` — exactly ADR-A (docs/16); `pending_payment` correctly NOT added; two-step `reserved→active` is Receipt-driven with no client-facing mutation setting `active` (`activate-enrollment.ts` is internal-only). Faithful.
- `OpportunityStage O1_LEAD…O5_ENROLLED` — matches docs/07 §3, docs/24; O5 auto-advance only inside `receiptApprove` (`finance/router.ts:179-183`), never a manual setter. I2/I3 (auto-O5 on approve; revert O4 + clear closedAt on sole-receipt cancel) implemented and match docs/01.
- `ReceiptStatus { draft, approved, sent, cancelled }`, `ReceiptKind { new, renewal }` — match; `kind` computed before stage mutation (docs/07 §4 "tính TRƯỚC update stage") — honored at `finance/router.ts:142-163`.
- I4 (netAmount frozen after approve): `runMoneyTransaction` never writes `netAmount`; approval `updateMany` sets only status/approvedById/kind. Correct.
- I5 (refund append-only, cap `SUM ≤ netAmount`, `FOR UPDATE`): `runRefundTransaction` uses `SELECT … FOR UPDATE` + aggregate + create-only. Correct; matches docs/01, docs/30 T4.
- I6 / ADR-0041 provisioning: ParentAccount find-or-create by normalized phone with `P2002`+refetch race handling; provisioning split out of the money transaction (failure records `provisioning.retry_pending`, does not roll back money). Matches docs/22, docs/24 WF-P1-04.
- `ParentAccount.phone @unique` (system-wide, not facility-scoped) — CONFIRMED present; matches docs/10 §4 invariant #3 / ADR-0041. `Student.createdByReceiptId @unique` nullable — matches provenance + break-glass intent (orphan allowed at DB level only for the admin path; app path always sets it).
- `Guardian @@unique([parentAccountId, studentId])` + `GuardianLinkStatus { pending, approved, rejected }` — matches WF-P1-06; parent sees child data only after `approved` (gate in `guardian/approved-children.ts`, enforced by `enrollment.mine`).
- `StudentLifecycle` includes `blocked_lms` — matches ADR-0038 `BLOCKED_LMS_LIFECYCLE` gating and WF-P1-07 LMS block.
- `EmailOutbox` (`EmailTransport { graph, brevo }`, `EmailOutboxStatus { pending, sent, failed }`) — matches docs/07 §6 outbox pattern; written in the approve path for at-least-once delivery.
- facilityId indexed on all facility-scoped business tables (Contact, Opportunity, Receipt, Student, Guardian, GuardianLinkRequest, Enrollment). ReceiptCodeCounter correctly global (`GLOBAL_RECEIPT_CODE` key) per docs/19 §2 — and the pre-existing per-facility keying bug is already fixed in `finance/router.ts:43-465`.
- PII columns (`nationalId`, `bankAccount`): NOT present in P1 schema at all — consistent with data-minimization for children (docs/08 §7) and the fact that these belong to later HR/student-profile phases. So the plaintext-PII risk (docs/10 V6, docs/08 §3, T13) is not yet in scope; no violation today. Flag for the phase that introduces them: they must land encrypted, not as plain columns.

---

## Verdict

The P1 substrate faithfully implements the money-gate invariants (I2–I6), the Receipt-driven enrollment state machine (ADR-A), and the identity uniqueness rules — the hard, money-touching parts are correct and well-guarded. The fidelity gaps are concentrated in three structural areas that should be resolved before layering the academic/HR phases on top:

1. Renewal cannot be modeled (no `Receipt.studentId`) — duplicates the child (D1).
2. Enrollment lacks the uniqueness constraint its own idempotency story depends on (D2).
3. "RLS" is convention, not database-enforced, on the most sensitive asset (children data) (D3).

Recommend treating D1–D2 as blocking for the enrollment domain (they are data-integrity defects, not style), D3 as an explicit ADR decision (enforce Postgres RLS or formally accept app-level filtering), and D4–D10 as tracked follow-ups on the respective later phases.

## Severity counts
- HIGH: 3 (D1, D2, D3)
- MEDIUM: 3 (D4, D5, D6) + 1 MEDIUM/LOW (D7)
- LOW: 3 (D8, D9, D10)

## Unresolved questions
- Is DB-level Postgres RLS a P1 requirement or an accepted deferral? The invariant text says "RLS"; the code says "by convention." Needs an explicit decision (D3).
- Renewal (D1): intended model — nullable `Receipt.studentId` set on renewal, or a distinct renewal receipt flow that resolves the existing Student? Domain owner call.
- `StudentLifecycle` (D6): add `archived`, or accept that void-vs-withdraw provenance lives only in AuditLog?
