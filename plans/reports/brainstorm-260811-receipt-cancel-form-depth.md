# Brainstorm — receipt cancel form-depth (P1-08 close)

**Date:** 2026-08-11  
**Authority:** `docs/ux-resource-centric-structure.md`  
**Mode:** implement --tdd --auto

## Contract

| Field | Content |
|-------|---------|
| **Outcome** | GĐ can cancel an **approved** receipt from the receipt form with reason (+ optional void), using existing `finance.receiptCancel` |
| **Constraints** | TDD; permission = same money gate as approve (`receiptApprove`); reason required; void flag semantics unchanged (server); resource-centric — no separate cancel app |
| **Non-goals** | New e2e journey this cook; gifts; payroll; RefundRecord UUID form; push/merge |
| **Acceptance** | (1) `receiptGet.viewerCanCancel`; (2) form HITL Huỷ phiếu + ConfirmDialog; (3) unit tests green; (4) P1-08 drops `no-ui-path` (becomes no-journey until e2e) |

## Queue (after last cook)

| # | Work | Status |
|---|------|--------|
| Session share + refund form | Done 0b4fbe3 |
| **1 receiptCancel form HITL** | **Now** |
| 2 e2e refund/cancel journey | Later |
| 3 Push PR #109 | Ops |
| 4 Gifts form | Defer |

## Decision

Cancel is a **destructive status action on Receipt**, not a new resource. Mirror refund: server flags on get, ConfirmDialog on form, server is source of truth.
