---
title: "Phase 4: Cau ERP money sang unit entitlement"
status: todo
priority: P1
effort: "2–4d"
dependencies: [3]
---

# Phase 4: ERP money → unit entitlement bridge

## Overview

Giữ ADR 0041 (tiền commit trước, provision idempotent) nhưng **mở rộng** `provisionFromReceipt` để cấp `EnrollmentUnitRange` theo sản phẩm/số unit đã bán + activate enrollment + identity.

## Requirements

- Functional:
  - [ ] On receipt approve: identity path unchanged (Parent/Student/Guardian/StudentAccount)
  - [ ] Enrollment shell `reserved→active` still receipt-driven
  - [ ] **NEW:** grant continuous unit range for classBatch (from product mapping)
  - [ ] Renewal receipts extend/add ranges without wiping history
  - [ ] Reconciler re-runs idempotent (no duplicate ranges)
  - [ ] Admin break-glass create student **does not** grant LMS access without explicit enroll (if D1 hybrid)
- Non-functional:
  - [ ] Money transaction never rolls back on LMS grant failure
  - [ ] AuditLog `provisioning.completed` includes range ids
  - [ ] Integration tests: new / renewal / cancel reconciliation

## Architecture

```text
finance.receiptApprove
  → commit money + O5
  → provisionFromReceipt (idempotent):
       findOrCreate Parent/Student/Guardian/StudentAccount
       activateEnrollment
       grantUnitsFromReceipt(receipt)  // NEW
         → validate continuous range in course
         → upsert EnrollmentUnitRange
```

**Product mapping (must be decided in phase 1):**

Options:

1. Receipt carries `unitCount` + `classBatchId` → grant from class current unit forward N units
2. Receipt line items list explicit unit codes / orderGlobal from–to
3. Whole-class enrollment (legacy) maps to full remaining course units (migration-only)

Recommend (1) for ops simplicity + (2) later for precision.

## Related Code Files

- Modify: `apps/api/src/provisioning/provision-from-receipt.ts`
- Modify: `apps/api/src/finance/router.ts` (inputs for unit grant if needed)
- Modify: receipt create UI fields if product needs unitCount
- Create: `apps/api/src/provisioning/grant-units-from-receipt.ts` (+ tests)
- Modify: worker `reconcile-orphaned-receipts.ts`

## Implementation Steps

1. Define input fields on Receipt or Opportunity for unit entitlement.
2. Implement `grantUnitsFromReceipt` pure + DB orchestration using domain validators.
3. Wire into provision after enrollment activate.
4. Handle cancel/refund path: **do not** rewrite past attendance; policy for revoke future units (align cmc-lms revokeFromNext) — document if finance cancel auto-revokes.
5. Tests: first sale, second child same phone, renewal, replay provision, receipt cancelled after provision.

## Success Criteria

- [ ] Provision tests green including unit ranges
- [ ] No money rollback on grant error (retry via reconciler)
- [ ] Manual enroll still works for admin ops (break-glass)

## Risk Assessment

Wrong range math = over/under sold rights. Mitigate: preview on receipt UI; lock order_global stability (cmc-lms seeder gate).
