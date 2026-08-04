# Research: Composite-screen cohesion (MetricCard · Panel · TaskRow · PageHeader · forms · DataTable)

**Date:** 2026-08-02  
**Stack:** React, `--cmc-*` tokens, `.ck-*` composites, Astryx Button/TextInput/Banner/Table  
**Scope:** rules when **one screen** composes raised cards + rows + header + filters + table + forms  
**Non-goals:** new color system, dark mode, new component library, full page redesigns

---

## Executive summary

Cohesion on dense ERP screens is not “make everything soft.” It is **one surface grammar**: nested radius (outer ≥ inner), one hairline, one hover language, elevation only for raised/floating roles, empty states that match the parent container, table-in-card flush (no double chrome), filter bars as **slot chrome** not a third card style, sticky headers that **stack** with shell chrome instead of fighting it.

CMC already encodes most of this in `tokens.css` + `premium.css` + `astryx-theme-cmc.css` (control 12 ≤ card 16 ≤ page 20; warm hairlines; sunken hover on rows; soft fields). Gaps that still break cohesion in practice: **FilterBar** cool gray slab, **ListPage** table not always card-wrapped, **sticky PageHeader** `top: 0` vs shell topbar, Design Lab demos with **stale radius numbers**, and ad-hoc page CSS that reintroduces cool borders / 4px radius.

**Ranked recommendation:** codify **12 rules** below as the Design Lab “proof contract”; fix FilterBar + table-in-panel + sticky offset next; do **not** invent a second card language for tables.

---

## Methodology

| Source | Credibility | Use |
|--------|-------------|-----|
| CMC `tokens.css`, `premium.css`, `astryx-theme-cmc.css`, composites | Primary (as-built) | Baseline rules already shipping |
| Prior plan notes `component-cohesion-soft-inputs.md` | Internal audit | Nested harmony already decided |
| Carbon 2x Grid (IBM) | High — production DS | Mini-unit rhythm, key lines, hybrid table sizing |
| Atlassian Design Grid | High — production DS | Containers on grid; nest with space tokens; overlays off-grid |
| Polaris / Linear / Stripe Dashboard (practice, not re-fetched) | High industry pattern | Nested radius, hairline cards, restrained hover, flush tables |
| Web fetches: Carbon overview, Atlassian Grid | 2 of max 3 | Confirmed grid/nest principles; nested-radius is industry consensus |

---

## Trade-off matrix (composition strategies)

| Strategy | Visual cohesion | Ops density | Impl cost | Maint risk | Fit CMC soft-ops |
|----------|-----------------|-------------|-----------|------------|------------------|
| **A. One raised family** (header/metrics/panels/table shell share md+hairline+sm) | High | High | Low | Low | **Best** — already half-done |
| B. Flat table on canvas, cards only for metrics | Medium | Highest | Low | Medium | OK list pages; splits dashboard look |
| C. Every block is a heavy shadow card | Low (muddy) | Low | Low | High | **Reject** — consumer landing |
| D. Nested “card in card” with full padding + own radius | Low (onion) | Medium | Medium | High | **Reject** unless intentional inset |
| E. Full-bleed sticky slab header + rounded body | Low (two eras) | High | Low | Medium | Was pre-soft; fixed for PageHeader |

**Ranked choice:** **A** for dashboards + list ops; **B** only if table is the sole content and density is extreme (still use one hairline top on filter, not cool gray).

---

## 12 concrete CSS / component rules

Map each rule to CMC tokens/classes. Implement as conventions; only add CSS when a composite lacks a class.

### R1 — Nested radius: outer ≥ inner (strict ladder)

```text
control / chip / field   →  --cmc-radius-control  (12)
card / panel / header    →  --cmc-radius-md       (16)
page / dialog / toast    →  --cmc-radius-lg       (20) or md+shadow-md
pill CTA / badge only    →  --cmc-radius-pill
table cells / row dividers → 0 (density; no fake round cells)
```

**Nested math (classic):** if parent pad = P and parent radius = R, child max radius ≈ R − P when child touches the edge; for CMC, **children never re-radius when flush** — parent clips (`overflow: hidden` on `.ck-pnl`).

**Do:** inputs 12 inside Panel 16.  
**Don’t:** 16px field inside 12px wrapper; don’t put 20px chips on 16px cards for “extra soft.”

### R2 — One hairline family

| Role | Token | Use |
|------|-------|-----|
| Rest card edge | `--cmc-border-subtle` | MetricCard, Panel, PageHeader, table shell |
| Emphasized control edge | `--cmc-border` | Field rest, secondary CTA border |
| Dividers | `--cmc-border-subtle` | `.ck-row + .ck-row`, panel head, inbox sections |
| Never | cool `#d4d4d4` / raw gray | Astryx default — already overridden |

**Rule:** same screen = same hairline hue. Mixing cool filter bar + warm cards = “two products.”

### R3 — Elevation roles (not decoration)

| Elevation | When |
|-----------|------|
| none + hairline optional | canvas, filter slot *inside* card, table body |
| `shadow-sm` + hairline | raised at rest: `.ck-mc`, `.ck-pnl`, `.ck-page-header`, form action bar |
| `shadow-md` | hover lift MetricCard; toast |
| `shadow-lg` | modal / rare float |

**Don’t** stack shadow-sm on every nested child. One raised shell per visual block.

### R4 — Hover language = one verb per role

| Role | Hover | Class / pattern |
|------|-------|-----------------|
| Navigable row / nav item | **sunken fill** | `.ck-row:hover`, `.sh-item:hover` → `--cmc-surface-sunken` |
| Raised card link (Metric) | **shadow + border tint** | `.ck-mc:hover` → shadow-md + accent-soft border; context text → brand |
| Text action in panel head | **underline brand** | `.ck-pnl-action:hover` |
| Control field | soft border lift, **no 2px inset ring** | astryx-theme soft field |
| Primary CTA | brand darken | `.sh-cta` / Button primary |

**Anti-mix:** row that both sunken-fills *and* drops shadow; Metric that only changes cursor with no visual.

### R5 — Surface stack (canvas → raised → sunken)

```text
--cmc-canvas          page background (.tpl-wrap)
--cmc-surface-raised  cards, header, white panels
--cmc-surface-sunken  field fill, row hover, funnel track
```

Forms: **sunken fields on raised card** (or on canvas with one raised form shell).  
Never white field on white card with only cool border (hard spreadsheet).

### R6 — Table-in-card treatment

**Preferred (list ops):**

```text
.ck-pnl (or list body card)
  [optional .ck-pnl-head]
  [optional FilterBar — flush, no second border-radius]
  DataTable — full bleed width, dividers=rows
  empty → EmptyState padded inside same shell
```

CSS contract:

```css
/* table shell — one raised surface */
.ck-table-shell {
  background: var(--cmc-surface-raised);
  border: 1px solid var(--cmc-border-subtle);
  border-radius: var(--cmc-radius-md);
  box-shadow: var(--cmc-shadow-sm);
  overflow: hidden; /* clips table corners */
}
.ck-table-shell .ck-filter { /* see R8 */
  border-bottom: 1px solid var(--cmc-border-subtle);
  background: var(--cmc-surface-sunken); /* or raised — pick one, not surface-2 cool */
  border-radius: 0; /* never double-radius */
}
```

**Don’t:** DataTable with own shadow + Panel around it (double chrome).  
**Don’t:** `padding: 16` then table with rounded cells — leaves ugly corner gutters.  
**Do:** Design Lab already demos `padding: 0; overflow: hidden` on table card — promote that to shared class.

### R7 — Sticky headers that don’t fight cards

Current: `.ck-page-header { position: sticky; top: 0; z-index: 10; }` soft card.

Problems when composed:

1. Shell `.sh-top` is also chrome → sticky header can **slide under** or **double-bar** depending on scroll container (`.sh-content` vs window).
2. Rounded sticky card + gap below creates a **floating island** that collides with next card’s top radius.
3. Filter sticky *and* header sticky → z-index war.

**Rules:**

| Context | Sticky target | `top` | Style |
|---------|---------------|-------|-------|
| List/Form inside `.sh-content` | PageHeader only | `0` relative to **scrollport** (`.sh-content`) — correct if only content scrolls | soft card OK |
| Need filter sticky | Filter **inside** table shell, not second page sticky | below header height if both sticky | flat bar, hairline bottom only |
| Form actions | `.tpl-actions` bottom sticky | `bottom: 0` | raised card, already in premium |

**Don’t** sticky a full Panel that contains the table (jank + shadow tear).  
**Don’t** full-bleed white slab sticky + rounded body (two eras — already rejected for PageHeader).

**Optional polish:** sticky header loses bottom radius while stuck (`border-radius: md md 0 0`) via scroll-driven class — nice-to-have, not required.

### R8 — Filter bars = chrome slot, not third card

Today `FilterBar` uses `background: var(--cmc-surface-2)` + `border-bottom: 1px solid var(--cmc-border)` — **cohesion leak** (cool gray vs warm soft-ops).

**Rule:**

- Inside list card: sunken or raised **warm** bar, only bottom hairline subtle, **no** outer radius, **no** own shadow.
- Standalone on canvas: either sit under PageHeader with gap section (no card) **or** top of table shell.
- Controls inside: size `sm`, radius control 12, same soft field theme.

### R9 — Empty states inherit container

| Location | Treatment |
|----------|-----------|
| Inside Panel / inbox | `.ck-empty` — monochrome icon, no second card |
| Table empty | `EmptyState` **inside** table shell (not naked on canvas) |
| Page-level empty (ListPage `isEmpty`) | one EmptyState in body; still under PageHeader |
| Never | empty card with shadow-lg + illustration heavy gradient |

Status color only on badge/dot/CTA — not empty illustration wash.

### R10 — Spacing rhythm on composed screens

From Carbon key-lines + CMC tokens:

| Token | Role on composite screen |
|-------|--------------------------|
| `--cmc-gap-section` (32) | between PageHeader, metric strip, body grid |
| 16px | between panels in dashboard grid (`.tpl-dash-body` gap) |
| `--cmc-pad-card` / panel 16–22 horizontal | internal padding; **rows share 22px** with panel head |
| 0 | table edge padding when flush |

**Key line rule (Carbon):** vertical edges of Metric strip, Panel, and table shell should align. Don’t offset FilterBar padding differently from table cell padding without reason.

### R11 — Type & status: one accent, no metric recolor

Already soft-ops:

- Metric value: near-black `--cmc-text`, never status green/red on the number.
- Attention = **dot** (`.ck-attn`) or StatusBadge — small.
- One interactive blue `--cmc-brand` for links, primary, focus halo.
- Uppercase labels 11px only for metric/inbox section labels — not for every table header (table uses column 11px per token, not shouty).

### R12 — Composition recipes (allowed stacks)

**Dashboard (DashboardPage):**

```text
canvas
  title block (not always PageHeader card — tpl-dash-title OK)
  chips (pill, raised)
  metrics grid (raised cards)
  body grid: Panel/WorkInbox | StageFunnel (raised)
```

**List ops (ListPage density=ops):**

```text
canvas
  PageHeader (raised sticky)
  table shell (raised)
    FilterBar flush
    DataTable | EmptyState
```

**Form (FormPage):**

```text
canvas
  PageHeader
  raised field shell OR bare fields with soft controls
  sticky .tpl-actions (raised)
```

**Forbidden stacks:** MetricCard inside Panel with full pad + shadow; Panel inside Panel; PageHeader full-bleed slab + rounded FilterBar card; Banner + Toast same message.

---

## Anti-patterns that break ERP cohesion

| # | Anti-pattern | Why it breaks | Fix |
|---|--------------|---------------|-----|
| 1 | **Mixed radius eras** (4px inputs + 16px cards) | Toolkit frankenstein | Enforce ladder R1 |
| 2 | **Cool gray + warm paper** on one page | FilterBar / legacy `surface-2` | Warm sunken + subtle |
| 3 | **Double chrome** (card shadow + table shadow + border) | Heavy, slow | One shell R6 |
| 4 | **Hover zoo** (scale + shadow + fill + underline) | Noise | One verb R4 |
| 5 | **Status-colored metrics / rows** | Alarm fatigue | Dot/badge only R11 |
| 6 | **Sticky fight** (header + filter + shell top all sticky) | Content jump, z-war | One sticky R7 |
| 7 | **Nested card onion** | Wasted density | Flush children R1/R6 |
| 8 | **Empty state as marketing block** | Breaks ops density | `.ck-empty` R9 |
| 9 | **Ad-hoc page CSS** redefining radius/border | Drift from Design Lab | Tokens only |
| 10 | **Primary CTA proliferation** (every panel has filled blue) | No hierarchy | One primary per view; panel uses text action |
| 11 | **Table as spreadsheet island** (white full bleed, no radius, cool grid) next to soft cards | Split personality | Table shell matches cards **or** whole page goes flat ops |
| 12 | **Inconsistent horizontal padding** (header 20, row 22, filter 24, table 12) | Key lines fail | Align to 20–22 panel rhythm |

Industry alignment: Atlassian — align **containers** not every control; Carbon — hybrid fluid width / fixed height for tables; Stripe/Linear — hairline + soft shadow, dense rows, restrained accent. None mix two border temperatures.

---

## Architectural fit (CMC)

| Asset | Status vs rules |
|-------|-----------------|
| `tokens.css` radius/shadow/canvas | Matches R1–R3, R5 |
| `premium.css` .ck-mc / .ck-pnl / .ck-row / .ck-page-header | Matches R3–R4, R9–R11 |
| `astryx-theme-cmc.css` soft fields | Matches R1, R5 |
| `FilterBar` | **Fails R2, R8** — cool surface-2 |
| `DataTable` | No shell class — call sites improvise (Design Lab OK) |
| `ListPage` | Slots only — no table shell; cohesion left to pages |
| Design Lab radius demo numbers | **Stale** (shows xs=4 md=12; tokens are 12/16/20) |
| Design Lab cohesion mini-compose | Good partial proof (header+form+panel); **missing** filter+table sticky |

**Adoption risk:** Low — rules are documentation + small CSS; no new deps. Breaking risk if FilterBar background changes on pages that assumed cool gray (visual only).

**YAGNI:** Do **not** add nested-radius calculator utility. Do **not** new Table component. Add `.ck-table-shell` + fix FilterBar tokens only if implementing.

---

## Design Lab demo sections (prove cohesion)

Add / replace sections so reviewers **see** rules fail/pass side-by-side. Prefer one scroll page; TOC anchors.

### D1 — Nested radius ladder (live)

- Outer card 16 containing control 12 and pill badge.
- Bad sibling: control 4px (deliberate anti-pattern strip, labeled “DON’T”).
- Caption: `12 ≤ 16 ≤ 20`.

### D2 — Hairline temperature

- Same Panel twice: warm subtle vs cool `#d4d4d4` border.
- Label which is production token.

### D3 — Hover language matrix

- Row / Metric / Panel action / Field / CTA in one row of mini demos.
- Caption lists allowed hover verb per role (R4).

### D4 — Full list composite (priority)

```text
PageHeader sticky
+ table shell
  FilterBar (fixed warm)
  DataTable with StatusBadge
  toggle empty state
```

Proves R6–R8–R9. Include control: “double chrome” bad example collapsed.

### D5 — Dashboard composite (exists; tighten)

- Already under `#composite` — add metric strip + dual Panel + empty inbox variant.
- Assert horizontal key-lines (same left padding).

### D6 — Sticky stack stress

- Short scrollport (fixed height 320px) with sticky PageHeader + long table shell.
- Document: only header sticks; filter scrolls with table **or** filter sticks under header with correct `top`.

### D7 — Form + sticky actions

- FormPage mock: soft fields + `.tpl-actions` / `.fp-action`.
- Prove no second primary in header **and** footer.

### D8 — Anti-pattern gallery (compact)

- Grid of 4–6 labeled DON’Ts from anti-pattern table (screenshot-friendly).
- Links rule id R#.

### D9 — Token truth table

- Fix radius/spacing demo to **read computed CSS vars** (or hardcode matching tokens.css 12/16/20).
- Shadow row: rest sm on card is **allowed** (update copy that still says “shadow only hover”).

### Suggested TOC delta

```text
… existing …
cohesion          (keep matrix)
cohesion-live     D4 list composite  ← NEW primary proof
cohesion-sticky   D6                 ← NEW
anti-patterns     D8                 ← NEW
composite         (dashboard)
table             (merge into D4 or keep atom-only)
…
```

---

## Implementation priority (if executing later)

| P | Change | Rules | Effort |
|---|--------|-------|--------|
| P0 | FilterBar → warm sunken + border-subtle | R2 R8 | S |
| P0 | Fix Design Lab token demo numbers + shadow copy | truth | S |
| P1 | `.ck-table-shell` in premium.css + ListPage optional wrap | R6 | S |
| P1 | Design Lab D4 + D6 sections | proof | M |
| P2 | Sticky top offset / stuck radius polish | R7 | M |
| P2 | Align filter/table horizontal pad to 20–22 | R10 | S |
| P3 | Anti-pattern gallery D8 | education | S |

---

## Comparative notes (systems → CMC)

| System | Takeaway | CMC mapping |
|--------|----------|-------------|
| Carbon 2x | Mini-unit, key lines, hybrid data table | 4/8 spacing; align shells; table fluid width |
| Atlassian Grid | Containers on grid; nest with space tokens | `.tpl-*` grids; don’t grid-align every button |
| Polaris | Nested radius, card sections | R1 + Panel head/body |
| Linear | Dense rows, hairline, quiet hover | `.ck-row` sunken |
| Stripe Dashboard | Soft cards, flush tables, one accent | soft-ops direction already |

---

## Limitations

- Did not re-audit every admin/LMS page for FilterBar/table ad-hoc styles (sample via design system only).
- Did not measure scroll/sticky against live shell in browser this pass.
- Astryx Table internal cell radius/hover not fully styled in premium.css — may need one more soft pass if Table draws cool dividers.
- Max web depth: 2 official DS pages + internal code; nested-radius formula from common DS practice (Material/Polaris-class), not a CMC invention.

---

## Unresolved questions

1. List pages: always force `.ck-table-shell`, or only `density=ops`?
2. Filter sticky required for long tables, or header-only sticky enough for M0?
3. Dashboard title: keep plain `.tpl-dash-title` (no card) vs PageHeader card everywhere — intentional split?

---

## Recommendation (final)

1. **Treat the 12 rules as the cohesion contract** for any screen mixing MetricCard/Panel/TaskRow/PageHeader/forms/DataTable.  
2. **Ship P0 FilterBar warm + Design Lab truth** before more visual experiments.  
3. **Prove with Design Lab D4 (list composite) + D6 (sticky)** — not more isolated atom galleries.  
4. **Reject** double chrome, cool/warm mix, hover zoo, status-colored metrics.

**Primary report path:**  
`plans/260802-design-lab-visual-system/reports/research-composite-screen-cohesion.md`
