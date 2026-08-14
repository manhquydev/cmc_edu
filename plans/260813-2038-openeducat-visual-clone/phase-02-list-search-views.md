# Phase 02 — List density, view switcher, search facet

**Plan:** [plan.md](./plan.md)  
**Pack:** `03`, `09`, `15`, `21`, `36`

## Overview

Khớp bảng Odoo: hàng 40px, header xám, không kẻ dọc, pill trạng thái, configurator cột. Extract view switcher. Search: facet chip xám + funnel tím khi đang lọc (không pill tím).

## Slice 02a

- [x] `DataTable` row 40px, thead `--console-gray-100`, no vertical borders, hover `#f2f2f2`, no zebra
- [x] Shared `ViewSwitcher` — active gray `#edeef1`, native `title` tooltip; CRM pipeline + teaching schedule consume it
- [x] Status cell renderer: Draft gray / Confirmed-Done `#28a745` (02b)
- [x] Optional column configurator icon on thead (02b)
- [x] FilterBar → facet chips in search box; caret Filters (02c; không bịa Group By/Favorites)

## Requirements (full phase)

- [x] `DataTable` row 40px, thead `--console-gray-100`, no vertical borders, hover `#f2f2f2`
- [x] Status cell renderer: Draft gray / Confirmed-Done `#28a745`
- [x] Optional column configurator icon on thead
- [x] Shared `ViewSwitcher` (kanban/list/calendar) — active gray, tooltip via `title`
- [x] FilterBar → facet chips in search box; caret Filters (menu lite)

## Files

- `packages/ui/src/components/data-table.tsx`
- `packages/ui/src/components/filter-bar.tsx`
- `packages/ui/src/components/view-switcher.tsx`
- CRM pipeline + teaching schedule + students list

## Acceptance

- [x] Status pills: Draft neutral / done-family solid `#28a745`
- [x] FilterBar: chip xám khi extra filter đang set
- [x] View switcher không tô purple khi active
- [ ] So tay pack `15` / `21` at 1280
