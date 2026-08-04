# Unified Component Structure System — CMC EDU Admin

**Date:** 2026-08-03  
**Status:** DONE — implementer contract (not a code drop)  
**Product:** education ERP soft-ops admin  
**Stack lock:** Astryx + `@cmc/ui` CSS tokens · **no** shadcn/Tailwind second stack  
**Brand lock:** `#0071E3` · Inter · canvas `#f5f3ee` · radius **12 / 16 / 20**

**Authority (read order):**
1. This report — structural sync contract  
2. `packages/ui/src/tokens.css` + `premium.css` + `astryx-theme-cmc.css`  
3. `design-system/cmc-edu/MASTER.md` + `PAGE-FRAMES.md`  
4. Xia compare: `xia-compare-shopify-github-cal-airbnb.md` (adapt only)  
5. Local extracts: `/home/manhquy/Downloads/design/*` (pattern cues, not look transplant)

---

## Executive summary

CMC already has the **right genre** (warm soft-ops, one blue, nested radius, page archetypes). What still breaks “one system” is **structural drift**: each composite invents its own head/body/foot padding, type px, and row heights (see token-rhythm research: 12.5 / 13 / 13.5 orphans; panel head ≠ set head ≠ page-header).

**Ranked fix:** freeze a **shared raised-surface anatomy + 5 type roles + 3 density tiers + 8 structural CSS vars**, then rewire existing `.ck-*` / `.tpl-*` / `.sh-*` to those vars. Do **not** invent a new component library or second CSS stack.

**Pattern sources (adapt):**
| Source | Steal | Skip |
|--------|-------|------|
| Shopify Polaris (local) | resource list density, label-above, quiet rest elevation, page+card chrome | green dual-accent, dark sidebar, 4px radius |
| GitHub Primer (local) | dense meta, status≠color-alone, table density | 3px radius, coral tab, cool canvas |
| Cal.com (local) | short critical path, pill choice, Inter roles | orange CTA, 16px body default |
| Airbnb (local) | money weight 600 only | photo cards, sparse gaps, dual brand |
| Carbon / Ant (agent DS research) | data-table / filter / empty grammar | visual chrome |

---

## 1. Shared anatomy — ALL raised surfaces

Every raised white surface is the **same family**, regardless of product name (Panel, SettingsSection, MetricCard shell, table shell, EntityHeader, Callout soft, PageHeader soft-card, FocusCard).

### Slot model (mandatory)

```text
┌─ raised shell ─────────────────────────────────────┐
│  HEADER  (optional)  title · meta · actions        │  ← hairline bottom
├────────────────────────────────────────────────────┤
│  BODY    (required)  content / rows / fields       │  ← flex 1, min-width 0
├────────────────────────────────────────────────────┤
│  FOOTER  (optional)  secondary text · CTA · pager  │  ← hairline top
└────────────────────────────────────────────────────┘
```

| Slot | Purpose | Allowed content | Forbidden |
|------|---------|-----------------|-----------|
| **header** | identity + one secondary action | title (role `title`), optional icon monochrome, optional action link/badge | primary brand fill CTA (that belongs page-level or footer); multi-line essays |
| **body** | primary content | rows, fields, children, empty state | second competing card chrome nested with own shadow |
| **footer** | commit / nav / summary | text + 1 CTA link or button group; pagination | third shadow elevation; full form fields |

### Shell contract (CSS intent)

```css
/* conceptual — implement via vars in §6 */
.ck-raised {
  background: var(--cmc-surface-raised);
  border: 1px solid var(--cmc-border-subtle);
  border-radius: var(--cmc-radius-card); /* 16 */
  box-shadow: var(--cmc-elev-raised);   /* role → shadow-sm or none */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ck-raised-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--cmc-gap-cluster);
  min-height: var(--cmc-head-h);
  padding: var(--cmc-head-py) var(--cmc-pad-card-x);
  border-bottom: 1px solid var(--cmc-border-subtle);
}
.ck-raised-body {
  flex: 1; min-width: 0; min-height: 0;
  /* padding: either 0 (row lists) or pad-card for free content */
}
.ck-raised-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--cmc-space-3);
  min-height: var(--cmc-foot-h);
  padding: var(--cmc-foot-py) var(--cmc-pad-card-x);
  border-top: 1px solid var(--cmc-border-subtle);
}
```

### Elevation roles (which shell gets which shadow)

| Role token | Shadow | Use | Examples today |
|------------|--------|-----|----------------|
| `flat` | none + hairline | table shell, filter bar, list chrome | `.ck-table-shell` (prefer quiet) |
| `sticky` | `--cmc-shadow-xs` | sticky page chrome | `.ck-page-header` |
| `raised` | `--cmc-shadow-sm` | rest cards | Panel, MetricCard, Settings, EntityHeader |
| `float` | `--cmc-shadow-md` | hover lift / popover-like | MetricCard:hover, FocusCard:hover |
| `modal` | `--cmc-shadow-lg` | toast, dialog | Toast, ConfirmDialog |

**Rule:** rows (`.ck-row`, table `tr`) **never** cast shadow — sunken hover only.

### Map existing composites → slots

| Component | header | body | footer |
|-----------|--------|------|--------|
| `Panel` | `.ck-pnl-head` | children | — (add only if CTA strip needed) |
| `SettingsSection` | `.ck-set-head` | `.ck-set-body` rows | — |
| `FunnelBar` | summary | rows/rail | `.ck-fn-footer` |
| `DataTable` + shell | thead | tbody | `ListPagination` as foot |
| `FormPage` | PageHeader | fields | `.tpl-actions` sticky |
| `EntityHeader` | self = identity header | — (page body below) | — |
| `MetricCard` / `InsightMetric` | label row | metric value | context/cta line |
| `SessionCard` | time+status | title+lines | CTA |
| `Callout` | — | icon+copy | optional action |
| `Toast` | — | title+desc | dismiss control |

**Implementer action:** when adding a new raised composite, **compose these slots** (class or structure), do not invent a fourth padding recipe.

---

## 2. Shared type roles

Freeze **five roles**. No half-pixels (12.5, 13.5) in new code. Map orphans → nearest role.

| Role | Token | Size | Weight | Color | Tracking / extras | Use |
|------|-------|------|--------|-------|-------------------|-----|
| **label** | `--cmc-fs-label` | 11px | 600 | `--cmc-text-muted` | `0.06em` + uppercase | section labels, metric labels, column headers |
| **title** | `--cmc-fs-title` | 16px | 600 | `--cmc-text` | `-0.01em` | panel title, card title, row primary name |
| **meta** | `--cmc-fs-meta` | 12px | 400–500 | `--cmc-text-muted` | tabular-nums when numeric | secondary lines, timestamps, ids, filter hints |
| **metric** | `--cmc-fs-metric` | 32px | 600 | `--cmc-text` **only** | `-0.03em` + tabular-nums | KPI numerals — never status-tinted |
| **cta** | body-ish | 13–14px | 600 | brand fill **or** brand text | pill shell for topbar CTA | primary actions, footer links, `.sh-cta` |

### Supporting scale (already tokens — keep)

| Token | Size | Role |
|-------|------|------|
| `--cmc-fs-body` | 14px | default reading / form labels body |
| `--cmc-font-size-data` | 13px | table cells, dense ops data |
| `--cmc-fs-h3` | 18px | rare section break inside long forms |
| `--cmc-fs-page` | 24px | dashboard page title only (not every panel) |
| `--cmc-font-size-column` | 11px | table thead (= label role) |

### Hierarchy rules

1. **One primary title per raised surface** (header slot).  
2. **Metric never recolored** by success/warn — use attention dot or delta chip (`meta` size).  
3. **Money** = `metric` or data size + weight 600 + tabular-nums (Airbnb-thin port).  
4. **CTA text** is either white-on-brand (filled) or brand-ink (text/link) — never orange/green as interactive.  
5. Kill new `12.5px` / `13.5px` / `11.5px` — pick `meta` (12) or `data` (13) or `label` (11).

### Type role → component mapping

| Component text | Role |
|----------------|------|
| `.ck-mc-label`, `.ck-inbox-section-label`, thead | **label** |
| `.ck-pnl-title`, `.ck-row-title`, `.ck-sc-title`, `.ck-set-title` | **title** (set-title may use 15→16 token) |
| `.ck-row-meta`, `.ck-eh-meta`, `.ck-meta-row`, funnel share | **meta** |
| `.ck-mc-value`, `.ck-im` value, funnel total | **metric** |
| `.sh-cta`, `.ck-fn-footer-cta`, form primary | **cta** |

---

## 3. Shared density tiers

Three named tiers for **content density**. Touch is a **target override**, not a fourth layout language.

| Tier | Token / class | Row py | Control h | Card pad | Page gap | When |
|------|---------------|--------|-----------|----------|----------|------|
| **compact** | `density="compact"` / `.is-compact` / `ListPage density="ops"` | 8px | 32px | 16×14 | 16 | tables, week schedule, finance lists, queues |
| **default** | (omit) | 12px | 36px | 24×20 | 24 | most detail, panels, month cards, forms happy path |
| **comfortable** | `density="comfortable"` / dashboard | 14–16px | 40px | 24 | 24 | cockpit, empty panels, onboarding blocks |

| Override | Rule |
|----------|------|
| **touch** | any interactive hit target ≥ **44×44** on `max-width: 768px` and attendance grids always | does not change type roles |

### Density behavior contract

| Surface | compact | default | comfortable |
|---------|---------|---------|-------------|
| `ListPage` | `ops` → `.tpl-wrap--ops` | normal pad | n/a (use default) |
| `DataTable` | Astryx `density="compact"` | default | avoid |
| `SessionCard` | 1 foot line + fixed min-h | 2 secondary lines | n/a |
| `TaskRow` / `.ck-row` | py 8–10 | py 12 | py 14 |
| `FilterBar` | single-row wrap tight | default | n/a |
| Dashboard metrics | — | default card pad | slightly airier grid gap OK, **not** 48–64 Airbnb |

**Rule:** density changes **padding + secondary line count**, not brand, radius ladder, or type *roles* (size may step one notch: title 16→14 on compact only if needed).

---

## 4. Rules — min-height, line-clamp, ellipsis

### Min-height

| Element | Min-height | Why |
|---------|------------|-----|
| Desktop control (input/button) | `--cmc-control-h` **36px** default | align filter + form + topbar secondary |
| Compact control | `--cmc-control-h-compact` **32px** | dense toolbars |
| Topbar CTA `.sh-cta` | **34px** (keep) or map to control-h | already shipped |
| Touch / mobile interactive | **44px** | TL12 + Shopify/Airbnb touch |
| Raised header slot | `--cmc-head-h` **44px** | sync Panel / Set / PageHeader optical band |
| Raised footer slot | `--cmc-foot-h` **48px** | pagination + form sticky actions |
| List / task row | `--cmc-row-h` **48px** default / **40px** compact | equal rows in queues |
| Chip / status badge | `--cmc-chip-h` **22px** default / **18px** compact | status + shortcut badge |
| Shortcut chip | `--cmc-chip-h-lg` **34px** | dashboard shortcuts |
| Metric / insight card | min-height **128px** (existing InsightMetric) | prevent KPI collapse |
| SessionCard | computed `--ck-sc-min-h` (keep fixed geometry) | equal tiles in week/month |
| Toast dismiss | 28×28 min; prefer 32 on touch | a11y |

**Rule:** fixed-height **grids** (session tiles, metric strips) use min-height; free-flow forms use min-height only on controls, not whole page.

### Ellipsis (single line)

Use when text is **secondary identity in a fixed-width slot** and full string is available via `title` / tooltip:

| Field class | Ellipsis? | Full string where |
|-------------|-----------|-------------------|
| P0 title (class code, entity name) | yes if overflow | `title` attr always |
| P0 time short | yes if overflow | prefer shorten format first |
| P1 subtitle / program | yes | title or detail tooltip |
| P2 meta room·teacher | yes | tooltip |
| Table primary column | yes | title attr or detail page |
| Metric value | **no wrap, no ellipsis** if possible — shorten format (1.2k) | — |
| Status chip label | yes, chip max-width ~40–50% | full in `title` |
| CTA label | prefer short verb; ellipsis last resort | — |
| Column header | ellipsis rare; wrap avoid | — |

**CSS pattern (shared utility):**

```css
.ck-truncate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Any flex child that truncates **must** have `min-width: 0` (already SessionCard / funnel label lesson).

### Line-clamp (multi-line)

| Use | Clamp | When |
|-----|-------|------|
| Description / callout body | 2–3 | cards with fixed height |
| Empty state description | none (or 4) | free layout |
| Entity subtitle | 1–2 | EntityHeader |
| Table cell notes | 1 (prefer ellipsis) | density |
| Dashboard greeting | 1 | top |

```css
.ck-clamp-2 {
  min-width: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
```

### Progressive disclosure (field hierarchy — generalize SessionCard)

| Priority | Show | Hide → |
|----------|------|--------|
| **P0** | always visible (title, status, primary time, CTA if actionable) | never |
| **P1** | default density own line; compact → single foot | tooltip |
| **P2** | default own line; compact demote | tooltip |
| **P3** | never body text | `title` / `detail` tooltip only |

**Anti-patterns:** multi-line wrap that breaks equal card height; UUID as primary; dumping full ISO ranges into compact cells.

---

## 5. Component family map

Five families. New UI must declare family membership before new CSS.

```text
chrome ── shell frame (nav, topbar, page wrap)
control ── interactive atoms (input, button, select, chip toggle)
raised ── white cards on warm canvas (panel, table shell, metrics)
float ── temporary elevated (toast, dialog, popover, bulk bar)
feedback ── status, empty, callout, progress, skeleton
```

### chrome

| Piece | Path / class | Notes |
|-------|--------------|-------|
| `AppFrame` | `.sh-root` `.sh-main` `.sh-content` | 100vh flex shell |
| `SideNav` | `.sh-sb` `.sh-item` | light warm; depth ≤2 |
| Topbar | `.sh-top` 60px blur | 1 primary CTA |
| Page wrap | `.tpl-wrap` / `--ops` | canvas + section gap |
| Page frames | `DashboardPage` `ListPage` `DetailPage` `FormPage` | **only** full-page archetypes |
| `PageHeader` | `.ck-page-header` sticky xs | title · subtitle · actions |

### control

| Piece | Implementation | Radius |
|-------|----------------|--------|
| Button / TextInput / Selector | Astryx + soft theme bridge | `--cmc-radius-control` 12 |
| `.sh-cta` / secondary / ghost | premium.css | pill for primary shell CTA only |
| `FilterBar` | `.ck-filter-bar` surface-2 | card radius shell, control radius fields |
| `ShortcutChip` | `.tpl-dash-chip` | control/pill family |
| `CmcTabs` | Astryx tabs + brand indicator | no coral |
| Choice pills (future CSS) | brand-muted selected | pill; not form control radius |
| Auth inputs | `auth-inputs` | same soft sunken |

### raised

| Piece | Elevation | Anatomy |
|-------|-----------|---------|
| `Panel` | raised | head + body |
| `SettingsSection` | raised | head + body rows |
| `MetricCard` / `InsightMetric` / `StatCard` | raised→float hover | label + metric + meta/cta |
| `FocusCard` | raised→float | accent edge + body |
| `EntityHeader` | raised | identity header |
| `SessionCard` | raised (local radius 12–14 OK) | fixed slots |
| `DataTable` shell | **flat** preferred | thead + body + page foot |
| `SectionBlock` / `KeyValueList` | flat or raised | body only |
| `MasterDetail` | raised panes | head optional |

### float

| Piece | Elevation | Notes |
|-------|-----------|-------|
| `Toast` | modal lg | left status stripe |
| `ConfirmDialog` / Astryx Dialog | modal | dialog radius 20 |
| `BulkActionBar` | float md | selection commit strip |
| Popover / menu (if added) | float md | Astryx first; no second stack |
| Sticky form actions | sticky + surface | `.tpl-actions` |

### feedback

| Piece | Rule |
|-------|------|
| `StatusBadge` + `.ck-badge-soft-*` | color **+** text (+ icon for danger/success) |
| `EmptyState` | title + description + action when next step exists |
| `Callout` | softer than Banner; tone soft pairs |
| `ProgressSteps` | brand current; success done |
| `ResultPanel` | post-automation |
| Skeleton | Astryx Skeleton; match target min-heights |
| Attention dot | 6–7px; never recolor metric |

### Family decision tree

```text
Is it app frame / nav / page archetype? → chrome
Is it a temporary overlay or sticky commit strip? → float
Is it status / empty / progress / toast copy? → feedback
Is it an interactive atom (type/click/select)? → control
Else white block on canvas → raised
```

---

## 6. Top 8 structural CSS variables (add for sync)

Add to `packages/ui/src/tokens.css` (single source). Wire `premium.css` gradually — **no new hex, no second stack**.

| # | Variable | Proposed value | Replaces / syncs |
|---|----------|----------------|------------------|
| 1 | `--cmc-row-h` | `48px` | TaskRow, table row optical, settings row |
| 2 | `--cmc-row-h-compact` | `40px` | ops lists, compact TaskRow / table |
| 3 | `--cmc-chip-h` | `22px` | status badges, row tags, funnel pills |
| 4 | `--cmc-control-h` | `36px` | inputs, filter controls, secondary buttons |
| 5 | `--cmc-head-h` | `44px` | Panel / Settings / PageHeader head band |
| 6 | `--cmc-foot-h` | `48px` | pagination, form sticky, funnel footer |
| 7 | `--cmc-elev-raised` | `var(--cmc-shadow-sm)` | single switch for all rest cards (table may use `none`) |
| 8 | `--cmc-keyline-x` | `var(--cmc-pad-card-x)` **20px** | alias — force one horizontal inset for head/body/foot/rows |

### Optional companions (if implementing density in one pass)

```css
--cmc-control-h-compact: 32px;
--cmc-chip-h-compact: 18px;
--cmc-chip-h-lg: 34px;      /* shortcut chips / topbar CTA height cousin */
--cmc-head-py: 12px;
--cmc-foot-py: 12px;
--cmc-row-py: 12px;
--cmc-row-py-compact: 8px;
--cmc-elev-flat: none;
--cmc-elev-sticky: var(--cmc-shadow-xs);
--cmc-elev-float: var(--cmc-shadow-md);
--cmc-elev-modal: var(--cmc-shadow-lg);
```

### Snippet to paste (implementers)

```css
/* tokens.css — structural sync (2026-08-03) */
--cmc-row-h: 48px;
--cmc-row-h-compact: 40px;
--cmc-chip-h: 22px;
--cmc-control-h: 36px;
--cmc-head-h: 44px;
--cmc-foot-h: 48px;
--cmc-elev-raised: var(--cmc-shadow-sm);
--cmc-keyline-x: var(--cmc-pad-card-x);
```

### Adoption order (YAGNI)

1. Declare 8 vars.  
2. Point `.ck-pnl-head`, `.ck-set-head`, `.ck-page-header` → `--cmc-head-h` + `--cmc-keyline-x`.  
3. Point `.ck-row`, table td, `.ck-set-row` → `--cmc-row-h` / compact.  
4. Point badges / tags → `--cmc-chip-h`.  
5. Point FilterBar controls + inputs theme → `--cmc-control-h`.  
6. Point pagination / `.tpl-actions` / `.ck-fn-footer` → `--cmc-foot-h`.  
7. Replace literal `box-shadow: var(--cmc-shadow-sm)` on cards with `--cmc-elev-raised`.  
8. **Do not** mass-rename classnames in the same PR.

---

## 7. What NOT to invent

| Do not invent | Why | Do instead |
|---------------|-----|------------|
| **Second CSS stack** (shadcn, Tailwind DS, Primer React, Polaris package) | Hard lock; dual languages | Astryx + `@cmc/ui` only |
| **New page archetype** beyond 4 | PAGE-FRAMES contract | Dashboard / List / Detail / Form |
| **New radius ladder** (3/4/8 sharp) | Soft-ops identity | 12 / 16 / 20 nested |
| **Second interactive hue** (green CTA, orange CTA, coral tab) | Brand lock | One blue; status separate |
| **Dark sidebar** | Warm light-only product | Light `SideNav` |
| **Consumer sparsity** (48–64 section gaps, 16 body everywhere) | Kills ops density | gap-section 24; body 14 / data 13 |
| **Per-feature raised chrome** (new card CSS each page) | Drift | Shared anatomy + family map |
| **Rainbow metrics** | Semantic noise | Near-black metric + delta chip |
| **Color-alone status** | a11y / Primer rule | soft badge + text (+ icon) |
| **Half-pixel type scale** | Accidental hierarchy | 5 roles only |
| **Shadow on rows** | Visual noise | sunken hover |
| **Pill 32px as default control radius** | Breaks nested harmony | pill = chips/CTA shell; inputs 12 |
| **Display 40 marketing titles** in admin | Wrong genre | page 24 max; panel 16 |
| **Fork Astryx Button/Input** | Dual control language | theme bridge + composites props-only |
| **Photo-first listing cards** | No product surface | text-led cards |
| **Decorative gradients on primary buttons** | Restraint lock | flat brand fill (funnel bar fills are data viz, not CTA) |
| **New elevation names per component** | Token sprawl | flat / sticky / raised / float / modal |
| **Plan IDs in classnames** | Stable artifacts rule | semantic names only |

---

## Trade-off matrix (structure approaches)

| Option | Sync quality | Effort | Risk | Rank |
|--------|--------------|--------|------|------|
| **A. Shared anatomy + 8 vars + family map (this report)** | High | S–M | Low | **1 — do** |
| B. Rewrite all composites to one `RaisedSurface` React primitive now | High | L | Med (blast radius) | 2 later if A sticks |
| C. Adopt Carbon/Ant as dependency | High patterns | XL | High brand/stack break | Reject |
| D. Per-page CSS continue | Low | S short-term | High drift | Reject |
| E. Xia full visual transplant | Low fit | M | High lock break | Reject |

**Architectural fit:** maps onto existing `.ck-*` / `.sh-*` / `.tpl-*` without new framework. Solo+AI maintainable (KISS). SessionCard already proves fixed-slot density — generalize that discipline.

**Adoption risk:** Low. Tokens additive. No upstream package. Breaking only if someone hardcodes opposing heights in apps — fix at composite layer.

---

## Implementer checklist (actionable)

- [ ] Add 8 structural vars to `tokens.css`  
- [ ] Document family membership in `MASTER.md` (link this report)  
- [ ] Align Panel / Settings / PageHeader head to `--cmc-head-h` + keyline  
- [ ] Align rows + table cells to `--cmc-row-h*`  
- [ ] Align badges to `--cmc-chip-h`  
- [ ] Align controls to `--cmc-control-h`  
- [ ] Align footers / pagination / sticky actions to `--cmc-foot-h`  
- [ ] Replace rest-card shadows with `--cmc-elev-raised`  
- [ ] Add `.ck-truncate` / `.ck-clamp-2` utilities once  
- [ ] New composites: declare family + slots before CSS  
- [ ] Density prop only: `compact | default | comfortable` (+ ops alias for ListPage)  
- [ ] Design Lab: one matrix page showing three densities × five type roles × raised slots  

**Out of scope here:** implementing FilterBar date types, attendance grid extract, ChoicePills composite (see xia-compare gap list).

---

## Sources & credibility

| Source | Credibility | Use |
|--------|-------------|-----|
| `packages/ui` tokens + premium + components | **Primary** as-built | anatomy reality |
| `design-system/cmc-edu/MASTER.md`, `PAGE-FRAMES.md` | Product DS authority | families, density intent |
| Local DESIGN.md Shopify/GitHub/Cal/Airbnb | Medium pattern extracts | adapt density/status/forms |
| Prior reports: xia-compare, token-rhythm, calendar-field-hierarchy, agent-readable-ds | Internal research | ranked ports + gaps |
| Carbon / Ant / Atlassian (via agent-readable report) | High for ERP patterns | grammar only |

---

## Limitations

1. No live Polaris/Primer DOM audit — static extracts + repo CSS.  
2. Did not measure every admin page for height drift (sample: premium composites + frames).  
3. Astryx internal StyleX control heights may need theme bridge verification when wiring `--cmc-control-h`.  
4. LMS parent mobile frames out of primary admin scope.  
5. Quantitative contrast of soft badges on `#f5f3ee` not re-run.

---

## Unresolved questions

1. Should `ListPage density="ops"` rename to `"compact"` for vocabulary sync, or keep `ops` as alias forever?  
2. Table shell: force `elev-flat` for all lists, or keep whisper `sm` for soft-ops brand? (Recommend **flat** for pure tables, **raised** for dashboard panels.)  
3. EntityHeader title at 20px — promote to token `--cmc-fs-entity` or clamp to `page`/`h3`? (Recommend map to **18 h3** or keep 20 as one-off entity role only.)

---

## Status

```text
Status: DONE
Summary: Unified structure contract — shared raised anatomy (head/body/foot), 5 type roles, 3 density tiers, ellipsis/min-height rules, 5 component families, 8 CSS vars, explicit non-invention list. Ready for token + premium rewiring.
Concerns/Blockers: none for research; implementers choose table elev-flat vs raised (Q2).
```
