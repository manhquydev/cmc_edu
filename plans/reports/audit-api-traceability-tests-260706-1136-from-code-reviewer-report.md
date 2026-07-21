# P1 API-Contract Fidelity, Traceability & Test-Quality Audit

Branch: feat/p1-identity-enrollment · Scope: CMC EDU v2 P1 backend (apps/api + packages/domain-*, packages/auth) · Mode: READ-ONLY (no edits)

## Real test/coverage numbers (executed)

| Suite | Files | Tests | Result |
|---|---|---|---|
| `@cmc/api` (integration, real Postgres `cmc-pg`) | 9 | 56 | all pass |
| `@cmc/domain-finance` (unit) | 6 | 23 | all pass |
| `@cmc/domain-identity` (unit) | 2 | 7 | all pass |
| `@cmc/auth` (unit) | 1 | 8 | all pass |
| **Total** | **18** | **94** | **all pass** |

Per-file API counts: health 1 · crm/stage 6 · finance/create-from-opp 5 · finance/approve 8 · finance/cancel-refund 11 · enrollment/reserved-active 8 · guardian/link 7 · lms-auth/login 6 · provisioning/idempotent 4.

**Coverage %: NOT OBTAINABLE.** `@vitest/coverage-v8` is not installed — `vitest run --coverage` fails with `Failed to load url @vitest/coverage-v8`. TL29 §2 sets finance/provisioning ≥90%, auth/RLS ≥85%, but **no coverage provider is configured for any package**, so the numeric targets are unverifiable and unenforced in CI. (CONFIRMED)

## Traceability matrix (TL25 P1 rows → code → test)

| WF | Procedure(s) present? | Permission correct? | Test file | Acceptance genuinely proven? | Gap |
|---|---|---|---|---|---|
| P1-01 crm | `crm.opportunityCreate/Advance/MarkLost/Lookup` ✓ (+`opportunityList`) | `crm.*` = sale, GĐKD (+cskh/ctv/ke_toan on read) ✓ | crm/stage.test.ts (6) | O5 manual-block ✓, skip-stage ✓, lostReason+reopen ✓, lookup dedup ✓, cross-facility RLS ✓ | `opportunityList` has **no test** (pagination shape only asserted by inspection) |
| P1-02 receiptCreate | `finance.receiptCreate` ✓ | `finance.receiptCreate` = GĐKD, sale, **ke_toan** | finance/create-from-opp.test.ts (5) | link+code ✓, dup-phone warning narrow ✓, missing amount/class BAD_REQUEST ✓, FORBIDDEN ✓ | **"Opp chưa O4 → cảnh báo" branch untested** (`opportunityNotAtO4Warning`); dup test doesn't assert *which* warning |
| P1-03 receiptApprove | `finance.receiptApprove` ✓ | registry = GĐKD, GĐĐT, **ke_toan** | finance/approve.test.ts (8) | I1 sale FORBIDDEN ✓, I2 auto-O5+closedAt ✓, I4 netAmount frozen ✓, ADR-B self-approve audit+threshold ✓, kind new/renewal ✓, concurrent double-approve ✓ | doc says "ke_toan **deferred**" but registry grants it (contract mismatch, untested either way) |
| P1-04 provisioning | internal `provisionFromReceipt` ✓ | n/a (internal) | provisioning/idempotent.test.ts (4) | no-orphan student ✓, no-rollback-on-fail ✓, sequential replay idempotent ✓, phone race→1 ParentAccount ✓ | **concurrent same-receipt Enrollment activation is a duplicate-row race, untested** (see F1) |
| P1-05 enroll reserved→active | `enrollment.enroll` + internal `activateEnrollmentForReceipt` ✓ | `enrollment.enroll` = GĐKD, GĐĐT, sale ✓ | enrollment/reserved-active.test.ts (8) | reserved created ✓, no auto-flip ✓, activation path ✓, idempotent activation (sequential) ✓, no direct active mutation ✓, RLS ✓ | "reserved không điểm danh được" acceptance not provable in P1 (attendance is P2 — acceptable defer); backfill-migration acceptance untested |
| P1-06 guardian link | `guardian.requestLink/approveLink/rejectLink` ✓ | `guardian.approveLink` = GĐKD,GĐĐT,sale,GV,cskh (hr excluded) ✓ | guardian/link.test.ts (7) | no child-data while pending ✓, approve→Guardian+read ✓, reject→no access ✓, staff-only (UNAUTHORIZED/FORBIDDEN) ✓, already-linked/duplicate-pending no-op ✓ | concurrent approve/reject race claimed atomic but **untested**; cross-facility approve RLS untested |
| P1-07 lms login | `lmsAuth.requestOtp/verifyOtp` + `enrollment.mine` ✓ | publicProcedure / lmsProcedure ✓ | lms-auth/login.test.ts (6) | OTP issue-not-returned ✓, expired==wrong generic ✓, no-account generic ✓, replay blocked ✓, ≥2 picker + blocked_lms excluded ✓ | none material |
| P1-08 cancel/refund | `finance.receiptCancel` + `finance.refundCreate` ✓ | Cancel gated by `finance.receiptApprove` ✓; refund by `finance.refundCreate` = GĐKD, ke_toan | finance/cancel-refund.test.ts (11) | I3 revert-sole / no-revert-with-2nd ✓, sale FORBIDDEN ✓, non-approved BAD_REQUEST ✓, void vs genuine lifecycle ✓, I5 cap+append-only+concurrent FOR UPDATE ✓ | **refundCreate has no idempotency key** → sequential retry double-refunds (see F2) |
| P1-09 recon | **ABSENT** (deferred) | — | — (no `agent/recon.spec`) | — | Deferred per plan — CONFIRMED no router/test/audit procedure exists; only referenced in comments |

Overall: 8/8 non-deferred P1 rows have a real, DB-backed test that genuinely asserts the named invariants (not phantom "resolves without error" tests). Test quality is generally high — assertions read DB state back, negative/FORBIDDEN/RLS cases exist, and two genuine concurrency tests (double-approve, concurrent-refund) prove the atomic-claim / FOR UPDATE mechanics. The gaps below are real but mostly at the edges.

## Ranked findings

### HIGH

**F1 — Concurrent same-receipt provisioning duplicates the active Enrollment (idempotency hole). CONFIRMED (structural) / SUSPECTED (runtime).**
`apps/api/src/enrollment/activate-enrollment.ts:29-46` does `findFirst` then `create` with **no unique constraint** on `Enrollment(facilityId, studentId, classBatchId)` (schema.prisma:284-298 has only `@@index`) and **no P2002 catch** (unlike `findOrCreateParentAccount/Student/StudentAccount` in provision-from-receipt.ts, which all guard P2002). Under a concurrent replay of the *same* receipt (approve-retry racing the outbox worker — the exact scenario ADR 0041 / WF-P1-04 "idempotent replay" targets), both calls resolve to the same Student, both `findFirst` see no enrollment, both insert → **two `active` enrollments**. TL29 §4 mandates "replay không nhân đôi". The idempotent test (idempotent.test.ts:170-201) only exercises **sequential** replay; the race test (203-236) uses **different** students so enrollment never collides. So the concurrent-replay branch of the ADR-0041 acceptance is unproven and the code is very likely defective. Fix path: add `@@unique([facilityId, studentId, classBatchId])` + P2002-refetch in `activateEnrollmentForReceipt`, and a test with two concurrent `provisionFromReceipt` calls on the *same* receipt asserting one enrollment.

### MEDIUM

**F2 — `finance.refundCreate` is not idempotent and has no `idempotencyKey`; a retry double-refunds. CONFIRMED.**
docs/11 §4 requires money-mutations to be "idempotent HOẶC có idempotencyKey — vì agent (consumer outbox) có thể gọi lại khi retry". `refundCreate` (finance/router.ts:366-417) appends a new `RefundRecord` on every call. The `FOR UPDATE` lock only serialises the cap check; two sequential identical refunds (e.g. 2M on a 10M receipt) both succeed → double refund. The concurrency test (cancel-refund.test.ts:224-245) proves the *cap* under contention but not *retry idempotency*. No `idempotencyKey` field exists on the input. Mitigant: refund is HITL (GĐKD) in P1, not yet agent-driven — but the contract obligation already applies and the append-only test (206-222) actually demonstrates the double-append behaviour is by-design-unbounded. Flag for decision, not silent.

**F3 — `finance.receiptApprove`/`receiptCreate` registry contradicts the documented contract on `ke_toan`. CONFIRMED, untested.**
docs/11 §5 catalog: `finance.receiptApprove (v2: GĐKD — ke_toan deferred)`; WF-P1-03 names approvers GĐKD + GĐĐT only. But `packages/auth/src/index.ts:50` grants approve to `['giam_doc_kinh_doanh','giam_doc_dao_tao','ke_toan']`, and `:47` grants create to `['...','sale','ke_toan']`. `ke_toan` is documented as deferred for v2 yet is live in the money-gate. No test asserts whether `ke_toan` can/cannot approve, so the divergence is invisible to CI. Either the doc note is stale or the registry over-grants — needs a decision (SoD-sensitive: this is the money gate).

**F4 — No finance cross-facility RLS negative test. CONFIRMED.**
TL29 §4 mandates an RLS negative test ("query cơ sở A không thấy dữ liệu cơ sở B") and finance is the ≥90% money module. crm/stage.test.ts:95 and reserved-active.test.ts:114 prove RLS for CRM and enrollment, but **no test proves a GĐKD in facility B gets NOT_FOUND when approving/cancelling/refunding a facility-A receipt.** The code scopes correctly (`findFirst({where:{id,facilityId}})` in runMoneyTransaction/runCancelTransaction/runRefundTransaction), so this is a *missing proof*, not a known break — but it is exactly the mandated money-RLS negative case.

**F5 — WF-P1-02 "Opp chưa O4 → cảnh báo" acceptance edge untested. CONFIRMED.**
`opportunityNotAtO4Warning` (finance/router.ts:432-445) implements the WF-P1-02 exception but no test creates a receipt against a non-O4 opportunity and asserts the warning/narrowing. The dup-phone test (create-from-opp.test.ts:64-80) asserts only `message.length > 0`, not which of the two warning sources fired, so the not-at-O4 branch has zero coverage.

### LOW

**F6 — `crm.opportunityList` has no test.** Only paginated endpoint; shape `{items,total,page,pageSize}` matches docs/11 §3 by inspection (crm/router.ts:189) but is unexercised. Not a TL25-named procedure, so non-blocking.

**F7 — Guardian approve/reject concurrency claimed but untested.** guardian/router.ts:111-117 uses the same atomic-claim pattern as receiptApprove and the comment asserts race safety, but no concurrent approve-vs-reject test exists (unlike finance, which does test it).

**F8 — `enrollment.reserved-active` "no direct mutation" test is structural/weak.** reserved-active.test.ts:95-103 asserts `setActive/activate/updateStatus` reject with NOT_FOUND (tRPC proxy on a missing procedure). It proves the procedures are absent but is a proxy-behaviour assertion rather than an invariant check; acceptable but brittle if tRPC error mapping changes.

**F9 — `SELF_APPROVE_THRESHOLD = 20,000,000` is an undocumented placeholder** (finance/router.ts:29, self-documented ASSUMPTION). No decision doc pins the figure; the recon agent (WF-P1-09) that would surface over-threshold self-approves is deferred. Tests hard-code `SELF_APPROVE_THRESHOLD ± 1`, so they'd silently follow any future change of the constant rather than pinning business intent.

## Positive observations (risk-calibration)

- Two genuine concurrency tests hit the real DB and assert exactly-one-winner semantics (approve.test.ts:107-135 double-approve; cancel-refund.test.ts:224-245 concurrent refund) — these are real race proofs, not happy-path theatre.
- Atomic-claim pattern (`updateMany WHERE status=...` + count check) is applied consistently across receiptApprove/receiptCancel/guardian.approveLink/verifyOtp, and the finance comment (finance/router.ts:31-42) documents a real pre-existing counter-keying bug fixed in-phase with rationale.
- Provisioning correctly runs *outside* the money transaction with a retry marker (finance/router.ts:509-544), and the test proves netAmount survives a provisioning failure (idempotent.test.ts:120-168).
- Child-data boundary (docs/08 §7) is enforced in one shared gate (`getApprovedChildren`) and negatively tested (pending/rejected → `[]`, blocked_lms excluded).

## Verdict

**CONDITIONAL PASS.** The P1 backend is materially real: 94/94 tests pass against a live Postgres, every non-deferred TL25 row maps to an existing correctly-permissioned procedure with a test that genuinely asserts its invariants, and the money/identity core has real concurrency and RLS-per-domain coverage. It is **not** a rubber-stamp-worthy "green" though — one HIGH idempotency hole (F1: concurrent Enrollment duplication, no unique constraint), one MEDIUM money-retry gap (F2: refund double-append), a MEDIUM SoD contract divergence (F3: ke_toan on the money gate vs "deferred"), and the mandated finance-RLS negative test (F4) are missing. Coverage targets (TL29 §2 ≥90%/≥85%) are **unenforceable** — no coverage provider is installed.

Counts: 9 findings (1 HIGH, 4 MEDIUM, 4 LOW) · 94 tests pass · 0 fail · coverage unmeasured (no provider) · 8/8 active P1 rows traced · P1-09 confirmed deferred.

## Unresolved questions

1. F3: is `ke_toan` intended to hold `finance.receiptApprove` in v2, or is docs/11's "ke_toan deferred" the authoritative contract? (SoD/money-gate decision — needs owner.)
2. F2: does refund idempotency need to land in P1, or is it acceptable while refund stays HITL-only until the agent/outbox phase?
3. Should a coverage provider be added now so TL29 §2 targets are actually gated in CI, or is that scoped to the CI-hardening phase?
</content>
</invoke>
