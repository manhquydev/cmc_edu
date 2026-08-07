---
title: "Phase 2: Search system filters groupby favorites"
status: done
---

# Phase 2: Search system — Filters · Group By · Favorites

**Parent:** [plan.md](./plan.md)  
**Dissection report:** [reports/odoo-search-system-filters-groupby-favorites.md](./reports/odoo-search-system-filters-groupby-favorites.md)  
**Pin:** `7de220c9` (19.0)

## Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Document Odoo’s system-wide Search OS (SearchBar + facets + Filters/GroupBy/Favorites menu) and define a CMC-lite parity target without porting SearchModel/OWL/domain DSL. |
| **Constraints** | Allowlist `addons/web/static/src/search/**` + list controller slot wiring only; no OWL/XML arch port; no purple accent; ListPage remains host. |
| **Non-goals** | DomainSelector, `ir.filters` server share without product ADR, SearchPanel left rail (unless a module later demands it). |
| **Acceptance (research)** | Wireframes + component inventory + CMC gap matrix + VIEW-GRAMMAR rules + evergreen map section. |
| **Acceptance (optional cook)** | Shared facet + preset-menu chrome on ≥2 ListPage pilots; unit CSS/structure tests; no per-page filter card invention. |

## Overview

Odoo applies **one** search chrome to nearly every multi-record view via `WithSearch` → `SearchModel` → `SearchBar` / `SearchBarMenu`. CMC already hosts filters system-wide (`ListPage` → `FilterBar`) but only as text/select/date controls — missing facet chips, named preset menu, groupBy, and favorites.

## Requirements

### Research (this wave)

- [x] Inventory Odoo `search/**` stack and default `searchMenuTypes`
- [x] Wireframe SearchBar facets + three-column menu + selection-swap + SearchPanel distinction
- [x] Map CMC `FilterBar` / ListPage adoption and gap matrix
- [x] Write report under `reports/odoo-search-system-filters-groupby-favorites.md`
- [x] Update evergreen `ODOO-COMPONENT-MAP` + `VIEW-GRAMMAR` search rules

### Optional cook (only if product prioritizes P1)

- [ ] Evolve FilterBar or add `SearchChrome`: facet chips + remove
- [ ] Preset filter menu (config-driven checkboxes) for pages with ≥3 named filters
- [ ] Pilot: finance receipt-list + CRM list surface
- [ ] Unit tests for structure/CSS under `.o_web_client`
- [ ] Group By + Favorites only after API/storage decisions (P2)

## Implementation steps (cook — deferred)

1. Design props for lite `SearchChrome` (see report §6.3).
2. Implement chips + menu shell in `packages/ui` (CSS density aligned to CP band).
3. Migrate 2 pilot pages from raw select rows to presets + facets.
4. Document storage ADR before favorites persistence.
5. Re-run design3 list audit / focused vitest.

## Files

| Path | Role |
|------|------|
| `reports/odoo-search-system-filters-groupby-favorites.md` | Authority dissection |
| `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md` | Evergreen map |
| `design-system/cmc-edu/VIEW-GRAMMAR.md` | Interaction rules |
| `packages/ui/src/components/filter-bar.tsx` | Current CMC analogue |
| Odoo `search/search_bar*`, `search_bar_menu*`, `search_model.js` | Source grammar |

## Todo

- [x] Research dissection complete
- [x] Product decision: **park cook** (brainstorm 2026-08-06) — see `plans/reports/brainstorm-260806-odoo-search-os-next-step.md`
- [x] Optional `/ak:xia` search-only — **skipped** (diminishing returns; report already source-grounded)
- [ ] Optional cook — **backlog only**; re-open on triggers in brainstorm report (not scheduled)

## Success criteria

**Research done when:** report + map + grammar updated and linked from plan. → **Met.**  
**Cook done when:** two pilots use shared search chrome… → **Deferred** until re-open trigger (lists still 1–2 filters; design3 validation first).
