# Brainstorm — next form-depth after parents

**Date:** 2026-08-11  
**Authority:** `docs/ux-resource-centric-structure.md`  
**Mode:** implement --tdd --auto

## Contract

| Field | Content |
|-------|---------|
| **Outcome** | Teaching session form is share-complete; refund money work happens on the **Receipt** form (list index → form HITL), not a separate role product |
| **Constraints** | TDD; existing `finance.refundCreate` rules (GĐKD only, approved only, cap netAmount); TL06 paths; no payroll form-depth; no `/finance/:id` collision with a second UUID type |
| **Non-goals** | Standalone RefundRecord form UUID; gifts; Search OS; kanban; inventing refund approval workflow |
| **Acceptance** | (1) Session detail CopyLink → `/go/classSession/:id`; (2) `receiptGet` returns refunds ledger + `viewerCanRefund`; (3) receipt form can create refund when allowed; (4) `/finance/refund` is index of approved receipts → open form; (5) focused tests green |

## Done (do not re-open)

Shifts form-depth · KPI shared workspace + confirm flags · shifts inbox index-only · aftersale · parents · `links.classSession`

## Priority queue

| # | Work | Size | Rationale |
|---|------|------|-----------|
| **1** | Session form share hygiene | **S** | Route + get exist; only CopyLink missing for classSession pack |
| **2** | Receipt refund form-depth | **M** | Money API ready; EmptyState is dead nav; resource = Receipt not RefundRecord |
| 3 | Gifts form UUID | S–M | Low staff HITL — defer |
| 4 | e2e aftersale/parents | M | Proof wave after merge pressure eases |
| 5 | Push PR #109 commits | ops | After CI green on branch |

## Decision (chosen)

**Resource-centric refund:** RefundRecord is append-only ledger **on** Receipt.  
HITL = form `/finance/:receiptId` · Index = `/finance/refund` filtered approved receipts with **Mở phiếu**.  
Do **not** add `links.refund` or `/finance/refunds/:id` (collides mentally with receipt UUID under finance).

## Approaches compared

| Approach | Pros | Cons |
|----------|------|------|
| A. Refund action on receipt form (chosen) | Matches domain; no route collision; reuses get/list | GĐĐT can read ledger but not create (correct) |
| B. Full RefundRecord form UUID | Symmetric with other modules | Overfits append-only line; path design vs receipt |
| C. Leave EmptyState | Zero risk | Nav lie continues |

## Implement order (this cook)

1. Session CopyLink TDD  
2. API `receiptGet` refunds + `viewerCanRefund` TDD  
3. Receipt detail refund UI TDD  
4. Refund index page (approved receipts) TDD  
5. Tests + review  

## Risks

- Money UI mistakes → confirm dialog + server is source of truth  
- List DTO must not force N+1 refund queries — only `receiptGet` loads ledger  
