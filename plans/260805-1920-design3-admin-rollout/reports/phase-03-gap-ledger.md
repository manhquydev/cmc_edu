# Phase 3 gap ledger — central template reskin

Date: 2026-08-05

## Ported (class emission `o-*`, styles in `odoo.css`)

| Component | Notes |
|-----------|--------|
| ControlBar | `o-control-bar*` sticky band; dense white under `.o_web_client` |
| ListPage | `o-wrap` / `o-list-body`; composes ControlBar |
| DetailPage | `o-detail*` frame |
| FormPage | `o-form-body` + `o-actions` |
| PageHeader | `o-page-header` + `o-bc*` breadcrumbs |
| ProgressSteps / WorkflowStatusbar | `o-steps*` chevron clip-path under shell |
| EntityHeader | `o-eh*` |
| SettingsShell | `o-settings-*` (+ @media collapse ported) |
| DashboardPage | `o-dash*` |
| MetricCard | `o-mc*` (coupled dash metrics) |
| FilterBar | `o-filter-bar` — **name FilterBar kept** for check-ui-frames |
| DataTable | wrapper `o-list` + Astryx `density=compact` `isStriped` |
| ShortcutChip | `o-dash-chip*` |

## Page utility renames

`tpl-detail-stack|split|panel` → `o-detail-*` on:
- opportunity-detail, receipt-detail, student-detail, class-detail, design-lab

## Known gaps (not blocking unit gates)

1. **Astryx Table internals** — no StyleX hash targeting; sticky header inset shadow from real Odoo list may be incomplete (wrapper only).
2. **CommandPalette** still emits `ck-cmd*` (Phase 6 census; not in Phase 3 list).
3. **Other premium composites** (FunnelBar, TaskRow, Panel, BulkActionBar, …) still `ck-*` — Phase 6.
4. **Visual checkpoint** of 12 pages including cockpit not done in browser this session.
5. **ui-e2e** not run after shell+reskin — required before merge to main.

## Decision 12 (checkpoint after Phase 3)

Auto-continue per plan: proceed to Phase 4 (CRM pilot) after local unit gates green; re-order Phase 5 modules only if visual review finds leverage mistakes. No scope stop for user approval.
