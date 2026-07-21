---
phase: 4
title: "P1 AuditLog coverage"
status: done
implementationNote: "F6 premise was STALE — a global auditLogMiddleware (trpc.ts:148) already auto-audits every successful mutation not in AUDIT_EXCLUDED_PATHS, so refundCreate/receiptCreate/opportunityAdvance/opportunityMarkLost were ALREADY audited. Adding in-handler writes would double rows. Implemented only the genuine gap: provisioning.completed summary row (runs outside any tRPC handler) + a parameterized coverage test that locks the invariant."
priority: P2
dependencies: [1, 2]
effort: "2-3h"
---

# Phase 4: P1 AuditLog coverage

## Overview
Findings F6 (HIGH) + F9 (MEDIUM, partially deferred). `refundCreate` — a money-moving mutation on an append-only ledger — writes **no AuditLog**. Neither do receiptCreate, successful provisioning, or opportunityAdvance/markLost/reopen. Close the money + CRM-stage gaps with the existing audit pattern; post-sale routers deferred by validation decision.

## Evidence (verified in-session)
- Audited today: receiptApprove (`finance/router.ts:340`), receiptCancel (:498), provisioning failures (:895-914), email-enqueue failure (:1023), opportunityCreate (`crm/router.ts:101-109`).
- NOT audited: `runRefundTransaction` (:548-626 — zero audit writes), receiptCreate (incl. the `confirmNewStudent` duplicate-override decision, schema.prisma:322-328), successful provisioning chain, `opportunityAdvance` (:115-147), `opportunityMarkLost`/reopen (:149-176), all of `meeting/router.ts`, `appointment/router.ts`, `after-sale/router.ts`.
- AuditLog model: global infrastructure, actor/action/entity/entityId/data (schema.prisma:962).

## Requirements
- Functional — write AuditLog rows (same shape as existing writes, inside the same transaction as the mutation):
  1. `finance.refundCreate` → action `finance.refundCreate`, data: receiptId, amount, refundId. **Highest priority.**
  2. `finance.receiptCreate` → data: opportunityId, classBatchId, netAmount, confirmNewStudent.
  3. Successful provisioning completion → one summary row: action `provisioning.completed`, data: receiptId, studentId, parentAccountId, enrollmentId, reused-vs-created flags.
  4. `crm.opportunityAdvance` → data: fromStage, toStage. `crm.opportunityMarkLost` → data: lostReason | reopen.
- **DEFERRED (Validation 2026-07-20):** post-sale mutations (parentMeeting/testAppointment/afterSale) are NOT audited in this plan — PO chose money + CRM-stage scope only (YAGNI); F9 remains deliberately part-open for post-sale, revisit after go-live. <!-- Updated: Validation Session 1 - post-sale audit deferred -->
- Non-functional: no PII beyond ids in `data` (phone/name stay out — AuditLog is global, not facility-RLS'd); actor = `ctx.subject.userId` consistently.

## Related Code Files
- Modify: `apps/api/src/finance/router.ts`, `apps/api/src/provisioning/provision-from-receipt.ts`, `apps/api/src/crm/router.ts`
- Tests: one parameterized coverage test + per-mutation assertions in existing finance/crm test files.

## Implementation Steps
1. Order by risk: refundCreate → receiptCreate → provisioning-success → crm stage mutations. (Post-sale routers deferred per validation.)
2. Implement one shared `writeAudit(tx, {...})` helper (DRY); assert coverage with ONE parameterized test table (mutation → expected action/entity), NOT a bespoke checklist test per router file (red-team: disproportionate test cost).
3. Provisioning summary row: written by the final step (post-StudentAccount), idempotent — skip if a `provisioning.completed` row for the receiptId already exists (replay safety, ADR 0041).
4. `gitnexus_impact` on each mutated symbol; full `pnpm -F @cmc/api test`.

## Success Criteria
- [ ] Every money mutation (refundCreate, receiptCreate) + CRM stage mutation (advance/markLost/reopen) + provisioning completion writes exactly one audit row per invocation (idempotent replays excepted) — verified by the single parameterized coverage test.
- [ ] refundCreate audit row includes amount + receiptId; no phone/name in any new `data` payload.
- [ ] No transaction boundary broken (audit row rolls back with its mutation).

## Risk Assessment
- **Risk**: audit volume growth — bounded (low-frequency ops in 1-facility deployment).
- **Risk**: forgetting a mutation — success criterion enforced by the single parameterized coverage test, not memory.
- **Rollback**: additive writes only; revert safe.
