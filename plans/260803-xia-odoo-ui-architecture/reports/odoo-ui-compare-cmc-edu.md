# Feature Comparison: Odoo Web Client UI Architecture

**Mode:** `--compare` (ak-xia) — analysis only, no code port  
**Date:** 2026-08-03  
**Source:** [odoo/odoo](https://github.com/odoo/odoo) branch `19.0` · docs [Framework Overview](https://www.odoo.com/documentation/19.0/developer/reference/frontend/framework_overview.html) · [View architectures](https://www.odoo.com/documentation/19.0/developer/reference/user_interface/view_architectures.html)  
**Local:** CMC EDU v2 · `apps/admin` + `@cmc/ui` · `design-system/cmc-edu/`  
**Risk score:** Low for **pattern port** · **Critical** if attempting OWL/Bootstrap/declarative-view transplant  

---

## 1. Source manifest

| Item | Value |
|------|--------|
| Repo | `odoo/odoo` (public, LGPL) |
| Ref | `19.0` (API + raw tree, not full clone — monorepo ~201k commits) |
| UI root | `addons/web/static/src/` |
| Scope for this study | Web client chrome, views, search/control panel, SCSS tokens — **not** Python ORM/accounting |
| Security | Content treated as untrusted design reference only |

### Source map (layers that make Odoo “feel like one product”)

```text
WebClient (SPA shell)
├── NavBar          — app switcher + menus + systray (company, user, …)
├── ActionContainer — stack of “actions” (breadcrumbs history)
└── MainComponentsContainer — global overlays (dialogs, notifications)

Layout (per action)
├── ControlPanel    — breadcrumbs · title · view switcher · search · pager · actions
├── SearchPanel     — optional left facet rail
└── o_content       — the active View

Views (registry-driven)
├── list | form | kanban | calendar | graph | pivot | …
├── fields registry (char, many2one, statusbar, tags, …)
└── widgets registry

Cross-cutting
├── Registries (fields, views, services, main_components)
├── Services (action, orm, notification, user, …)
├── Bus events (ACTION_MANAGER:UI-UPDATED, ROUTE_CHANGE, …)
└── SCSS primary_variables → Bootstrap override → component SCSS
```

Key files (reference):

| Concern | Path |
|---------|------|
| Shell | `webclient/webclient.{js,xml,scss}` |
| Action stack | `webclient/actions/` |
| Layout + CP | `search/layout.xml`, `search/control_panel/` |
| Search model | `search/search_model.js` (large, domain + favorites) |
| Views | `views/{list,form,kanban,calendar,…}/` |
| Fields | `views/fields/` |
| Tokens | `scss/primary_variables.scss` |

---

## 2. Why Odoo UI feels “professional & synchronized”

Not because of pretty pixels alone — because **every module reuses the same interaction grammar**.

### 2.1 One shell, infinite modules

- **WebClient** is always the same: navbar + action area + global chrome.
- Business modules **do not invent** a new app chrome; they register **actions** and **views**.
- Result: Sales, Inventory, HR open with identical muscle memory.

### 2.2 Closed set of view archetypes

| View | User job |
|------|----------|
| **list** | Browse, multi-select, bulk, open row |
| **form** | One record: sheet · groups · notebook · header status · chatter |
| **kanban** | Stage/card pipeline |
| **calendar** | Time-based |
| **graph / pivot** | Analytics |

Switching view type is a **ControlPanel control**, not a new page layout per team.

### 2.3 ControlPanel = universal ops chrome

Always the same band:

```text
[ breadcrumbs / action stack ]  [ view switcher ]  [ Create · Action · … ]
[ search bar · filters · group by · favorites ]     [ pager 1-80 / N ]
```

Search, pagination, and primary actions never “float” to random places per module.

### 2.4 Form is a recipe, not freeform HTML

Declarative structure (XML arch → JS compiler):

```text
form
  header     → workflow buttons + statusbar
  sheet
    button_box / oe_title / oe_stat_button
    group(col) → fields with labels
    notebook → page tabs
  chatter    → messages / activities (optional mixin)
  footer     → dialog Save/Discard
```

Same sheet width, same field label density, same tab pattern across CRM and Accounting.

### 2.5 Field widgets registry

`char`, `integer`, `many2one`, `many2many_tags`, `statusbar`, `monetary`, `date`…  
Developers pick a **widget name**, not invent a date picker every time.

### 2.6 Action stack = professional navigation

Opening a related record **pushes** an action; breadcrumbs reflect the stack.  
Back is not “browser hope” — it is product behavior.

### 2.7 Visual system is secondary to structure

Tokens (body 14px, system fonts, purple brand `#71639e` community / enterprise purple, Bootstrap):  
consistent, dense, **ops-first**. Beauty is restraint + repetition, not marketing flourish.

---

## 3. Local map (CMC EDU today)

| Layer | CMC equivalent | Status |
|-------|----------------|--------|
| Shell | `AppFrame` + `SideNav` + topbar | EXISTS |
| Page frames | `DashboardPage` · `ListPage` · `DetailPage` · `FormPage` | EXISTS (good direction) |
| List ops | `FilterBar` · `DataTable` · `BulkActionBar` · `ListPagination` | EXISTS |
| Detail | `EntityHeader` · `KeyValueList` · `SectionBlock` · `CmcTabs` | EXISTS (recent recipe) |
| Pipeline | `FunnelBar` / `StageFunnel` · CRM pipeline page | EXISTS (custom, not generic kanban engine) |
| Schedule | `WeekSchedule` · `SessionCard` | EXISTS (edu-specific) |
| Tokens | `--cmc-*` warm canvas · Inter · brand `#0071E3` | EXISTS (LOCKED) |
| Design lab | `/design` | EXISTS |
| Declarative views / field registry | — | **NEW** (not desired as full Odoo) |
| Action stack service | React Router routes | **PARTIAL** (routes ≠ action stack) |
| Universal ControlPanel | PageHeader + FilterBar (split) | **PARTIAL** |
| View switcher list↔form↔kanban | Ad-hoc per page | **GAP** |
| Statusbar / button_box / chatter | Scattered | **GAP** as pattern |
| Search favorites / domain builder | Simple filters | **GAP** |

**Already aligned in spirit:** closed page frames, raised family, DetailPage recipe, no second Tailwind/shadcn stack.

**Not Odoo yet:** “same ControlPanel for every entity,” view modes, action stack, field widgets as product language.

---

## 4. Head-to-head

| Aspect | Odoo | CMC EDU | Recommendation |
|--------|------|---------|----------------|
| Shell | NavBar + ActionContainer | AppFrame + SideNav + Routes | Keep CMC shell; add **action stack metaphors** only where drill-down deep |
| Page archetypes | list/form/kanban/… views | 4 frames Dashboard/List/Detail/Form | **Map Odoo views → CMC frames** (table below) |
| List chrome | ControlPanel unified | PageHeader + FilterBar separate | **Merge UX:** sticky “ops bar” = title+filters+pager+primary |
| Form layout | sheet · group · notebook · header | DetailPage / FormPage + SectionBlock | **Adopt form recipe slots** on Detail/Form |
| Field UI | registry widgets | Astryx inputs + ad-hoc | Optional **widget map** (status, money, phone, tags) not full registry |
| Kanban | first-class view | CRM pipeline custom | Keep custom pipeline; extract **KanbanBoard** only if 2+ boards |
| Search | SearchModel + favorites | FilterBar state | Evolve filters; skip full domain DSL initially |
| Navigation | action stack + breadcrumbs | RR Link breadcrumbs | Strengthen breadcrumbs; optional stack for CRM→receipt |
| Visual brand | Bootstrap purple / system UI | Warm paper + Inter + one blue | **Do not copy Odoo purple** — keep CMC brand |
| Extensibility | registries + services | React composition | Prefer composition + frames over DI registries |
| Density | high (14px, tight) | ops density + premium soft | Keep CMC soft premium; borrow Odoo **chrome consistency**, not boxy Bootstrap |

### View → Frame mapping (design target)

| Odoo view | CMC frame / surface |
|-----------|---------------------|
| list | `ListPage` + ops ControlBar |
| form (record) | `DetailPage` (read) / `FormPage` (edit) |
| kanban | StageFunnel / future `KanbanBoard` |
| calendar | `WeekSchedule` / `ScheduleMonth` |
| graph/pivot | Dashboard metrics + reports pages |
| settings | `SettingsSection` + FormPage |

---

## 5. Challenge framework (≥5)

| # | Question | Source answer | Local answer | Risk if wrong |
|---|----------|---------------|--------------|---------------|
| 1 | **Necessity:** need Odoo stack or only the *idea*? | Full declarative XML views + OWL | We need **grammar of screens**, not OWL | Wasting quarters rebuilding Odoo |
| 2 | **Simpler 80%?** | ControlPanel + view modes + form recipe | Enforce frames + ControlBar + Detail recipe | Over-engineering registries |
| 3 | **Overlap?** | Universal list/form | We already have List/Detail/Form + tokens | Duplicating shells → visual fork |
| 4 | **Maintenance?** | Odoo owns web client forever | Solo + AI ops; keep surface area small | Importing Bootstrap+OWL = unmaintainable |
| 5 | **Dependencies?** | OWL, QWeb, SCSS, py_js domains | React, Astryx, tRPC, CSS tokens | Stack dualism kills cohesion |
| 6 | **Architecture match?** | Model-driven UI from server arch | Hand-authored React pages + tRPC | Declarative XML fights typed frontend |
| 7 | **Tenant scale?** | Multi-company switcher core | Facility-scoped session | Fake multi-company UI without backend truth |

**Critical risks if “clone Odoo UI runtime”:** 5+ → **High**  
**Critical risks if “port interaction grammar only”:** 0–1 → **Low**

---

## 6. Decision matrix

| # | Decision | Odoo’s way | Our way | Choice |
|---|----------|------------|---------|--------|
| 1 | Framework | OWL + QWeb | React + Astryx + `@cmc/ui` | **Local** |
| 2 | Styling base | Bootstrap + SCSS vars | CSS tokens + premium.css | **Local** (keep brand) |
| 3 | Page grammar | View types | 4 frames + edu surfaces | **Hybrid:** map views → frames |
| 4 | List chrome | ControlPanel | PageHeader + FilterBar | **Hybrid:** unify into ControlBar pattern |
| 5 | Detail/form structure | sheet/group/notebook/header | EntityHeader/Section/Tabs | **Hybrid:** name slots like Odoo jobs |
| 6 | Field system | Full registry | Astryx + a few CMC widgets | **Local** + small widget kit |
| 7 | Action stack | action service | React Router | **Local** + deeper breadcrumbs |
| 8 | Kanban engine | Generic | CRM-specific | **Local** until 2nd board |
| 9 | Search favorites | SearchModel | Optional later | Defer |
| 10 | Chatter | mail.thread | ActivityTimeline | Keep Timeline; no full chatter |

---

## 7. Design direction for “Odoo-level sync” on CMC (without being Odoo)

### Principle

> **One interaction grammar · four page frames · one visual system.**  
> Modules only change **data, permissions, and which tabs exist** — never chrome geometry.

### A. Shell (already mostly right)

```text
AppFrame
  SideNav (module apps — like Odoo app switcher, vertical)
  Main
    Topbar (facility / user / 1 primary CTA)
    Page frame (List | Detail | Form | Dashboard)
```

**Odoo lesson:** never let a module own its own sidebar or invent a second top nav.

### B. ListPage = Odoo list + ControlPanel

Standardize every list as:

```text
┌─ ControlBar (sticky) ─────────────────────────────────────┐
│ breadcrumbs · title · subtitle          [Create primary]  │
│ FilterBar (search · status · chips)     pager · density   │
│ BulkActionBar when selection > 0                          │
├───────────────────────────────────────────────────────────┤
│ table shell · DataTable · EmptyState                      │
└───────────────────────────────────────────────────────────┘
```

Optional later: **view mode chips** (list | kanban) when a domain has both.

### C. DetailPage = Odoo form *read* recipe

Already started — lock as product law:

```text
header:   PageHeader (breadcrumbs)
entity:   EntityHeader  ≈ oe_title + status + button_box actions
summary?: Callout / metrics / status strip  ≈ header statusbar context
tabs?:    CmcTabs  ≈ notebook/page
body:     SectionBlock stack/split  ≈ group/sheet
```

Add **pattern names** in docs (for AI + humans):

| Odoo form piece | CMC slot |
|-----------------|----------|
| `header` + statusbar | EntityHeader badges + ProgressSteps when workflow |
| `button_box` / stat buttons | EntityHeader actions + InsightMetric strip |
| `sheet` + `group` | SectionBlock + KeyValueList / fields |
| `notebook` | CmcTabs |
| chatter | ActivityTimeline in a tab |

### D. FormPage = Odoo form *edit*

```text
PageHeader
ProgressSteps? (wizard)
SectionBlock fields (2-col groups)
ResultPanel?
sticky tpl-actions (Save · Discard)
```

### E. DashboardPage = Odoo “client action” dashboards

Shortcuts + metrics + primary queue + secondary — already role-framed; keep as only full custom layout.

### F. Visual: stay CMC, steal Odoo *discipline*

| Borrow from Odoo | Do not borrow |
|------------------|---------------|
| Same chrome every module | Purple brand / Bootstrap default gray |
| Dense but predictable list toolbar | FontAwesome-everywhere clutter |
| Form sheet mental model | Full OWL / XML views |
| Status as chip + workflow header | Recoloring every number |
| Pager always same place | Per-page layout experiments |

CMC already has stronger **premium restraint** (warm canvas, soft radius, one blue) — keep it; Odoo is the **ops OS**, not the brand.

### G. Micro-patterns that sell “ERP maturity”

1. **Statusbar workflow** on detail (draft → approved → sent) — ProgressSteps / pipeline rail  
2. **Stat buttons** on entity (Invoices: 3, Classes: 2) → navigate related list with context  
3. **Optional columns** on dense tables (Odoo `optional="hide"`)  
4. **Multi-edit** only where bulk already exists  
5. **Confirm on irreversible** (already ConfirmDialog)  
6. **Empty with sample-safe CTA** (no fake Odoo demo data in prod)

---

## 8. Phased roadmap (if product wants “second Odoo” UX)

**Not implementation plan for cook — design sequencing.**

| Phase | Goal | Outcome |
|-------|------|---------|
| **P0 — Law** | Document VIEW-GRAMMAR.md: map Odoo concepts → CMC frames; forbid page-local chrome | Agents stop inventing layouts |
| **P1 — ControlBar** | Unify list chrome (header+filter+pager) visual + sticky behavior | Every list “feels Odoo” |
| **P2 — Detail law** | All remaining entity pages on DetailPage recipe | Class/student/receipt/opp already; finish stragglers |
| **P3 — Widget kit** | StatusMoney, Phone, Tags, Statusbar strip, StatAction | Field look synchronized |
| **P4 — Related navigation** | Breadcrumb stack + “open related” with query context | CRM→receipt→student feels continuous |
| **P5 — Optional kanban frame** | Only if 2+ boards need same component | Avoid premature generic kanban |
| **Skip** | OWL, Bootstrap, XML views, SearchModel favorites, full chatter, multi-company switcher | Out of scope |

---

## 9. What “Odoo thứ 2” should mean for CMC

| Meaning | Verdict |
|---------|---------|
| Clone Odoo frontend runtime | **No** — wrong stack, wrong brand, unmaintainable solo |
| Same module cohesion as Odoo ERP | **Yes** — frames + grammar + tokens |
| Declarative model-driven UI from backend | **No** near-term — hand-crafted React + tRPC is the product truth |
| Education-specific surfaces (schedule, LMS) | **Yes** — Odoo has calendar; you have WeekSchedule — keep edu vocabulary |

**Positioning line:**

> CMC EDU = **facility education OS** with Odoo-grade **interaction consistency**, on a **premium warm design system**, not a reskin of Odoo.

---

## 10. Recommendation (ak-xia compare)

1. **Port patterns, not code.**  
2. **Treat Odoo ControlPanel + form sheet + view modes as the north-star grammar.**  
3. **Execute on existing `@cmc/ui` frames** — you already built the right abstraction layer.  
4. **Write `VIEW-GRAMMAR.md` + extend PAGE-FRAMES** before more page redesigns.  
5. **Next cook-sized step** (when approved): ControlBar unification on ListPage + finish DetailPage adoption — not “import Odoo web”.

---

## Handoff

- Report: `plans/260803-xia-odoo-ui-architecture/reports/odoo-ui-compare-cmc-edu.md`  
- Mode: **compare complete** — no implementation plan unless you approve a P0–P2 cook plan  
- To implement later: `/ak:plan` scoped to ControlBar + VIEW-GRAMMAR, then `/ak:cook`

**Status:** DONE  
**Summary:** Odoo sync comes from shell + ControlPanel + closed view set + form recipe + registries; CMC should map those to existing frames and brand, not transplant OWL/Bootstrap.  
**Concerns:** Full Odoo clone is a multi-year trap; design law docs are the high-leverage next step.
