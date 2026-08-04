# Audit: CMC EDU design system completeness (education ERP admin)

**Date:** 2026-08-02  
**Scope:** `@cmc/ui` exports + components, tokens/premium CSS, Design Lab (`/design`), `design-system/cmc-edu/*`  
**Mode:** read-only inventory vs typical full ERP admin needs  
**Product lens:** facility-scoped education ERP (admin desktop) — auth, shell, ops lists, finance, CRM pipeline, teaching touch, HR, settings  

---

## Executive summary

CMC EDU already has a **coherent soft-ops stack**: tokens + Astryx one-door primitives + strong page frames (4 archetypes) + cockpit composites (metrics, inbox, funnel). Design Lab is a solid **living token/cohesion lab**, not yet a full component catalog.

| Layer | Completeness (est.) | Notes |
|-------|---------------------|--------|
| Tokens / visual language | **High** | Brand, warm neutrals, radius 12/16/20, elevation roles, type roles |
| Astryx primitives (via `@cmc/ui`) | **Medium–High** | Button, inputs, dialog, banner, skeleton, layout — **not fully demoed** |
| CMC composites (page atoms) | **High for ops core** | List/table/filter, metrics, funnel, inbox, toast, confirm |
| Page frames | **High** | Dashboard / List / Detail / Form documented + implemented |
| Design Lab inventory coverage | **Medium** | Strong on tokens + cockpit composites; weak on shell, detail/form, a11y states, Astryx catalog |
| Full ERP gaps | **Selective missing** | Pagination/bulk table, date filters, settings sections, auth frame, touch/attendance composite, steppers, charts |

**Doc drift:** `design-system/cmc-edu/MASTER.md` still lists Toast as “TO BUILD”; `ToastProvider` / `useToast` already ship in `packages/ui` and appear in Design Lab.

---

## 1. Inventory (source of truth)

### 1.1 `packages/ui/src/index.ts` — public surface

| Category | Exports |
|----------|---------|
| Tokens object | `tokens`, `Tokens` |
| Icons | `LineIcon`, `IconName` (~26 names) |
| Tone | `Tone` |
| Premium composites | `MetricCard`, `Panel`, `TaskRow`, `FunnelBar`, `funnelFillWidth`, `InsightMetric`, `FocusCard` |
| Theme | `AstryxCmcProvider` |
| Astryx barrel | `export * from './primitives.js'` (see §1.3) |
| Auth inputs | `TextField`, `PasswordInput` |
| Ops atoms | `StatusBadge`, `PageHeader`, `DataTable`, `EmptyState`, `StatCard`, `FilterBar`, `MasterDetail`, `CmcTabs`, `ConfirmDialog`, `ToastProvider`/`useToast`, `ResultPanel` |
| Shell | `NavEntry`, `NavModule`, `activeModuleId`, `SideNav`, `AppFrame` |
| Page templates | `ListPage`, `DetailPage`, `FormPage`, `DashboardPage`, `ShortcutChip`, `WorkInbox`, `StageFunnel` |

### 1.2 `packages/ui/src/components/*` — CMC-owned files

Presentational (props-only) composites:

- Shell: `app-frame`, `side-nav`, `nav-types`
- Frames: `list-page`, `detail-page`, `form-page`, `dashboard-page`
- Headers / chrome: `page-header`, `filter-bar`, `cmc-tabs`, `master-detail`
- Data: `data-table`, `empty-state`, `status-badge`, `result-panel`
- Feedback: `confirm-dialog`, `toast`
- Metrics / work: `metric-card`, `stat-card`, `insight-metric`, `focus-card`, `panel`, `task-row`, `work-inbox`, `shortcut-chip`
- Pipeline: `funnel-bar`, `stage-funnel`
- Auth: `auth-inputs` (`TextField`, `PasswordInput`)
- Icons: `line-icon`, `tone`

### 1.3 Astryx re-exports (`primitives.ts`)

`Text`, `Heading`, `Stack`/`HStack`/`VStack`/`StackItem`, `Button`, `IconButton`, `Badge`, `TextInput`, `TextArea`, `Selector`/`SelectorOption`, `MultiSelector`, `NumberInput`, `Skeleton`, `Spinner`, `ProgressBar`, `Divider`, `Grid`/`GridSpan`, `Banner`, `Dialog`/`DialogHeader`, `AlertDialog`, `Card`, `AppShell`, `TopNav`*, `SideNav`* (Astryx names collide conceptually with CMC `SideNav`), `Breadcrumbs`/`BreadcrumbItem`, `Tab`/`TabList`/`TabMenu`.

\* Prefer CMC `AppFrame` + CMC `SideNav` for admin shell (PAGE-FRAMES).

### 1.4 Tokens & premium CSS

| File | Role |
|------|------|
| `packages/ui/src/tokens.css` | Brand, text, surface, status solid+soft, radius ladder, space 4–24, Inter type roles, canvas/raised/sunken, shadows xs–lg, motion, focus halo, pad/gap rhythm, accent-soft |
| `packages/ui/src/premium.css` | `.ck-*` composites, `.ck-table-shell`, funnel/rail/split, `.sh-*` shell + CTA hierarchy, `.tpl-*` page templates, reduced-motion |
| `packages/ui/src/astryx-theme-cmc.css` | Bridges Astryx theme vars → CMC soft controls |

### 1.5 Design Lab (`apps/admin/src/pages/design-lab.tsx`) — what it shows

| TOC section | Content |
|-------------|---------|
| Cohesion | Nested radius, warm neutrals, elevation, hover verbs |
| Color | Swatches from CSS vars |
| Typography | Metric → label scale (Inter) |
| Space · radius · shadow | Scales + nested harmony ladder |
| Hover | Row / metric / field / action-link |
| Icon | Full `LineIcon` grid (most names) |
| Button | Astryx Button variants + `.sh-cta` / secondary / ghost + toast triggers + confirm **state flag only** |
| Status | `StatusBadge`, soft badge classes, `Banner` |
| Form | `TextInput` only (not TextArea/Selector/Number/Password) |
| Đồng nhất | Family table + composed PageHeader + fields + Panel/TaskRow |
| List ops | Live `ListPage` + `FilterBar` + `DataTable` in shell |
| Funnel | `FunnelBar` + `StageFunnel` stack/rail/split |
| Composite | ShortcutChip, FocusCard, InsightMetric, MetricCard, WorkInbox, Panel, EmptyState |
| Table | Standalone `DataTable` shell |
| Page frames | **ASCII mocks only** for 4 archetypes + one `PageHeader` |
| Live | Small production-like stack |
| Next | Anti-patterns |

**Not rendered in Design Lab (but exist in package):**  
`AppFrame`, `SideNav`, `ConfirmDialog` (real dialog), `DashboardPage`, `DetailPage`, `FormPage`, `MasterDetail`, `CmcTabs`, `ResultPanel`, `StatCard`, `TextField`/`PasswordInput`, Skeleton/Spinner/ProgressBar, TextArea/NumberInput/MultiSelector, Dialog (non-confirm), IconButton, Badge (Astryx), Breadcrumbs, loading/error table states.

### 1.6 Design-system docs

| Doc | Authority |
|-----|-----------|
| `design-system/cmc-edu/MASTER.md` | Global visual rules, density tiers, interaction contract, shadcn→CMC map |
| `design-system/cmc-edu/PAGE-FRAMES.md` | Shell + 4 page archetypes + role cockpit matrix |
| `pages/cockpit.md`, `list-ops.md`, `attendance.md` | Page overrides |
| `STYLING-BRIDGE.md` | Bridge notes |

---

## 2. Gap matrix (ERP admin needs)

Status: **exists** = shipped in `@cmc/ui` (or Astryx via one-door) and usable; **partial** = exists but incomplete, dual, underused, or not inventory-visible; **missing** = no shared pattern.

Priority: **P0** product-critical · **P1** high ops value · **P2** polish / later · **P3** nice-to-have.

| Component / pattern | Status | Priority | Notes |
|---------------------|--------|----------|-------|
| **Tokens (color, type, space, radius, elevation)** | exists | P0 | Complete soft-ops language; Design Lab covers well |
| **Premium CSS (composites + shell + tpl)** | exists | P0 | Single raised family + table shell + funnel layouts |
| **Astryx one-door primitives** | exists | P0 | Barrel in `primitives.ts`; Design Lab only demos subset |
| **Auth: login form inputs** | exists | P0 | `TextField`, `PasswordInput`; used by `apps/admin` login |
| **Auth: login / unauthenticated page frame** | missing | P1 | Login is page-local Card stack — no shared `AuthPage` / marketing-auth template |
| **Auth: change-password / session gate chrome** | partial | P2 | Product pages exist; no reusable auth-layout composite |
| **App shell (`AppFrame` + topbar slots)** | exists | P0 | Not in Design Lab; production shell uses it |
| **Side navigation (`SideNav` + NavModule)** | exists | P0 | Permission-filtered modules; not in Design Lab |
| **Nav registry / active module** | exists | P1 | `activeModuleId` + admin `nav-registry` (app-owned) |
| **Primary / secondary / ghost CTA hierarchy** | exists | P0 | `.sh-cta*` + Astryx Button; Design Lab demos |
| **Page frames: Dashboard / List / Detail / Form** | exists | P0 | Code + PAGE-FRAMES; Lab only ASCII for Detail/Form/Dashboard |
| **PageHeader (title, subtitle, actions, breadcrumbs)** | exists | P0 | Soft sticky card; Lab demos |
| **List ops recipe (header + filters + table)** | exists | P0 | `ListPage` + `density="ops"`; Lab demos |
| **FilterBar** | partial | P1 | Only `text` \| `select`; no date/range/boolean/chips/multi |
| **DataTable** | partial | P0 | Columns, load, error, empty, row click; **no** sort UI, pagination, selection, bulk actions, sticky cols |
| **EmptyState (title + description + action)** | exists | P0 | Lab demos; MASTER: still underused in product |
| **Detail: tabs (`CmcTabs`)** | exists | P1 | Not in Lab; detail pages should standardize on it |
| **Detail: MasterDetail split** | exists | P1 | Exists; not in Lab; limited product adoption visibility |
| **Form page + sticky actions** | exists | P0 | `FormPage`; not live-demoed in Lab |
| **ResultPanel (post-submit)** | exists | P1 | success/error/warning/loading; not in Lab |
| **ConfirmDialog (irreversible)** | exists | P0 | Lab only toggles boolean — **does not mount dialog** |
| **Toast (commit feedback)** | exists | P0 | Implemented + Lab triggers; MASTER.md still says “TO BUILD” |
| **Banner (durable alert)** | exists | P0 | Astryx via one-door; Lab demos |
| **Status badges** | exists | P0 | `StatusBadge` + soft badge CSS classes |
| **Metric cards (ops KPI)** | exists | P0 | `MetricCard` preferred; `StatCard` older Astryx Card variant (dual) |
| **InsightMetric (spark/delta)** | exists | P1 | Lab demos; reporting polish |
| **FocusCard (priority next action)** | exists | P1 | Lab demos |
| **Work inbox / TaskRow** | exists | P0 | Cockpit queue pattern |
| **Pipeline / funnel** | exists | P0 | `FunnelBar` + `StageFunnel` stack/rail/split — strong for CRM |
| **Shortcut chips (role cockpit)** | exists | P1 | Lab demos |
| **Icons (`LineIcon`)** | partial | P1 | Solid monochrome set (~26); may need more for full module map (e.g. print, download, trash, more-horizontal) |
| **Settings page pattern** | missing | P1 | No `SettingsSection` / description-list form layout composite; HR/admin config pages ad hoc |
| **Pagination / list footer** | missing | P1 | Not in `@cmc/ui`; large lists will invent local UI |
| **Table bulk actions / row selection** | missing | P1 | Common ERP (approve many, export); not in DataTable |
| **Date / date-range filter** | missing | P1 | Finance/attendance/CRM need dates; FilterBar lacks type |
| **Checkbox / switch / radio set** | partial | P1 | Not re-exported as CMC patterns; Astryx may expose elsewhere — no Lab demo; soft theme CSS only excludes checkbox from radius rules |
| **File upload / dropzone** | missing | P2 | Teaching evidence / attachments likely page-local |
| **Stepper / multi-step wizard** | missing | P2 | FormPage is single sticky bar, not step chrome |
| **Schedule / calendar day strip** | missing | P2 | Teaching schedule pages; no shared agenda composite |
| **Attendance touch grid (≥44px)** | partial | P1 | Pattern in docs (`attendance.md`); not extracted composite |
| **Charts / sparklines beyond InsightMetric** | partial | P2 | Tiny spark only; revenue report needs charts (app-local OK) |
| **Popover / dropdown menu / command palette** | missing | P2 | Not in barrel; shell uses simple links |
| **Tooltip** | missing | P3 | Not inventoried |
| **Avatar / user chip** | missing | P3 | Topbar badge text only |
| **Drawer / sheet (mobile secondary)** | missing | P3 | Admin is desktop-first; LMS separate |
| **Skeleton loading layouts** | partial | P1 | Astryx `Skeleton` exported; DataTable has row skeleton; no page-level skeleton recipes in Lab |
| **Spinner / progress** | exists | P2 | Re-exported; not in Lab |
| **Dirty leave-guard pattern** | partial | P1 | App helper `use-unsaved-blocker`; not a Design Lab / ui composite |
| **Density tiers (comfortable / compact / touch)** | partial | P1 | ListPage `ops` + docs; DataTable density fixed compact; no `density` prop API |
| **i18n / formatRole / status labels** | partial | P1 | Product language in docs; helpers mostly app-side |
| **Dark mode** | missing | P3 | Intentionally out of scope (warm light ops) |
| **LMS mobile frame** | partial | P2 | Explicit YAGNI in index comments; separate from admin |

---

## 3. Design Lab coverage vs package (inventory gaps)

Add these **even if only Astryx re-export demos** so `/design` is the single visual catalog.

### 3.1 High priority Lab sections to ADD

| Section ID (suggested) | What to demo | Why |
|------------------------|--------------|-----|
| `shell` | Mini `AppFrame` + `SideNav` with 2 modules, `.sh-cta` in topbar, content canvas | ERP chrome is invisible in Lab today |
| `feedback` | Real `ConfirmDialog` open/close + loading; toast success/error/info; `Banner` already nearby | Interaction contract (MASTER) |
| `frames-live` | Mini live `DashboardPage`, `DetailPage`+`CmcTabs`, `FormPage`+sticky actions+`ResultPanel` | ASCII mocks do not prove cohesion |
| `master-detail` | `MasterDetail` list + detail pane | Common detail archetype |
| `astryx-primitives` | Button (done), IconButton, Badge, TextArea, NumberInput, Selector, MultiSelector, Skeleton, Spinner, ProgressBar, Divider, Dialog, Breadcrumbs, Card | One-door catalog for implementers |
| `auth` | `TextField` + `PasswordInput` + sample login card | Login hardening surface |
| `table-states` | DataTable loading skeleton, error Banner, empty EmptyState, row click | Ops states under-shown |
| `legacy-dual` | Side-by-side `MetricCard` vs `StatCard` with “prefer MetricCard” callout | Prevent dual metric languages |

### 3.2 Medium priority Lab additions

- Soft badge CSS utility strip (already partial under Status) + document when to use StatusBadge vs soft chips  
- Density: `ListPage` default vs `ops` side-by-side  
- Focus / reduced-motion note (link tokens)  
- Icon gaps list (missing names)  
- Anti-pattern gallery with screenshots/markup (already prose; could be visual “don’t” cards)

### 3.3 Lab bugs / incompleteness

1. **ConfirmDialog not mounted** — `confirmOpen` state only; misleading for “feedback works.”  
2. **MASTER.md Toast “TO BUILD”** — update evergreen doc when docs pass runs.  
3. **No shell** — reviewers cannot validate nav hover, brand, topbar blur, CTA hierarchy in context.  
4. **StatCard orphaned** from Lab and from preferred metric language.

---

## 4. Recommended new presentational composites (3–6 high value)

Build only props-only DUMB composites in `@cmc/ui` (no tRPC). Prefer extending existing frames over parallel layouts.

### 4.1 `ListPagination` (or `TableFooter`) — **P1**

- **Problem:** Large ERP lists invent page size / “Trang n / m” UI inconsistently.  
- **API sketch:** `{ page, pageSize, total, onPageChange, onPageSizeChange?, summary? }`  
- **Visual:** flush under `.ck-table-shell`, meta 12, control radius 12.  
- **Value:** Unlocks finance, users, CRM, audit without page-local chrome.

### 4.2 `FilterBar` date / multi extensions — **P1** (extend, don’t replace)

- **Problem:** Attendance, receipts, pipeline, payroll need date and multi-select; only text+select today.  
- **API:** `FilterDef.type: 'text' | 'select' | 'date' | 'date-range' | 'multi'`  
- **Value:** Deep-linkable filters stay one pattern; Design Lab gains a real ops filter demo.

### 4.3 `SettingsSection` (description list form block) — **P1**

- **Problem:** Admin config (shift, network IP, salary tiers, facilities) needs titled sections with help text + fields; currently ad hoc.  
- **API sketch:** `{ title, description?, children, actions? }` raised card, optional split title | fields.  
- **Value:** Aligns settings density with FormPage without new page archetype.

### 4.4 `EntityHeader` (detail chrome) — **P1**

- **Problem:** Opportunity/receipt/class detail headers diverge (status + primary/destructive + meta).  
- **API sketch:** `{ title, status?, meta?, breadcrumbs?, primaryAction?, secondaryActions? }` built on `PageHeader` slots.  
- **Value:** DetailPage cohesion without inventing a 5th frame.

### 4.5 `BulkActionBar` — **P1/P2**

- **Problem:** Multi-approve / multi-export needs selection chrome (count + actions sticky).  
- **API sketch:** `{ selectedCount, actions, onClear }` appears above table when count > 0.  
- **Value:** ERP power-user pattern; pairs with future DataTable selection.

### 4.6 `AuthCard` / `AuthPage` layout — **P2** (or P1 if multi-auth surfaces grow)

- **Problem:** Login uses local Card; SSO/return/error states may drift.  
- **API sketch:** centered canvas, brand, title, children, footer links.  
- **Value:** Matches PAGE-FRAMES “no invent full-page layout” rule for unauthenticated routes.

**Honorable mentions (do not prioritize unless a product page forces it):**  
`AgendaStrip` (teaching day), `TouchStatusGrid` (attendance ≥44px extracted from teaching), `WizardSteps` (multi-step enroll), `FileDropzone`.

---

## 5. Prioritized roadmap (design system only)

| Phase | Work | Outcome |
|-------|------|---------|
| **A. Lab completeness** | Mount ConfirmDialog; shell mini-demo; live Dashboard/Detail/Form; Astryx primitive gallery; auth inputs; table states | `/design` = full inventory |
| **B. Doc sync** | MASTER interaction table: Toast **exists**; map StatCard → prefer MetricCard; refresh “missing primitives” list | Docs match code |
| **C. List power** | Pagination footer + FilterBar date/multi + optional BulkActionBar | Ops scale |
| **D. Settings + detail chrome** | SettingsSection + EntityHeader | Admin config + detail cohesion |
| **E. Touch/schedule extract** | Only when teaching pages migrate (YAGNI until second consumer) | Attendance/schedule reuse |

---

## 6. Strengths to preserve

1. **One interactive blue + warm paper canvas** — no second design system.  
2. **Nested radius harmony 12 ≤ 16 ≤ 20** with elevation roles.  
3. **Four mandatory page archetypes** (PAGE-FRAMES) — strong ERP consistency lever.  
4. **Cockpit composites** (WorkInbox, StageFunnel layouts, FocusCard, InsightMetric) exceed typical “admin kit” depth for CRM/ops.  
5. **Props-only package boundary** — pages own data; UI stays portable.  
6. **Design Lab as cohesion lab** already documents hover verbs and anti-patterns in-product.

---

## 7. Acceptance criteria for “complete enough” ERP admin DS

System is “complete enough” for solo-maintained education ERP when:

- [ ] Design Lab demos every **exported** CMC composite at least once (including shell + ConfirmDialog).  
- [ ] Astryx one-door primitives have a Lab section (even if thin).  
- [ ] List ops: filter + table + empty + loading + error + **pagination**.  
- [ ] Commit path: pending → toast; irreversible → ConfirmDialog (documented + demoed).  
- [ ] Settings and detail headers share one visual family.  
- [ ] No second metric card language (`StatCard` deprecated or clearly secondary).  
- [ ] MASTER / PAGE-FRAMES match shipped APIs (no “TO BUILD” for shipped features).

---

## Sources (repo paths)

- `/home/manhquy/Downloads/cmc_edu/packages/ui/src/index.ts`
- `/home/manhquy/Downloads/cmc_edu/packages/ui/src/primitives.ts`
- `/home/manhquy/Downloads/cmc_edu/packages/ui/src/components/*`
- `/home/manhquy/Downloads/cmc_edu/packages/ui/src/tokens.css`
- `/home/manhquy/Downloads/cmc_edu/packages/ui/src/premium.css`
- `/home/manhquy/Downloads/cmc_edu/apps/admin/src/pages/design-lab.tsx`
- `/home/manhquy/Downloads/cmc_edu/design-system/cmc-edu/MASTER.md`
- `/home/manhquy/Downloads/cmc_edu/design-system/cmc-edu/PAGE-FRAMES.md`

---

**Status: DONE**  
**Summary:** Soft-ops core (tokens, frames, list/filter/table, cockpit metrics/inbox/funnel, toast) is strong; Design Lab under-inventories shell, detail/form, Astryx primitives, and real ConfirmDialog. Highest-value builds: pagination footer, richer filters, settings section, entity header, optional bulk bar + auth layout.  
**Concerns:** MASTER.md Toast status is stale; `StatCard` dual with `MetricCard`; FilterBar/DataTable lack date/pagination/selection for full ERP scale.
