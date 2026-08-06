# Odoo Search System Dissection — Filters · Group By · Favorites

**Date:** 2026-08-06  
**Pin:** `7de220c9` (`19.0`) — `/home/manhquy/Downloads/odoo-src`  
**Allowlist:** `addons/web/static/src/search/**` (+ list controller wiring only)  
**Parent plan:** [plan.md](../plan.md)  
**Why this wave:** User observation that Filters / Group By / Favorites is applied nearly system-wide — this is the real “ops OS” chrome, not a per-module widget.

---

## 1. Insight: một Search OS, không phải filter form rời

Trong Odoo backend, **mọi list / kanban / calendar / graph / pivot** (và nhiều form-related multi-record actions) đều đi qua cùng một stack:

```text
WithSearch  →  SearchModel (state + domain + groupBy + orderBy)
     │
     ├─ ControlPanel
     │     └─ layout-actions slot → SearchBar + SearchBarMenu
     │
     └─ Layout
           ├─ optional SearchPanel (left faceted sidebar)
           └─ view renderer (list / kanban / …)
```

**Hệ quả UX:** người dùng học **một** grammar:

| Hành vi | Nơi xảy ra | Kết quả nhìn thấy |
|---------|------------|-------------------|
| Gõ tìm field | SearchBar input + autocomplete | Facet chip `field` / `filter` |
| Bật preset filter | SearchBarMenu → cột **Filters** | Facet chip `filter` (primary) |
| Group records | SearchBarMenu → cột **Group By** | Facet chip `groupBy` (action color) |
| Lưu / mở view đã lưu | SearchBarMenu → cột **Favorites** | Facet chip `favorite` (star / warning) |
| Xóa điều kiện | Facet × remove | Domain/groupBy recompute |
| Multi-select rows | CP center swap | SearchBar **bị thay** bởi selection actions |

Đây là lý do cảm giác “áp dụng gần như toàn hệ thống”: **không có màn list nào tự vẽ form filter riêng** — view chỉ khai báo search arch / fields; chrome là shared.

---

## 2. Component inventory (source)

| Symbol | Path | Role |
|--------|------|------|
| `WithSearch` | `search/with_search/with_search.js` | Instantiates `SearchModel`, puts it on `env`, reloads on domain/groupBy/orderBy/context |
| `SearchModel` | `search/search_model.js` | **Single source of truth**: query, facets, domain, groupBy, orderBy, irFilters (favorites) |
| `SearchBar` | `search/search_bar/` | Facet chips + free-text search + autocomplete dropdown |
| `SearchBarMenu` | `search/search_bar_menu/` | Mega-dropdown 3 cột: Filters · Group By · Favorites |
| `CustomFavoriteItem` | `search/custom_favorite_item/` | Accordion “Save current search” (name + Default filter) |
| `CustomGroupByItem` | `search/custom_group_by_item/` | Select “Custom Group” over groupable fields |
| `PropertiesGroupByItem` | `search/properties_group_by_item/` | Group by dynamic properties fields |
| `SearchPanel` | `search/search_panel/` | **Left** category/filter sidebar (Inventory, etc.) — orthogonal to SearchBarMenu |
| `Layout` | `search/layout.xml` | CP + `main.o_content` (+ optional SearchPanel) |
| `ControlPanel` | `search/control_panel/` | LEFT / CENTER / RIGHT bands; center hosts SearchBar **or** selection |

**Default menu types** (SearchModel config):

```js
searchMenuTypes = ["filter", "groupBy", "favorite"]  // Set; can drop per view
```

Views có thể tắt từng cột (vd. một số form dialogs bỏ groupBy).

---

## 3. Wireframes

### 3.1 SearchBar (CP center — always-on grammar)

```text
┌─ .o_cp_searchview.input-group ─────────────────────────────────────────────┐
│ ┌─ .o_searchview.form-control (flex, wrap, py-1) ───────────────────────┐ │
│ │ [🔍]  ┌facet┐ ┌facet┐ …  [ Search... input flex-grow ]                 │ │
│ └───────────────────────────────────────────────────────────────────────┘ │
│ [▾]  ← .o_searchview_dropdown_toggler  (opens SearchBarMenu)              │
└───────────────────────────────────────────────────────────────────────────┘
         │
         ▼ autocomplete dropdown (.o_searchview_autocomplete)
    “Search Name for: john”
    “Search Email for: john”
    Custom Filter…
```

**Facet chip anatomy** (`.o_searchview_facet`):

```text
┌─ label (colored by type) ─┬─ values… ─[×] ─┐
│ icon | title              │ v1 | v2         │
└───────────────────────────┴─────────────────┘
```

| `facet.type` | Label chrome | Icon (FACET_ICONS) | Semantic color |
|--------------|--------------|--------------------|----------------|
| `filter` / `field` | `btn-primary` | filter icon / field title | primary |
| `groupBy` | `text-bg-action` (+ sort hover) | `oi-group` | action |
| `favorite` | `btn-favourite` | `fa-star` | warning / favourite |

Tokens:

- Facet value max-width: `$o-search-bar-facet-value-width: 16rem` (½ on small screens)
- Hotkeys: search focus `Q`; menu `Shift+Q`

### 3.2 SearchBarMenu (system-wide mega menu)

```text
┌─ .o_search_bar_menu (flex row on lg; stack on small) ──────────────────────┐
│ ┌ Filters ──────────┐ ┌ Group By ─────────┐ ┌ Favorites ────────────────┐ │
│ │ ☑ My Pipeline     │ │ ☑ Stage           │ │ ☆ My open deals           │ │
│ │ ☑ Unassigned      │ │ ☐ Salesperson     │ │ ☆ Team shared…            │ │
│ │ ───               │ │ ☐ Date > Month    │ │ ───                       │ │
│ │ Custom Filter…    │ │ ───               │ │ [Save current search]     │ │
│ │                   │ │ Custom Group ▾    │ │   name + ☐ Default filter │ │
│ └───────────────────┘ └───────────────────┘ └───────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────┘
```

**Column rules**

1. **Filters**
   - Checkbox items from search arch (`<filter>` / field filters).
   - Accordion when item has date/period **options** (Today / This week / …).
   - Divider between `groupNumber` clusters.
   - Footer: **Custom Filter…** → domain selector dialog (`DomainSelectorDialog`).

2. **Group By**
   - Checkbox group fields (incl. date intervals via options).
   - Multi groupBy stacks as ordered facets (secondary groups).
   - Optional **Custom Group** `<select>` over `GROUPABLE_TYPES` fields.
   - Can order-by-count when `canOrderByCount` (sort icon on groupBy facet).

3. **Favorites**
   - User favorites first, then shared (`More…` expand).
   - Selecting a favorite **replaces** the whole query (clear then activate).
   - **Save current search**: name + “Default filter” → persists as `ir.filters` server-side.
   - Edit pencil on hover.

Menu only renders columns present in `searchMenuTypes`.

### 3.3 SearchPanel (optional left rail — not the same as Filters menu)

```text
Layout content row:
┌─ SearchPanel ─┬─ renderer ─────────────────────────────┐
│ CATEGORY      │ list / kanban                          │
│  All / A / B  │                                        │
│ FILTERS       │                                        │
│  ☑ State X    │                                        │
└───────────────┴────────────────────────────────────────┘
```

- Declared in search arch as `<searchpanel>`.
- Used heavily in inventory/docs-style modules.
- Collapsible to thin “current selection” sidebar.
- **Orthogonal** to SearchBarMenu Filters: panel = hierarchical dimension browse; menu = boolean/domain presets + free text.

### 3.4 Selection replaces search (system rule)

From list controller:

```text
hasSelectedRecords == false:
  CP CENTER = SearchBar
  CogMenu visible

hasSelectedRecords == true:
  CP CENTER = SelectionBox + header bulk buttons + ActionMenus
  SearchBar hidden (layout-actions still defined; selection-actions win visually)
  Cog may swap to selection-aware menus on small screens
```

CMC today: `BulkActionBar` in ControlBar **footer** — does **not** steal the filter row. Gap remains PARTIAL (already noted in phase matrix).

---

## 4. SearchModel mental model (agent-facing, no OWL port)

Do **not** port `SearchModel`. Port the **state shape** if CMC ever grows a shared list chrome:

```text
SearchState
  query[]           // active search item activations
  searchItems{}     // catalog: filter | field | groupBy | dateGroupBy | favorite
  facets[]          // derived UI chips (type, values, separator, groupId)
  domain            // AND of globalDomain + query domains
  groupBy[]         // string field specs (may include :day/:month)
  orderBy[]
  irFilters[]       // favorites catalog (server)
  searchMenuTypes   // which menu columns exist
```

**Key behaviors to mirror conceptually**

| Behavior | Odoo | CMC implication |
|----------|------|-----------------|
| Facets are the truth UI | chips always reflect active query | Prefer chips over silent query params only |
| Favorite is exclusive | clear query then activate | Saved views = full snapshot, not additive |
| GroupBy can stack | multiple group facets | If group UI exists, allow multi-level |
| clearFilters keeps groupBy | `clearFilters()` | Reset filters ≠ reset grouping |
| Default favorite on open | `activateFavorite` | Optional “default view” per user/list |
| URL/export state | `exportState` / globalState | CMC already uses URL for FilterBar keys — good seed |

**Non-goals (reconfirmed)**

- Domain expression language + DomainSelectorDialog (debug-tier).
- `ir.filters` server persistence without product decision.
- Full search arch XML parser.

---

## 5. Why it feels universal (architecture)

```text
                    ┌──────────────────┐
  every multi-rec   │   WithSearch     │
  action wraps ───► │  SearchModel     │──► domain/groupBy to ORM read_group / web_search_read
                    └────────┬─────────┘
                             │ env.searchModel
              ┌──────────────┼────────────────┐
              ▼              ▼                ▼
         SearchBar     SearchBarMenu     SearchPanel
         (facets)      (F / GB / Fav)    (left rail)
              │              │
              └──────┬───────┘
                     ▼
              ControlPanel center
```

List / Kanban / Graph controllers **only**:

1. Pass `searchMenuTypes` / arch / fields into WithSearch.
2. Slot `SearchBar` into `layout-actions`.
3. Read `searchModel.domain` / `groupBy` for data load.

→ **Zero per-module filter UI implementation.** Modules contribute **data** (search view XML), not chrome.

---

## 6. CMC as-built vs Odoo

### 6.1 What CMC has today

| Piece | CMC | Coverage |
|-------|-----|----------|
| List chrome host | `ListPage` + `ControlBar` | System-wide for ops lists |
| Filter UI | `FilterBar` → `.o-filter-bar` | **PARTIAL** — row of text/select/date controls |
| State | URL query params **or** controlled `value/onChange` | Good deep-link seed |
| Bulk | `BulkActionBar` + DataTable selection | PARTIAL — footer, not center-swap |
| Group By | — | **MISSING** as shared primitive |
| Favorites / saved search | — | **MISSING** |
| Facet chips | — | **MISSING** |
| Search mega-menu | — | **MISSING** |
| SearchPanel left rail | — | **MISSING** (optional; only if inventory-like UX needed) |
| View switcher near search | page-local (`?view=`) | PARTIAL |

**FilterBar contract** (`packages/ui/src/components/filter-bar.tsx`):

```ts
FilterDef = { key, label, type: 'text'|'select'|'date', options?, placeholder? }
// Renders Selector / TextInput / date — not chips, not presets, not groupBy
```

**Adoption:** used on finance, CRM aftersale/meetings, students, teaching schedule, engagement rewards, etc. (~system-wide list pattern via ListPage) — **correct host**, **thin grammar**.

### 6.2 Gap matrix (this surface only)

| Odoo capability | Priority for CMC ops feel | Status | Cook note |
|-----------------|---------------------------|--------|-----------|
| Shared FilterBar host on ListPage | P0 | **SHIPPED** | Keep |
| Dense CP band (no nested cards) | P0 | **SHIPPED** (phase-01) | Keep |
| Facet chips for active filters | P1 | MISSING | Highest visual parity win |
| Preset filter menu (named checkboxes) | P1 | MISSING | Config-driven, no domain DSL |
| Free-text multi-field search | P1 | PARTIAL | Per-page single text key today |
| Group By menu + chip | P2 | MISSING | Only where list API supports group |
| Favorites / saved filter sets | P2 | MISSING | Needs storage decision (local vs server) |
| Selection replaces search | P2 | PARTIAL | UX polish after facets |
| Custom domain builder | P3 | SKIP | Non-goal |
| SearchPanel left rail | P3 | SKIP unless module needs | Inventory-style only |
| ir.filters server share | P3 | SKIP until product | |

### 6.3 Recommended CMC target grammar (lite, no OWL)

**Name:** `SearchChrome` (or evolve `FilterBar` → multi-slot) living in ControlBar filters slot.

```text
┌─ .o-search-chrome ────────────────────────────────────────────────────────┐
│ ┌─ .o-searchview ──────────────────────────────────────────┐ ┌ menu ▾ ┐ │
│ │ [chips…] [search input]                                  │ │Filters │ │
│ └──────────────────────────────────────────────────────────┘ │GroupBy?│ │
│                                                              │Saved?  │ │
└──────────────────────────────────────────────────────────────┴─────────┘
```

**Props sketch (design only — not implementing now):**

```ts
type SearchFacet = {
  id: string;
  type: 'filter' | 'groupBy' | 'favorite' | 'field';
  label: string;       // chip label band
  values: string[];    // chip body
};

type SearchPreset = {
  id: string;
  section: 'filter' | 'groupBy' | 'favorite';
  label: string;
  active?: boolean;
  // filter: contributes query keys; groupBy: field key; favorite: full snapshot
};

type SearchChromeProps = {
  facets: SearchFacet[];
  onRemoveFacet: (id: string) => void;
  searchText?: string;
  onSearchTextChange?: (q: string) => void;
  presets?: SearchPreset[];
  onTogglePreset?: (id: string) => void;
  // optional later: onSaveFavorite, groupableFields
};
```

**Page responsibility stays thin:** declare presets + map facets ↔ tRPC/query input.  
**Chrome responsibility:** chips + menu layout + keyboard focus. Same host every ListPage.

**Color grammar (mirror FACET_COLORS, CMC tokens):**

| Type | Chip accent |
|------|-------------|
| filter / field | `--cmc-accent` / primary |
| groupBy | secondary “action” (not purple brand) |
| favorite | warning / star |

---

## 7. Interaction rules to add to VIEW-GRAMMAR

1. **One search chrome per ListPage** — do not invent page-local filter cards outside ControlBar.
2. **Active conditions must be visible as chips** (or equivalent removable tokens) — silent URL-only filters are weaker than Odoo.
3. **Presets live in a menu**, not a second row of unlabeled selects, when a page has ≥3 named filters.
4. **Group By is optional per page** but when present uses the **same** menu + chip grammar.
5. **Favorites/snapshots** replace the full filter set; they do not stack with previous free filters unless product says so.
6. **Selection mode** may replace search chrome (P2); bulk bar alone is acceptable interim.
7. **No DomainSelector** in staff UI unless explicitly scoped as admin/debug.

---

## 8. Density / layout notes (SCSS facts)

| Token / rule | Value / behavior |
|--------------|------------------|
| Facet value max width | 16rem (8rem on small) |
| SearchBarMenu columns | min-width ~200px; lg max-width ≈ viewport/6 |
| Menu layout | row + `border-end` between columns on lg; stacked mb-4 on small |
| Favorite edit icon | hidden until hover (`--show-on-hover`) |
| CP SearchBar | `input-group` with menu toggler `rounded-start-0` (attached button) |

CMC densify path: keep single CP band; put search chrome **inside** filters slot (already flat under `.o_web_client .o-control-bar .o-filter-bar`).

---

## 9. Proof / next process steps

### Done this wave (research)

- [x] Inventory `search/**` against pin `7de220c9`
- [x] Wireframes: SearchBar, SearchBarMenu, SearchPanel, selection swap
- [x] CMC FilterBar + ListPage adoption scout
- [x] Gap matrix + lite target grammar
- [x] Evergreen map + VIEW-GRAMMAR updates (same session)

### Optional next (implementation — only if product prioritizes)

| Step | Command lane | Output |
|------|--------------|--------|
| Xia compare search surface | `/ak:xia odoo-src "search_bar facets SearchBarMenu favorites groupBy" --compare` | `plans/reports/xia-compare-*-odoo-search.md` |
| Phase cook P1 chips + preset menu | `/ak:cook` on new phase file | `SearchChrome` or FilterBar v2 + tests |
| Pilot pages | CRM pipeline + finance receipt-list | Prove system-wide host without per-page redesign |

### Explicit non-cook

- Port `SearchModel.js` / OWL / domain tree editor.
- Server `ir.filters` without storage ADR.

---

## 10. File index (read-only authority)

```text
odoo-src/addons/web/static/src/search/
  with_search/with_search.js
  search_model.js
  search_bar/search_bar.{xml,js,scss,variables.scss}
  search_bar_menu/search_bar_menu.{xml,js,scss}
  custom_favorite_item/*
  custom_group_by_item/*
  search_panel/*
  control_panel/control_panel.xml
  layout.xml
  utils/misc.js          # FACET_ICONS, FACET_COLORS, GROUPABLE_TYPES

odoo-src/addons/web/static/src/views/list/list_controller.xml  # SearchBar slot + selection

cmc:
  packages/ui/src/components/filter-bar.tsx
  packages/ui/src/components/list-page.tsx
  packages/ui/src/components/control-bar.tsx
  packages/ui/src/odoo.css  # .o-filter-bar densify
```

---

## 11. One-line synthesis

**Odoo’s “Filters · Group By · Favorites” is not a feature of each module — it is the shared Search OS (SearchModel + SearchBar + three-column menu + facet chips) mounted on every multi-record view; CMC already mounts filters system-wide via ListPage/FilterBar but still lacks facets, preset menu, groupBy, and favorites — those are the next professional-parity gaps, not more page-local select boxes.**
