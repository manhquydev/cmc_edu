# Phase 04 e2e — shift form depth

**Date:** 2026-08-11  
**Command:** `PLAYWRIGHT_UI=1 pnpm --filter @cmc/e2e test --project=ui-chromium tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`  
**Result:** **1 passed** (~32s)

## Proven

1. Sale compose `/hr/shifts/new` → submit → URL `/hr/shifts/{uuid}`
2. GĐ cold-start form `/hr/shifts/{uuid}` → reject with reason
3. Sale resubmit → new form UUID
4. GĐ `/go/shiftRegistration/{uuid}` → resolves to form → approve
5. Business invariant: 1 approved registration
6. Owner cancel on form (`Hủy phiếu`)

## Build fixes needed for e2e

- Rebuild `@cmc/domain-lms` dist exports
- Selector `null` → `undefined` in classes form
- `exercise-delivery` exerciseId narrow
