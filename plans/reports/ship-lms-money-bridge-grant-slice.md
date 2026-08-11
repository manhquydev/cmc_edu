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
| Provision | grants after activate; idempotent by receipt; unitCount 0 = break-glass |
| Refund | full refund deletes ranges for that `sourceReceiptId` |
| Mapping | interim default 4 units; owner packages still needed for sale UX |
| Runbook | `plans/260811-1118-lms-erp-money-bridge-import-cutover/runbook-cutover-draft.md` |

## Not in this slice

- Live LMS import dry-run data pipeline
- Quality gate / close old LMS
- Sale UI package picker polish
- Partial-refund unit proportion

## ADR 0041 preserved

Grant runs **after** money commit; grant soft-failures do not roll back `netAmount`/`approved`.

## Validation

See test run in cook session (`grant-units.int.test.ts` + domain package-grant + finance regression).
