# Red-team note — Cycle 3 (FilterBar · Pager · Bulk honesty)

**Date:** 2026-08-04  
**Direction:** Option B locked — no re-skin  

## Slice outcomes

| Slice | Claim | Evidence | Status |
|-------|--------|----------|--------|
| **3a FilterBar** | ≥2 high-traffic lists use FilterBar in ListPage.filters | `students/index` (text q), `crm/aftersale` (status select), + `crm/post-sale-meeting` | **PASS** |
| **3b Pager** | ≥3 residual lists get ListPagination | `courses/index`, `engagement/rewards`, `crm/post-sale-meeting` | **PASS** |
| **3c Bulk honesty** | Inventory does not oversell domain bulk | Design Lab **Bulk rollout** → `partial` (clipboard except gifts multi-hide) | **PASS** |

## Finding board (rebased)

| ID | Was | Now | Note |
|----|-----|-----|------|
| H1 bulk power | open | **fixed** (honesty) | partial inventory = acceptance; domain bulk still P2 optional |
| H2 FilterBar OS | open | **partial** | high-traffic done; boards/wizards exempt |
| H3 pager residual | partial | **partial** | B1/B2/B5 done; kpi/reconciliation optional |
| H6 detail depth | partial | partial | Cycle 4 if needed |

## Metrics

- `pnpm check:ui-frames` — keep bulkListsOk ≥5, dualTitleReview = 0  
- FilterBar product pages (excl lab): ≥6 (receipts·schedule·rewards·students·aftersale·post-sale)  
- Exempt pager: pipeline cards, schedule calendar body, grading master-detail, class-placement wizard  

## Non-goals (unchanged)

Re-skin · OWL · new skins · generic Kanban · FormPage on every create dialog  

## Next (only if needed)

- Cycle 4 / Slice D: detail recipe tiers doc + optional one more entity depth  
- P2: one domain bulk (export/tag) on receipts  

**Cycle 3 Soft Ops depth stop criteria:** met for A+B+C.
