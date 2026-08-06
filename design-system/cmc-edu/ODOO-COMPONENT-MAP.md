# Odoo → CMC component map (admin design3)

> **Purpose:** One-page authority for which Odoo backend UI piece maps to which `@cmc/ui` surface.  
> **Source pin process:** `plans/260806-odoo-ui-component-dissection/`  
> **Full wireframes + matrix:** `plans/260806-odoo-ui-component-dissection/reports/odoo-19-source-dissection.md`  
> **Runtime design language:** `docs/design-system-odoo.md`  
> **Upstream:** [odoo/odoo@19.0](https://github.com/odoo/odoo/tree/19.0/addons/web/static/src)

**Do not port OWL/XML/Bootstrap.** Port layout grammar, slots, density, stacking.

---

## Shell

```text
Odoo                              CMC (apps/admin)
─────────────────────────────────────────────────────────────
.o_web_client                     .o_web_client  (shell.tsx)
.o_main_navbar                    OdooNavbar → .o-navbar
apps menu                         .o-app-switcher-toggle + .o-app-switcher-menu
.o_menu_brand                     .o-brand  (active module label; OdooNavbar default)
.o_menu_sections                  .o-menu-sections / .o-menu-item
.o_menu_systray                   systray slot (⌘K, enroll, role, logout)
.o_action_manager > .o_action     (collapsed)
.o_content (scroll)               main.o-main { overflow: auto }
MainComponentsContainer           Toast + CommandPalette (+ dialogs)
```

**Stacking rule:** `.o-navbar` must sit above `main.o-main` (z-index shell layer). App-switcher is absolute under navbar — never let `.o-page-header` win hit-testing.

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
| search / facets | FilterBar (lite) |
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

## Form / record analogue

| Odoo | CMC |
|------|-----|
| `.o_form_statusbar` | WorkflowStatusbar / ProgressSteps (in DetailPage `summary`) |
| `.o_form_sheet_bg` + `.o_form_sheet` | **DetailPage / FormPage** emit `.o-form-sheet-bg` + `.o-form-sheet` (**SHIPPED** P1) |
| button_box | StatActions / EntityHeader actions |
| notebook | CmcTabs |
| Save / Discard | FormPage sticky actions |
| dirty indicator | not shipped |

```text
DetailPage
  PageHeader
  .o-form-sheet-bg
    .o-detail-summary     ← statusbar / HighlightStrip band
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
| Filters | FilterBar |
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

**Last status refresh:** 2026-08-06 post-rebuild audit — navbar stacking **SHIPPED** (`menuCoveredCount=0`, z-index 1000); brand=module **SHIPPED**; kanban responsive **SHIPPED**; form dual-sheet **SHIPPED**; statusbar sticky **DEFERRED**; list Astryx sticky **CUT/debt**.

---

## Related

- [VIEW-GRAMMAR.md](./VIEW-GRAMMAR.md) — interaction rules (update: admin shell is OdooNavbar, not SideNav)
- [PAGE-FRAMES.md](./PAGE-FRAMES.md) — frame tiers
- [STRUCTURE.md](./STRUCTURE.md) — surface families (premium-era; admin paints via odoo mirror)
- [MASTER.md](./MASTER.md) — tokens / anti-patterns
