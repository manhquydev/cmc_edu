# Phase 6 — `git ls-files | grep -i odoo` classification

Generated 2026-08-07.

## Bucket (a) historical / intentional — leave

All `plans/**` paths matching `*odoo*` (completed plans, reports, dissection
process). Per plan.md, historical plans are not rewritten for rebrand.

Also intentional in live code (not filenames): LGPL-3 provenance comments and
"Odoo analogue" design commentary in CSS/components — not dead code.

## Bucket (b) leftover from this plan — deleted

**CSS orphans** (zero emitters after Phase 1–2; confirmed not dynamic):
- `console-breadcrumbs`, `console-breadcrumb-*` (PageHeader uses Astryx Breadcrumbs)
- `console-list-table`, `console-list-row`, `console-list-checkbox-col`, `console-list-number-col` (DataTable uses Astryx Table)
- `console-badge-count`, `console-content`, `console-control-panel`, `console-search`, `console-panel-buttons`, `console-label-upper`

Dynamic modifiers (`console-toast--*`, `console-av--*`, etc.) **kept** — emitted via templates.

**Prose renames** (this plan byproduct): a few test `describe()` strings and
comments still saying `odoo.css` / "Odoo chrome" → console naming.

## Bucket (c) owned by Phase 7 — leave

- `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` — rename to CONSOLE-COMPONENT-MAP.md in Phase 7

## SideNav / AppFrame

Still exported from `@cmc/ui`; zero production importers. **Kept** (public
contract; plan non-goal). No dead import to remove.

## Phase 5 leftovers

No ViewSwitcher/FormDialog extraction occurred; pipeline/schedule markup
unchanged and still needed.
