# VIEW-GRAMMAR — Odoo-like interaction grammar for CMC EDU

> **Authority:** Maps Odoo UX concepts → CMC `@cmc/ui` frames.  
> **Does not** port OWL, Bootstrap, or XML views.  
> **Stack:** React + Astryx + CSS tokens.  
> Related: [PAGE-FRAMES.md](./PAGE-FRAMES.md) · [STRUCTURE.md](./STRUCTURE.md) · [MASTER.md](./MASTER.md) · **[ODOO-COMPONENT-MAP.md](./ODOO-COMPONENT-MAP.md)**  
> **Source-grounded dissection (2026-08-06):** `plans/260806-odoo-ui-component-dissection/`  
> **Xia extract (layout, pre-design3 shell notes):**  
> `plans/260804-ui-smart-cohesion-upgrade/reports/xia-odoo-layout-grammar-2026-08-04.md`  
> **Upstream:** [odoo/odoo@19.0](https://github.com/odoo/odoo) ·  
> `addons/web/static/src/webclient/` · `search/control_panel/` · `views/{list,form,kanban}/`

> **Admin shell (design3, 2026-08):** production chrome is **OdooNavbar + `.o_web_client` + `main.o-main`**.  
> `AppFrame` / `SideNav` remain for **LMS** (TL12 premium) only — do not reintroduce as admin shell.

---

## 1. One product OS

```text
Admin (design3):  OdooNavbar + main.o-main
LMS (TL12):       AppFrame + SideNav
  └── exactly one page frame:
        DashboardPage | ListPage | DetailPage | FormPage | SettingsShell
```

Modules change **data, permissions, tabs** — never invent full-page chrome.

---

## 2. View type map (Odoo → CMC)

| Odoo view | CMC frame | Notes |
|-----------|-----------|--------|
| list | **ListPage** + ControlBar | Ops tables, queues |
| form (read) | **DetailPage** | Entity identity + sections |
| form (edit/create) | **FormPage** | Sticky actions |
| kanban | ListPage body **or** `KanbanBoard` | CRM pipeline: list↔kanban + `?view=`; generic board in `@cmc/ui` |
| calendar | ListPage + SoftOpsFullCalendar (FullCalendar dayGrid) **or** WeekSchedule | Teaching: week/month = FC Soft Ops B-lite; batch all-day v1; list/kanban Soft Ops |
| graph/pivot | DashboardPage / report panels | Revenue report etc. |
| settings | FormPage + SettingsSection | Or ListPage + tabs |

---

## 3. ControlBar (list chrome)

Sticky ops band on every ListPage:

```text
┌─ ControlBar (.tpl-control-bar) ─────────────────────────┐
│ header   → PageHeader (title · breadcrumbs · actions)     │
│ filters? → FilterBar                                      │
│ footer?  → ListPagination · bulk · secondary tools        │
└───────────────────────────────────────────────────────────┘
│ list body → DataTable | custom board | EmptyState         │
```

**Rules**

- One primary CTA in header actions (Create / Ghi danh).
- Pager always bottom of ControlBar footer or list foot — not random.
- Do not put FilterBar outside ListPage when using ListPage.
- **Row selection:** `DataTable` `selectedIds` + `onSelectionChange` → checkbox column; pair with `BulkActionBar` in `controlFooter` (pilot: gifts).

---

## 4. Detail / record recipe (Lightning-aligned)

**Tiers (authoritative):** [PAGE-FRAMES.md](./PAGE-FRAMES.md) §C — **full · standard · settings · thin**.  
Do not force EntityHeader on settings or thin ops pages.

```text
DetailPage
  header:   PageHeader — breadcrumbs; title only for settings/thin
  entity?:  EntityHeader  ← full/standard only · single h1 · 1 primary CTA
  summary?: HighlightStrip (standard+) · WorkflowStatusbar (full)
  settings?: SettingsShell (settings tier)
  stats?:   StatActions
  tabs?:    CmcTabs
  body?:    .tpl-detail-stack | .tpl-detail-split + SectionBlock + KeyValueList
```

**Single identity heading (full/standard):** only `EntityHeader` owns the entity name (`h1`).  
PageHeader with EntityHeader → omit `title` (breadcrumbs + optional actions only).  
**Settings:** PageHeader title is the page name; SettingsShell owns navigation.

| Odoo / Lightning | CMC |
|------------------|-----|
| form header + statusbar / Path | EntityHeader badges + WorkflowStatusbar |
| button_box / highlight panel | StatActions + HighlightStrip |
| sheet + group | SectionBlock + KeyValueList |
| notebook | CmcTabs |
| related lists | tab + table / “Xem tất cả” |
| chatter | ActivityTimeline tab (optional) |

### ControlBar surface

Sticky list chrome uses quiet canvas/raised surface + bottom hairline so scrolled rows do not bleed through (`.tpl-control-bar`).

---

## 5. Form recipe

```text
FormPage
  header → PageHeader
  body   → SectionBlock fields
  result? → ResultPanel
  actions → sticky Save / Discard (.tpl-actions)
```

---

## 6. Dashboard recipe

```text
DashboardPage
  title · shortcuts · metrics · primary queue · secondary context
```

Only cockpit (and future role dashboards).

---

## 6b. SettingsShell

```text
SettingsShell
  rail:  nav items (id · label · description)
  main:  SettingsSection blocks
```

Pilot: `/admin/shift-config` (groups | policy). Prefer over CmcTabs when ≥2 config domains.

---

## 6c. Command palette

Shell topbar **Tìm** + hotkey **⌘K / Ctrl+K** opens `CommandPalette` with permission-filtered nav entries.

---

## 7. Intentional exemptions

| Path | Reason |
|------|--------|
| `login.tsx`, `change-password.tsx` | Auth outside shell frames |
| `design-lab.tsx` | Inventory, not product |
| `coming-soon.tsx` | Placeholder |
| `teaching/pdf-annotator.tsx` | Embed tool |
| `*dialog*.tsx`, hooks, `*-actions.ts` | Not full pages |

Any new exemption must be added here.

---

## 8. Anti-patterns

- Page-local full-page layout CSS
- Second design system (shadcn/Tailwind)
- Bare PageHeader + ad-hoc Stack for product lists
- Odoo purple / Bootstrap default as brand
- BulkActionBar without DataTable selection (not ready)
- Generic KanbanBoard before 2+ boards need it

---

## 9. Adoption check

```bash
rg -L "ListPage|DetailPage|FormPage|DashboardPage" apps/admin/src/pages --glob '*.tsx'
# subtract EXEMPT paths above
```

---

## 10. Reference product recipes

| Recipe | File |
|--------|------|
| List | `apps/admin/src/pages/finance/receipt-list.tsx` |
| Detail | `…/finance/receipt-detail.tsx`, `…/students/student-detail.tsx` |
| Form | `…/finance/receipt-create.tsx` |
| Dashboard | `…/cockpit.tsx` |
| Demo | `…/design-lab.tsx` |
