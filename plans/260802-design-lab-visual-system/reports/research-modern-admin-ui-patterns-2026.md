# Research: Modern Admin / SaaS / ERP UI Patterns (2024–2026)

**Date:** 2026-08-02  
**Audience:** Design Lab visual sprint (CMC EDU soft-ops ERP)  
**Stack constraint:** `--cmc-*` CSS custom properties + `.ck-*` / `.tpl-*` / `.sh-*` premium layer — **no** second DS (shadcn/Tailwind/Geist port)  
**Avoid:** 2018 Material flat cards, Bootstrap card stacks, thin gray-only progress bars, rainbow metric fills, cool Apple gray on warm canvas  
**Output goal:** concrete tokens, class names, visual rules applicable today  

---

## Executive summary

Modern professional admin UIs (Stripe Dashboard, Linear, Vercel, Shopify admin/Polaris, Attio, Atlassian, Carbon) converged on **software density + soft surfaces**, not marketing whitespace:

1. **Monochrome base + purposeful color** (Polaris, Geist, Atlassian) — one interactive blue; status only for state  
2. **Elevation as roles** (Atlassian) — sunken wells, flat default, raised float, overlay — not every card shadowed equally  
3. **Work-first composition** — metrics secondary to **inbox / pipeline / table**; focus action always one hop away  
4. **Soft semantic chips** (Radix Badge default = `soft`) — pastel bg + ink, not filled solid  
5. **Tables = toolbars + bulk bar + density modes** (Carbon, Polaris Index table) — not naked HTML tables  
6. **Feedback ladder** — inline → banner/callout → toast → modal (Carbon notifications)  

CMC already ships most of this grammar (`tokens.css` soft status pairs, `.tpl-dash-*`, `.ck-fn-*` / `.ck-rail` / `.ck-cstrip`, sticky `.tpl-actions`, toast left-rail). **Gaps that still read “dated ERP”:** StatusBadge still maps to Astryx **filled** semantics; DataTable lacks modern toolbar/bulk/density chrome; empty/loading often generic; funnel fallback to thin gray bars if stack/rail not used; nav density can drift consumer-sparse.

**Ranked choice for next visual sprint:**

| Rank | Action | Why |
|------|--------|-----|
| **1** | Wire **soft status chips** + table **toolbar/bulk/density** classes | Highest “not 2018” signal per line of CSS |
| **2** | Lock **dashboard composite** recipe (metrics ≤4 + focus CTA + pipeline + inbox) | Already half-built in `.tpl-dash-*` / FocusCard / StageFunnel |
| **3** | Standardize **empty / skeleton / error** inside panels (not full-page only) | Carbon + Polaris consensus; CMC EmptyState too thin |
| **4** | Form **section cards + sticky actions** (already `.tpl-actions`) as FormPage default | Carbon forms + Polaris card layout |
| **5** | Prefer **rail / conversion strip / stack bars** over lone thin FunnelBar | Premium already has modern family; ban gray-only tracks |

Do **not** adopt consumer SaaS sparsity (32–48px section gaps, 40px metrics everywhere) or second design system.

---

## Methodology

| # | Source | Credibility | Used for |
|---|--------|-------------|----------|
| 1 | [Shopify Polaris — Layout](https://polaris.shopify.com/design/layout), [Color](https://polaris.shopify.com/design/colors), [Patterns](https://polaris.shopify.com/patterns) | Official merchant admin DS (2025–26 Polaris Web Components era) | Software-not-website density; proximity; monochrome + purposeful color; index/resource layouts |
| 2 | [Atlassian Design — Elevation](https://atlassian.design/foundations/elevation), [Spacing](https://atlassian.design/foundations/spacing), [Color](https://atlassian.design/foundations/color), Lozenge | Official enterprise DS | Elevation ladder; 8px scale; lozenge/status as attribute labels |
| 3 | [IBM Carbon — Patterns](https://carbondesignsystem.com/patterns/overview/) (empty, forms, notifications, loading, data table, progress) | Official enterprise DS | Empty anatomy; form sections; feedback ladder; skeleton rules; table behaviors |
| 4 | [Vercel Geist](https://vercel.com/geist/introduction) materials/colors.md | Production DS behind Vercel product | Materials (radius/fill/stroke/shadow presets); high-contrast neutrals; modern “tool” aesthetic reference |
| 5 | [Radix Themes — Badge](https://www.radix-ui.com/themes/docs/components/badge) / Callout | Popular 2024–26 component primitive set | **Default badge = soft**; callout soft/surface/outline variants |
| — | Linear Method / product UI (observed patterns; public Method is process not pixel DS) | High product quality signal | Keyboard density, inbox-as-home, quiet chrome, command palette — **pattern** not tokens |
| — | Stripe Dashboard, Attio CRM, HubSpot admin (product observation + prior industry writeups) | High for visual language | Metric restraint, pipeline stages, soft filters, work lists |
| — | CMC as-built: `tokens.css`, `premium.css`, TL12, prior design-lab reports | Primary fit | Map every idea to existing tokens/classes |

**Search budget:** 4 research batches (Polaris/Atlassian/Carbon foundations; Linear/Stripe/Vercel/Attio discovery; Carbon+Polaris+Geist+Radix pattern pages; Carbon table/progress + secondary sources). No Gemini.  
**Date range of materials:** official docs current as of 2026-08; product UIs 2024–2026 generation.

---

## What “modern 2026” is (and is not)

### Is

- Warm or cool **paper canvas**, white raised work surfaces, **hairline** borders  
- Nested radius (control < card < dialog)  
- Soft pastel status, **near-black** metrics with tabular nums  
- Sticky chrome (top bar glass, sticky page header, sticky form actions, sticky table bulk bar)  
- Dense rows (40–48px list, 36–44px table) with sunken hover — **not** card-per-row  
- Pipeline as **stage rail / conversion strip / stepped stack**, not gray 4px bars  

### Is not

- Material Design 2018 filled FAB + primary-colored app bars  
- Bootstrap 4 card grid with equal drop shadows  
- Full-bleed colored metric tiles  
- Only thin `#e0e0e0` progress bars for funnels  
- Huge empty marketing illustrations on every empty list  
- Cool `#f5f5f7` chrome mixed into warm `#f5f3ee` product (CMC already fixing)

---

## 1. Dashboard composite patterns

### Industry consensus

| Product | Pattern | Lesson for CMC |
|---------|---------|----------------|
| Linear | Home = **My issues inbox** + status filters; metrics minimal | Work queue first |
| Stripe Dashboard | KPI strip (small) + **attention items** + charts secondary | Focus action > vanity metrics |
| Shopify admin | Resource index: filters + table; home cards for tasks | Card layout for settings, index for work |
| Attio | Pipeline stages as **columns/rail** + record density | CRM stages = navigation not decoration |
| Polaris Layout | Proximity groups related work; **software size** for tasks | Compact chips + larger focus blocks |

### CMC recipe (lock as Design Lab contract)

```text
.tpl-dash
  ├─ header (title + optional sub)          .tpl-dash-title / .tpl-dash-sub
  ├─ focus actions (1–5)                   .tpl-dash-shortcuts + .tpl-dash-chip
  ├─ metrics (2–4 max)                     .tpl-dash-metrics > .ck-mc | .ck-im
  └─ body 1.4fr / 1fr                      .tpl-dash-body
       ├─ primary: pipeline OR work inbox  .ck-fn* | .ck-rail | .ck-cstrip | .ck-inbox-*
       └─ secondary: tasks / shortcuts     .ck-pnl > .ck-row
```

**Visual rules**

| Rule | Token / class | Do | Don’t |
|------|---------------|-----|-------|
| Max 4 metrics | `.tpl-dash-metrics` | Near-black value, label uppercase 11 | Rainbow card fills, >4 KPIs |
| Metric elevation | `--cmc-shadow-sm` rest | Hover → `--cmc-shadow-md` + brand soft border | All metrics + panels same float |
| Focus CTA | `.tpl-dash-chip` pill | Count badge `.tpl-dash-chip-badge` | Giant primary buttons in metric grid |
| Primary column | `.tpl-dash-primary` | One dominant work surface | Two equal competing tables |
| Section gap | `--cmc-gap-section` (keep ≤24 ops) | `.tpl-wrap--ops` for dense | 32–48 consumer gaps |

**Optional composite class (if missing):**

```css
/* Focus strip under title — Linear/Stripe “what needs me” */
.ck-focus-strip {
  display: flex; flex-wrap: wrap; gap: var(--cmc-space-2);
  padding: 12px var(--cmc-pad-card-x);
  background: color-mix(in srgb, var(--cmc-brand-muted) 40%, var(--cmc-surface-raised));
  border: 1px solid var(--cmc-border-subtle);
  border-radius: var(--cmc-radius-md);
}
.ck-focus-strip-title {
  width: 100%;
  font-size: var(--cmc-fs-label); font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--cmc-text-muted);
}
```

---

## 2. Form patterns

### Industry (Carbon forms + Polaris card/settings layout)

- Group related fields under **section titles**  
- Progressive disclosure for advanced  
- Single interaction method as long as possible  
- Long forms: **sticky save/discard** (Polaris Contextual save bar legacy → modern sticky footer)  
- Dedicated route for create (`/…/new`) — already TL12  

### CMC mapping

| Pattern | Class / token | Visual rule |
|---------|---------------|-------------|
| Page canvas | `.tpl-wrap` / `.tpl-form-body` | gap = `--cmc-gap-cluster` (16) |
| Section card | `.ck-pnl` + `.ck-pnl-head` | One section = one panel; no nested full cards |
| Field group | `.ck-field-group` *(add)* | 12–16px vertical stack; label above |
| Sticky actions | `.tpl-actions` + `.fp-action` | **Already modern** — raised md + shadow-md + pill primary |
| Inline error | field border `--cmc-danger` + text `--cmc-danger-ink` | Never only red border without text |
| Destructive | secondary outline danger soft | ConfirmDialog for money/enrollment |

```css
/* Proposed field-group — Carbon “section” without new DS */
.ck-field-group {
  display: flex; flex-direction: column; gap: 12px;
  padding: 4px 0 8px;
}
.ck-field-group + .ck-field-group {
  border-top: 1px solid var(--cmc-border-subtle);
  margin-top: 8px; padding-top: 16px;
}
.ck-field-group-title {
  font-size: var(--cmc-fs-body); font-weight: 600;
  color: var(--cmc-text); letter-spacing: -0.01em;
}
.ck-field-group-hint {
  font-size: var(--cmc-fs-meta); color: var(--cmc-text-muted); margin-top: -6px;
}
.ck-field-row { /* 2-col on wide */
  display: grid; gap: 12px;
  grid-template-columns: 1fr;
}
@media (min-width: 720px) {
  .ck-field-row.is-2 { grid-template-columns: 1fr 1fr; }
}
/* Sticky actions: keep existing .tpl-actions; add top hairline glass option */
.tpl-actions.is-glass {
  background: color-mix(in srgb, var(--cmc-surface-raised) 88%, transparent);
  backdrop-filter: var(--cmc-blur-nav);
}
```

**Ranked form layout:** sectioned panels + sticky bottom actions (**1**) > single long scroll no sticky (**3**) > multi-step wizard for simple create (**avoid** unless ≥3 required stages — Carbon progress indicator).

---

## 3. Empty / loading / error states

### Carbon empty anatomy (authoritative)

1. Optional **non-interactive** image  
2. **Positive title** (“Bắt đầu bằng cách thêm…”) not only “Không có dữ liệu”  
3. Body: what would appear + why empty  
4. **Primary action** (create / clear filters)  
5. Optional secondary link (docs)  

Types: first-use · user-cleared · no-results (filters) · error/unavailable  

### Carbon loading

- **Skeleton** for containers/tables/cards only  
- Motion on skeleton reduces “frozen” feel  
- Never skeleton: toasts, menus, modals, loaders themselves  
- Prefer progressive load of primary column first  

### CMC rules

| State | Placement | Classes | Visual |
|-------|-----------|---------|--------|
| Empty in panel | inside `.ck-pnl` | `.ck-empty` | pad 32–40; icon monochrome faint; title 14/600; CTA pill brand |
| Empty full page | `.tpl-wrap` | `EmptyState` | same grammar; max-width 360 centered |
| No results | replace table body | `.ck-empty--filtered` | “Không khớp bộ lọc” + clear filters |
| Loading table | keep header/toolbar | `.ck-skel-row` | 4–6 rows, shimmer warm sunken |
| Loading metrics | metric grid | `.ck-mc.is-skel` | block placeholders, no spinner per card |
| Error panel | inline callout | `.ck-callout--danger` | soft red bg; retry action |
| Error toast | transient | `.ck-toast--error` | already left rail |

```css
.ck-empty {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 8px; padding: 36px 24px;
}
.ck-empty-icon { color: var(--cmc-text-faint); margin-bottom: 4px; }
.ck-empty-title { font-size: 14px; font-weight: 600; color: var(--cmc-text); }
.ck-empty-body { font-size: 13px; color: var(--cmc-text-muted); max-width: 320px; line-height: 1.5; }
.ck-empty-actions { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }

.ck-skel-row {
  height: 44px; margin: 0 var(--cmc-pad-card-x) 8px;
  border-radius: var(--cmc-radius-control);
  background: linear-gradient(
    90deg,
    var(--cmc-surface-sunken) 0%,
    var(--cmc-hover) 50%,
    var(--cmc-surface-sunken) 100%
  );
  background-size: 200% 100%;
  animation: ck-skel 1.2s var(--cmc-ease) infinite;
}
@keyframes ck-skel {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
@media (prefers-reduced-motion: reduce) {
  .ck-skel-row { animation: none; opacity: 0.7; }
}

/* Callout = Radix/Carbon inline message */
.ck-callout {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 12px 14px; border-radius: var(--cmc-radius-control);
  border: 1px solid transparent; font-size: 13px; line-height: 1.45;
}
.ck-callout--info { background: var(--cmc-info-soft); color: var(--cmc-info-ink); }
.ck-callout--success { background: var(--cmc-success-soft); color: var(--cmc-success-ink); }
.ck-callout--warning { background: var(--cmc-warning-soft); color: var(--cmc-warning-ink); }
.ck-callout--danger { background: var(--cmc-danger-soft); color: var(--cmc-danger-ink); }
```

**Anti-patterns:** full-page spinner blocking shell; empty table with zero chrome; error only as toast when form still open.

---

## 4. Navigation density (side nav + top bar)

### Industry

| Source | Pattern |
|--------|---------|
| Linear | Narrow icon+label rail; active = soft fill; keyboard first |
| Vercel/Geist | Compact top bar; product switcher; dense mono |
| Polaris | Frame: top bar + nav; **admin = software** sizing |
| Atlassian | Nested side nav; elevation for flyouts only |
| Shopify | Collapsible nav; active module emphasis |

### CMC shell (`.sh-*` / AppFrame)

**Target density (soft-ops):**

```text
Side nav width:     220–240px expanded / 64px collapsed
Nav item height:    32–36px  (not 44 consumer)
Nav item radius:    --cmc-radius-control (12)
Active:             brand-muted bg + brand ink (not solid brand fill bar)
Top bar height:     48–52px  glass (--cmc-blur-nav)
Top bar elevation:  --cmc-shadow-xs only
Content pad:        .tpl-wrap--ops 18×22 for lists; 24×28 default
```

```css
/* Density tokens — promote if not present */
:root {
  --cmc-nav-width: 232px;
  --cmc-nav-width-collapsed: 64px;
  --cmc-topbar-height: 52px;
  --cmc-row-height: 44px;      /* table / task */
  --cmc-row-height-dense: 36px;
  --cmc-control-height: 36px;
}
.sh-item {
  min-height: 32px;
  border-radius: var(--cmc-radius-control);
  /* active: background var(--cmc-brand-muted); color var(--cmc-brand-ink); */
}
/* Sticky page header must clear shell topbar */
.ck-page-header { top: var(--cmc-topbar-height); } /* not top: 0 if shell fixed */
```

**Trade-off:** wider nav labels (VN language) need ≥220px — don’t force icon-only desktop. Collapse only below ~1100px.

---

## 5. Data table modern treatments

### Carbon + Polaris Index table consensus

| Feature | Behavior | CMC class idea |
|---------|----------|----------------|
| Toolbar | search + filters + primary create | `.ck-table-toolbar` |
| Index filters | chips for active filters | reuse FilterBar warm chrome |
| Bulk actions | appears on selection; sticky | `.ck-table-bulk` |
| Density | comfortable / compact | `.ck-table[data-density=…]` |
| Row hover | sunken, not shadow | match `.ck-row:hover` |
| Selected row | brand-muted wash | `.is-selected` |
| Sticky header | thead on scroll inside card | `position: sticky; top: 0` |
| Flush in panel | no double border/radius | table shell = panel; `overflow: hidden` |
| Status col | soft badge, not loud fill | soft StatusBadge |
| Empty | in-body empty state | `.ck-empty` |

```css
.ck-table-shell {
  background: var(--cmc-surface-raised);
  border: 1px solid var(--cmc-border-subtle);
  border-radius: var(--cmc-radius-md);
  box-shadow: var(--cmc-shadow-sm);
  overflow: hidden;
}
.ck-table-toolbar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px var(--cmc-pad-card-x);
  border-bottom: 1px solid var(--cmc-border-subtle);
  background: var(--cmc-surface-2); /* warm chrome — not cool gray */
}
.ck-table-toolbar-spacer { flex: 1; }
.ck-table-bulk {
  display: none; align-items: center; gap: 12px;
  padding: 8px var(--cmc-pad-card-x);
  background: var(--cmc-brand-muted);
  border-bottom: 1px solid color-mix(in srgb, var(--cmc-brand) 18%, transparent);
  font-size: 13px; font-weight: 500; color: var(--cmc-brand-ink);
}
.ck-table-shell.has-selection .ck-table-bulk { display: flex; }
.ck-table {
  width: 100%; border-collapse: collapse;
  font-size: var(--cmc-font-size-data);
}
.ck-table th {
  font-size: var(--cmc-font-size-column);
  font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--cmc-text-muted);
  text-align: left; padding: 10px 12px;
  background: var(--cmc-surface-raised);
  border-bottom: 1px solid var(--cmc-border-subtle);
  position: sticky; top: 0; z-index: 1;
}
.ck-table td {
  padding: 0 12px; height: var(--cmc-row-height);
  border-bottom: 1px solid var(--cmc-border-subtle);
  color: var(--cmc-text); vertical-align: middle;
}
.ck-table[data-density="compact"] td { height: var(--cmc-row-height-dense); }
.ck-table tr:hover td { background: var(--cmc-surface-sunken); }
.ck-table tr.is-selected td {
  background: color-mix(in srgb, var(--cmc-brand-muted) 65%, transparent);
}
/* Numeric columns */
.ck-table .is-num { font-variant-numeric: tabular-nums; text-align: right; }
```

**Ranked table chrome:** shell+toolbar+bulk (**1**) > shell only (**2**) > bare table on canvas (**3**, list-only extreme density).

---

## 6. Feedback (toast, banner, inline)

### Carbon notification ladder (map → CMC)

| Disruptiveness | When | CMC |
|----------------|------|-----|
| Inline field | Validation on blur/submit | TextInput error + `--cmc-danger-ink` |
| Callout / banner in page | Persistent context (permission, period closed) | `.ck-callout--*` or Astryx Banner themed soft |
| Toast | Transient success / non-blocking error | `.ck-toast` (exists) |
| Modal / confirm | Destructive or irreversible | `ConfirmDialog` |
| Result panel | Multi-step automation outcome | `ResultPanel` (TL12 — keep) |

**Toast visual rules (refine existing):**

```css
/* Already good: raised, shadow-lg, 3px left rail */
/* Soften: optional soft fill instead of only border */
.ck-toast--success {
  border-left-color: var(--cmc-success);
  background: color-mix(in srgb, var(--cmc-success-soft) 35%, var(--cmc-surface-raised));
}
.ck-toast--error {
  border-left-color: var(--cmc-danger);
  background: color-mix(in srgb, var(--cmc-danger-soft) 40%, var(--cmc-surface-raised));
}
```

**Rules:** one toast at a time for same action; never toast-only for form errors still on screen; banners dismissible unless system-blocking; prefer Vietnamese user language (TL12 §8).

---

## 7. Status / badge systems — soft pastels

### Industry

- **Radix Badge** default variant = **`soft`** (pastel bg + colored text)  
- **Atlassian Lozenge** = compact attribute label (not decoration)  
- **Polaris Badge** = status meaning; monochrome admin so color pops  
- **Astryx semantic** (current CMC StatusBadge path) = often **filled solid** → loud in tables  

### CMC tokens (already present — use them)

```css
/* tokens.css — LOCKED pairs */
--cmc-success-soft / --cmc-success-ink
--cmc-warning-soft / --cmc-warning-ink
--cmc-danger-soft  / --cmc-danger-ink
--cmc-info-soft    / --cmc-info-ink     /* brand family */
--cmc-neutral-soft / --cmc-neutral-ink
```

```css
/* Promote StatusBadge off filled Astryx semantics */
.ck-badge {
  display: inline-flex; align-items: center; gap: 4px;
  height: 22px; padding: 0 8px;
  border-radius: var(--cmc-radius-pill);
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  line-height: 1; white-space: nowrap;
}
.ck-badge--success { background: var(--cmc-success-soft); color: var(--cmc-success-ink); }
.ck-badge--warning { background: var(--cmc-warning-soft); color: var(--cmc-warning-ink); }
.ck-badge--danger  { background: var(--cmc-danger-soft);  color: var(--cmc-danger-ink); }
.ck-badge--info    { background: var(--cmc-info-soft);    color: var(--cmc-info-ink); }
.ck-badge--neutral { background: var(--cmc-neutral-soft); color: var(--cmc-neutral-ink); }
/* Optional leading dot for denser tables */
.ck-badge-dot {
  width: 6px; height: 6px; border-radius: 999px; background: currentColor; opacity: 0.85;
}
/* Solid only for rare high-urgency headers — not table cells */
.ck-badge.is-solid.ck-badge--danger {
  background: var(--cmc-danger); color: #fff;
}
```

**TL12 semantics preserved:** brand blue = “you are here” / interactive — **never** danger for current CRM stage.

---

## 8. Pipeline / funnel visualization alternatives

### Reject (dated)

- Single thin 4–6px gray track with muted fill only  
- Rainbow multi-color funnel with no labels  
- Giant 3D funnel illustrations  

### Prefer (2024–26 ops — **already in premium.css**)

| Pattern | Class | When |
|---------|-------|------|
| **Stack bars** (step + track + count + share%) | `.ck-fn*` | Conversion stages with counts |
| **Stage rail** horizontal | `.ck-rail` / `.ck-rail-stage` | CRM pipeline / enrollment stages; clickable |
| **Conversion strip** | `.ck-cstrip` | Share-of-whole comparison |
| **Progress indicator** (Carbon) | step list, not bar | Linear multi-step **task** (form wizard) |
| **Kanban columns** | sunken columns (Atlassian sunken) | Heavy CRM board (later) |

**Visual rules for any funnel:**

```text
Track height:     8–12px (not 4px) · sunken well · inset shadow
Fill:             brand gradient or brand solid — never gray-on-gray only
Current stage:    .is-emphasize (brand-muted row + solid step chip)
Muted stages:     opacity ~0.4 for future/empty
Always show:      absolute count + optional % share
Footer CTA:       .ck-fn-footer when one action dominates
```

**Ranked default:** stack (`.ck-fn`) for dashboards → rail for CRM detail → strip for share mix → thin FunnelBar only as sparkline accessory.

---

## Trade-off matrix (adoption options)

| Option | Modern feel | Ops density | Impl cost | Maint risk | Stack fit | Rank |
|--------|-------------|-------------|-----------|------------|-----------|------|
| **A. CSS/token promotion on existing composites** (this report) | High | High | Low | Low | Perfect | **1** |
| B. Port Geist / Radix Themes wholesale | High | Medium | Very high | High | Conflicts Astryx | Reject |
| C. shadcn dashboard blocks | High trendy | Medium | High | High | Second system forbidden | Reject |
| D. Consumer Linear-marketing sparsity | “Pretty” | Low | Medium | Medium | Wrong product | Reject |
| E. Carbon-hard dense (4px radius, cool gray) | Consistent old-enterprise | Highest | High reverse | Brand regress | Fights soft-ops | Reject |

---

## Architectural fit (CMC EDU)

| Constraint | Fit of Option A |
|------------|-----------------|
| Astryx + `@cmc/ui` only | Classes sit in `premium.css` / `tokens.css`; StatusBadge can wrap soft CSS instead of filled Badge |
| Soft-ops already shipped (12/16/20, warm canvas, status soft tokens) | Incremental; no redesign |
| TL12 page templates | ListPage gains table shell; FormPage already sticky actions; DashboardPage slots match recipe |
| Solo + AI codegen | Closed class list + tokens = enforceable; avoid inventing px |
| Vietnamese labels | Nav width + badge min-width; don’t icon-only |

**Adoption risk:** Low–medium. StatusBadge change is **visible everywhere** (tables/detail) — soft chips are intentional; screenshot regress ok if TL12 semantics hold. Table toolbar needs careful FilterBar cohesion (warm `--cmc-surface-2`).

---

## Concrete token checklist (promote / keep)

```css
/* KEEP */
--cmc-brand, --cmc-brand-muted, --cmc-brand-ink
--cmc-canvas, --cmc-surface-raised, --cmc-surface-sunken, --cmc-surface-2
--cmc-*-soft / --cmc-*-ink status pairs
--cmc-radius-control|md|lg|pill
--cmc-shadow-xs|sm|md|lg
--cmc-blur-nav, --cmc-focus-ring, --cmc-focus-halo

/* ADD if missing */
--cmc-nav-width: 232px;
--cmc-topbar-height: 52px;
--cmc-row-height: 44px;
--cmc-row-height-dense: 36px;
--cmc-control-height: 36px;
--cmc-space-150: 12px;   /* between 8 and 16 — Atlassian space.150 */
--cmc-space-250: 20px;
--cmc-z-sticky: 10;
--cmc-z-overlay: 40;
--cmc-z-toast: 60;
```

### Class inventory to standardize

| Domain | Classes |
|--------|---------|
| Dashboard | `.tpl-dash-*`, `.ck-mc`, `.ck-im`, `.ck-focus-strip` |
| Inbox | `.ck-inbox-*`, `.ck-row`, `.ck-dot` |
| Pipeline | `.ck-fn*`, `.ck-rail*`, `.ck-cstrip*` |
| Forms | `.tpl-form-body`, `.tpl-actions`, `.fp-action`, `.ck-field-group*` |
| Table | `.ck-table-shell`, `.ck-table-toolbar`, `.ck-table-bulk`, `.ck-table` |
| Feedback | `.ck-toast*`, `.ck-callout*`, `.ck-empty*`, `.ck-skel-row` |
| Status | `.ck-badge*` |
| Shell | `.sh-*` density tokens |

---

## Ranked implementation order (visual sprint)

1. **StatusBadge → soft pastels** (`.ck-badge` + tokens) — biggest anti-dated win  
2. **DataTable shell + toolbar + selection bulk + density**  
3. **Empty/skeleton/callout** inside Panel/ListPage  
4. **Dashboard composite audit** — force pipeline/rail not thin gray; max 4 metrics  
5. **Form field-groups** + glass sticky actions optional  
6. **Nav density tokens** + PageHeader `top` offset vs shell  

---

## Sources & credibility notes

| Source | Weight |
|--------|--------|
| Polaris Layout/Color/Patterns | High — live Shopify admin language |
| Atlassian Elevation/Spacing/Color/Lozenge | High — enterprise multi-product |
| Carbon empty/forms/notifications/loading/table | High — explicit pattern specs |
| Geist materials/colors | Medium-high — modern tool aesthetic; don’t copy cool neutrals onto warm CMC |
| Radix Badge/Callout | Medium-high — primitive defaults match soft-ops |
| Linear / Stripe / Attio / HubSpot | Medium — product observation; limited public pixel DS |
| CMC TL12 + premium.css + prior lab reports | Highest for **fit** |

Conflicting advice resolved: Polaris “software not website” + Carbon density **win** over consumer Linear marketing spacing; Radix soft badges **win** over Astryx filled semantics for tables; Atlassian elevation roles **win** over “shadow every card.”

---

## Limitations

- Did not instrument live Stripe/Linear/Attio pixels (no authenticated capture); patterns from public DS + product observation.  
- HubSpot Canvas design-system URL 404; HubSpot treated as secondary product observation.  
- No a11y contrast lab on new soft badge pairs beyond existing token intent — verify AA on `--cmc-warning-ink` on `--cmc-warning-soft`.  
- Kanban pipeline alternative sketched only; not in CMC scope yet.  
- Motion/skeleton animation not performance-tested on low-end tablets (GV classroom).  

---

## Unresolved questions

1. StatusBadge: soft-only everywhere, or keep solid for detail-header “hero” status?  
2. Table density: default comfortable (44) or compact (36) for ERP list pages?  
3. FilterBar: merge into `.ck-table-toolbar` vs stay sibling above shell?  
4. Funnel: deprecate thin `FunnelBar` prop API or keep as sparkline-only?  

---

## Recommendation (one line)

**Ship Option A:** soft status chips + table shell/toolbar/bulk + panel empty/skeleton/callout + existing dashboard/pipeline composites — all on `--cmc-*` / `.ck-*`; reject second design systems and consumer sparsity.

**Report path:** `/home/manhquy/Downloads/cmc_edu/plans/260802-design-lab-visual-system/reports/research-modern-admin-ui-patterns-2026.md`
