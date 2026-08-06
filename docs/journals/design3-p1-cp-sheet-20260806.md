# Journal — design3 P1 ControlBar densify + form sheet

**Date:** 2026-08-06  
**Plan:** `plans/260806-odoo-ui-component-dissection/phase-01-controlbar-form-sheet-p1.md`

## What shipped

- ControlBar under `.o_web_client`: flat white CP band; nested `.o-page-header` / `.o-filter-bar` lose card chrome (CRM pipeline + finance receipt list inherit via ListPage).
- DetailPage / FormPage: Odoo dual-layer `.o-form-sheet-bg` + `.o-form-sheet` (summary above sheet; entity/tabs/body or form fields inside).
- CSS contracts + structure tests; EntityHeader flattened inside sheet.
- Sticky summary intentionally **not** applied (tall HighlightStrip + statusbar on pilots).

## Validation

- `packages/ui` vitest: detail/form/list/control-bar + odoo-cp-sheet + shell-stacking green.
- Admin pilot tests: receipt-detail/list, pipeline, opportunity-detail (run in session).

## Follow-ups

- Split pilot `summary` so only WorkflowStatusbar stays outside sheet; HighlightStrip under entity.
- Optional sticky thin statusbar only after that split.
- Deploy admin image for visual confirm on cmcv2-prod.
