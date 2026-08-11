# Independent Code Review — Plan 3/3 LMS money bridge (phases 1–4)

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Plan:** `plans/260811-1118-lms-erp-money-bridge-import-cutover/`  
**Ship note:** `plans/reports/ship-lms-money-bridge-grant-slice.md`  
**Prior race review:** `plans/reports/code-review-260811-lms-money-unit-bridge-races.md` (NO-GO on C1/H1)  
**Posture:** production-readiness, evidence-backed, hostile to free entitlement / soft-swallow  

---

## 1. Scope + commits

### In scope (Plan 3 phases 1–4 only)

| Commit | Summary |
|--------|---------|
| `f7fc46b` | feat: grant units from receipt + full-refund range revoke |
| `cd84c82` | fix: rethrow unit grants, missing-range repair, cancel revoke |
| `7bf9b3d` | fix: stop reconciler free re-grant after revoke / full refund |

### Files reviewed (current HEAD)

| Path | Role |
|------|------|
| `apps/api/src/lms-ops/grant-units.ts` | Single money-path writer: grant + revoke |
| `apps/api/src/provisioning/provision-from-receipt.ts` | Post-activate grant (ADR 0041) |
| `apps/api/src/finance/router.ts` | `unitCount`, approve wire, cancel/refund revoke |
| `apps/api/src/worker/reconcile-orphaned-receipts.ts` | Missing-range orphan + residual + audit gate |
| `apps/api/src/lms-ops/grant-units.int.test.ts` | Grant / refund / cancel revoke tests |
| `apps/api/src/worker/reconcile-orphaned-receipts.test.ts` | Residual / crash-before-grant / no re-grant |
| `apps/api/src/provisioning/idempotent.test.ts` | Curriculum seed so grant path does not break identity suite |
| `packages/domain-lms/src/package-grant.ts` (+ test) | Pure range resolution |
| `packages/db/prisma/migrations/20260811150000_receipt_unit_count_range_source/migration.sql` | Schema |
| `packages/db/prisma/schema.prisma` | `Receipt.unitCount`, `EnrollmentUnitRange.sourceReceiptId` |
| `apps/api/src/lms-ops/router.ts` | Admin dual-write paths (addWithUnits/grantPast/revokeFromNext) |

**LOC (code only, three commits):** ~990 insertions / 3 deletions across 12 production/test/schema files.

**Out of scope (not reviewed for ship of this slice):** phases 5–6 import dry-run, quality gate, close old LMS, partial-refund proportion, sale UI package picker.

**Local test re-run:** blocked in this environment (`APP_DATABASE_URL` / `DATABASE_URL` unset). Ship note claims 40 focused tests green on 2026-08-11; treat as author claim, not re-verified here.

---

## 2. Spec compliance — phases 1–4

| Phase | Plan intent | HEAD reality | Verdict |
|-------|-------------|--------------|---------|
| **1** Start / runbook draft | Cutover runbook skeleton | `runbook-cutover-draft.md` present | **Met** (draft only; live inventory / staging day not re-audited here) |
| **2** Package → unit mapping | Owner 3–5 packages + receipt fields | `Receipt.unitCount` + `LMS_DEFAULT_UNIT_COUNT_ON_RECEIPT` (default **4**); **owner table still open** | **Interim only** — contract shape landed; product mapping incomplete |
| **3** `grantUnitsFromReceipt` in provision | After activate; idempotent; no money rollback on grant fail | Grant after activate; `sourceReceiptId` unique; failures rethrow → `retry_pending`; reconciler repairs *never-granted* missing ranges | **Met** for money path |
| **4** Break-glass + refund revoke | `unitCount=0`; refund cuts units; attendance kept | `unitCount=0` skips range + dual-gate excludes roster; full refund + cancel delete receipt-sourced ranges; attendance not touched | **Mostly met** — break-glass is field-level, not a separate permission; full refund = wholesale range delete (not proportional `revokeFromNext`) |

### Invariants (must-hold)

| Invariant | Status | Evidence |
|-----------|--------|----------|
| ADR 0041 money first; grant fail rethrows → `retry_pending`; no soft-swallow | **Hold** | Soft-swallow introduced in `f7fc46b`, **removed** in `cd84c82`. HEAD: bare `await grantUnitsFromReceipt(...)` then completed audit. Approve catch still writes `provisioning.retry_pending`. |
| `unitCount === 0` break-glass | **Hold** | `grantUnitsFromReceipt` returns `skipped_break_glass`; reconciler excludes `unitCount = 0`; roster test asserts not on dual-gate. |
| `sourceReceiptId` unique idempotent | **Hold** | Unique index + pre-check + post-`FOR UPDATE` recheck + `P2002` → idempotent. |
| Full refund + cancel revoke ranges; attendance kept | **Hold** | `runRefundTransaction` when `remaining <= 0`; `runCancelTransaction` always `revokeRangesForReceipt` with `enrollment.revokeOnCancel`. No attendance delete. |
| Reconciler must **not** free re-grant after intentional cut | **Hold (fixed in `7bf9b3d`)** | Missing-range arm requires residual `> 0` **and** `NOT EXISTS` grant audit `enrollment.grantUnitsFromReceipt` with `data.sourceReceiptId`. |
| Dual-gate still requires range for learning | **Hold** | Break-glass test via `rosterForSession`. |

### Plan checkbox honesty

Plan marks `0 dual-write (single grant writer path)` as done. **That is overclaim.**

- Money path is single-writer (`grant-units.ts` via provision + reconciler).
- Admin `lmsOps.addWithUnits` / `grantPast` still **inline-create** `EnrollmentUnitRange` without `sourceReceiptId` and without calling `grantRangeOnEnrollment` (`router.ts` ~206–482). Helper comment claims reuse; code does not.

Ship note correctly lists admin consolidation as optional / out of slice. Prefer ship note over plan checkbox.

---

## 3. Findings

### Critical

**None remaining** after `7bf9b3d`.

Prior **C1** (reconciler free re-grant after `revokeFromNext` / intentional delete) and **H1** (full-refund forever-fail loop) are addressed in code + sequential tests:

```143:168:apps/api/src/worker/reconcile-orphaned-receipts.ts
           OR (
                resolved."classBatchId" IS NOT NULL
                AND (resolved."unitCount" IS NULL OR resolved."unitCount" <> 0)
                ...
                AND NOT EXISTS (
                  SELECT 1 FROM "EnrollmentUnitRange" eur
                  WHERE eur."sourceReceiptId" = resolved."receiptId"
                )
                AND (
                  resolved."netAmount" - COALESCE((
                    SELECT SUM(rr."amount") FROM "RefundRecord" rr
                    WHERE rr."receiptId" = resolved."receiptId"
                  ), 0)
                ) > 0
                AND NOT EXISTS (
                  SELECT 1 FROM "AuditLog" al
                  WHERE al."action" = 'enrollment.grantUnitsFromReceipt'
                    AND al."data"->>'sourceReceiptId' = resolved."receiptId"::text
                )
              )
```

Why this works operationally:

1. Successful money grant always writes `enrollment.grantUnitsFromReceipt` **in the same tx** as the range row.
2. Intentional cut deletes the range but leaves the grant audit.
3. `AuditLog` is append-only for app role (`REVOKE UPDATE, DELETE` on `cmc_app` — wave-A privilege hardening) → tombstone is hard to erase via normal API.
4. Full refund residual 0 excludes the row even if audits were missing.

### Important

#### I1 — Entitlement tombstone is AuditLog JSON, not a first-class receipt flag

**Impact:** Correct today given append-only audit + same-tx grant audit. Long-term coupling of worker entitlement policy to forensic log shape (`action` string + `data->>'sourceReceiptId'`). Any future change that:

- renames the audit action, or
- stops putting `sourceReceiptId` in audit JSON, or
- introduces a bulk audit purge path for superuser ops,

silently re-opens free re-grant for residual > 0 receipts with no range row.

**Mitigation (follow-up, not ship-blocker):** sticky `Receipt.unitsGrantState` / revocation table, or keep a non-deletable tombstone row. Document audit action as a **contract** in runbook.

#### I2 — Admin grant paths still dual-write without `sourceReceiptId`

**Evidence:** `lms-ops/router.ts` `addWithUnits` / `grantPast` create ranges with no `sourceReceiptId`; local `rangesOverlap` / `loadProgramUnitOrders` duplicates exist beside `grant-units.ts`.

**Impact:**

- Refund/cancel cannot revoke admin-granted ranges (by design if no money link).
- Drift risk: admin path may diverge on lock/overlap rules over time.
- Plan “single writer” success criterion is false for ops API.

**Not a free-unit money bug** if admin is trusted GĐĐT. Still a maintainability / future cutover risk when import may mix admin and receipt ranges.

#### I3 — No concurrent refund∥grant / cancel∥grant automated tests

Lock design is sound (shared `Receipt FOR UPDATE` + status/residual gates; cancel `updateMany` claim). Suite only proves **sequential** happy paths + reconciler predicates.

**Risk:** regression of lock order / residual check without CI signal. Prior review H2 still open.

#### I4 — Phase 2 owner package table incomplete; default 4 is a product knife-edge

`null unitCount` → env default 4 units at grant time. Wrong default silently over/under-entitles every receipt that omits the field until owner mapping lands.

**Ops requirement before real sales volume:** set `LMS_DEFAULT_UNIT_COUNT_ON_RECEIPT` deliberately; prefer always writing explicit `unitCount` on create.

#### I5 — Break-glass is not separately permission-gated

Phase 4 text: “Permission-gated break-glass + audit”. Implementation: any `receiptCreate` caller may pass `unitCount: 0`; GĐKD approval still required; no dedicated permission or break-glass audit action (only grant skip + normal finance audits).

**Impact:** low abuse (still needs money approval); process/compliance gap vs phase wording. Dual-gate still blocks learning without a later admin range grant.

#### I6 — M9 multi-receipt absolute ranges (product, not race)

Cancel always revokes **that** receipt’s ranges while keeping enrollment if another approved receipt exists. Ranges are absolute `orderGlobal` spans. Cancelling an earlier package can leave a learning gap even though later money remains (prior H3). Document for ops; not a money double-spend.

### Suggestions

| # | Item | Note |
|---|------|------|
| S1 | Route `addWithUnits`/`grantPast` through `grantRangeOnEnrollment` | Closes dual-write; optional this slice |
| S2 | Concurrent `Promise.all` race tests | Mirror `cancel-refund` FOR UPDATE patterns |
| S3 | Refund revoke actor is `'system'` | Cancel passes real actor; forensics uneven |
| S4 | `grantUnitsFromReceipt` may report `status: 'granted'` when inner `created: false` | Cosmetic on rare internal recheck path |
| S5 | `sourceReceiptId` has no FK to `Receipt` | Soft key is fine (receipts not hard-deleted); document |
| S6 | Partial refund keeps full unit package | Documented intentional; product debt |
| S7 | Grant requires program units + class `currentUnitId` neo | Fail-closed + reconciler retry — ops prereq in ship note is correct |
| S8 | `skipped_no_class` result variant unused | Dead type arm |

---

## 4. Race / RLS assessment

| Scenario | Verdict | Why |
|----------|---------|-----|
| Full refund ∥ `grantUnitsFromReceipt` | **Solid** | Both take `Receipt ... FOR UPDATE` in facility tx; grant refuses non-approved / residual ≤ 0; refund revokes ranges in same tx as refund row. |
| Cancel ∥ grant | **Solid** | Cancel atomic `updateMany` approved→cancelled; grant requires `status === 'approved'`; cancel revokes ranges before commit. Window after activate / before grant: cancel wins → grant throws → no ghost range. |
| Provision ∥ reconciler double grant | **Solid** | Unique `sourceReceiptId` + P2002 idempotent; enrollment `FOR UPDATE` serializes multi-receipt grants on same seat. |
| Cancel revoke + M9 | **Correct for money** | Always drops cancelled receipt’s ranges; keeps seat if other approved money. Package gap is product (I6). |
| Reconciler missing-range after intentional cut | **Fixed** | Residual gate + prior grant audit gate. Tests cover residual-0 and audit-remaining cases. |
| Reconciler crash-before-first-grant | **Correct** | No range + no grant audit + residual > 0 → repair. Test models via break-glass then flip `unitCount`. |
| RLS / facility isolation | **Solid** | `grantUnitsFromReceipt` uses `withFacility(db, facilityId)`; `EnrollmentUnitRange` ENABLE+FORCE RLS + facility policy (foundation migration); locks include `facilityId`; worker orphan scan uses `bypass: true` (ADR 0042 system job, same as pre-existing reconciler). |

**No new RLS hole** introduced by money-bridge columns. `sourceReceiptId` uniqueness is global (not per facility) — acceptable UUID key; collision across facilities is not a realistic threat.

---

## 5. Solid areas

1. **Soft-swallow removed** — grant integrity failures surface as `retry_pending`; money stays approved (ADR 0041 preserved).
2. **Idempotent receipt-sourced grant** — unique index + multi-layer race handling.
3. **Refund/cancel serialization** against grant on the same receipt row.
4. **Cancel revoke + `enrollment.revokeOnCancel` audit** (forensics fixed from prior M2).
5. **Reconciler dual gate** (residual + never-succeeded-grant) closes the entitlement regression that made the prior review NO-GO.
6. **Break-glass dual-gate** — active enrollment without range does not learn.
7. **Attendance never erased** on refund/cancel unit cut.
8. **Domain pure helper** `resolvePackageGrantRange` is small, tested, and matches renewal-extends-after-max semantics.

---

## 6. Verdict

# **GO** for ship-to-develop of the money-bridge slice (phases 1–4)

**Conditions (non-blocking but required for honest ops):**

1. Do **not** treat owner package mapping as done — default 4 is interim.
2. Do **not** claim global single-writer until admin paths route through `grant-units.ts`.
3. CI on the PR must re-run the focused suite claimed in the ship note (this review could not execute DB tests).
4. Prefer explicit `unitCount` on every live receipt create until package table is frozen.

**Why not NO-GO:** prior merge-blocking free re-grant (C1) and refund fail-loop (H1) are fixed in `7bf9b3d` with matching tests. Remaining issues are product interim, dual-write hygiene, and missing concurrent race coverage — not open entitlement exploits on the money path.

**Why not unconditional GO:** AuditLog-as-tombstone and dual admin writers are residual design debt; concurrent race proof is still absent.

---

## 7. Explicit out-of-scope remaining work

| Work | Phase / owner |
|------|----------------|
| Owner 3–5 real package → unit mapping table; freeze default | Phase 2 completion |
| Live LMS import dry-run + integrity | Phase 5 |
| Quality gate → cutover → close old LMS as SoT | Phase 6 |
| Partial-refund unit proportion (or explicit never) | Product debt |
| Route `addWithUnits` / `grantPast` through `grantRangeOnEnrollment` | Ops API consolidation |
| Concurrent refund/cancel vs grant range tests | Test hardening |
| First-class grant/revoke state on Receipt (replace audit tombstone) | Hardening |
| Sale UI package picker polish | UX |
| Break-glass dedicated permission + audit (if compliance requires) | Phase 4 polish |
| 1 week ops without rollback (plan success criterion) | Post-cutover, not this slice |

---

## Known-fixed verification (do not re-open without new evidence)

| Item | HEAD |
|------|------|
| Soft-swallow removed | Yes (`cd84c82`; no `unit_grant_failed` / fake `skipped_break_glass` path) |
| Residual filter for refunds | Yes (`7bf9b3d` SQL) |
| Prior grant audit blocks re-grant | Yes (`7bf9b3d` SQL + test) |
| Cancel revoke + `revokeOnCancel` audit | Yes (`7bf9b3d` + grant-units int test) |

## Known-open (severity)

| Item | Severity |
|------|----------|
| Admin addWithUnits/grantPast dual-write without `sourceReceiptId` | Important (hygiene / future cutover) |
| Phases 5–6 import/cutover not done | Out of scope |
| Owner package table interim (default 4) | Important (product) |
| AuditLog used as entitlement tombstone | Important (design debt) |
| No concurrent race tests | Important (proof gap) |
| Partial refund keeps full ranges | Suggestion / product debt |

---

## Metrics

| Metric | Value |
|--------|-------|
| Commits in slice | 3 |
| Code+test+schema Δ | ~990 / −3 LOC |
| Critical open | 0 |
| Important open | 6 (I1–I6) |
| Concurrent race tests | 0 |
| Local test re-run | **Not possible** (no DB URL in review env) |
| Prior review C1/H1 | **Fixed** |

---

**Status: DONE_WITH_CONCERNS**  
**Summary:** Phases 1–4 money bridge is GO for develop after the reconciler free-re-grant fix; residual concerns are dual admin writers, audit-as-tombstone, interim default package size, and missing concurrent race proof — not open free-unit exploits.  
**Concerns:** Cannot re-verify the 40-test claim without DB; plan “0 dual-write” checkbox is overstated relative to `lms-ops/router.ts`.
