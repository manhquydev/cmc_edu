# G1 — Search OS Application Playbook (CMC Admin ListPages)

**Date:** 2026-08-06  
**Scope:** How to apply Search OS grammar on CMC admin lists **today** (FilterBar + ListPage).  
**Non-goals:** Implement SearchChrome / facets / favorites; port OWL `SearchModel`; invent page-local filter chrome.  
**Authority:**

| Source | Role |
|--------|------|
| `design-system/cmc-edu/VIEW-GRAMMAR.md` §3 / §3.1 | Evergreen rules |
| `plans/260806-odoo-ui-component-dissection/reports/odoo-search-system-filters-groupby-favorites.md` | Odoo dissection + gap matrix |
| `plans/reports/brainstorm-260806-odoo-search-os-next-step.md` | Park-cook decision + re-open triggers |
| `packages/ui/src/components/{filter-bar,list-page,control-bar}.tsx` | Shipped contracts |

---

## 0. One-line rule

**Every multi-record ops list mounts search inside `ListPage` → `ControlBar.filters` via `FilterBar` (1–2 fields). Do not invent filter cards. Chips / preset menu / Group By / Favorites stay parked until a re-open cook trigger fires.**

```text
ListPage
  header        → PageHeader
  filters?      → FilterBar   ← system Search OS slot (lite today)
  controlFooter?→ BulkActionBar · ListPagination
  children      → DataTable | board | EmptyState
```

---

## 1. Decision tree — FilterBar as-is vs chips / presets (later)

Use this before adding any filter UI to a new or existing ListPage.

```text
Does the page use ListPage?
  NO  → Prefer migrate to ListPage first (ops list). Do not ship a free-floating filter form.
  YES ↓

How many independent filter conditions will staff use routinely?
  0           → Omit `filters` prop entirely (header + body only).
  1 text      → Archetype A — FilterBar text (uncontrolled URL or controlled).
  1 select    → Archetype B — FilterBar select status/kind.
  1 select + 1 text  → Archetype C — FilterBar both (receipt-list pattern).
  1–2 date fields only (range-ish) → FilterBar `type: 'date'` per key; still as-is.
  ≥3 named presets / “My open… / Unassigned…” style
              → STOP implementation of mega-menu. Prefer keep 1–2 selects
                OR fire re-open cook (chips first, then preset menu). See §8.
  Multi-field free-text that confuses staff (“what am I filtering?”)
              → Prefer clearer placeholders / labels first; if UAT still fails → cook B (chips).

Is Group By / saved Favorites required by product?
  NO  → Stay on FilterBar. Do not fake groupBy with extra selects in the filter row.
  YES → Needs list API + storage ADR; not FilterBar work. See §4 later column.
```

### Quick matrix

| Situation | Use now | Do **not** do now |
|-----------|---------|-------------------|
| 1–2 `FilterDef`s | `FilterBar` as-is in `filters=` | Page-local Card/Panel of inputs |
| Deep-link shareable filters | Uncontrolled FilterBar **or** controlled + mirror URL | Hidden state only, no UI |
| Reset page on filter change | Controlled `value`/`onChange` + `setPage(1)` | Rely on URL alone without reset |
| ≥3 named domain presets | Stay 1–2 selects **or** re-open cook | Hand-rolled dropdown “mega menu” per page |
| Want Odoo facet chips | Wait for cook B (shared chrome) | Per-page chip components |
| Row selection bulk | `BulkActionBar` in `controlFooter` | Hide filters and invent selection chrome |

---

## 2. URL / query contract

### 2.1 FilterDef keys

```ts
// packages/ui — shipped
export interface FilterDef {
  key: string;           // → URL query param name AND Record key in value/onChange
  label: string;
  type: 'text' | 'select' | 'date';
  options?: { value: string; label: string }[];  // select only
  placeholder?: string;  // text default: label; select default: 'Tất cả'
}
```

**Key rules**

| Rule | Detail |
|------|--------|
| Stable keys | Prefer short domain names: `status`, `q`, `kind`, `courseId`. Avoid renaming once deep-links exist. |
| Empty = all / no filter | Empty string → param **deleted** (uncontrolled) or omitted from API input. Select clear = “Tất cả”. |
| One key per control | Do not encode multi-value domains as comma-lists unless the API already owns that contract. |
| Reserved / orthogonal | View switchers (`?view=`) live beside filters (page-owned), not inside FilterDef. Pagination is **not** a FilterBar key (local state or separate param by page choice). |
| Value encoding | Always `string` in URL and in `Record<string, string>`. Coerce to API enums in the page. |

### 2.2 Controlled vs uncontrolled

| Mode | Props | Who owns state | URL | When to use |
|------|-------|----------------|-----|-------------|
| **Uncontrolled (default)** | `filters={FILTERS}` only | FilterBar via `useSearchParams` | Auto read/write (`replace: true`) | Simple lists; page reads params itself for tRPC (e.g. rewards) |
| **Controlled** | `value` + `onChange` | Parent `useState` | Parent must mirror if deep-link needed | Need side effects: reset page, clear selection, client-side filter, Vitest-stable state |

**Precedence (source):** when `value` is provided, FilterBar **does not** read URL for display; when `onChange` is provided, FilterBar **does not** write URL. Full control is both together.

```text
Uncontrolled:
  URL ⇄ FilterBar UI  →  page reads useSearchParams for query input

Controlled (recommended when page has pager/selection):
  Parent state ⇄ FilterBar UI
  Parent optionally ⇄ URL (deep-link / back-forward)
  Parent maps state → tRPC input + side effects
```

### 2.3 Mapping to data

1. Read string values (`filters.status`, `searchParams.get('status')`).
2. Validate against allowed enum sets; invalid → treat as empty/all.
3. Pass only defined filters to tRPC (`status` omitted when all).
4. On filter change: `setPage(1)`, clear `selectedIds` when selection exists.
5. Prefer server-side filter when the API supports it; client-side text filter is acceptable for small pages (receipt-list `q` is client filter today).

### 2.4 Contract anti-skips

- Do not put filter keys only in React state with no visible control (silent filters).
- Do not dual-write competing keys (`status` vs `filterStatus`) without migrating URLs.
- Do not use FilterBar `key` that collides with unrelated page params unless intentional.

---

## 3. Archetype recipes

### (A) Single text search

**When:** Lookup-style lists (students, schedule course id).  
**Host:** `ListPage` + `filters={<FilterBar … />}`.

**Pattern (controlled — students):**

```tsx
const STUDENT_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên hoặc SĐT phụ huynh (≥2 ký tự)',
  },
];

// state
const [filters, setFilters] = useState<Record<string, string>>({ q: '' });

// query: gate on min length; map q → name vs phone
filters={
  <FilterBar
    filters={STUDENT_FILTERS}
    value={filters}
    onChange={(next) => {
      setFilters({ q: next.q ?? '' });
      setPage(1);
      setSelectedIds([]);
    }}
  />
}
```

**Pattern (uncontrolled — schedule):**

```tsx
const FILTERS: FilterDef[] = [
  { key: 'courseId', label: 'ID khóa học', type: 'text', placeholder: 'Lọc theo khóa học' },
];

filters={<FilterBar filters={FILTERS} />}
// page: const courseId = searchParams.get('courseId') ?? undefined
```

---

### (B) Status / kind select only

**When:** Queue lists (aftersale, meetings, rewards, reconciliation).  
**Select clear semantics:** omit option `value: 'all'`; use `placeholder: 'Tất cả'` + empty string = all.

**Pattern (controlled — aftersale / meetings):**

```tsx
const AFTERSALE_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: [
      { value: 'open', label: 'Mở' },
      { value: 'in_progress', label: 'Đang xử lý' },
      { value: 'resolved', label: 'Đã giải quyết' },
      { value: 'closed', label: 'Đã đóng' },
    ],
    placeholder: 'Tất cả',
  },
];

const [filters, setFilters] = useState<Record<string, string>>({ status: '' });

// tRPC: ...(status !== 'all' ? { status } : {})
filters={
  <FilterBar
    filters={AFTERSALE_FILTERS}
    value={filters}
    onChange={(next) => {
      setFilters({ status: next.status ?? '' });
      setPage(1);
      setSelectedIds([]);
    }}
  />
}
```

**Pattern (uncontrolled URL — rewards):**

```tsx
const FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: REWARD_STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    placeholder: 'Tất cả',
  },
];

filters={<FilterBar filters={FILTERS} />}
// page: statusParam = searchParams.get('status'); validate ∈ enum
```

**Pattern (controlled + URL kind — reconciliation):**

```tsx
const RECON_FILTERS: FilterDef[] = [
  {
    key: 'kind',
    label: 'Loại cảnh báo',
    type: 'select',
    options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
    placeholder: 'Tất cả',
  },
];

// value={{ kind: kindFilter }} + onChange writes searchParams
```

---

### (C) Select + text (canonical dual-field)

**When:** Finance / ops lists with lifecycle + free search.  
**Reference pilot:** `apps/admin/src/pages/finance/receipt-list.tsx`.

```tsx
const FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: RECEIPT_STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    placeholder: 'Tất cả',
  },
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên HS, mã phiếu...',
  },
];

// Controlled local state is SoT for UI + query;
// URL mirrored best-effort for deep-link (back/forward re-sync via useEffect).
filters={
  <FilterBar filters={FILTERS} value={filters} onChange={handleFilterChange} />
}
```

**Side effects checklist (C):**

- [ ] Validate `status` against enum  
- [ ] Reset `page` + selection when status/q change  
- [ ] Server filter for status if API supports; client or server for `q`  
- [ ] URL keys match FilterDef keys exactly  

---

### (D) Multi-preset future (design only — do not implement ad hoc)

**When a cook trigger fires** (see §8), evolve the **same** ControlBar slot — not a second toolbar:

```text
┌─ ControlBar.filters ──────────────────────────────────────────────┐
│  [chip status:approved ×] [chip q:nguyen ×]  [search…]   [menu ▾] │
│                                                     Filters / …   │
└───────────────────────────────────────────────────────────────────┘
```

| Concern | Rule for later |
|---------|----------------|
| Host | Still `ListPage` `filters` slot only |
| State | Prefer chip-visible active conditions over silent URL |
| Presets ≥3 | Menu column, not a third/fourth select in a growing row |
| Favorites | Full snapshot replace (exclusive), after storage ADR |
| Group By | Same menu + distinct chip color; only if API supports |
| Migration | Keep FilterDef keys as URL seeds; chips reflect those keys |

**Until cook:** if product asks for “My open cases”, implement as **one select option or default query**, not a custom favorites UI.

---

## 4. Odoo → CMC now / later

| Odoo capability | CMC **now** (apply this) | CMC **later** (parked) |
|-----------------|--------------------------|-------------------------|
| Shared search host on every list | `ListPage` + `ControlBar` + `FilterBar` in `filters` | Same host; evolve FilterBar → SearchChrome |
| Free-text / field search | `FilterDef` `type: 'text'` (one key, page maps to fields) | Multi-field autocomplete + field chips |
| Named Filters presets | One `select` of statuses/kinds; empty = all | Checkbox preset menu when ≥3 named domains |
| Facet chips | **Absent** — active values live in controls | Removable chips (cook B first) |
| Group By menu + chip | **Absent** | Optional per page when API has groupBy |
| Favorites / saved search | **Absent** | After local vs server storage ADR; exclusive activate |
| SearchBarMenu 3 columns | **Absent** | Only after presets + (optional) groupBy demand |
| SearchPanel left rail | **Absent** | SKIP unless inventory-like module needs it |
| Selection replaces search (CP center swap) | `BulkActionBar` in **footer**; filters stay visible | Optional center-swap **after** chips |
| Domain / Custom Filter builder | **Never** for staff | Debug/admin only if ever scoped |
| URL / exportable state | URL query keys via FilterBar (good seed) | Facet export / favorite snapshot |

**Do not** treat “port SearchModel” as a now-step. Port **grammar** (one slot, visible conditions, thin page ownership of domain keys).

---

## 5. Anti-patterns

| Anti-pattern | Why it fails | Do instead |
|--------------|--------------|------------|
| **Filter card / Panel outside ListPage** | Breaks one-chrome grammar; densify work undoes nested cards | Always `ListPage` `filters=` |
| **Silent filters** (query param or default domain with no control) | Staff cannot see or clear conditions | Every active condition has a FilterBar control (or future chip) |
| **Inventing page chrome** (custom SearchBar, second toolbar, Odoo class clones) | Diverges from VIEW-GRAMMAR; hard to migrate later | Compose FilterBar only |
| **Growing select row for “presets”** (4+ Selects) | Odoo solves this with menu + chips; row becomes unreadable | Cap at ~2 controls; re-open cook for presets |
| **Page-local chip library** before shared chrome | Inconsistent ops OS | Wait for shared FilterBar evolution |
| **Hiding filters when rows selected** without platform support | Half-ported selection-swap; confuses pager/filter | Keep filters; use footer `BulkActionBar` |
| **Duplicate “Tất cả” option + empty clear** | Two “all” paths | Options = real values only; clear/empty = all |
| **Uncontrolled FilterBar + controlled tRPC mismatch** | UI shows URL; query uses different state | Either fully uncontrolled (read URL for query) or fully controlled |
| **FilterBar outside admin ListPage for non-list** | Wrong archetype | Forms use FormPage; dashboards use their own panels |
| **Domain DSL in staff UI** | Explicit non-goal | Fixed enums / simple text only |

### Scout note: CRM pipeline exception

`apps/admin/src/pages/crm/pipeline.tsx` puts a **lost-visibility Selector** in `filters` but implements it as raw `HStack` + `Selector`, not `FilterBar`. Search text lives in **header actions**. That is a board-style hybrid, not the canonical list recipe. For new **tabular** CRM lists (aftersale, meetings), **prefer FilterBar** — do not copy pipeline’s split chrome for standard lists.

---

## 6. Pilot recommendations

### 6.1 Finance — `receipt-list` (already archetype C)

| Aspect | Current | Apply now | If chips land later |
|--------|---------|-----------|---------------------|
| Host | `ListPage` density ops | Keep | Same slot; swap FilterBar internals |
| Filters | `status` select + `q` text | **Canonical dual-field reference** | Chips for active status + q; inputs remain or collapse into searchview |
| State | Controlled + URL mirror | Keep pattern for pager/selection | Facet remove → same `handleFilterChange` |
| Data | Server `status`; client `q` | OK for density; promote `q` to API if scale hurts | No chrome change |
| Bulk | Footer `BulkActionBar` | Keep interim selection UX | Still footer until selection-swap cook |
| What would change | — | Nothing required for G1 | Prefer **no page rewrite**: map existing keys → facets |

**Recommendation:** Treat receipt-list as the **golden path** for new finance/ops lists. Do not add a third filter without a cook trigger.

### 6.2 CRM — prefer `aftersale` (or `post-sale-meeting`) over pipeline

| Aspect | aftersale / meetings | Pipeline (contrast) |
|--------|----------------------|---------------------|
| Host | ListPage + FilterBar status | ListPage + custom filters slot + header search |
| Archetype | **B** (single status select) | Board hybrid |
| Controlled | Yes (reset page / selection) | Local state, non-FilterBar |
| Pilot choice | **Yes — standard CRM list pilot** | Not the Search OS list pilot |

**If chips land later on aftersale:**

- One select → one removable chip when non-empty (`status: open`).
- No preset menu needed until ≥3 **named domain shortcuts** beyond lifecycle select.
- `BulkActionBar` stays in footer; selection-swap not required for pilot.

**What would *not* need to change on aftersale when chips land:**

- `AFTERSALE_FILTERS` key `status`  
- tRPC `afterSale.list` input shape  
- ListPage / ControlBar composition  

---

## 7. Copy-paste FilterDef examples (from real pages)

### A — Students text (`apps/admin/src/pages/students/index.tsx`)

```ts
const STUDENT_FILTERS: FilterDef[] = [
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên hoặc SĐT phụ huynh (≥2 ký tự)',
  },
];
```

### A — Teaching schedule text URL (`apps/admin/src/pages/teaching/schedule.tsx`)

```ts
const FILTERS: FilterDef[] = [
  { key: 'courseId', label: 'ID khóa học', type: 'text', placeholder: 'Lọc theo khóa học' },
];
// usage: filters={<FilterBar filters={FILTERS} />}
```

### B — CRM aftersale status (`apps/admin/src/pages/crm/aftersale.tsx`)

```ts
const AFTERSALE_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    // Empty value = all (FilterBar select clear)
    options: STATUS_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({
      value: o.value,
      label: o.label,
    })),
    placeholder: 'Tất cả',
  },
];
```

### B — CRM parent meetings (`apps/admin/src/pages/crm/post-sale-meeting.tsx`)

```ts
const MEETING_FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: STATUS_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({
      value: o.value,
      label: o.label,
    })),
    placeholder: 'Tất cả',
  },
];
```

### B — Engagement rewards uncontrolled (`apps/admin/src/pages/engagement/rewards.tsx`)

```ts
const FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: REWARD_STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    placeholder: 'Tất cả',
  },
];
// usage: filters={<FilterBar filters={FILTERS} />}
```

### B — Finance reconciliation kind (`apps/admin/src/pages/finance/reconciliation.tsx`)

```ts
const RECON_FILTERS: FilterDef[] = [
  {
    key: 'kind',
    label: 'Loại cảnh báo',
    type: 'select',
    options: Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label })),
    placeholder: 'Tất cả',
  },
];
```

### C — Finance receipt-list dual (`apps/admin/src/pages/finance/receipt-list.tsx`)

```ts
const FILTERS: FilterDef[] = [
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'select',
    options: RECEIPT_STATUS_VALUES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
    placeholder: 'Tất cả',
  },
  {
    key: 'q',
    label: 'Tìm kiếm',
    type: 'text',
    placeholder: 'Tên HS, mã phiếu...',
  },
];
```

### Adoption scout summary (admin pages, non-test, 2026-08-06)

| Page | Path | Archetype | Mode |
|------|------|-----------|------|
| Students | `students/index.tsx` | A text | Controlled |
| Schedule | `teaching/schedule.tsx` | A text | Uncontrolled URL |
| Aftersale | `crm/aftersale.tsx` | B select | Controlled |
| Post-sale meeting | `crm/post-sale-meeting.tsx` | B select | Controlled |
| Rewards | `engagement/rewards.tsx` | B select | Uncontrolled URL |
| Reconciliation | `finance/reconciliation.tsx` | B select | Controlled + URL |
| Receipt list | `finance/receipt-list.tsx` | C select+text | Controlled + URL |
| Pipeline | `crm/pipeline.tsx` | Hybrid (non-FilterBar) | Custom |

**No admin list currently defines ≥3 named presets.** That is why SearchChrome cook remains parked.

---

## 8. Re-open cook triggers

From `plans/reports/brainstorm-260806-odoo-search-os-next-step.md` — **any one** re-opens delivery:

1. A ListPage needs **≥3 named presets** or multi-field free-text that confuses staff.  
2. UAT: “không thấy đang lọc gì” / cannot clear conditions.  
3. Product explicitly prioritizes Odoo SearchBar visual parity for a pilot module.  
4. A list API grows **server-side groupBy** with UI demand.

**If a trigger fires:**

| Order | Action |
|-------|--------|
| 1 | Start with **option B** — chips / clear-all on existing FilterBar (shared), not full mega-menu |
| 2 | Promote to preset **menu** only when presets ≥3 |
| 3 | Group By / Favorites / selection-swap stay separately gated (API + storage ADR) |
| 4 | Plan path: thin phase for FilterBar chips → cook; pilots: finance receipt-list + CRM aftersale |

**Explicitly parked until then**

| Item | Until |
|------|--------|
| Group By chrome | List API + product need |
| Favorites / saved views | Storage ADR (local vs server) |
| Selection replaces search | After chips exist (if ever) |
| SearchPanel left rail | Inventory-like module request |
| Domain custom filter | Never for staff (SKIP) |
| OWL / SearchModel port | Never as implementation strategy |

---

## 9. Agent checklist — new ListPage filter

```text
[ ] Page is ListPage (density ops for staff tables)
[ ] Filters only via filters={<FilterBar filters={…} />}
[ ] FilterDef keys stable; empty = all; select options without synthetic "all" value
[ ] Choose controlled if pager/selection/side effects; else uncontrolled URL
[ ] Map strings → API enums; reset page (+ selection) on change
[ ] Bulk actions in controlFooter, not a second filter row
[ ] ≤2 controls unless cook trigger; no page-local cards/chips/menu
[ ] Matches VIEW-GRAMMAR §3.1; no DomainSelector
```

---

## 10. File index

```text
packages/ui/src/components/filter-bar.tsx
packages/ui/src/components/list-page.tsx
packages/ui/src/components/control-bar.tsx
design-system/cmc-edu/VIEW-GRAMMAR.md          # §3 ControlBar, §3.1 Search OS
plans/260806-odoo-ui-component-dissection/reports/odoo-search-system-filters-groupby-favorites.md
plans/reports/brainstorm-260806-odoo-search-os-next-step.md

Admin references:
  apps/admin/src/pages/finance/receipt-list.tsx      # C golden
  apps/admin/src/pages/crm/aftersale.tsx             # B CRM pilot
  apps/admin/src/pages/crm/post-sale-meeting.tsx
  apps/admin/src/pages/students/index.tsx            # A
  apps/admin/src/pages/teaching/schedule.tsx         # A URL
  apps/admin/src/pages/engagement/rewards.tsx        # B URL
  apps/admin/src/pages/finance/reconciliation.tsx    # B kind
  apps/admin/src/pages/crm/pipeline.tsx              # hybrid — do not copy for tables
```

---

**Status:** DONE  
**Summary:** Playbook maps G1 Search OS to CMC as-is FilterBar on ListPage: decision tree, URL/controlled contract, archetypes A–D, Odoo now/later table, anti-patterns, receipt-list + aftersale pilots, real FilterDef snippets, and brainstorm re-open cook triggers (chips first, no SearchModel port).
`)