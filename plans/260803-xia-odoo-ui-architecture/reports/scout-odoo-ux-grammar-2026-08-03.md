# Scout Report (canonical copy): Admin frames & Odoo grammar readiness

**Date:** 2026-08-03  
**Agent:** explore (read-only)  
**Full inventory:** see agent output in session; summary below.

## Snapshot

| Capability | Readiness |
|------------|-----------|
| Shell AppFrame/SideNav | Strong |
| 4 page frames code | Strong |
| Product adoption any frame | ~60–70% |
| Detail recipe (4 entities) | Strong |
| Universal list ControlPanel | Weak |
| VIEW-GRAMMAR.md | Missing |
| ControlBar | Missing |
| ListPagination / BulkActionBar in product | 0 |
| FilterBar types | Partial (text/select) |
| Action stack | Weak (RR only) |

## Off-frame high impact pages

students list · classes list · courses list · pipeline · payroll list · revenue-report · class-placement · parents · grading (MasterDetail intentional) · refund/leaderboard stubs

## Top gaps (impact)

1. VIEW-GRAMMAR law  
2. ControlBar / unified list chrome  
3. Migrate ~12–15 PageHeader-only pages  
4. ListPagination in product  
5. Bulk + DataTable selection  
6. FilterBar date/multi  
7. Detail recipe outside 4 entities  
8. Pipeline shell grammar  
9. Widget kit  
10. Related-nav stack  

## Do not invent

Compose only: List/Detail/Form/Dashboard, PageHeader, FilterBar, EntityHeader, premium `.tpl-*`, design-system PAGE-FRAMES/STRUCTURE/MASTER, recipes receipt-detail / receipt-list / cockpit.

## Status

DONE — frames exist; cohesion blocked by law + ControlBar + adoption, not greenfield UI.
