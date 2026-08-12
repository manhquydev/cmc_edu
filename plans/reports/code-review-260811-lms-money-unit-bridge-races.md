# Code Review — LMS money→unit bridge races / RLS

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike` (commits `f7fc46b`, `cd84c82`)  
**Scope:** money-bridge grant/revoke/reconcile only  
**Posture:** production-readiness, evidence-backed  

## Scope

| File | Role |
|------|------|
| `apps/api/src/lms-ops/grant-units.ts` | grant + revoke writer |
| `apps/api/src/worker/reconcile-orphaned-receipts.ts` | missing-range repair |
| `apps/api/src/finance/router.ts` | cancel + full-refund revoke |
| `apps/api/src/provisioning/provision-from-receipt.ts` | post-activate grant |

**Focus checklist**

1. Race: full refund vs `grantUnitsFromReceipt`
2. Race: `receiptCancel` vs grant
3. Race: provision + reconciler double grant (`sourceReceiptId` unique)
4. Cancel revoke + M9 (other approved receipt keeps enrollment)
5. Reconciler SQL: `unitCount` null vs 0; false +/−
6. RLS: `withFacility` in grant-units; `FOR UPDATE` on Receipt/Enrollment

---

## Overall Assessment

The **concurrent money paths (refund/cancel vs grant)** are designed correctly: both refund and grant serialize on `Receipt ... FOR UPDATE`; cancel uses atomic `updateMany` on the same row; grant refuses non-`approved` and zero residual balance; double grant is idempotent via unique `sourceReceiptId` + `P2002`.

The **repair path is not**. Treating “no `EnrollmentUnitRange` for this `sourceReceiptId`” as “never granted” is false whenever ranges were intentionally removed while the receipt stays `approved` with residual balance. That is a production entitlement bug, not a theoretical race.

---

## Critical Issues

### C1 — Reconciler re-grants after intentional `revokeFromNext` delete (free units)

**Evidence**

- Reconciler orphan predicate (`reconcile-orphaned-receipts.ts` ~134–151):

```sql
-- unitCount = 0 excluded; NULL or <> 0 included
AND (resolved."unitCount" IS NULL OR resolved."unitCount" <> 0)
AND EXISTS (active Enrollment for class)
AND NOT EXISTS (
  SELECT 1 FROM "EnrollmentUnitRange" eur
  WHERE eur."sourceReceiptId" = resolved."receiptId"
)
```

- `lmsOps.revokeFromNext` (`router.ts` ~530–535) **hard-deletes** whole ranges when `fromOrderGlobal >= input.fromOrderGlobal`, including receipt-sourced rows (`sourceReceiptId` set).
- Repair calls `provisionFromReceipt` → `grantUnitsFromReceipt`, which only refuses grant when **full residual ≤ 0** or status ≠ `approved`. After ops revoke, receipt is still approved with full (or partial) balance → grant **succeeds**.

**Failure scenario**

1. Approve + provision: range `[301–304]` with `sourceReceiptId = R`, `unitCount = 4`.
2. GĐĐT `revokeFromNext({ fromOrderGlobal: 301 })` deletes that row (class current ≤ 301).
3. Worker `reconcileOrphanedReceipts` selects R as orphan (approved, active enrollment, no range, unitCount ≠ 0).
4. `grantUnitsFromReceipt` recreates `[301–304]`.
5. Student regains full package after an intentional cut. Money ledger unchanged.

**Impact:** teaching entitlement integrity / free LMS access after ops revoke. Introduced by this slice’s missing-range OR clause (`cd84c82`).

**Fix direction (pick one, product-aligned)**

- Do not use “row absent” alone: require a never-succeeded grant signal (e.g. no `enrollment.grantUnitsFromReceipt` / `provisioning.completed` with `unitRangeId`, or a sticky `unitsGrantState` on Receipt).
- Or: `revokeFromNext` must not delete receipt-sourced rows without a tombstone (`revokedAt` / zero-length forbidden by check — use explicit `EnrollmentUnitRangeRevocation` / receipt flag `unitsRevokedByOps`).
- Or: exclude receipts that ever had a range for `sourceReceiptId` via audit/history table.

Until fixed: **do not merge** the missing-range reconciler arm as written.

---

## High Priority

### H1 — Full refund → permanent reconciler false positive (fail loop, no free units)

**Evidence**

- Full refund keeps `Receipt.status = 'approved'` (only appends `RefundRecord`; no status flip) — `runRefundTransaction`.
- Revoke deletes ranges in same tx when `remaining <= 0`.
- Reconciler still selects those receipts (status approved + no range).
- `grantUnitsFromReceipt` correctly throws after `FOR UPDATE` + residual check (`net - refunded <= 0`).
- Worker records `worker.reconcileOrphanedReceipts.failed` every drain cycle.

**Failure scenario**

1. Full refund after successful grant → ranges gone, receipt still approved.
2. Every reconcile pass: select → provision → grant throws → `failed`.
3. Audit noise; can mask real orphans; worker thrash.

**Not a free-unit exploit** (grant refuses). Still production reliability defect for the new repair path.

**Fix:** exclude fully-refunded receipts in SQL, e.g. residual balance predicate:

```sql
AND (
  COALESCE((
    SELECT SUM(rr."amount") FROM "RefundRecord" rr WHERE rr."receiptId" = resolved."receiptId"
  ), 0) < resolved."netAmount"
)
```

(Use numeric-safe comparison consistent with Decimal.)

### H2 — No concurrent regression tests for the claimed races

Design is lock-based and looks correct, but suite only has sequential happy paths:

- `grant-units.int.test.ts`: provision, idempotent replay, break-glass, renewal extend, sequential full refund.
- `reconcile-orphaned-receipts.test.ts`: missing-range recovery after manual delete (ironically the same shape as C1’s exploit).
- No `Promise.all(refundCreate, grantUnitsFromReceipt)` / cancel vs grant range tests.

**Fix:** add concurrent tests mirroring `cancel-refund.test.ts` FOR UPDATE pattern.

### H3 — M9 keep-enrollment + absolute package ranges → learning gap (product, not money double-spend)

**Evidence**

- Cancel always `revokeRangesForReceipt` for cancelled receipt (`router.ts` ~579–587), even when M9 skips enrollment withdraw.
- Ranges are absolute `orderGlobal` spans (`resolvePackageGrantRange`), not “N floating units”.

**Scenario:** Receipt A `[301–304]`, B `[305–308]`; cancel A → enrollment stays (B approved); A ranges deleted; student only has `[305–308]`. If class is at 302, dual-gate roster excludes them despite still-paid B package framed as “extension”.

Not a race bug; document/ops expectation. Partial-refund still keeps full ranges (intentional per comments) — separate product debt.

---

## Medium Priority

### M1 — `unitCount` null vs 0 SQL is correct for stated semantics; env default 0 edge

| `unitCount` | Selected as missing-range orphan? | Grant behavior |
|-------------|-----------------------------------|----------------|
| `0` | No (`<> 0` fails; NULL branch false) | `skipped_break_glass` |
| `NULL` | Yes | `defaultUnitCountFromEnv()` (default 4) |
| `N>0` | Yes if no range | grant N |

False negative for intentional break-glass: none.  
Edge: `LMS_DEFAULT_UNIT_COUNT_ON_RECEIPT=0` + null `unitCount` → reconciler selects forever, grant no-ops as skip, marks `recovered` then re-selects (noise loop). Misconfig only.

### M2 — Cancel revoke audit action labeled `enrollment.revokeOnRefund`

`revokeRangesForReceipt` always audits `enrollment.revokeOnRefund` even when called from `runCancelTransaction`. Confuses forensics.

### M3 — `grantUnitsFromReceipt` trusts caller `enrollmentId`

Only called from `provisionFromReceipt` (+ tests). Does not assert enrollment.student matches receipt’s resolved student. Safe today; footgun if reused.

---

## Low Priority

- Partial refund keeps full unit package (documented intentional; not proportional).
- `Number(netAmount)` residual math is fine for VND integers in safe range; prefer Decimal for consistency with ledger.
- Ship note claims concurrent grant serialization; no automated proof (see H2).

---

## Focus item verdicts

| # | Topic | Verdict |
|---|--------|---------|
| 1 | Full refund ∥ grant | **Solid.** Both take `Receipt FOR UPDATE` in one `withFacility` tx; grant checks residual after lock; refund revokes in same tx as refund row. Winner order always ends with no free units after full refund. |
| 2 | Cancel ∥ grant | **Solid.** Cancel `updateMany` row lock serializes with grant `FOR UPDATE`; grant requires `status === 'approved'`; cancel revokes ranges before commit. Window after activate / before grant: cancel wins → grant throws; no ghost range. |
| 3 | Provision ∥ reconciler double grant | **Solid.** Unique `EnrollmentUnitRange.sourceReceiptId`; pre-check + post-`FOR UPDATE` recheck + `P2002` → idempotent. Enrollment `FOR UPDATE` serializes multi-receipt grants on same seat. |
| 4 | Cancel revoke + M9 | **Correct for money.** Always revokes cancelled receipt’s ranges; keeps enrollment if other approved receipt. Gap risk is package semantics (H3), not “wrong receipt’s ranges left behind.” |
| 5 | Reconciler unitCount / missing range | **unitCount null/0 OK; absence-of-row predicate NOT OK.** C1 free re-grant; H1 full-refund fail loop. |
| 6 | RLS / FOR UPDATE | **Solid.** `grantUnitsFromReceipt` uses `withFacility(db, facilityId)`; `EnrollmentUnitRange` FORCE RLS facility isolation; Receipt/Enrollment locks include `facilityId` in WHERE; revoke runs inside caller’s facility tx (cancel/refund). |

---

## What looks solid

1. **Single writer** for receipt-sourced ranges (`grant-units.ts`) with overlap recheck under enrollment lock.
2. **Refund/grant serialization** on the same receipt row lock + residual balance gate.
3. **Cancel status claim** + grant status gate (no grant onto cancelled money).
4. **Idempotent same-receipt grant** via unique index (provision replay + reconciler concurrency).
5. **Break-glass `unitCount = 0`** excluded from missing-range repair and skips grant without throwing.
6. **Grant failure rethrow** from provision (no soft-swallow) preserves ADR 0041 money-first + `retry_pending`.
7. **RLS posture** matches ADR 0042 for facility-scoped range writes.

---

## Recommended Actions (merge blockers first)

1. **Blocker:** Fix missing-range detector so intentional deletes / full refunds are not “orphans” (C1, H1). Minimum: residual-balance SQL filter + never re-grant when a successful grant audit exists unless an explicit repair flag is set.
2. **Blocker or immediate follow-up:** Concurrent tests for refund∥grant and cancel∥grant on ranges.
3. Document M9 + multi-receipt range gaps for ops (H3).
4. Rename revoke audit action or pass reason (M2).

---

## Metrics (this slice)

| Metric | Value |
|--------|------|
| Focus files LOC | grant-units 360; reconciler 392; finance router 1188 (touched cancel/refund); provision ~492 |
| Automated race coverage for claimed locks | **0 concurrent cases** |
| Happy-path grant/refund/reconcile tests | Present (`grant-units.int`, `reconcile-orphaned-receipts`, `cancel-refund`) |
| Type/lint | Not re-run in this review (static evidence only) |

---

## GO / NO-GO

# **NO-GO** for merge of the money-bridge slice **as landed**

**Reason:** C1 is a production entitlement regression introduced by the missing-range reconciler arm: ops `revokeFromNext` that deletes a receipt-sourced range is inverted by the worker into a full re-grant while money remains approved.

Races (1)–(3) and RLS (6) would be mergeable alone. Do not ship repair SQL that equates “no row” with “never granted” without a stronger predicate.

**Re-review when:**

- [ ] C1 fixed and tested (revokeFromNext delete must not reappear after reconcile)
- [ ] H1 fixed (full refund not selected / not failed forever)
- [ ] Optional but strongly preferred: concurrent refund/cancel vs grant tests green
`
