# Phase 01 — P1 ControlBar densify + Form sheet grammar (CRM/finance pilot)

**Status:** completed (unit) — 2026-08-06  
**Parent:** [plan.md](./plan.md)

## Brainstorm contract

| Field | Value |
|-------|--------|
| **Outcome** | Admin list chrome densifies to one Odoo-like ControlPanel band (no nested header/filter cards). Record pages get dual form sheet (`sheet_bg` + `sheet`) so CRM/finance detail reads as ERP form, not floating soft cards. |
| **Constraints** | CSS + thin template markup only; public props of ListPage/DetailPage/FormPage unchanged; LMS/`premium.css` untouched; no OWL/SearchModel. |
| **Non-goals** | Full CP L/C/R rebuild; view switcher component; sticky thead; selection-replaces-search; chatter. |
| **Acceptance** | (1) Under `.o_web_client`, `.o-control-bar .o-page-header` and `.o-filter-bar` are flat (no card border/shadow). (2) ControlBar gap/padding denser. (3) DetailPage emits `.o-form-sheet-bg` + `.o-form-sheet`. (4) FormPage body sits in sheet. (5) Unit tests green for structure + CSS contracts. (6) CRM pipeline + finance list/detail need **no page edits** (inherit templates). |

## Scout summary

- `ControlBar` / `ListPage` — slots OK; double-card from `.o-page-header` + `.o-filter-bar` inside white CP band (`odoo.css` base + `.o_web_client` overrides incomplete).
- `DetailPage` — header/entity/summary/tabs/body flat stack; no sheet dual-layer.
- Pilots already use frames: `crm/pipeline` + `finance/receipt-list` (ListPage ops); `finance/receipt-detail` + `crm/opportunity-detail` (DetailPage + WorkflowStatusbar in summary).

## Implementation steps

1. **CSS densify** — `.o_web_client .o-control-bar` + flatten nested header/filter/footer separators.
2. **DetailPage** — wrap summary outside sheet (statusbar band), entity+tabs+body inside `.o-form-sheet` under `.o-form-sheet-bg`.
3. **FormPage** — body inside sheet dual-layer; sticky actions stay outside sheet.
4. **CSS sheet tokens** — max-width, border, sticky summary slot, flatten EntityHeader inside sheet.
5. **Tests** — detail/form structure classes; CSS contract file for densify/sheet.
6. **Docs** — touch CONSOLE-COMPONENT-MAP + plan phase status only.

## Files

| Path | Action |
|------|--------|
| `packages/ui/src/console.css` | densify + sheet rules |
| `packages/ui/src/components/detail-page.tsx` | sheet markup |
| `packages/ui/src/components/form-page.tsx` | sheet markup |
| `packages/ui/src/components/detail-page.test.tsx` | structure asserts |
| `packages/ui/src/components/form-page.test.tsx` | structure asserts |
| `packages/ui/src/console/odoo-cp-sheet.test.ts` | CSS contracts |
| `design-system/cmc-edu/CONSOLE-COMPONENT-MAP.md` | status bump |

## Validation

```bash
cd packages/ui && pnpm exec vitest run \
  src/components/control-bar.test.tsx \
  src/components/list-page.test.tsx \
  src/components/detail-page.test.tsx \
  src/components/form-page.test.tsx \
  src/odoo/odoo-cp-sheet.test.ts \
  src/odoo/odoo-shell-stacking.test.ts
```

## Risks / rollback

- DetailPage DOM nesting change may affect CSS that assumed flat siblings — mitigate with scoped `.o-form-sheet` rules only under shell.
- Rollback: revert three component/CSS files + tests.
