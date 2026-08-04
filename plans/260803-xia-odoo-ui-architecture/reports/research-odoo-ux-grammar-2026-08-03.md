# Research Report: Odoo-like UX grammar for facility ERP (CMC)

**Date:** 2026-08-03  
**Skills:** ak-research (≤5 external probes + local scout)  
**Sources:** Odoo 19 docs (framework overview, view architectures), odoo/odoo `addons/web/static/src` tree, CMC design-system + `@cmc/ui`, scout report

---

## Executive Summary

Odoo’s cohesion is an **interaction grammar** (WebClient → ControlPanel → closed view types → form sheet recipe → field widgets), not a visual skin. CMC already has the right **frame layer** (List/Detail/Form/Dashboard) and a strong **Detail recipe** on four entities. The binding constraints for “second Odoo” UX are: missing **VIEW-GRAMMAR law**, missing **unified list ControlBar**, **~30–40% pages still PageHeader-only**, and **unused ListPagination/BulkActionBar**. Best practice for a solo React ERP: compose sticky list chrome + enforce frames; **do not** port OWL/Bootstrap/XML views.

## Methodology

| Source | Role |
|--------|------|
| Odoo 19 Framework Overview | Shell, registries, services, Layout |
| Odoo View architectures | form/list structural components |
| GitHub odoo/odoo 19.0 web paths | ControlPanel, views, SCSS tokens |
| Xia compare report (same folder) | Grammar map + non-goals |
| Explore scout 2026-08-03 | Live adoption inventory |

Key terms: ControlPanel, view type, form sheet, action stack, page frame, ControlBar.

## Key Findings

### 1. Technology / product pattern

ERP UIs that scale modules share:

1. Fixed shell  
2. Closed set of page/view archetypes  
3. Universal list toolbar (search · filter · pager · create)  
4. Form/detail structural recipe (identity · status · groups · tabs)  
5. Optional field widget vocabulary  

Odoo implements (3–5) via XML arch + registries. CMC should implement via **React frames + CSS tpl + docs law**.

### 2. Current state (CMC, measured)

| Item | State |
|------|--------|
| 4 frames in code | EXISTS + tests |
| Detail recipe on student/class/receipt/opportunity | EXISTS |
| ListPage on ~13 screens | PARTIAL (~33% of all, ~65% of list-like) |
| ControlBar component | MISSING |
| VIEW-GRAMMAR.md | MISSING |
| ListPagination / BulkActionBar in product | 0 pages |
| FilterBar | text+select only |
| DataTable selection | MISSING (blocks bulk) |

### 3. Best practices (aligned to YAGNI)

1. **Law before mass migration** — agents re-fragment without VIEW-GRAMMAR.  
2. **Compose ControlBar from PageHeader + FilterBar + pager slot** — avoid new chrome framework.  
3. **Migrate highest-traffic off-frame lists first** (students, classes, courses, payroll list, pipeline shell).  
4. **Defer** kanban engine, favorites, action service until two real consumers.  
5. **Keep brand** — Odoo density discipline, CMC premium warm tokens.

### 4. Security / tenancy

UI grammar must not invent multi-company chrome without backend truth. Facility-scoped session is the authority. Related nav should pass facility-safe query context only.

### 5. Performance

Sticky ControlBar is CSS/layout only. Avoid re-fetching on every chrome re-render; pager state stays page-owned (tRPC as today).

## Comparative Analysis

| Approach | Effort | User-visible sync | Risk |
|----------|--------|-------------------|------|
| Docs-only | S | Low | Agents still diverge on code |
| Law + ControlBar + priority lists | M | High | Manageable |
| Full Odoo parity toolkit | XL | Highest | Scope death |

## Implementation Recommendations

### Quick start (for plan phases)

1. VIEW-GRAMMAR.md + link from PAGE-FRAMES, STRUCTURE, llms.txt  
2. ControlBar or ListPage `control` slot + premium CSS  
3. Migrate students/classes/courses/payroll list → ListPage  
4. Wire ListPagination on receipt-list (reference)  
5. Design Lab demo of full list grammar  
6. Optional later: FilterBar date type; DataTable selection + bulk  

### Pitfalls

- Building BulkActionBar without row selection  
- Treating pipeline as ListPage body without preserving FunnelBar  
- Second card/table language  
- “21/21 templates” doc claim as truth  

## Resources

- https://www.odoo.com/documentation/19.0/developer/reference/frontend/framework_overview.html  
- https://www.odoo.com/documentation/19.0/developer/reference/user_interface/view_architectures.html  
- `plans/260803-xia-odoo-ui-architecture/reports/odoo-ui-compare-cmc-edu.md`  
- Scout: explore agent report 2026-08-03 (same folder topic)

## Unresolved (need advise)

1. Scope breadth: priority lists only vs all PageHeader-only pages this plan?  
2. ControlBar as named component vs ListPage internal layout only?  
3. Include DataTable selection+bulk in v1 or defer?
