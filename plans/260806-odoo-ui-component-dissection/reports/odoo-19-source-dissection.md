# Odoo 19.0 Source Dissection — Layout, Wireframe, Component Matrix

**Date:** 2026-08-06  
**Refresh:** 2026-08-06 (same pin; statuses re-verified vs `@cmc/ui` — see `delta-260806-refresh.md`)  
**Upstream:** https://github.com/odoo/odoo.git · branch **`19.0`**  
**Pin:** `7de220c941c77d4fffdc270a7862c69475fa4577` (local: `/home/manhquy/Downloads/odoo-src`)  
**Target product:** CMC EDU `apps/admin` design3 (`docs/design-system-odoo.md`)  
**Code target:** `@cmc/ui` (`packages/ui/src/odoo*`, page templates)  
**Brainstorm / xia brief:** `plans/reports/brainstorm-260806-odoo-ui-dissection-refresh.md`

---

## 0. Method

1. Sparse-clone only `addons/web/static/src/{webclient,search,views,core,scss}`.
2. Read XML templates (structure) + SCSS (sticky/stacking/density) — **not** OWL services.
3. Map each region to CMC symbol / CSS class with status.
4. Cross-check prior xia extract (`plans/260804-ui-smart-cohesion-upgrade/reports/xia-odoo-layout-grammar-2026-08-04.md`) and design3 rollout (shell now **is** OdooNavbar — that xia doc’s “keep SideNav” is **superseded for admin**).

### Port vs skip

| Port | Skip |
|------|------|
| Flex shell hierarchy | OWL, registries, ORM |
| Named layout slots | XML arch + view compiler |
| Sticky/scroll-owner rules | Bootstrap SCSS system wholesale |
| Dense list/form visual grammar | Chatter/mail.thread product |
| Kanban column/card geometry | Full pivot indent / graph engine |
| Stacking layers (navbar > content > sticky thead) | Purple interactive brand |

---

## 1. Shell OS — WebClient

### Source

- `webclient/webclient.xml` — `NavBar` + `ActionContainer` + `MainComponentsContainer`
- `webclient/webclient_layout.scss` — column flex, overflow ownership
- `webclient/navbar/navbar.xml` + `navbar.scss` + `navbar.variables.scss` — height **46px**

### Wireframe (Odoo)

```text
html/body 100% height, overflow hidden (browser)
└─ .o_web_client                 flex column, height 100%
   ├─ header.o_navbar            flex: 0 0 auto
   │  └─ nav.o_main_navbar       height: 46px
   │     ├─ .o_navbar_apps_menu  [Apps dropdown]
   │     ├─ .o_menu_brand        current app name
   │     ├─ .o_navbar_breadcrumbs (mobile portal target)
   │     ├─ .o_menu_sections     in-app top menus
   │     └─ .o_menu_systray      ms-auto (messages, user, …)
   ├─ .o_action_manager          flex: 1 1 auto; overflow: hidden
   │  └─ .o_action               flex column; height 100%; overflow hidden
   │     ├─ .o_control_panel     flex: 0 0 auto
   │     └─ .o_content           flex: 1; overflow: auto  (scroll owner desktop)
   │        └─ .o_view_controller  absolute fill
   └─ MainComponentsContainer    dialogs, toasts, effects (float layer)
```

**Mobile scroll flip** (`webclient_layout.scss` md-down): `.o_action` becomes scroll owner; `.o_content` overflow initial — statusbar/sticky behavior changes with it.

### CMC analogue

| Odoo | CMC | Status |
|------|-----|--------|
| `.o_web_client` | `.o_web_client` in `apps/admin/src/shell/shell.tsx` | **SHIPPED** |
| `.o_main_navbar` | `OdooNavbar` → `.o-navbar` | **SHIPPED** |
| Apps menu dropdown | `.o-app-switcher-menu` | **SHIPPED** (vertical list — Odoo-correct) |
| Brand | `.o-brand` “CMC EDU” | **PARTIAL** — **DECIDED** switch to current module name; code not yet |
| Sections | `.o-menu-sections` / `.o-menu-item` | **SHIPPED** |
| Systray | shell systray slot (⌘K, enroll, role, logout) | **SHIPPED** |
| `.o_action_manager` / `.o_action` | collapsed into `main.o-main` | **PARTIAL** — single scroll pane, no nested action stack |
| `.o_content` scroll owner | `main.o-main { overflow: auto }` | **SHIPPED** (simplified) |
| MainComponentsContainer | Toast + CommandPalette siblings | **SHIPPED** (unscoped float CSS) |
| Navbar stacking over content | `.o-navbar { z-index: 1000 }` | **SHIPPED in source** (2026-08-06); deploy verify open |

### Professional gap notes

1. ~~Odoo brand shows **current app name**; CMC shows fixed “CMC EDU”~~ → **DECIDED** adopt module name; implement later.
2. Odoo has multi-action stack / breadcrumbs of actions; CMC is SPA routes only — OK for product size.
3. **Must keep** navbar z-index above `main` (live audit proved cover bug).

---

## 2. ControlPanel (ops chrome)

### Source

- `search/layout.xml` — CP then `main.o_content`
- `search/control_panel/control_panel.xml` — named slots
- `control_panel.scss` — mobile sticky z-index **10**

### Wireframe (Odoo CP)

```text
┌─ .o_control_panel  (column, gap-3, px-3, pt-2, pb-3) ─────────────────────┐
│ optional .o_embedded_actions  (saved related views strip)                   │
│ ┌─ .o_control_panel_main  (row, wrap / lg nowrap) ──────────────────────┐ │
│ │ LEFT  .o_control_panel_breadcrumbs                                     │ │
│ │   [New] [layout-buttons] [always-buttons]                              │ │
│ │   Breadcrumbs + status-indicator + cog/additional                      │ │
│ │ CENTER .o_control_panel_actions  (~33% min-width lg+)                  │ │
│ │   SearchBar  OR  selection-actions (when rows selected)                │ │
│ │ RIGHT  .o_control_panel_navigation                                     │ │
│ │   Pager · embedded toggle · view switcher · extra                      │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**Critical Odoo UX rule:** when records selected, **selection actions replace search** in the center band.

### CMC analogue

| Odoo slot | CMC | Status |
|-----------|-----|--------|
| ControlPanel container | `ControlBar` → `.o-control-bar` | **PARTIAL** — column of header/filters/footer, not L/C/R band |
| Create / primary | `PageHeader` actions | **SHIPPED** |
| Breadcrumbs | `PageHeader` breadcrumbs (`.o-bc*`) | **SHIPPED** |
| Search / filters | `FilterBar` → `.o-filter-bar` | **PARTIAL** — filters, not Odoo SearchModel facets |
| Selection actions | `BulkActionBar` + DataTable selection | **PARTIAL** — not CP-center swap |
| Pager | `ListPagination` in `controlFooter` | **SHIPPED** |
| View switcher | CRM pipeline `?view=` + custom buttons | **PARTIAL** — no shared `ViewSwitcher` component |
| Cog menu | none generic | **MISSING** (optional) |
| Mobile sticky CP | `.o-control-bar` sticky z-index 5 | **PARTIAL** |

### Wireframe (CMC ListPage — as-built)

```text
┌─ .o-wrap ──────────────────────────────────────────────────────────────┐
│ ┌─ .o-control-bar (sticky top, z-index 5) ───────────────────────────┐ │
│ │ header  → PageHeader (.o-page-header)                                │ │
│ │ filters → FilterBar                                                  │ │
│ │ footer  → pagination / bulk                                          │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ┌─ .o-list-body ───────────────────────────────────────────────────────┐ │
│ │ DataTable / board / empty                                              │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Recommendation for professional parity:** keep CMC ControlBar API, but **visually densify** toward Odoo CP (single white band, thinner padding, optional right-aligned pager + view switcher row). Full three-column CP rebuild only if list UX research demands it.

---

## 3. List view

### Source

- `views/list/list_controller.xml` — Layout slots: New, SearchBar, selection, CogMenu, Renderer
- `list_renderer.scss` — sticky thead `--sticky-header-zindex`

### Wireframe

```text
ControlPanel (New | Search | Pager | Switcher)
└─ content
   └─ table.o_list_table
      thead sticky
      tbody rows (checkbox optional, open form on row)
      optional editable save/discard in CP when editing
```

### CMC

| Odoo | CMC | Status |
|------|-----|--------|
| List controller | `ListPage` | **SHIPPED** |
| Dense table | `DataTable` + `.o-list` skins | **SHIPPED** |
| Optional columns | page-local | **PARTIAL** |
| Inline edit list | rare | **SKIP** unless product needs |
| Sticky thead | CSS partial | **PARTIAL** |
| no_content_helpers | `EmptyState` | **SHIPPED** |

---

## 4. Form / Detail view

### Source

- `form_controller.xml` — Layout + FormStatusIndicator + Renderer
- `form_controller.scss` — `.o_form_sheet_bg` → `.o_form_statusbar` sticky md+ → `.o_form_sheet`
- `form_compiler.js` — class names `o_form_statusbar`, `o_form_sheet_bg`, `o_form_sheet`

### Wireframe (Odoo form)

```text
ControlPanel (New/Save/Discard | breadcrumbs | cog | pager)
└─ .o_content
   └─ .o_form_view
      └─ .o_form_sheet_bg          (max-width sheet, padded bg)
         ├─ .o_form_statusbar      sticky md+  [statusbar buttons | status widget]
         └─ .o_form_sheet          white card
            ├─ .oe_title / button_box
            ├─ group fields
            └─ notebook (tabs)
      optional chatter side (xxl) — SKIP for CMC
```

### CMC

| Odoo | CMC | Status |
|------|-----|--------|
| Form container | `FormPage` / `DetailPage` | **SHIPPED** (split read vs edit frames) |
| Sheet bg + sheet | `.o-form-sheet-bg` + `.o-form-sheet` | **SHIPPED** (P1 unit 2026-08-06; CSS + tests) |
| Statusbar chevron | `WorkflowStatusbar` / `ProgressSteps` | **SHIPPED** (CRM, receipt) |
| Sticky statusbar md+ | CSS under sheet | **PARTIAL** — gate sticky to md+ like Odoo |
| Button box | `StatActions` / entity actions | **PARTIAL** |
| Notebook tabs | `CmcTabs` | **SHIPPED** |
| Save/Discard sticky | `.o-actions` sticky bottom | **SHIPPED** (FormPage) |
| Form status dirty indicator | none | **MISSING** (nice-to-have) |

### Professional form recipe (as-built target)

```text
DetailPage | FormPage
  PageHeader (breadcrumbs; title only if no EntityHeader)
  .o-form-sheet-bg
    .o-detail-summary?        ← WorkflowStatusbar / HighlightStrip
    .o-form-sheet
      EntityHeader?
      CmcTabs?
      body sections
  sticky .o-actions (FormPage)
```

---

## 5. Kanban

### Source

- `kanban_controller.xml` — same CP slots as list + Renderer
- `kanban_renderer.xml` / record SCSS — columns, color bar, progress

### CMC

| Odoo | CMC | Status |
|------|-----|--------|
| Board / column / card | `KanbanBoard` / `KanbanColumn` / `KanbanCard` | **SHIPPED** |
| Color accents | `--odoo-kanban-color-*` | **SHIPPED** |
| Quick create | not generic | **SKIP** until 2nd board |
| Progress bar on column | `column_progress` analogue | **MISSING** (optional) |
| Selection mode | CRM-local | **PARTIAL** |

---

## 6. Settings

### Source

- `webclient/settings_form_view/**` — app rail + searchable settings blocks

### CMC

| Odoo | CMC | Status |
|------|-----|--------|
| Settings form | `SettingsShell` + `SettingsSection` | **SHIPPED** (shift-config, salary-tiers, network-ip) |
| Searchable settings | partial | **PARTIAL** |
| Two-column setting row | documented in design-system-odoo | **PARTIAL** |

---

## 7. Float / overlay stack (professional critical)

Odoo layers (simplified, Bootstrap z-index scale):

```text
base content
  sticky thead / statusbar   ($zindex-sticky)
  dropdown menus
  navbar / mobile sticky CP  (high, always above content)
  modal dialogs
  toasts / notifications
```

### CMC (design3)

| Layer | Class / component | z-index (as-built) | Status |
|-------|-------------------|--------------------|--------|
| Page sticky control | `.o-control-bar` | 5 | OK |
| Base page header sticky | `.o-page-header` | 10 then **auto under shell** | Fixed 2026-08-06 |
| App switcher | `.o-app-switcher-menu` | 10 under navbar | OK if navbar layer high |
| Navbar shell | `.o-navbar` | **1000** (source) | Fix landed |
| Toast | `.ck-toast-viewport` | 60 | OK |
| Command palette | `.ck-cmd` | 1200 | OK |
| Confirm dialog | overlay | 1200-ish | OK |

---

## 8. Full component matrix (Odoo core → CMC)

Statuses: **S** shipped · **P** partial · **M** missing · **K** skip non-goal · **C** CSS mirror only (`ck-*`)

| # | Odoo surface | Odoo key classes / modules | CMC target | St | Notes |
|---|--------------|----------------------------|------------|----|-------|
| 1 | Web client root | `.o_web_client` | `.o_web_client` shell | S | design3 |
| 2 | Main navbar | `.o_main_navbar` | `OdooNavbar` `.o-navbar` | S | |
| 3 | Apps menu | `.o_navbar_apps_menu` | `.o-app-switcher-*` | S | vertical list |
| 4 | Menu brand | `.o_menu_brand` | `.o-brand` | P | fixed product name |
| 5 | Sections menu | `.o_menu_sections` | `.o-menu-sections` | S | |
| 6 | Systray | `.o_menu_systray` | shell systray | S | |
| 7 | User menu | `user_menu` | logout + RoleSwitcher | P | |
| 8 | Company switcher | `switch_company_menu` | n/a multi-facility later | K/P | product |
| 9 | Burger / mobile apps | `burger_menu` | responsive TBD | P | |
| 10 | Action manager | `.o_action_manager` | SPA router | P | simplified |
| 11 | Layout | `web.Layout` | page frames | S | |
| 12 | Control panel | `.o_control_panel` | `ControlBar` | P | slot geometry |
| 13 | Breadcrumbs | search/breadcrumbs | `PageHeader` crumbs | S | |
| 14 | Search bar | `search_bar` | `FilterBar` | P | no facets model |
| 15 | Search panel | `search_panel` | n/a | K | until needed |
| 16 | Cog menu | `cog_menu` | page actions | M | optional |
| 17 | Pager | `core/pager` | `ListPagination` | S | |
| 18 | View switcher | CP switch buttons | CRM custom | P | extract shared? |
| 19 | Selection box | `selection_box` | DataTable + BulkActionBar | P | |
| 20 | List renderer | `.o_list_table` | `DataTable` `.o-list` | S | |
| 21 | Form sheet | `.o_form_sheet(_bg)` | Detail/Form `.o-form-sheet*` | S | dual sheet shipped P1 |
| 22 | Form statusbar | `.o_form_statusbar` | `WorkflowStatusbar` | S | |
| 23 | Button box | `.oe_button_box` | `StatActions` | P | |
| 24 | Notebook | notebook field | `CmcTabs` | S | |
| 25 | Form dirty indicator | `form_status_indicator` | — | M | |
| 26 | Kanban board | kanban renderer | `KanbanBoard` | S | |
| 27 | Kanban record | card + color | `KanbanCard` | S | |
| 28 | Calendar | calendar view | FullCalendar soft-ops | P | non-Odoo grid |
| 29 | Graph / pivot | views/graph, pivot | Dashboard panels | P/K | |
| 30 | Settings view | settings_form_view | `SettingsShell` | S | |
| 31 | Dialog | `core/dialog` | `ConfirmDialog` + Astryx | P | |
| 32 | Dropdown | `core/dropdown` | Astryx / native | P | stacking rules |
| 33 | Notifications | `core/notifications` | `Toast` | S | |
| 34 | Command palette | `core/commands` | `CommandPalette` | S | |
| 35 | Bottom sheet mobile | `bottom_sheet` | — | K | explicit non-goal |
| 36 | Autocomplete | `autocomplete` | Astryx Selector | P | |
| 37 | Tags | `tags_list` | chips / badges | P | |
| 38 | Avatar | `core/avatar` | `Avatar` | S | |
| 39 | Badge | `core/badge` | `Badge` / StatusBadge | S | |
| 40 | File upload | `file_upload` | domain-specific | P | |
| 41 | Domain selector | `domain_selector` | — | K | |
| 42 | Loading indicator | webclient loading | Skeleton | P | |
| 43 | No content helper | `no_content_helpers` | `EmptyState` | S | |
| 44 | Hotkeys | `hotkeys` | ⌘K only | P | |
| 45 | Overlay service | `overlay` | portal layers | P | |

---

## 9. Token map (density / chrome)

| Token / measure | Odoo 19 | CMC design3 | Match |
|-----------------|---------|-------------|-------|
| Navbar height | 46px (`$o-navbar-height`) | `--odoo-navbar-height: 46px` | Yes |
| Base font | 14px system stack | 14px **Inter** | Intentional deviation |
| Radius default | ~0.25rem / 4px | `--odoo-radius: 4px` | Yes |
| Brand navbar | purple community/enterprise | purple decorative | Yes |
| Interactive accent | Odoo purple buttons often | **CMC blue** | Locked deviation |
| List cell padding | tight | `--odoo-list-cell-padding-*` | Yes |
| Sheet max width | ~1400px var | `--odoo-sheet-max-width: 1400px` | Yes |
| Statusbar height | ~33px | `--odoo-statusbar-height: 33px` | Yes |

---

## 10. Ranked backlog for “chuyên nghiệp như Odoo”

| Priority | Item | Why | Effort |
|----------|------|-----|--------|
| **P0** | Deploy navbar stacking fix + re-audit | Menu covered by page header — unprofessional | Rebuild admin image |
| **P1** | Navbar brand = current module name | Product decision 2026-08-06; code still “CMC EDU” | 0.5–1d |
| **P1** | ControlBar visual densify (single CP band, less card-in-card) | List ops feel “premium soft” not “ERP dense” | 1–2w |
| **P1** | Form statusbar sticky **md+ only** | Match Odoo form_controller.scss mobile scroll | 0.5w |
| ~~P1~~ | ~~Form sheet dual-layer~~ | **Done** unit 2026-08-06 | — |
| **P2** | Shared ViewSwitcher component | CRM pattern should generalize (schedule list/kanban) | 0.5–1w |
| **P2** | Sticky thead live proof under shell scroll | CSS present; need e2e confidence | 0.5w |
| **P2** | Mobile scroll-owner flip decision | Odoo `.o_action` scroll on small viewports; CMC simplified | product |
| **P3** | Selection replaces filters in CP | Odoo classic multi-select UX | 1w |
| **P3** | Optional class rename ck→o | Debt, not UX | 2–3w |
| **Skip** | Chatter, domain builder, pivot indent, bottom-sheet | Non-goals | — |

---

## 11. How to re-run dissection (checklist)

```text
[ ] Update ODOO_PIN.txt from odoo-src
[ ] Diff webclient_layout.scss + navbar + control_panel against previous pin
[ ] Refresh wireframes if DOM tree changed
[ ] Update ODOO-COMPONENT-MAP.md statuses
[ ] Run design3-frontend-audit.mjs on cmcv2-prod
[ ] Open cook packages only for P0–P1 gaps with multi-page impact
```

---

## 12. Unresolved / product decisions

1. **Brand label:** **DECIDED 2026-08-06** — show **current module/app name** (Odoo). Implementation still open (code = fixed “CMC EDU”).
2. Is a shared ViewSwitcher worth extracting before a second list↔kanban surface beyond CRM/schedule?
3. Form dirty indicator (Save/Discard visibility) — product need or always-explicit buttons?
4. Mobile scroll-owner flip — keep CMC simple or mirror Odoo small-viewport behaviour?

---

## References

- Local Odoo tree: `/home/manhquy/Downloads/odoo-src/addons/web/static/src/`
- Prior layout xia (pre-design3 shell): `plans/260804-ui-smart-cohesion-upgrade/reports/xia-odoo-layout-grammar-2026-08-04.md`
- Design3 rollout: `plans/260805-1920-design3-admin-rollout/`
- Live stacking audit: `plans/reports/design3-frontend-system-audit-260806.md`
- Evergreen map: `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`
