# Ship note — Plan 3 grantUnitsFromReceipt slice

**Date:** 2026-08-11  
**Branch:** `feat/lms-foundation-unit-range-spike`  
**Plan:** `plans/260811-1118-lms-erp-money-bridge-import-cutover/`

## Delivered (phases 1–4 core)

| Item | Detail |
|------|--------|
| Schema | `Receipt.unitCount`, `EnrollmentUnitRange.sourceReceiptId` unique |
| Domain | `resolvePackageGrantRange` pure helper |
| Single writer | `apps/api/src/lms-ops/grant-units.ts` |
| Provision | grants after activate; **failures rethrow** → `retry_pending` (no soft-swallow) |
| Break-glass | `unitCount = 0` → active enrollment, no range |
| Refund | full refund deletes ranges for that `sourceReceiptId` |
| Cancel | `receiptCancel` also revokes ranges for the receipt (M9-safe) |
| Reconciler | passes `unitCount`; missing-range orphan only if residual > 0 and no prior grant audit (no free re-grant after revoke/refund) |
| Grant race | Receipt `FOR UPDATE` + residual check vs full refund; P2002 → idempotent |
| Mapping | interim default 4 units (`LMS_DEFAULT_UNIT_COUNT_ON_RECEIPT`); owner packages still needed |
| Runbook | `plans/260811-1118-lms-erp-money-bridge-import-cutover/runbook-cutover-draft.md` |

## Not in this slice

- Live LMS import dry-run data pipeline
- Quality gate / close old LMS
- Sale UI package picker polish
- Partial-refund unit proportion
- Routing `addWithUnits`/`grantPast` admin paths fully through grant-units (helper exists; ops API consolidation optional)

## ADR 0041 preserved

Grant runs **after** money commit. Grant integrity failures do **not** roll back `netAmount`/`approved`; they surface as `provisioning.pending` + reconciler retry. Intentional skip only for `unitCount === 0`.

## Validation (2026-08-11)

```text
apps/api vitest:
  grant-units.int.test.ts              6 passed (refund + cancel revoke)
  reconcile-orphaned-receipts.test.ts  8 passed (missing-range, residual, no re-grant after cut)
  cancel-refund.test.ts               17 passed
  idempotent.test.ts                   6 passed
  guardian-provisioning.test.ts        3 passed
  Total                               40 passed
```

## Ops prerequisites

Class batches need `currentUnitId` neo + program `CurriculumUnit.orderGlobal` coverage for the sold span, or grant fails closed and reconciler keeps retrying until curriculum/neo is fixed.
