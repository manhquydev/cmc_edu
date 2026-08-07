# Design System: CMC Console (Admin ERP UI Language)

## Status & Provenance

**Status: shipped for admin** — design3 shell + odoo layer + premium import
retirement on admin (2026-08-06). **CI:** `typecheck-and-test` + full `ui-e2e`
green on `develop` PR #75 (`eaa223a`, 2026-08-07). **Acceptance re-measure:**
done @ `eaa223a` CI journey artifact — **31/38 proven** (7 `no-ui-path`
ceiling); see `plans/reports/cook-260807-0902-design3-validation-acceptance.md`.
**Still open:** human visual smoke (see rollout plan).

This document is the **authoritative design language for `apps/admin`** based on a
source-grounded recreation of Odoo's backend web-client UI. It **supersedes
[docs/12-design-system-ui.md](./12-design-system-ui.md) (TL12) for admin only**.
LMS (student/parent) keeps the TL12 premium language (`@cmc/ui/premium.css`) and
does not adopt Odoo chrome.

**Implementation surface (source of truth for re-implementation):**
- CSS: [`packages/ui/src/console.css`](../packages/ui/src/console.css) — tokens under
  `.o_web_client`, component skins (`.o-*`), plus Phase 6 scoped mirror of
  remaining premium (`.ck-*` / `.tpl-*` / `.sh-*`) selectors so admin no longer
  imports `premium.css`.
- Shell: [`ConsoleNavbar`](../packages/ui/src/console/console-navbar.tsx) + admin
  `apps/admin/src/shell/shell.tsx` (`.o_web_client` + `<main class="o-main">`).
- Kanban: [`KanbanBoard` / `KanbanColumn` / `KanbanCard`](../packages/ui/src/console/console-kanban.tsx).
- Templates: ListPage, DetailPage, FormPage, DashboardPage, ControlBar, etc.
  emit `o-*` classes (Phase 3 port).

**Not implemented (explicit non-goals):** Odoo pivot indent, calendar
grid-shell, dropdown↔bottom-sheet responsive behaviours — build only when a
real surface needs them.

**Historical:** Lab-era readiness notes lived in
`docs/design-system-odoo-candidate.md` (deleted after promote). Recover from
git history if needed. This file is the sole evergreen authority.

### Verification method

- **Source:** Odoo 19.0 backend web-client source (`github.com/odoo/odoo`, LGPL-3, branch `19.0`, commit `7de220c941c77d4fffdc270a7862c69475fa4577` — pin reconciled 2026-08-07 (Phase 3; see plans/260807-1453-cmc-console-design-system-rebrand-hardening/reports/fresh-fidelity-audit-2026-08-07.md))
- **Implementation:** [`packages/ui/src/console.css`](../packages/ui/src/console.css) + [`ConsoleNavbar`](../packages/ui/src/console/console-navbar.tsx) + [`KanbanBoard`](../packages/ui/src/console/console-kanban.tsx); production shell `apps/admin/src/shell/shell.tsx`
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
| Shell placement | Odoo web client chrome | Admin `Shell` is ConsoleNavbar + app-switcher (all post-login routes); login stays outside | Single chrome language for ERP staff UI |

---

## Design Tokens

**Status:** All tokens read directly from Odoo source; CMC deviations marked.

### Colors

| Category | Token | Value | Source / Note |
|---|---|---|---|
| **Brand (decorative)** | `--console-brand-purple` | `#71639e` | Odoo community brand (used navbar only) |
| | `--console-brand-purple-dark` | `#5a4f7e` | Navbar border depth |
| | `--console-enterprise-purple` | `#714B67` | Odoo enterprise variant (reference, not used) |
| **Status colors (muted, Bootstrap-derived)** | `--console-success` | `#28a745` | Approve, paid, done (green) |
| | `--console-info` | `#17a2b8` | Info, pending (teal) |
| | `--console-warning` | `#ffac00` | Warning, in progress (amber) |
| | `--console-danger` | `#dc3545` | Danger, rejected (red) |
| **Kanban card accent colors** | `--console-kanban-color-1..6` | gray, red, amber, teal, green, purple | Status-to-color mapping: draft→gray, rejected→red, pending→amber, confirmed→teal, approved→green, done→purple |
| **Grays (Bootstrap 5 defaults)** | `--console-gray-100` through `--console-gray-900` | `#f8f9fa` to `#212529` | Full 9-step neutral ramp |
| **Interactive accents (CMC, not Odoo)** | Not in this token set | — | TL12 defines `#0071E3` globally; admin keeps CMC blue for interactive chrome |

### Typography

| Token | Value | Notes |
|---|---|---|
| `--console-font-size-base` | `14px` | Body text, table cells, control panel |
| `--console-font-size-sm` | `13px` | Secondary, labels, kanban headers |
| `--console-font-size-xs` | `12px` | Badges, hints, small form text |
| Font family | `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | **CMC deviation:** Odoo uses bare system stack; we keep Inter (TL12 locked) |
| Font weight | `400` (normal), `500` (medium), `700` (bold) | Only 3 steps; headers/labels typically 500–600, not 700 |
| Line-height | Base `1.5`, small `1.25` | Odoo defaults; list/kanban use tight leading |

### Spacing & Sizing

| Token | Value | Usage |
|---|---|---|
| `--console-spacer` | `16px` | Base unit; padding/gaps throughout |
| `--console-radius` | `4px` | Cards, buttons, dropdowns (default) |
| `--console-radius-sm` | `3px` | Search box, view-switcher, small elements |
| `--console-radius-lg` | `6px` | Form sheets (less-used variant) |
| `--console-navbar-height` | `46px` | Fixed navbar strip |
| `--console-statusbar-height` | `33px` | Chevron statusbar |
| `--console-list-cell-padding-x`, `-y` | `0.3rem`, `0.5rem` | Dense table cells (≈ 4.8px, 8px) |
| `--console-kanban-card-width` | `320px` | Standard kanban card |
| `--console-kanban-card-width-sm` | `300px` | Compact variant (mobile) |
| `--console-kanban-gutter` | `8px` | Column gap, card bottom margin |

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

### Shipped in production admin (design3 rollout)

**Shell — ConsoleNavbar + app-switcher**
- Root: `.o_web_client` + `<main class="o-main">` in `apps/admin/src/shell/shell.tsx`
- 46px navbar, brand-purple background, white 90%-opacity text
- App-switcher: hamburger toggle; dropdown is a vertical text-list (Odoo-correct pattern)
- Permission gate: `isChildVisible` required on navbar children (fail-closed)
- Chrome-suppressed mode on `/change-password` (no navbar / ⌘K / role switcher)
- Login remains **outside** the Odoo shell

**Control panel + templates**
- Shared templates (`ListPage`, `DetailPage`, `FormPage`, `DashboardPage`, `ControlBar`,
  `FilterBar`, `PageHeader`, `EntityHeader`, …) emit `o-*` classes
- Dense ops control bar; view switcher where modules need list ↔ kanban

**List view**
- Dense table via `DataTable` + `o-list` framing: `14px` base, tight cell padding
- Sticky header cues, zebra striping, hover row background

**Kanban board**
- `KanbanBoard` / `KanbanColumn` / `KanbanCard` in `@cmc/ui`
- Horizontal flex board, card left-bar accent via `--console-kanban-color-*`
- CRM pipeline pilot: list ↔ kanban + `?view=` deep-link

**Statusbar (chevron shape)**
- `WorkflowStatusbar` / `ProgressSteps` restyled with interlocking chevrons
  (`clip-path`); used on CRM opportunity + finance receipt (incl. terminal cancelled)

**Float layers (after premium.css retirement on admin)**
- Toast and command palette CSS (`.ck-toast*`, `.ck-cmd*`) ship **unscoped** in
  `odoo.css` because `ToastViewport` mounts as a sibling of the router tree
  (not under `.o_web_client`). Guarded by `packages/ui/src/odoo/odoo-float-layer.test.ts`.

### Explicit non-goals (not built)

**Pivot view indent formula** (`5 + indent×30px` per nesting level)  
**Calendar grid-shell** (FullCalendar uses admin-local `o-fc*` skins, not Odoo grid-shell)  
**Dropdown ↔ bottom-sheet responsive switch**  
Build only when a real surface needs them.

### Residual debt (honest)

- Many composites still emit premium class prefixes (`ck-*` / `tpl-*` / `sh-*`);
  admin paints them via a Phase 6 **selector mirror** under `.o_web_client` plus
  unscoped float layers — not a full class rename.
- LMS still owns `@cmc/ui/premium.css` + `AppFrame`/`SideNav` for student/parent.
- Dual CSS drift risk if premium and odoo mirror diverge without dual-edit discipline.

---

## Rollout status (as-built)

### Done (unit / static + CI)

✓ **Design language in `@cmc/ui`:** tokens under `.o_web_client`, `ConsoleNavbar`, `KanbanBoard`, template `o-*` reskin  
✓ **Admin shell swap:** SideNav/`AppFrame` production shell replaced; design-lab routes deleted  
✓ **Module coverage:** central templates cover most pages; CRM/finance/teaching/classes/enrollment residual sweeps landed  
✓ **premium.css retired on admin:** import removed; LMS unchanged  
✓ **Static gates:** `scripts/check-ui-frames.mjs` (FilterBar name preserved), unit suites for shell/odoo layer  
✓ **G1 FilterBar lite + list search wave (2026-08-07):** ControlBar hosts FilterBar; `hasClear` for default-domain selects; optional `search` on major list procedures; **~20/23** ListPages use FilterBar (holdouts: leaderboard, class-placement, refund stub). Full Odoo Search OS (facets/GroupBy/Favorites) remains parked.  
✓ **Full `ui-e2e` green** on `develop` PR #75 (`fdc2c93`) — journeys aligned to reactive FilterBar (no submit button; combobox labels)

### Still open validation gates

✓ **`pnpm acceptance:report` re-measure** @ `eaa223a` (CI `gitDirty:false`) — 31/38 proven, 38 flow ids retained; tool exit 1 only for pre-existing untriaged orphans  
✗ **Human visual smoke** after premium drop (toast, ⌘K, CRM list/kanban, cancelled receipt, teaching calendar)  
✗ **True class-language retirement** (`ck-*` → `o-*` rename) — optional backlog, not required for shell language  

### Token coexistence with TL12

TL12 remains authoritative for **LMS** and shared base tokens (`--cmc-*`, Inter,
accent `#0071E3`, light-only). Admin interactive accent stays CMC blue; Odoo purple
is navbar chrome only. No token conflict under separate import paths
(`odoo.css` admin / `premium.css` LMS).

---

## References

### Research reports (lab-era evidence base)

- [research-260805-1604-odoo-layout-information-architecture.md](../plans/reports/research-260805-1604-odoo-layout-information-architecture.md)
- [research-260805-1604-odoo-visual-design-language.md](../plans/reports/research-260805-1604-odoo-visual-design-language.md)
- [ui-ux-designer-260805-1609-odoo-backend-view-wireframe-dissection-report.md](../plans/reports/ui-ux-designer-260805-1609-odoo-backend-view-wireframe-dissection-report.md)
- [research-260805-1604-odoo-design-token-taxonomy.md](../plans/reports/research-260805-1604-odoo-design-token-taxonomy.md)
- [fidelity-audit-260805-1544-design3-vs-real-odoo.md](../plans/reports/fidelity-audit-260805-1544-design3-vs-real-odoo.md)

### Implementation + decision log

- [plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md](../plans/260805-1421-design-lab-3-odoo-ui-recreation/plan.md) — Lab decisions / red-team (historical)
- [plans/260805-1920-design3-admin-rollout/plan.md](../plans/260805-1920-design3-admin-rollout/plan.md) — Production rollout plan (phases 1–6)
- [plans/260806-odoo-ui-component-dissection/plan.md](../plans/260806-odoo-ui-component-dissection/plan.md) — **Ongoing Odoo→CMC dissection process** (pin, wireframes, matrix, gap backlog)
- [plans/260806-odoo-ui-component-dissection/reports/odoo-19-source-dissection.md](../plans/260806-odoo-ui-component-dissection/reports/odoo-19-source-dissection.md) — Source-grounded wireframes + full component matrix (Odoo 19.0 pin)
- [plans/reports/ship-20260807-filterbar-search.md](../plans/reports/ship-20260807-filterbar-search.md) — FilterBar + API search ship + CI proof
- [plans/reports/orchestrate-20260806-234049-ui-component-readiness/report.md](../plans/reports/orchestrate-20260806-234049-ui-component-readiness/report.md) — Pre-ship component readiness baseline

### Implementation source (authoritative)

- [`packages/ui/src/console.css`](../packages/ui/src/console.css) — tokens, skins, premium mirror, float layers (LGPL-3 attribution)
- [`packages/ui/src/console/console-navbar.tsx`](../packages/ui/src/console/console-navbar.tsx)
- [`packages/ui/src/console/console-kanban.tsx`](../packages/ui/src/console/console-kanban.tsx)
- [`apps/admin/src/shell/shell.tsx`](../apps/admin/src/shell/shell.tsx)

### Related design docs

- [docs/12-design-system-ui.md](./12-design-system-ui.md) (TL12) — **LMS** + shared base tokens; superseded for admin chrome
- [docs/system-architecture.md](./system-architecture.md) — as-built shell note for admin
- [design-system/cmc-edu/ODOO-COMPONENT-MAP.md](../design-system/cmc-edu/ODOO-COMPONENT-MAP.md) — maintainer one-pager Odoo↔CMC map

---

## Maintainer notes

- Do **not** reintroduce `/design3` or design-lab pages; re-implement from this doc + `packages/ui/src/odoo*`.
- Keep `FilterBar` symbol name until `check-ui-frames` is intentionally rewritten.
- When adding portal/provider siblings that emit `ck-*`, either mount under `.o_web_client` or add unscoped float rules + extend `odoo-float-layer.test.ts`.
