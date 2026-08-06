# Design System: Odoo Backend UI Language (Admin)

## Status & Provenance

**Status: rolled out for admin** (design3 admin rollout complete, 2026-08-06).

This document is the **authoritative design language for `apps/admin`** based on a
source-grounded recreation of Odoo's backend web-client UI. It **supersedes
[docs/12-design-system-ui.md](./12-design-system-ui.md) (TL12) for admin only**.
LMS (student/parent) keeps the TL12 premium language (`@cmc/ui/premium.css`) and
does not adopt Odoo chrome.

**Implementation surface (source of truth for re-implementation):**
- CSS: [`packages/ui/src/odoo.css`](../packages/ui/src/odoo.css) — tokens under
  `.o_web_client`, component skins (`.o-*`), plus Phase 6 scoped mirror of
  remaining premium (`.ck-*` / `.tpl-*` / `.sh-*`) selectors so admin no longer
  imports `premium.css`.
- Shell: [`OdooNavbar`](../packages/ui/src/odoo/odoo-navbar.tsx) + admin
  `apps/admin/src/shell/shell.tsx` (`.o_web_client` + `<main class="o-main">`).
- Kanban: [`KanbanBoard` / `KanbanColumn` / `KanbanCard`](../packages/ui/src/odoo/odoo-kanban.tsx).
- Templates: ListPage, DetailPage, FormPage, DashboardPage, ControlBar, etc.
  emit `o-*` classes (Phase 3 port).

**Not implemented (explicit non-goals):** Odoo pivot indent, calendar
grid-shell, dropdown↔bottom-sheet responsive behaviours — build only when a
real surface needs them.

**Promoted from:** [docs/design-system-odoo-candidate.md](./design-system-odoo-candidate.md)
(historical readiness assessment; may be removed once this doc is sole authority).

### Verification method

- **Source:** Odoo 19.0 backend web-client source (`github.com/odoo/odoo`, LGPL-3, branch `19.0`, commit `5568f6e472e2e53bc2931e744421015b0f0f3550`)
- **Implementation:** [`packages/ui/src/odoo.css`](../packages/ui/src/odoo.css) + [`OdooNavbar`](../packages/ui/src/odoo/odoo-navbar.tsx) + [`KanbanBoard`](../packages/ui/src/odoo/odoo-kanban.tsx); production shell `apps/admin/src/shell/shell.tsx`
- **Verification layers:**
  - Phase implementation with explicit decision log ([plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md](../plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md))
  - Red-team review: 13 findings, 12 accepted, 1 rejected; 6 agents reviewing decisions against source
  - Fidelity audit: 6 independent agents re-verifying against Odoo source directly (9 findings → all fixed)
  - 4 research agents: layout/IA, visual design language, wireframe structures, design tokens

### Approved deliberate deviations from Odoo

Per the [plan's Decision Log](../plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md):

| Element | Odoo's way | CMC's choice | Reason |
|---|---|---|---|
| Brand/accent color | Purple `#71639e` (community) / `#714B67` (enterprise) | Blue `#0071E3` (locked CMC brand) | Odoo purple decorative only; interactive accent stays CMC blue (per TL12) |
| Typography | System-font stack (Apple → Segoe UI → Roboto) | Inter font family (locked per TL12) | Consistency with existing CMC design-language layer; Odoo's size steps (14/13/12px) adopted |
| Shell placement | Odoo web client chrome | Admin `Shell` is OdooNavbar + app-switcher (all post-login routes); login stays outside | Single chrome language for ERP staff UI |

---

## Design Tokens

**Status:** All tokens read directly from Odoo source; CMC deviations marked.

### Colors

| Category | Token | Value | Source / Note |
|---|---|---|---|
| **Brand (decorative)** | `--odoo-brand-purple` | `#71639e` | Odoo community brand (used navbar only) |
| | `--odoo-brand-purple-dark` | `#5a4f7e` | Navbar border depth |
| | `--odoo-enterprise-purple` | `#714B67` | Odoo enterprise variant (reference, not used) |
| **Status colors (muted, Bootstrap-derived)** | `--odoo-success` | `#28a745` | Approve, paid, done (green) |
| | `--odoo-info` | `#17a2b8` | Info, pending (teal) |
| | `--odoo-warning` | `#ffac00` | Warning, in progress (amber) |
| | `--odoo-danger` | `#dc3545` | Danger, rejected (red) |
| **Kanban card accent colors** | `--odoo-kanban-color-1..6` | gray, red, amber, teal, green, purple | Status-to-color mapping: draft→gray, rejected→red, pending→amber, confirmed→teal, approved→green, done→purple |
| **Grays (Bootstrap 5 defaults)** | `--odoo-gray-100` through `--odoo-gray-900` | `#f8f9fa` to `#212529` | Full 9-step neutral ramp |
| **Interactive accents (CMC, not Odoo)** | Not in this token set | — | TL12 defines `#0071E3` globally; `/design3` does not override |

### Typography

| Token | Value | Notes |
|---|---|---|
| `--odoo-font-size-base` | `14px` | Body text, table cells, control panel |
| `--odoo-font-size-sm` | `13px` | Secondary, labels, kanban headers |
| `--odoo-font-size-xs` | `12px` | Badges, hints, small form text |
| Font family | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | **CMC deviation:** Odoo uses bare system stack; we keep Inter (TL12 locked) |
| Font weight | `400` (normal), `500` (medium), `700` (bold) | Only 3 steps; `/design3` applies sparingly (headers/labels use 500–600, not 700) |
| Line-height | Base `1.5`, small `1.25` | Odoo defaults; list/kanban use tight leading |

### Spacing & Sizing

| Token | Value | Usage |
|---|---|---|
| `--odoo-spacer` | `16px` | Base unit; padding/gaps throughout |
| `--odoo-radius` | `4px` | Cards, buttons, dropdowns (default) |
| `--odoo-radius-sm` | `3px` | Search box, view-switcher, small elements |
| `--odoo-radius-lg` | `6px` | Form sheets (less-used variant) |
| `--odoo-navbar-height` | `46px` | Fixed navbar strip |
| `--odoo-statusbar-height` | `33px` | Chevron statusbar |
| `--odoo-list-cell-padding-x`, `-y` | `0.3rem`, `0.5rem` | Dense table cells (≈ 4.8px, 8px) |
| `--odoo-kanban-card-width` | `320px` | Standard kanban card |
| `--odoo-kanban-card-width-sm` | `300px` | Compact variant (mobile) |
| `--odoo-kanban-gutter` | `8px` | Column gap, card bottom margin |

---

## Layout & Shell Patterns

### Scroll container owner flip (responsive)

Desktop: `.o_content` (inner pane) is the scroll owner; outer `.o_action` has `overflow: hidden`. Mobile (below `md`/768px): `.o_action` becomes scrollable, `.o_content` is `overflow: initial`. **Impact:** sticky headers and modals behave differently per breakpoint — a material layout shift, not just resizing. 

**Port cost:** Requires markup structure change (flex order/ownership shift) + media-query aware JS logic. Not just CSS.

### Settings row pattern

Two-column layout: narrow left pane (24px, holds toggle) + wide right pane (flex-grow). Right pane uses **left-border** (1px) as visual separator, not horizontal gutters. Fields capped to 50% width at `md+`, allowing two settings to align vertically. Flexible wrapping flex grid, not fixed column count.

### Auto-fullscreen dialog rule

Every dialog becomes fullscreen on small viewports (`isFullscreen = props.fullscreen || env.isSmall`), regardless of requested size. Header's close button morphs to back-arrow. Applies across all modal sizes — a structural breakpoint change, not responsive styling.

### Sticky statusbar gating

Form statusbar only sticks to content top at `md+`; below `md` it's inline/static. Pairs with scroll-container-owner-flip: on mobile, the whole action scrolls, so a sticky statusbar at the sheet level wouldn't behave as intended.

---

## Component & Pattern Inventory

### Built & verified in /design3

**Navbar + App-switcher**
- 46px navbar, brand-purple background, white 90%-opacity text
- App-switcher: toggle via hamburger icon; dropdown renders as vertical text-list (not icon grid — this was a verified-correct Odoo pattern)
- Systray: badge counter (green pill, hardcoded "3") and alert icon (non-interactive demo)

**Control panel + Breadcrumb**
- Left: breadcrumb with `/` separators, current page bold
- Center: search box (non-interactive placeholder)
- Right: view-switcher (list ↔ kanban buttons) + create button
- All fixed-height, white background, border-bottom only

**List view**
- Dense table: `14px` base, `0.3rem` × `0.5rem` cell padding, `40px` checkbox column
- Sticky header with depth cue (inset shadow under first data row)
- Zebra striping (`nth-child(odd)` background)
- Right-aligned numbers, left-aligned text
- Hover state: darker gray background

**Kanban board**
- Horizontal scrolling flex layout, 320px cards, 8px gutters
- Card: white bg, 1px border, colored left-bar accent (3px, via `::after` two-border technique)
- Column header: uppercase small text, count badge (gray pill)
- Card footer: separated by top border, smaller font (secondary info)

**Statusbar (chevron shape)**
- Interlocking arrow/chevron buttons via `clip-path: polygon()`
- First step: left edge flat, right edge →pointing
- Middle steps: ←← left pointing, →→ right pointing (overlap/interlock)
- Last step: right edge flat, left edge ←pointing
- Active step: dark background + 1px inset border-ring (two-layer emphasis)
- Chevron arithmetic: padding + negative margins + clip-path create seamless interlock

### Researched but NOT yet built

**Pivot view indent formula** (`5 + indent×30px` per nesting level)
- Distinctive drill-down affordance for tree tables
- Port cost: numeric precision required; CSS custom properties can carry the formula

**Calendar grid-shell** (`grid-template-rows: auto auto 1fr auto`)
- Toolbar fixed at top, content flexible, sidebar fixed-width (not proportional)
- Mobile: sidebar collapses into overlay panel
- Port cost: moderate; CSS Grid + JS overlay logic

**Dropdown ↔ bottom-sheet responsive switch**
- Desktop: anchored floating menu (`position: absolute`, `bottom-start`)
- Mobile: full-height bottom drawer (`inset: auto 0 0 0`)
- Structural change (position strategy), not just resizing
- Port cost: high; requires condition-driven DOM structure

---

## Readiness Assessment for Project-Wide Rollout

### What is ready

✓ **Design language layer:** Tokens, colors, typography, spacing fully portable; `/design3` proves viability
✓ **Standalone views:** List, kanban, and statusbar can be extracted to production surfaces as dumb components (props-in, CSS-out)
✓ **Verification chain:** Red-team + fidelity audit leaves high confidence in accuracy vs. Odoo source

### What is NOT ready

✗ **Integration with production AppFrame/SideNav:** `/design3` deliberately lives outside the shell. Production surface would need to:
  - Audit whether `/design3` navbar should become part of `AppFrame`, or replace it
  - Decide on dual-chrome risk (Odoo navbar inside CMC's outer shell vs. replacing it entirely)
  - This decision was explicitly out of scope for `/design3` — no brainstorm or plan exists yet

✗ **Component library changes:** `/design3` uses page-scoped CSS (`.odoo-lab-*` classes). Rollout would require:
  - Extracting components to `@cmc/ui/odoo-*` or similar (with design-token layering)
  - Migrating from `DataTable` (premium design language) to Odoo-style dense lists
  - Potentially two parallel component systems during transition (risk)

✗ **Responsive behavior audit:** `/design3` is static desktop demo. Real rollout requires:
  - Scroll-container-owner-flip logic implementation + testing on mobile
  - Dialog auto-fullscreen gating JS
  - Dropdown ↔ bottom-sheet conditional rendering
  - Testing against all documented responsive rules

✗ **Migration path strategy:** No plan exists for:
  - Which surfaces migrate first (CRM? Finance? Teaching?)
  - Phased rollout (one module at a time, or all-or-nothing)
  - Parallel old/new design-system coexistence strategy
  - Training/comms for users expecting existing UI

### Token conflicts with TL12 (low risk)

`docs/12-design-system-ui.md` (TL12) is locked:
- One brand accent: blue `#0071E3` (interactive)
- Light mode only
- Inter typography (which `/design3` also uses)

Odoo candidate uses:
- Purple for navbar **only** (never interactive accent) — no conflict with TL12's brand
- All same typography + grays — compatible

**Verdict:** Token set is additive, not conflicting. Can coexist under different CSS class scopes (`.odoo-lab-*` for experiment, `--cmc-*` for production).

### Cost estimate for rollout (order-of-magnitude)

1. **Component extraction:** 2–3 weeks (list, kanban, statusbar → library components + design tokens)
2. **Shell integration:** 1–2 weeks (navbar/control-panel routing, app-switcher wiring to real modules)
3. **Responsive logic:** 1–2 weeks (scroll flip, dialog gating, dropdown variants)
4. **First-surface migration:** 2–4 weeks (choice: CRM or Finance module, then test)
5. **Design review + QA:** 2–3 weeks (visual regression, a11y, e2e smoke)

**Total:** ~9–16 weeks for one production module + library, assuming sequential.

---

## References

### Research reports (evidence base)

- [research-260805-1604-odoo-layout-information-architecture.md](../plans/reports/research-260805-1604-odoo-layout-information-architecture.md) — Shell scroll behavior, form structure, settings pattern, responsive breakpoint rules
- [research-260805-1604-odoo-visual-design-language.md](../plans/reports/research-260805-1604-odoo-visual-design-language.md) — Color system, typography, shadow/elevation, motion, icon approach
- [ui-ux-designer-260805-1609-odoo-backend-view-wireframe-dissection-report.md](../plans/reports/ui-ux-designer-260805-1609-odoo-backend-view-wireframe-dissection-report.md) — List/kanban/calendar/pivot/graph wireframe structure + highest-value port candidates
- [research-260805-1604-odoo-design-token-taxonomy.md](../plans/reports/research-260805-1604-odoo-design-token-taxonomy.md) — Full token catalog with file:line evidence from Odoo source
- [fidelity-audit-260805-1544-design3-vs-real-odoo.md](../plans/reports/fidelity-audit-260805-1544-design3-vs-real-odoo.md) — 6-agent verification, 9 findings + corrections, structural accuracy scorecard

### Implementation + decision log

- [plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md](../plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md) — Approved decisions, scope (what's built vs. researched), red-team findings, validation Q&A

### Implementation source

- [apps/admin/src/pages/design-lab-3.tsx](../apps/admin/src/pages/design-lab-3.tsx) — Live React component (route `/design3`)
- [packages/ui/src/odoo.css](../packages/ui/src/odoo.css) — All tokens, layout, component styles (LGPL-3 Odoo attribution header included)

### Related production design doc

- [docs/12-design-system-ui.md](./12-design-system-ui.md) (TL12) — Current locked production design language (does NOT include this Odoo candidate)

---

## Next steps

**During rollout:** Use the active plan `plans/260805-1920-design3-admin-rollout/` and clarify only open product questions:
- Which production surface(s) to migrate first?
- Shell integration strategy (replace navbar, or nest inside existing AppFrame)?
- Component library approach (new `@cmc/ui/odoo-*` namespace, or mixed)?
- Timeline and team capacity?

**Current status:** Design Lab 3 is complete as an exploration. Follow-up: design3 admin rollout is in progress (shell swap → template reskin → module sweeps).
