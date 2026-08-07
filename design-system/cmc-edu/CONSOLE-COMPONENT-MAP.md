# CMC Console ↔ Odoo 19 component map (admin design3)

> **Purpose:** One-page authority for which Odoo backend UI piece maps to which `@cmc/ui` surface.  
> **Source pin process:** `plans/260806-odoo-ui-component-dissection/`  
> **Full wireframes + matrix:** `plans/260806-odoo-ui-component-dissection/reports/odoo-19-source-dissection.md`  
> **Runtime design language:** `docs/design-system-console.md`  
> **Upstream:** [odoo/odoo@19.0](https://github.com/odoo/odoo/tree/19.0/addons/web/static/src)

**Do not port OWL/XML/Bootstrap.** Port layout grammar, slots, density, stacking.

---

## Shell

```text
Odoo                              CMC (apps/admin)
─────────────────────────────────────────────────────────────
.o_web_client                     .o_web_client  (shell.tsx)
.o_main_navbar                    ConsoleNavbar → .console-navbar
apps menu                         .o-app-switcher-toggle + .o-app-switcher-menu
.o_menu_brand                     .console-brand  (active module label; ConsoleNavbar default)
.o_menu_sections                  .o-menu-sections / .o-menu-item
.o_menu_systray                   systray slot (⌘K, enroll, role, logout)
.o_action_manager > .o_action     (collapsed)
.o_content (scroll)               main.o-main { overflow: auto }
MainComponentsContainer           Toast + CommandPalette (+ dialogs)
```

**Stacking rule:** `.console-navbar` must sit above `main.o-main` (z-index shell layer). App-switcher is absolute under navbar — never let `.o-page-header` win hit-testing.

---

## Page frames (view types)

| Odoo view | CMC frame | Compose with |
|-----------|-----------|--------------|
| list | **ListPage** | ControlBar · FilterBar · DataTable · ListPagination · BulkActionBar |
| form (read) | **DetailPage** | PageHeader · `.o-form-sheet-bg` / `.o-form-sheet` · EntityHeader? · statusbar? · tabs · sections |
| form (edit) | **FormPage** | same sheet dual-layer · fields · sticky `.o-actions` |
| kanban | **ListPage** body **or** KanbanBoard | CRM: list↔kanban + `?view=` |
| calendar | SoftOps FullCalendar / WeekSchedule | not Odoo grid-shell |
| settings | **SettingsShell** | SettingsSection rows |
| dashboard / graph | **DashboardPage** | MetricCard · Panel |

---

## Control panel analogue

| Odoo CP slot | CMC |
|--------------|-----|
| create / layout buttons | PageHeader `actions` |
| breadcrumbs | PageHeader `breadcrumbs` |
| search / facets | FilterBar (lite) — see **Search OS** below |
| selection actions | BulkActionBar (when DataTable selected) |
| pager | ListPagination in `controlFooter` |
| view switcher | page-local today (extract later) |
| cog menu | page overflow actions (optional) |

```text
ListPage
  ControlBar          ← single flat white band under .o_web_client (P1 densify)
    header  = PageHeader   (no nested card chrome inside CP)
    filters = FilterBar?   (flat inside CP)
    footer  = ListPagination | BulkActionBar?
  body      = DataTable | KanbanBoard | custom
```

---

## Search OS (system-wide Filters · Group By · Favorites)

> Full wireframes + gap matrix:  
> `plans/260806-odoo-ui-component-dissection/reports/odoo-search-system-filters-groupby-favorites.md`  
> Odoo pin paths: `addons/web/static/src/search/{search_bar,search_bar_menu,search_model,custom_*}`

Odoo mounts **one** search stack on nearly every multi-record view (`WithSearch` → `SearchModel` → CP center). Modules do not invent filter UIs — they declare search arch / fields.

| Odoo piece | Role | CMC analogue | Status |
|------------|------|--------------|--------|
| `WithSearch` + `SearchModel` | Shared domain / groupBy / orderBy / query | URL params + page query state | **PARTIAL** (no shared model) |
| `SearchBar` + facet chips | Active conditions visible & removable | — | **MISSING** |
| Free-text + field autocomplete | Multi-field search | FilterBar `type: 'text'` (single keys) | **PARTIAL** |
| `SearchBarMenu` → **Filters** | Named preset checkboxes + Custom Filter | FilterBar `type: 'select'` row | **PARTIAL** |
| `SearchBarMenu` → **Group By** | Stackable group facets | — | **MISSING** |
| `SearchBarMenu` → **Favorites** | Saved snapshots (`ir.filters`) + default | — | **MISSING** |
| Selection replaces SearchBar | CP center swap when rows selected | BulkActionBar in footer | **PARTIAL** |
| `SearchPanel` left rail | Category/filter sidebar | — | **SKIP** unless module needs |

**Facet color grammar (Odoo `FACET_COLORS` → CMC tokens):**

| `facet.type` | Odoo cue | CMC token direction |
|--------------|----------|---------------------|
| filter / field | primary | `--cmc-accent` |
| groupBy | action | secondary action (not brand purple) |
| favorite | warning / star | warning + star icon |

**Target (lite, no OWL):** evolve FilterBar / add `SearchChrome` — chips + optional three-section menu — still hosted only in `ListPage` → ControlBar `filters` slot.

**Apply now (agents):**  
[G1 Search application playbook](../../plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/reports/g1-search-application-playbook.md)  
— decision tree, archetypes A–C, URL contract, anti-patterns. Cook mega-menu still **parked**.

```text
Odoo CP center                          CMC ControlBar.filters (target)
─────────────────                       ──────────────────────────────
[chips…][Search…][▾ F|GB|Fav]   →       SearchChrome / FilterBar v2
     ↕ selection swap                     (BulkActionBar still footer for now)
```

---

## Form fields (Odoo widgets → CMC)

> Inventory + map (research):  
> [G2 form fields inventory](../../plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/reports/g2-form-fields-inventory-map.md)  
> Odoo pin: `views/fields/*` (68 widget folders + registry helpers). **Do not port OWL.**

| Family | CMC direction | Status |
|--------|---------------|--------|
| Form sheet / statusbar / notebook | DetailPage · FormPage · WorkflowStatusbar · CmcTabs | **SHIPPED** |
| char / text / int / selection | Astryx TextInput · TextArea · NumberInput · Selector | **SHIPPED** |
| date / datetime | `DateField` (native `type=date`, design3 density) | **SHIPPED** (date only; datetime later) |
| many2one async | Selector / custom lookup | **PARTIAL** |
| x2many / lines | DataTable + page forms | **PARTIAL** |
| monetary | NumberInput + format | **PARTIAL** |
| boolean / binary / html | ad hoc or missing | **MISSING** / sparse |
| domain / properties / studio | — | **SKIP** |

**Coverage audit (pages):**  
[admin-grammar-coverage-audit.md](../../plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/reports/admin-grammar-coverage-audit.md) — frames **40/55** (72.7%) / routed **40/44** (90.9%) as of 2026-08-06 audit. **FilterBar (post-cook):** **12/23** list surfaces (**~52%**) — pipeline, kpi, parents, audit-log, gifts added; see debt list for remaining.

---

## Form / record analogue

| Odoo | CMC |
|------|-----|
| `.o_form_statusbar` | DetailPage `statusbar` → `.o-detail-statusbar` + WorkflowStatusbar (**sticky md+**) |
| `.o_form_sheet_bg` + `.o_form_sheet` | **DetailPage / FormPage** emit `.o-form-sheet-bg` + `.o-form-sheet` (**SHIPPED** P1) |
| button_box | StatActions / EntityHeader actions |
| notebook | CmcTabs |
| Save / Discard | FormPage sticky actions |
| dirty indicator | not shipped |

```text
DetailPage
  PageHeader
  .o-form-sheet-bg
    .o-detail-summary     ← HighlightStrip / StatActions (scrolls)
    .o-detail-statusbar   ← WorkflowStatusbar (sticky md+)
    .o-form-sheet
      EntityHeader
      tabs?
      body
```

---

## Primitives & chrome

| Need | CMC export |
|------|------------|
| Icons | LineIcon |
| Table | DataTable |
| Empty | EmptyState |
| Dialog confirm | ConfirmDialog |
| Toast | ToastProvider / useToast |
| Command palette | CommandPalette |
| Status chips | StatusBadge / Badge |
| Avatar | Avatar |
| Tabs | CmcTabs |
| Filters (lite) | FilterBar |
| Search OS (target) | FilterBar → SearchChrome (facets + presets; see above) |
| Metrics | MetricCard / StatCard / InsightMetric |

---

## Status legend (dissection)

| Tag | Meaning |
|-----|---------|
| SHIPPED | Usable production analogue |
| PARTIAL | Works; density/slot order still behind Odoo |
| MISSING | No analogue; add only with multi-page demand |
| SKIP | Explicit non-goal |

Refresh statuses via the dissection process in `plans/260806-odoo-ui-component-dissection/plan.md` when Odoo pin or shell changes.

**Last status refresh:** 2026-08-06 (post P0) — **DateField** SHIPPED (date only); FilterBar on **12/23** lists; SearchChrome/facets still parked. Playbook + field map: `plans/260806-1509-odoo-ui-g1-search-g2-fields-grammar-audit/`. Review debt: `plans/260806-1538-parallel-comprehensive-review-wave-cook-datefield-filterbar/reports/debt-list.md`.

### Float stacking (design3)

```text
page chrome (1–10) < .console-navbar (1000) < .ck-toast-viewport (1100)
  < dialog.ck-dialog band (1150) < .ck-cmd (1200)
native <dialog>.showModal() top-layer > all of the above while open
```

Proof: `packages/ui/src/odoo/odoo-float-layer.test.ts`. Xia: `plans/reports/xia-compare-260806-odoo-float-layers.md`.

---

## Related

- [VIEW-GRAMMAR.md](./VIEW-GRAMMAR.md) — interaction rules (update: admin shell is ConsoleNavbar, not SideNav)
- [PAGE-FRAMES.md](./PAGE-FRAMES.md) — frame tiers
- [STRUCTURE.md](./STRUCTURE.md) — surface families (premium-era; admin paints via odoo mirror)
- [MASTER.md](./MASTER.md) — tokens / anti-patterns
