# Xia Report: Odoo Web Client Layout Grammar → CMC Soft Ops

**Date:** 2026-08-04  
**Mode:** layout extract / compare (read-only)  
**Source:** [odoo/odoo](https://github.com/odoo/odoo) branch **`19.0`** (default)  
**Scope:** structure + sticky/chrome slots only  
**Local:** CMC EDU `@cmc/ui` frames (`PAGE-FRAMES.md`, `VIEW-GRAMMAR.md`)

---

## 0. Source manifest

| Item | Value |
|------|--------|
| Repo | `https://github.com/odoo/odoo` |
| Branch | `19.0` |
| Authority paths | `addons/web/static/src/webclient/`, `…/search/`, `…/views/{list,form,kanban,calendar}/` |
| Credibility | Official product source (highest for layout grammar) |
| Cross-check | CMC `design-system/cmc-edu/{VIEW-GRAMMAR,PAGE-FRAMES}.md` + `packages/ui` composites |
| Not used as layout authority | Tutorials, theme stores, Odoo purple brand kits |

### Port vs Skip

| Port (layout grammar) | Skip (do not transplant) |
|-----------------------|--------------------------|
| Flex chrome hierarchy (shell → action → CP → content) | OWL runtime, services, hooks |
| Named CP / form / list slots | XML arch engine + view compilers |
| Sticky rules (CP, statusbar, settings rail) | Bootstrap / SCSS variables / purple brand |
| Selection replaces search; pager right of CP | Chatter RPC / mail.thread backend |
| Sheet / notebook / button_box spatial order | Generic full Kanban product before 2+ boards |

---

## 1. Executive summary

Odoo 19 web client is a **column flex OS**: fixed top navbar → action manager fills remaining height → each action is itself a column of **ControlPanel (shrink-0)** + **scrollable content**. List/Kanban/Calendar fill content with search/selection chrome in the CP. Form adds a **sheet stack** (statusbar → sheet title/button_box/groups/notebook) and optional **side chatter** at xxl.

CMC already mirrored the *interaction* grammar (`ListPage`+`ControlBar`, `DetailPage`+`EntityHeader`/`StatActions`/`WorkflowStatusbar`, `SettingsShell`). **Do not re-skin to Odoo.** Keep Soft Ops (warm canvas, one blue, radius 12/16/20) and **SideNav shell** (CMC vertical nav ≠ Odoo top app bar). Port only slot order, sticky behavior, and density rules that ops users expect.

**Ranked recommendation**

1. **Adopt Odoo slot grammar inside existing CMC frames** (enforce ControlBar/Detail recipe) — best fit, lowest risk.  
2. Optionally deepen list selection + pager placement to match CP right-band habit.  
3. Reject: top-nav transplant, purple brand, OWL, arch XML, full chatter side panel product.

---

## 2. Research methodology

- Primary: raw GitHub files from `odoo/odoo@19.0` (XML templates + layout SCSS).  
- Secondary: CMC design-system authority + `packages/ui` exports/CSS analogues.  
- Tertiary: prior cohesion research in this plan folder.  
- Key terms: `o_web_client`, `o_control_panel`, `o_form_sheet`, `button_box`, `settings_tab`.

Sources consulted: **≥8 independent Odoo layout files** + **3 CMC authority surfaces**.

---

## 3. Surface 1 — WebClient shell

### Structure (from source)

```text
.o_web_client                    # flex column; height 100%; overflow hidden (browser)
├── NavBar (.o_main_navbar)     # flex: 0 0 auto; hidden if fullscreen
├── ActionContainer
│   └── .o_action_manager       # flex: 1 1 auto; overflow hidden
│       └── .o_action           # flex column; height 100%
│           ├── .o_control_panel  # flex: 0 0 auto
│           └── .o_content        # flex: 1 1 auto; overflow auto
│               └── .o_view_controller (absolute fill of content)
└── MainComponentsContainer     # dialogs, toasts, etc. (not page chrome)
```

**Files**

- `addons/web/static/src/webclient/webclient.xml` — `NavBar` + `ActionContainer` + `MainComponentsContainer`
- `addons/web/static/src/webclient/webclient_layout.scss` — flex fill rules
- `addons/web/static/src/webclient/navbar/navbar.xml` — navbar slots

### Navbar wireframe + slots

```text
┌─ header.o_navbar / nav.o_main_navbar ─────────────────────────────────────┐
│ [AppsMenu] [App brand] [SectionsMenu …… grow] [Systray ………… ms-auto]      │
│  oi-apps    currentApp   o_menu_sections      o_menu_systray              │
│  (or mobile hamburger + portal breadcrumbs into .o_navbar_breadcrumbs)     │
└────────────────────────────────────────────────────────────────────────────┘
```

| Slot | Class / template | Behavior |
|------|------------------|----------|
| Apps launcher | `o_navbar_apps_menu` / mobile sidebar | Home of all apps |
| App brand | `o_menu_brand` | Current app; click re-enters root |
| Breadcrumbs portal | `o_navbar_breadcrumbs` | Mobile CP portals breadcrumbs here |
| Sections | `o_menu_sections` | In-app top menus; overflow → More (+) |
| Systray | `o_menu_systray` | Messaging, activities, company, user |

**Sticky/chrome:** navbar fixed height (`--o-navbar-height`); not page-scroll. Fullscreen actions hide navbar.

### CMC mapping

| Odoo | CMC `@cmc/ui` | Note |
|------|---------------|------|
| WebClient column | `AppFrame` | Same “shell owns chrome” idea |
| Apps + sections top nav | `SideNav` + module groups | **Keep vertical rail** — Soft Ops / edu density |
| Systray | Topbar actions (Tìm, user, CTA) | CommandPalette already = global jump |
| ActionContainer | Router outlet inside `tpl-wrap` | One page frame only |

---

## 4. Surface 2 — Layout + ControlPanel

### Layout composition

```text
Layout (web.Layout)
├── ControlPanel          # if display.controlPanel
└── main.o_content
    ├── SearchPanel?      # optional left multi-facet panel
    └── default slot      # view renderer
```

**Files:** `addons/web/static/src/search/layout.xml`, `layout.js`

### ControlPanel wireframe + named slots

```text
┌─ .o_control_panel (column, gap-3, px-3, pt-2, pb-3) ─────────────────────┐
│ [optional .o_embedded_actions — related saved views strip]                 │
│ ┌─ .o_control_panel_main (row wrap / lg-nowrap) ───────────────────────┐ │
│ │ LEFT  .o_control_panel_breadcrumbs                                   │ │
│ │   · control-panel-create-button  (New primary)                       │ │
│ │   · layout-buttons               (Save/Discard when editing list…)   │ │
│ │   · control-panel-always-buttons (header buttons display=always)     │ │
│ │   · Breadcrumbs + control-panel-status-indicator                     │ │
│ │   · control-panel-additional-actions (CogMenu, form tools)           │ │
│ │ CENTER .o_control_panel_actions  (min-width ~33% lg+)                │ │
│ │   · layout-actions (SearchBar)  OR  control-panel-selection-actions  │ │
│ │ RIGHT  .o_control_panel_navigation                                   │ │
│ │   · Pager  · view switcher  · control-panel-navigation-additional    │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

**Files:** `addons/web/static/src/search/control_panel/control_panel.xml`, `control_panel.scss`

### Sticky / chrome rules (real)

| Rule | Source evidence |
|------|-----------------|
| CP does not scroll with records | `webclient_layout.scss`: `.o_control_panel { flex: 0 0 auto }` |
| Content scrolls | `.o_content { overflow: auto; height: 100% }` |
| Mobile CP sticky | `.o_control_panel.o_mobile_sticky { position: sticky; z-index: 10 }` |
| Desktop: left/right bands share flex-1; center actions capped ~33% | `control_panel.scss` lg+ rules |
| Selection **replaces** search band | List/Kanban set `control-panel-selection-actions` when rows selected |
| Pager lives in **navigation** (right), not under table by default | `control_panel.xml` `.o_cp_pager` |

### CMC mapping

| Odoo CP slot | CMC frame / atom | Soft Ops rule |
|--------------|------------------|---------------|
| Whole ControlPanel | `ControlBar` (`.tpl-control-bar`) | Sticky, quiet canvas/raised, hairline bottom — already |
| create-button | `PageHeader` actions · 1 primary CTA | Never dual primary |
| layout-actions SearchBar | `FilterBar` inside ControlBar filters | Do not put FilterBar outside ListPage |
| selection-actions | `BulkActionBar` in `controlFooter` | Pair only with DataTable selection |
| Pager | `ListPagination` | Prefer ControlBar footer **or** list foot — one place |
| Breadcrumbs | `PageHeader` breadcrumbs | On Detail: breadcrumbs only when `EntityHeader` owns h1 |
| Cog / view switcher | Optional secondary tools | YAGNI until multi-view same route |
| SearchPanel left rail | Not in CMC | Skip until faceted inventory needs it |

---

## 5. Surface 3 — List view

### Structure

```text
ListView
└── Layout
    ├── CP slots: New | SearchBar | Cog | SelectionBox+bulk | Pager | view switch
    └── ListRenderer
        └── .o_list_renderer.table-responsive
            └── table.o_list_table
                thead  [selector?] [sortable cols…] [open form?] [optional cols gear]
                tbody  rows | group headers | “Add a line”
                tfoot  aggregates / add group
```

**Files**

- `addons/web/static/src/views/list/list_controller.xml`
- `addons/web/static/src/views/list/list_renderer.xml`

### Selection grammar

1. Optional checkbox column `o_list_record_selector`.  
2. When `hasSelectedRecords`: CP center shows `SelectionBox` + multi-record buttons + `ActionMenus`; Cog/search toggler hide.  
3. Editable row: Save/Discard appear in create-button band.

### CMC mapping

| Odoo | CMC |
|------|-----|
| ListView + Layout | `ListPage` + `ControlBar` |
| table renderer | `DataTable` |
| selectors + SelectionBox | `selectedIds` + `BulkActionBar` |
| optional columns gear | Later / per-list config — not global yet |
| no content helper | `EmptyState` (title + description + action) |
| grouped list | Optional later; ops queues rarely need Odoo group headers first |

**Fit:** Already aligned. Gap is **adoption depth** (bulk on more lists), not new grammar.

---

## 6. Surface 4 — Form view (record page)

### Controller chrome

```text
FormView
└── .o_form_view_container
    └── Layout
        ├── CP: New | Cog | FormStatusIndicator (Save dirty state)
        ├── layout-actions: ButtonBox (desktop)
        └── FormRenderer …
```

**File:** `addons/web/static/src/views/form/form_controller.xml`

### Sheet stack (spatial grammar — authoritative for Detail)

```text
.o_form_view
├── .o_form_sheet_bg                    # padded stage; max-width sheet
│   ├── .o_form_statusbar               # STICKY top ≥md; z-index sticky
│   │     ├── .o_statusbar_buttons      # workflow actions (Confirm, Cancel…)
│   │     └── status field / path
│   └── .o_form_sheet                   # raised card (border/radius ≥md)
│         ├── .o-form-buttonbox         # smart buttons (stat counts)
│         │     └── .oe_stat_button × N  # icon | label | value; overflow “More”
│         ├── .oe_title (+ .oe_avatar)  # record identity heading
│         ├── .o_group / .o_inner_group # label|field grid (2-col sm+)
│         ├── separators
│         └── .o_notebook               # tabs; tab-pane body
│               └── fields / x2many lists (edge-bleed under tabs)
└── [xxl] side chatter column           # .o_xxl_form_view flex row
```

**Files**

- `addons/web/static/src/views/form/form_controller.scss` (sheet, statusbar sticky, notebook, xxl chatter)
- `addons/web/static/src/views/form/button_box/button_box.xml` + `.scss`
- `addons/web/static/src/views/form/status_bar_buttons/status_bar_buttons.xml`

### Button box layout facts

- Horizontal cluster of **stat buttons**: icon + text + **bold value** (primary color in Odoo — map to CMC brand, not purple).  
- Overflow → “More” dropdown; small screens → grid / bottom sheet.  
- Placed in CP `layout-actions` on desktop; under cog on small.

### Sticky / chrome

| Element | Sticky? |
|---------|---------|
| ControlPanel | shrink-0 (action column) |
| `.o_form_statusbar` | `position: sticky; top: 0` from md up |
| Sheet | scrolls inside content / sheet_bg |
| Side chatter (xxl) | own scroll column |

### CMC mapping (Detail / Form)

| Odoo form slot | CMC | Frame |
|----------------|-----|-------|
| CP breadcrumbs + New | `PageHeader` (no title if EntityHeader) | `DetailPage` / `FormPage` |
| FormStatusIndicator Save/Discard | sticky `.tpl-actions` | **`FormPage`** (edit/create) |
| statusbar + workflow buttons | `WorkflowStatusbar` + actions | `DetailPage` |
| `oe_title` / avatar | `EntityHeader` (single h1) | `DetailPage` |
| `o-form-buttonbox` / `oe_stat_button` | `StatActions` | summary band |
| key fields above fold | `HighlightStrip` | optional summary |
| groups / sheet body | `SectionBlock` + `KeyValueList` | body / tabs |
| notebook | `CmcTabs` | tabs |
| related x2many | tab + table / “Xem tất cả” | related |
| chatter | `ActivityTimeline` **tab** (optional) | do **not** force side panel |

**Read vs edit:** Odoo one form component switches mode; CMC splits **DetailPage (read)** / **FormPage (edit)** — keep split (clearer ops + sticky save).

---

## 7. Surface 5 — Kanban (brief)

```text
KanbanView → Layout (same CP as list: New, Search, selection, Cog, pager)
└── .o_kanban_renderer
    ├── GROUPED: .o_kanban_group × N
    │     KanbanHeader | quick-create | KanbanRecord× | Load more
    │     + column quick-create
    └── UNGROUPED: wrap cards + ghost spacers + optional add card
```

**Files:** `kanban_controller.xml`, `kanban_renderer.xml`

### CMC

| Odoo | CMC |
|------|-----|
| KanbanView shell | `ListPage` body custom **or** pipeline-only board |
| Column progress | `FunnelBar` (CRM) — already |
| Generic board | **No `KanbanBoard` until 2+ domains need it** (VIEW-GRAMMAR anti-pattern) |

---

## 8. Surface 6 — Calendar (brief)

```text
CalendarController → Layout (Cog, SearchBar)
└── .o_calendar_container
    ├── .o_calendar_header  prev/next | scale | Today | period title | multi-select
    ├── sidebar toggler / MobileFilterPanel
    └── .o_calendar_wrapper
          Renderer grid | CalendarSidePanel filters
```

**File:** `addons/web/static/src/views/calendar/calendar_controller.xml`

### CMC

| Odoo | CMC |
|------|-----|
| Calendar chrome | `ListPage` + `WeekSchedule` (teaching) |
| Scale switcher | Local controls in body — not second shell |
| Side filter panel | Optional filters in ControlBar |

---

## 9. Surface 7 — Settings-style apps

```text
SettingsFormView (inherits FormView)
├── CP: search field (replaces SearchBar model) | Save buttons | dirty warning
└── .o_setting_container  (flex row, full height)
    ├── .settings_tab (sticky left rail, tabs per app/module)
    └── .settings (scroll main)
          app_settings_block → h2 sections → .o_settings_container rows
```

**Files**

- `addons/web/static/src/webclient/settings_form_view/settings_form_view.xml`
- `settings_form_view.scss`
- `settings/settings_page.xml`

### CMC

| Odoo | CMC |
|------|-----|
| settings_tab + settings | **`SettingsShell`** (rail + main) |
| setting blocks | `SettingsSection` |
| search settings | optional later; not required for pilot |
| Use when | ≥2 config domains (VIEW-GRAMMAR §6b) |

---

## 10. Master slot map (Odoo → CMC)

```text
Odoo WebClient                 →  AppFrame + SideNav + topbar
Odoo ControlPanel              →  ControlBar
  create-button                →  PageHeader primary action
  breadcrumbs                  →  PageHeader breadcrumbs
  layout-actions / SearchBar   →  FilterBar
  selection-actions            →  BulkActionBar
  pager                        →  ListPagination
  status-indicator             →  FormPage sticky actions / dirty toast
  additional-actions (cog)     →  secondary overflow (rare)
Odoo ListRenderer              →  DataTable (+ EmptyState)
Odoo Form statusbar            →  WorkflowStatusbar
Odoo button_box                →  StatActions
Odoo oe_title / avatar         →  EntityHeader
Odoo sheet groups              →  SectionBlock + KeyValueList
Odoo notebook                  →  CmcTabs
Odoo chatter                   →  ActivityTimeline tab (optional)
Odoo settings_tab/page         →  SettingsShell
Odoo Kanban                    →  ListPage body / FunnelBar (no generic board)
Odoo Calendar                  →  ListPage + WeekSchedule
Odoo graph/pivot               →  DashboardPage / report panels
```

---

## 11. Decision matrix — Odoo way vs CMC Soft Ops

| Decision | Odoo way | CMC Soft Ops | Ranked recommendation |
|----------|----------|--------------|------------------------|
| Shell nav | Top navbar apps + sections | SideNav 248 + topbar 60 | **Keep SideNav** — better multi-module edu ops |
| Brand color | Purple / primary BS theme | Warm canvas, **one blue**, Soft Ops tokens | **Never port purple** |
| Corner radius | Bootstrap radii / sheet vars | **12 / 16 / 20** | Keep CMC |
| Page archetypes | Dynamic OWL views from XML | Closed set: Dashboard/List/Detail/Form | **Keep closed set** |
| List chrome | ControlPanel 3-band | ControlBar header/filters/footer | **Same grammar**; CMC already sticky |
| Record identity | oe_title in sheet | EntityHeader single h1 | **Keep EntityHeader** (Lightning-aligned) |
| Smart buttons | button_box strip | StatActions chips | **Keep StatActions** (warmer, less chrome) |
| Workflow | Sticky statusbar | WorkflowStatusbar | Keep; optional sticky under EntityHeader |
| Edit mode | In-place form | FormPage sticky Save/Discard | **Keep split** Detail/Form |
| Chatter | Side panel xxl | Tab timeline | **Tab only** — YAGNI side panel |
| Settings | Left app tabs | SettingsShell | **Keep SettingsShell** |
| Kanban product | First-class view | Domain boards only | **No generic KanbanBoard** yet |
| Search model | Full domain DSL + favorites | Explicit FilterBar fields | Keep explicit filters (KISS) |
| View switcher | list/kanban/… icons in CP | Separate routes | Prefer routes unless same dataset needs flip |
| Theming | SCSS + Bootstrap | Astryx + premium.css tokens | **No second DS** |

### Trade-off matrix (adoption options)

| Option | Perf | Complexity | Maintenance | Cohesion | Cost |
|--------|------|------------|-------------|----------|------|
| **A. Grammar-only enforce** (frames as-is) | High | Low | Low | High | Low |
| B. Clone Odoo CP 3-band pixel layout | Med | Med | Med | Med–High | Med |
| C. Transplant top-nav + purple sheet | Low | High | High | Low | High |
| D. Side chatter + full mail | Low | Very high | High | Fragment | Very high |

**Choose A.** B only if ControlBar usability fails measured ops testing. Reject C/D.

### Adoption risk

| Risk | Level | Mitigation |
|------|-------|------------|
| Odoo version churn (17→19 CP slots) | Low for us | We port concepts not OWL files |
| Over-building SearchPanel/Cog/favorites | Med | YAGNI gates in VIEW-GRAMMAR |
| Fake “Odoo-like” without frames | High | Adoption matrix + lint pages |
| Brand bleed (purple, BS cards) | Med | Soft Ops tokens only; lab skins non-prod |

**Maturity:** Odoo layout grammar is production-proven for decades; **community size huge**. Abandonment risk of Odoo itself: irrelevant — we do not depend on their package.

**Architectural fit:** Excellent for interaction grammar; **poor for visual/runtime transplant**. Stack is React+Astryx, solo+AI ops — closed frames beat open OWL.

---

## 12. Concrete recommendations (ordered)

1. **Freeze Soft Ops tokens** as production authority; treat Odoo only as slot/sticky reference.  
2. **Enforce** existing maps in `VIEW-GRAMMAR.md` — this report **validates** them against Odoo 19 source; no new archetype.  
3. **List depth:** expand DataTable selection + BulkActionBar; keep pager in ControlBar footer consistently.  
4. **Detail depth:** EntityHeader → optional HighlightStrip → WorkflowStatusbar → StatActions → CmcTabs → SectionBlocks (Odoo sheet order).  
5. **Settings:** SettingsShell for multi-domain config (already Odoo-shaped).  
6. **Do not** implement: OWL, arch XML, SearchPanel, embedded-actions strip, side chatter, purple sheet, top app switcher, generic KanbanBoard.  
7. Optional later: sticky workflow band under EntityHeader (Odoo statusbar sticky) if long detail pages need it.

---

## 13. Challenge notes (xia)

| # | Question | Odoo answer | CMC answer | Risk if wrong |
|---|----------|-------------|------------|---------------|
| 1 | One shell or per-module chrome? | One WebClient | One AppFrame | Fragmented UX |
| 2 | Where does search live? | CP center | ControlBar filters | Lost filters if ad-hoc |
| 3 | Who owns record title? | Sheet oe_title | EntityHeader only | Double h1 |
| 4 | Bulk vs search simultaneous? | Selection replaces search | Same rule | Crowded chrome |
| 5 | Port brand? | Purple BS | Soft Ops warm | Brand identity loss |

---

## 14. Limitations

- Did not execute live Odoo instance; structure from **templates + layout SCSS** only.  
- Chatter UI lives largely under `mail` module — layout placement from form SCSS only.  
- Graph/pivot/gantt not deep-dived (map remains Dashboard/report).  
- Mobile bottom-sheet nuances partially sampled via CP/button_box SCSS.  
- Enterprise-only skins not consulted (Community `web` is enough for grammar).

---

## 15. File citation index (Odoo 19.0)

| Topic | Path |
|-------|------|
| Shell template | `addons/web/static/src/webclient/webclient.xml` |
| Shell flex layout | `addons/web/static/src/webclient/webclient_layout.scss` |
| Navbar | `addons/web/static/src/webclient/navbar/navbar.xml`, `navbar.scss` |
| Layout | `addons/web/static/src/search/layout.xml` |
| ControlPanel | `addons/web/static/src/search/control_panel/control_panel.xml`, `.scss` |
| List | `addons/web/static/src/views/list/list_controller.xml`, `list_renderer.xml` |
| Form | `addons/web/static/src/views/form/form_controller.xml`, `form_controller.scss` |
| Button box | `addons/web/static/src/views/form/button_box/*` |
| Status bar buttons | `addons/web/static/src/views/form/status_bar_buttons/*` |
| Kanban | `addons/web/static/src/views/kanban/kanban_controller.xml`, `kanban_renderer.xml` |
| Calendar | `addons/web/static/src/views/calendar/calendar_controller.xml` |
| Settings | `addons/web/static/src/webclient/settings_form_view/*` |
| Shared empty/status | `addons/web/static/src/views/view.scss` |

**CMC authority**

- `design-system/cmc-edu/VIEW-GRAMMAR.md`  
- `design-system/cmc-edu/PAGE-FRAMES.md`  
- `packages/ui/src/premium.css` (`.tpl-control-bar`, `.ck-stat-actions`, …)  
- `packages/ui/src/index.ts` (ListPage, ControlBar, EntityHeader, SettingsShell, …)

---

## 16. Unresolved questions

1. Should long Detail pages get **sticky WorkflowStatusbar** like Odoo statusbar, or keep scroll-away? (product preference)  
2. Multi-view switcher on same route for CRM list↔board — needed, or separate routes forever?  
3. Settings global search (Odoo CP search) — any CMC config surface large enough to need it?

---

## 17. Handoff

Report path:

`plans/260804-ui-smart-cohesion-upgrade/reports/xia-odoo-layout-grammar-2026-08-04.md`

Use for: cohesion upgrade enforcement, Detail/List recipe audits, rejection of visual Odoo clones.

**Status: DONE**  
**Summary:** Extracted Odoo 19 WebClient/CP/List/Form/Kanban/Calendar/Settings layout grammar from official sources; mapped every slot to existing CMC Soft Ops frames; recommend grammar-only adoption, never brand/runtime transplant.  
**Concerns:** None blocking — CMC VIEW-GRAMMAR already correct; gap is adoption, not missing Odoo chrome.
