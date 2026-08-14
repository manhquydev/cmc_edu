---
name: CMC EDU — Cockpit
description: A near-white Linear + Stripe operations ledger where hairlines carry structure and one purple carries authority.
colors:
  primary: "#71639e"
  primary-dark: "#5a4f7e"
  primary-soft: "#f0edf6"
  bg: "#f7f7f8"
  surface: "#ffffff"
  sidebar: "#fafafa"
  text: "#18181b"
  text-secondary: "#71717a"
  text-tertiary: "#a1a1aa"
  border: "#e4e4e7"
  border-strong: "#d4d4d8"
  danger: "#dc2626"
  danger-soft: "#fef2f2"
  warning: "#d97706"
  warning-soft: "#fffbeb"
  success: "#16a34a"
  success-soft: "#f0fdf4"
  info: "#2563eb"
  info-soft: "#eff6ff"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tabular-nums"
rounded:
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  gutter: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "30px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "30px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "30px"
  button-ghost-hover:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "30px"
  chip:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "28px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "32px"
  search-trigger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "34px"
  count-chip:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.pill}"
    padding: "0 6px"
    height: "20px"
  badge-brand:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
---

# Design System: CMC EDU — Cockpit

## Overview

**Creative North Star: "The Ruled Ledger"**

CMC EDU's cockpit is a near-white operations ledger built on the shared craft bar of Linear and the Stripe Dashboard. Structure is drawn by hairlines, not by boxes: a single 240px navigation column, a fluid main worksurface, and a sticky context rail, all separated by 1px `#e4e4e7` rules on a `#f7f7f8` ground. It reads as an instrument, not a marketing page — dense, quiet, and legible at a glance from three feet away on a 1440px office display.

Five role cockpits share this one shell. The doctrine is that permission rewrites the *table*, never the *chrome*: a Sale and a Super admin see the same navbar, the same tabs, the same ruled metrics band — but different rows, different funnel, different queue. The design system's job is to make that shell so calm and consistent that the change in content is the only thing that moves when you switch roles. Separation of duties should be visible in the data, not dramatized by the UI.

Restraint is the whole personality. One purple (`#71639e`) is the only branded hue and it is rationed to acts of authority — active navigation, the selected tab's underline, the primary button, and the funnel bars. Status is carried by a six-tone ink-on-soft-tint system (five states plus brand-as-waiting), never by the brand color. Taxonomy such as subject, role, or action type lives on a separate four-step categorical ramp, so a status tone never has to double as a label. There are no cards used as structure, no gradients, no glassmorphism, and exactly one shadow in the entire build (the toast). This lab world is the forward design system for `design-lab/` work; `design-system/cmc-edu/OPENEDUCAT-VISUAL-CONTRACT.md` remains the authority for production list, form, and statusbar fidelity until a bridge wave lands these tokens into `@cmc/ui`.

**Key Characteristics:**
- Near-white ground (`#f7f7f8`) with a subtly cooler `#fafafa` sidebar and pure-white worksurface.
- Hairline `#e4e4e7` rules do all structural separation; boxes appear only for true containers.
- One purple, rationed to authority; a six-tone status palette for state; a four-step categorical ramp for taxonomy.
- Inter throughout, tuned for Vietnamese diacritics; every figure is tabular.
- 40px table rows, 32px nav items, 28–30px controls — a tight, instrument-grade density.
- Flat by default: tonal layering and rules convey depth, not elevation.
- Three-layer tokens (primitive → semantic → component) with density and print contexts.
- Cross-module patterns sit between atoms and pages; module grammar adds only what a domain needs.

## Architecture layers (general → specific)

The living gallery under `design-lab/system/` is organized so nothing invents values it does not own:

1. **Foundations** (`tokens.css`, `index.html`) — private primitives, public semantic tokens, sparse component tokens; density `compact|default|comfortable` remaps size/spacing only; print surface flips backgrounds and borders.
2. **Cross-module patterns** (`system.css`, `patterns.html`) — shell, seven-state controls, list with saved views + URL state + bulk select-all-across-filter, master–detail drawer, dashboard, detail, form, approval gate, toast, command palette. These assemble the four production archetypes (`DashboardPage`, `ListPage`, `DetailPage`, `FormPage`).
3. **Module grammar** (`modules.css`, `modules/*.html`) — patterns that exist only inside one domain:
   - **CRM:** O1→O5 kanban, three-level due vocabulary, bulk lead import with dedupe step.
   - **Finance:** money emphasis tiers, second-eyes threshold gate, append-only refund ledger, reconciliation pairs.
   - **Teaching:** week schedule grid, attendance matrix (C/M/V), gradebook draft→publish, session evidence.
   - **Students:** multi-tab profile, enrollment unit ranges, parent-link approve/reject-with-reason, placement dual list.
   - **HR:** punch pair integrity, KPI bars with business thresholds, locked payroll period.
   - **Engagement:** ruled gift catalog, points ledger (money-like), redeem queue.
   - **Audit:** compact-by-default read-only log, record trace timeline, role×capability matrix.
   - **Print:** same HTML, `@media print` token context (no duplicate template).

Status vocabulary is shared across every module: `danger` · `warning` · `success` · `info` · `neutral` · `brand` (waiting on the system). A module may not invent a seventh status tone. Anything that is a category rather than a state uses `data-category` (`a`–`d`) instead, which is why subjects, roles, and audit action kinds no longer borrow `success` or `brand`.

Density default is **40px** to honor the OpenEduCat production contract. Audit may default to **compact (32px)** because its job is dense scanning. Comfortable (48px) is for careful reading and touch.

Bridge details and wave order live in `design-lab/system/BRIDGE.md`. Research backing this depth wave: `plans/reports/research-260814-design-system-depth.md`.

## Colors

A near-white neutral field, one branded purple held in reserve, and a saturated six-tone status set that only ever appears as ink on its own soft tint. Status ink is drawn from the 700 step of each hue, which is what makes it legible on its own 050 tint.

### Primary
- **Cockpit Purple** (`#71639e`): The single branded hue. Appears only on the active nav item's soft fill, the selected tab underline, the primary button, the funnel bars, and the brand mark. It is authority made visible — where the product acts on your behalf or marks where you are.
- **Cockpit Purple Deep** (`#5a4f7e`): Pressed/hover state of the primary button, and the ink color for brand-tinted chips, counts, and badges on `primary-soft`.
- **Purple Veil** (`#f0edf6`): The soft brand tint. Fills the active nav item, the queue count chip, the funnel index bubbles, the selected table row, and the "waiting on the system" brand badge.

### Neutral
- **Ink** (`#18181b`): Primary near-black text — titles, values, active labels, row titles.
- **Ink Muted** (`#71717a`): Secondary text — subtitles, meta lines, column headers, resting nav labels.
- **Ink Faint** (`#a1a1aa`): Tertiary text — group labels, keyboard hints, synthetic-data notes.
- **Ground** (`#f7f7f8`): The app background and the fill for resting chips.
- **Surface** (`#ffffff`): The main worksurface, containers, and popovers.
- **Sidebar Wash** (`#fafafa`): The sidebar and table-header fill — one shade cooler than surface to seat the navigation without a border alone.
- **Hairline** (`#e4e4e7`): Every structural rule — sidebar edge, tab strip, metric dividers, table rows, container borders.
- **Hairline Strong** (`#d4d4d8`): The dashed border on the synthetic-data note; a heavier rule when one hairline is not enough.

### Status (functional, non-brand)
- **Danger** (`#dc2626` on `#fef2f2`): Over-threshold receipts, overdue items, missing evidence.
- **Warning** (`#d97706` on `#fffbeb`): Due today, pending grading, approaching deadlines.
- **Success** (`#16a34a` on `#f0fdf4`): Positive deltas, O4-ready-to-enroll, placement done.
- **Info** (`#2563eb` on `#eff6ff`): Neutral CRM / assignment states. This blue is a status ink only; it must never be mistaken for a brand or link color.
- **Neutral** (`#71717a` on `#f7f7f8`): Audit, config, and unclassified states.

### Named Rules
**The One Purple Rule.** `#71639e` is spent only on active nav, the tab underline, the primary button, and the funnel bars (plus its `primary-soft` tint on counts, brand badges, and the selected row). Never a gradient, never a decorative fill, never a status color.

**The Ink-on-Tint Rule.** Every status is a saturated ink sitting on its own soft tint of the same hue. Status never borrows the brand purple, and the brand purple never borrows a status role — a brand-tinted badge (`Chờ duyệt`) means "waiting on the system," which is a sixth, distinct tone.

## Typography

**Display / Body / Label Font:** Inter (with `ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, sans-serif)
**Mono Font:** `ui-monospace`, SFMono-Regular, Menlo, Consolas, monospace — record codes only.

**Character:** One typeface does everything. Inter is chosen for full Vietnamese diacritic coverage and its neutral, instrument-like tone; personality comes from weight (400/500/550/600) and tight negative tracking on large text, not from a display face.

### Hierarchy
- **Display** (600, 28px, line-height 1.1, `-0.03em`, tabular): Metric values in the ruled quick-stats band — the largest number on the page.
- **Headline** (600, 26px, line-height 1.15, `-0.03em`): The page title (`Tổng quan`). One per screen.
- **Title** (600, 14px, `-0.01em`): Section headers — queue title, rail panel headings.
- **Body** (400, 14px, line-height 1.45): Default UI text and table cells. Emphasis is carried at weight 550 (row titles, amounts, active nav) rather than a larger size.
- **Label** (600, 11px, `0.04em`, UPPERCASE): Nav group labels and small eyebrow captions. Reserved for structural section markers, not decoration.
- **Mono** (400, 12px, tabular): Record codes in the first table column (`PT-08421`, `O4-9918`) — the only monospaced text in the system.

### Named Rules
**The Tabular Numbers Rule.** Every figure aligns: metric values, amounts, due times, counts, pager numbers, and record codes all use `font-variant-numeric: tabular-nums` so columns of numbers read as a ledger.

**The Weight-Not-Size Rule.** Within body text, importance is expressed by stepping weight to 550, never by enlarging the type. The size ramp stays reserved for true hierarchy (title / headline / display).

## Layout

A three-zone shell on a CSS grid: a fixed **240px** left navigation column and a fluid main column (`grid-template-columns: 240px minmax(0, 1fr)`). The sidebar is sticky, full-height, and cooler than the surface. Inside main, a **48px** utility bar (breadcrumb + role/context chips + primary CTA) sits above the page head, an underline tab strip, and a **three-column ruled metrics band**. The worksurface below splits into a fluid queue table plus a **300px** sticky context rail (`minmax(0, 1fr) 300px`, 28px gutter).

Density is instrument-grade with **three named modes**: default **40px** table rows (OpenEduCat contract), compact **32px**, comfortable **48px**. Density remaps row height, cell padding, and group spacing — never the type ramp. Nav items are **32px** at default; controls sit at **28–34px**, with an 8/12/16/20/24/28 spacing rhythm. Main content is padded 28px horizontally, dropping to 16px on narrower viewports.

Responsive behavior collapses the shell in three steps. At **≤1100px** the nav narrows to 200px and the rail to 240px. At **≤860px** the grid goes single-column: the sidebar becomes a top bar (nav and search hidden), the metrics band stacks and re-rules horizontally, and the rail unstacks below the queue as a two-up grid. At **≤640px** the rail collapses to one column.

### Named Rules
**The Shared-Chrome Rule.** All five roles render the identical shell — 240px nav, utility bar, tabs, three-metric band, queue + rail. Only the *content* of the table, funnel, and metrics changes per role. Do not restructure the layout to differentiate a role.

**The Two-Column Cockpit Rule.** The worksurface is always fluid-queue + 300px sticky rail down to 860px, where the rail unstacks beneath the queue rather than shrinking into it.

## Elevation & Depth

Flat by default. Depth is conveyed by tonal layering (`#fafafa` sidebar and table headers against `#ffffff` surfaces on a `#f7f7f8` ground) and by hairline rules — never by resting shadows. The system ships exactly one shadow token, `--shadow-overlay`, used on the transient toast and nowhere else. The command palette and sticky form footer are separated by a hairline and a solid fill rather than by elevation or a gradient fade.

### Shadow Vocabulary
- **Toast lift** (`box-shadow: 0 8px 24px rgb(24 24 27 / 10%)`): The only visible elevation. It marks the floating status toast as detached from the plane; nothing else in the system earns a shadow.
- **Hairline inset** (`box-shadow: inset 0 0 0 1px rgb(255 255 255 / 12%)`): A single inset highlight on the brand mark. Decorative, not a depth device.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A drop shadow appears only on a transient, floating element (the toast). Structure and grouping are expressed with 1px hairlines and one-step tonal shifts — never with resting elevation, and never with glass or blur.

## Shapes

A restrained radius set on rectilinear forms. Controls and small surfaces use **6px** (`--radius`: buttons, nav items, the search trigger, pager cells). True containers — the table wrap, rail panels, and toast — use **8px**. Fully rounded **999px** pills are reserved for status badges, filter chips, counts, funnel index bubbles, and the avatar. The active tab underline is a 2px bar with 2px top corners. Borders are the primary form device: 1px hairlines define nearly every edge; the metrics band and rows are *ruled*, not boxed.

### Named Rules
**The No-Cards Rule.** Structure is drawn with hairline rules, not card boxes. Metrics are divided by right-borders; queue rows by bottom-borders. A border-box (8px, 1px hairline) is spent only on genuine containers — the scrollable table wrap, the rail panels, the toast — never to visually "chunk" content that a rule could separate.

## Components

### Buttons
- **Shape:** 6px radius (`{rounded.sm}`), 30px tall, 550 weight, 13px.
- **Primary:** Solid Cockpit Purple (`#71639e`) with white text; the only filled purple control. Used once per view for the role's main action (`+ Tạo phiếu thu`, `+ Điểm danh`).
- **Hover:** Darkens to Cockpit Purple Deep (`#5a4f7e`). No transform, no shadow.
- **Ghost:** Transparent with a 1px hairline border and muted-ink text; hover fills to `#f7f7f8` and darkens text to ink. Used for pager and secondary actions.
- **Disabled:** 0.45 opacity, `not-allowed` cursor.

### Chips
- **Style:** 28px pill (`999px`), 1px hairline border, `#f7f7f8` fill, muted-ink 12px text. Utility-bar chips carry facility, date, and a role selector (`chip-select` embeds a borderless `<select>`).
- **State:** Static filter/context descriptors; the embedded select is the only interactive chip.

### Badges (status)
- **Style:** 22px pill (`999px`), 12px / 550, no border — a saturated ink on its matching soft tint, driven by `data-tone`.
- **Tones:** `danger`, `warning`, `success`, `info`, `neutral`, and `brand` (Purple Veil + Cockpit Purple Deep, meaning "waiting on the system"). One badge per status cell.

### Cards / Containers
- **Corner Style:** 8px radius (`{rounded.md}`).
- **Background:** `#ffffff` surface.
- **Shadow Strategy:** None — flat, per the Flat-By-Default Rule.
- **Border:** 1px hairline (`#e4e4e7`).
- **Internal Padding:** 14px (rail panels); the table wrap is padless and scrolls internally.

### Inputs / Fields
- **Style:** The search trigger is a 34px, 6px-radius button-as-input: hairline border, white fill, muted placeholder, a 16px search glyph, and a `⌘K` `<kbd>` hint. The pager and chip selects are borderless or hairline-bordered controls at 28px.
- **Focus:** Global `:focus-visible` ring — a real `outline: 2px solid #71639e` at `outline-offset: 2px`, never a box-shadow ring. A shadow ring is silently clipped by any ancestor that scrolls or hides overflow, which is most of a data console, and it vanishes entirely in forced-colors mode; the outline survives both, and `forced-colors: active` swaps it for the operating system `Highlight` color. Never the LMS blue.

### Navigation
- **Style:** A grouped vertical list. Group labels are 11px uppercase Ink-Faint (`0.04em`); items are 32px, 6px-radius rows with a 16px currentColor icon and muted-ink label.
- **States:** Resting muted-ink; hover fills `rgb(24 24 27 / 4%)` and darkens to ink; **active** fills Purple Veil, sets ink text at weight 550, and carries `aria-current="page"`.
- **Tabs:** 40px underline tabs, 20px gap, 13px / 500, muted at rest, ink when selected with a 2px Cockpit Purple underline overlapping the strip's hairline.
- **Mobile:** Below 860px the sidebar becomes a top bar and the nav list + search are hidden.

### Ruled Metrics Band (signature)
Three equal columns divided by right-hairlines (no boxes), each: an optional status dot + 12px muted label, a 28px tabular value, and a 12px delta tinted `up`/`down` by success/danger. This is the cockpit's answer to "what is waiting for me" and the clearest expression of the No-Cards Rule.

### Funnel Rail (signature)
A sticky rail panel listing pipeline stages as `clip-path` trapezoid bars in stepped `color-mix` tints of the brand purple (78% → 34%), each with a zero-padded index bubble on Purple Veil and a tabular count. An `data-emphasize` stage outlines its bar in Cockpit Purple Deep and fills its index bubble solid purple — this is where the brand color earns its place as a data mark, not decoration.

## Do's and Don'ts

### Do:
- **Do** spend Cockpit Purple (`#71639e`) only on active nav, the tab underline, the primary button, and funnel bars; keep it under ~10% of any screen.
- **Do** separate content with 1px `#e4e4e7` hairlines and one-step tonal shifts (`#fafafa` vs `#ffffff`); rule the metrics band and rows instead of boxing them.
- **Do** set every figure in `tabular-nums` and express emphasis by stepping weight to 550, not by enlarging type.
- **Do** keep all five roles on the identical shell — change the table, funnel, and metrics content, never the chrome.
- **Do** render status as a saturated ink on its own soft tint via `data-tone`, keeping `brand` distinct as "waiting on the system."
- **Do** hold surfaces flat; reserve the single drop shadow for the transient toast and honor `prefers-reduced-motion`.

### Don't:
- **Don't** use cards, panels, or shadows to structure content that a hairline rule can separate (The No-Cards Rule).
- **Don't** introduce gradients, glassmorphism, or blur anywhere in the shell.
- **Don't** let the LMS/Apple blue (`#0071E3`) or the status info blue (`#2563eb`) appear on buttons, links, focus rings, or tabs — those belong to Cockpit Purple.
- **Don't** color status with the brand purple, or use a status ink for a brand affordance.
- **Don't** treat this lab world as production authority: `OPENEDUCAT-VISUAL-CONTRACT.md` governs production list/form/statusbar until a bridge wave ports these tokens into `@cmc/ui`.
