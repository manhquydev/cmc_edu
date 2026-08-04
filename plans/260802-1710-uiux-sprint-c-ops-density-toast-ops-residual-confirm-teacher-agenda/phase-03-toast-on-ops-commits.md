---
title: "Phase 3: Toast on ops commits"
status: completed
priority: P1
effort: "1.5h"
dependencies: [1]
---

# Phase 3: Toast on ops commits

## Overview

Wire `useToast().success` after successful commit mutations outside teaching (already has toast).

## Related Code Files

- Modify: `apps/admin/src/pages/finance/receipt-detail.tsx` — receiptApprove onSuccess
- Modify: `apps/admin/src/pages/finance/reconciliation.tsx` — dismiss/action success path
- Modify: `apps/admin/src/pages/parents/index.tsx` — approve/reject onSuccess
- Modify: `apps/admin/src/pages/enrollment/class-placement.tsx` — enroll onSuccess
- Modify: `apps/admin/src/pages/hr/kpi.tsx` — confirm + bulkApprove onSuccess

## Implementation Steps

1. Import `useToast` from `@cmc/ui`.
2. Call toast with short Vietnamese success copy (no secrets).
3. Keep existing ResultPanel / invalidate; toast is transient confirmation only.
4. Do not toast on filter or pure navigation.

## Success Criteria

- [ ] Each listed mutation shows success toast
- [ ] Existing tests still pass (toast provider already in test harness)
