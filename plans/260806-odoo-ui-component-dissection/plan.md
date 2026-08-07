---
title: "Odoo UI Component Dissection → CMC Professional Parity"
description: "Quy trình bóc tách layout/wireframe/component từ odoo/odoo@19.0 và map sang @cmc/ui design3; ma trận, gap, gate tái-audit."
status: active
priority: P1
effort: "ongoing process + gap backlog"
tags: [design-system, odoo, design3, layout, wireframe]
created: 2026-08-06
---

# Odoo UI Component Dissection → CMC Professional Parity

## Outcome

Staff admin UI (`apps/admin`) looks and behaves like a **professional Odoo backend** at the layout/grammar level — without porting OWL, XML arch, Bootstrap, or purple brand as interactive accent.

## Source of truth

| Layer | Path |
|-------|------|
| Odoo pin | [ODOO_PIN.txt](./ODOO_PIN.txt) — branch `19.0`, local sparse clone `/home/manhquy/Downloads/odoo-src` |
| Upstream | https://github.com/odoo/odoo.git |
| Extract report | [reports/odoo-19-source-dissection.md](./reports/odoo-19-source-dissection.md) |
| Evergreen map | [design-system/cmc-edu/ODOO-COMPONENT-MAP.md](../../design-system/cmc-edu/ODOO-COMPONENT-MAP.md) |
| Admin design authority | [docs/design-system-odoo.md](../../docs/design-system-odoo.md) |
| Code | `packages/ui/src/odoo.css`, `odoo/odoo-navbar.tsx`, `odoo/odoo-kanban.tsx`, templates under `packages/ui/src/components/` |

## Non-goals (locked)

- Do **not** port OWL runtime, view compilers, XML arch, or RPC services.
- Do **not** adopt Odoo purple as interactive accent (navbar decorative only; CMC blue `#0071E3`).
- Do **not** reintroduce `/design3` lab routes.
- LMS keeps TL12 premium — out of scope.

## Process (nghiệp vụ bóc tách — run this every time Odoo pin or CMC shell drifts)

### Step 0 — Pin

```bash
# sparse web UI only (already seeded at /home/manhquy/Downloads/odoo-src)
cd /home/manhquy/Downloads/odoo-src
git fetch --depth 1 origin 19.0
git checkout FETCH_HEAD
git rev-parse HEAD > /path/to/cmc_edu/plans/260806-odoo-ui-component-dissection/ODOO_PIN.txt
```

### Step 1 — Surface inventory (Odoo)

Read **only** these authority paths (layout grammar):

| Surface | Authority files |
|---------|-----------------|
| Shell | `webclient/webclient.xml`, `webclient_layout.scss`, `navbar/navbar.xml`, `navbar.scss`, `navbar.variables.scss` |
| Action layout | `search/layout.xml`, `search/control_panel/control_panel.{xml,scss}` |
| Search OS | `search/search_bar/**`, `search/search_bar_menu/**`, `search/search_model.js`, `search/custom_{favorite,group_by}_item/**`, `search/search_panel/**` |
| List | `views/list/list_controller.xml`, `list_renderer.{xml,scss}` |
| Form | `views/form/form_controller.{xml,scss}`, `form_status_indicator/`, `button_box/`, `status_bar_buttons/` |
| Kanban | `views/kanban/kanban_controller.xml`, `kanban_renderer.xml`, `kanban_record.scss` |
| Settings | `webclient/settings_form_view/**` |
| Float | `core/dialog`, `core/dropdown`, `core/notifications`, `core/commands` |

Capture for each surface:

1. DOM tree wireframe (ASCII)
2. Named slots / regions
3. Sticky / scroll-owner rules
4. z-index / stacking notes
5. Density tokens (height, padding, font-size)

### Step 2 — CMC analogue map

For each Odoo region, fill the matrix row:

| Odoo class / slot | CMC symbol / class | Status | Gap note |
|-------------------|--------------------|--------|----------|

Statuses: `SHIPPED` · `PARTIAL` · `MIRROR-CSS` · `MISSING` · `SKIP` (non-goal).

### Step 3 — Wireframe parity check (runtime)

```bash
# admin design3 live walk (stacking + shell markers)
cd apps/e2e && node design3-frontend-audit.mjs
```

Pass criteria: shell 100%; app-switcher not covered by page chrome; pages use central templates.

### Step 4 — Gap backlog → cook packages

Only open cook work for gaps that:

- affect multi-page consistency (shell, CP, form sheet, list density), or
- block professional “ops ERP” feel on high-traffic screens (CRM, finance, teaching).

Skip one-off decorative pixels.

### Step 5 — Document

- Update `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` (evergreen)
- Append delta notes under `plans/260806-…/reports/` (dated)
- Touch `docs/design-system-odoo.md` only when tokens/shell contract change

## Phases (implementation backlog from first dissection)

| # | Phase | Focus | Status |
|---|-------|-------|--------|
| 0 | Process + matrix + wireframes | This plan + reports + evergreen map | **Done 2026-08-06**; **refreshed** same day (`reports/delta-260806-refresh.md`) |
| 1 | Shell stacking / float layers | Navbar z-index, dropdown over main (from frontend audit) | **SHIPPED** (+ toast/dialog float contracts) |
| 1b | ControlBar densify + form sheet (P1) | [phase-01](./phase-01-controlbar-form-sheet-p1.md) — CP flat band + Detail/Form dual sheet | **Done** |
| 1c | Navbar brand = module name | Product decision 2026-08-06 | **SHIPPED** |
| 2 | ControlPanel slot fidelity | LEFT/CENTER/RIGHT bands, view switcher density, selection replaces search | **Accept densify** — L/C/R SKIP |
| 3 | Form sheet grammar | sheet_bg → statusbar sticky → sheet → notebook order | **SHIPPED** (thin statusbar md+) |
| 4 | List density & sticky thead | table cell padding, sticky header z-index under shell | Tokens OK; sticky e2e **CUT/debt** |
| 5 | Search / facets (lite) | FilterBar + optional API `search` on major lists | **SHIPPED lite 2026-08-07** (~20/23 ListPage; PR #75). Not full Odoo Search OS |
| 5b | Search OS deep dive | Filters · Group By · Favorites system-wide | **Research closed** — cook **parked** (brainstorm: `plans/reports/brainstorm-260806-odoo-search-os-next-step.md`) |
| 6 | Class purity | Optional `ck-*` → `o-*` rename | Backlog |
| X | Xia compare (read-only) | 7 surfaces (shell…float+settings) | **Done 2026-08-06** — synthesis acceptance close |
| A | Agent OS (anti-sprawl) | [AGENT-COMMAND-MAP.md](./AGENT-COMMAND-MAP.md) | **Done** |

## Acceptance

- [x] Odoo 19.0 sparse source available + SHA pinned
- [x] Wireframes for shell, CP, list, form, kanban documented from source
- [x] Full Odoo→CMC component matrix with status codes
- [x] Evergreen map linked from design-system kit
- [x] 2026-08-06 refresh: form sheet status + backlog aligned to shipped code (`delta-260806-refresh.md`)
- [x] Live re-audit after admin image rebuild (`menuCoveredCount=0`)
- [x] `/ak:xia --compare` layout grammar pass (7 surfaces + synthesis acceptance)
  - Reports: `plans/reports/xia-compare-260806-odoo-*.md`
  - Synthesis: `plans/reports/xia-compare-synthesis-260806-odoo-layout.md`
- [x] Phase 1c / form sticky / float P1 triaged and cooked on `feat/design3-admin-rollout`
- [x] Search OS dissection (Filters / Group By / Favorites) — `reports/odoo-search-system-filters-groupby-favorites.md`
- [x] Decision: **do not cook Search OS now** (2026-08-06 brainstorm) — re-open only on demand triggers
- [x] FilterBar lite + API list `search` wave (2026-08-07) — ControlBar host, `hasClear`, major list procedures; CI ui-e2e green PR #75 (`plans/reports/ship-20260807-filterbar-search.md`)
- [ ] Backlog cook (parked): FilterBar chips first, then presets — not scheduled
- [ ] Optional P2 (Settings mobile / list sticky debt / favorites storage) — not blocking this wave

## Dependencies

- Design3 admin rollout unit-complete (`plans/260805-1920-design3-admin-rollout/`)
- Frontend stacking audit (`plans/reports/design3-frontend-system-audit-260806.md`)
