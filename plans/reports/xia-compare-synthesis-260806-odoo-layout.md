# Xia compare synthesis — Odoo layout grammar (5 surfaces)

**Date:** 2026-08-06  
**Pin:** `7de220c9` @ 19.0 (`/home/manhquy/Downloads/odoo-src`)  
**Mode:** `--compare` only (no cook)  
**Playbook:** `plans/260806-odoo-ui-component-dissection/AGENT-COMMAND-MAP.md`

## Reports

| Surface | File | Verdict |
|---------|------|---------|
| Shell / navbar | [xia-compare-260806-odoo-shell-navbar.md](./xia-compare-260806-odoo-shell-navbar.md) | Production-ready SPA simplify; MED risk |
| Form sheet | [xia-compare-260806-odoo-form-sheet.md](./xia-compare-260806-odoo-form-sheet.md) | Dual sheet shipped; sticky statusbar gap |
| Control panel | [xia-compare-260806-odoo-control-panel.md](./xia-compare-260806-odoo-control-panel.md) | Keep densify column; **no** 3-col port |
| List density | [xia-compare-260806-odoo-list-density.md](./xia-compare-260806-odoo-list-density.md) | Tokens OK; e2e sticky + ops pad |
| Kanban | [xia-compare-260806-odoo-kanban.md](./xia-compare-260806-odoo-kanban.md) | Geometry aligned; gap/responsive |

## Cross-cutting conclusions

1. **Do not port OWL / XML arch / SearchModel / 3-col CP / inline list edit.** Every surface recommends grammar fidelity + CMC SPA patterns.
2. **Core parity already high:** navbar 46px + z-index 1000, form dual-sheet, list cell tokens, kanban 320px + 6 colors.
3. **Biggest deliberate keep:** ControlBar vertical densify beats Odoo L/C/R for CMC maintainability (CP report score densify 46 vs 3-col 26).
4. **Shared mobile theme:** Odoo scroll-owner flip + sticky gates; CMC flatter scroll — accept for now, phase later.

## Ranked cook backlog (from all five)

| Pri | Item | Surfaces | Effort cue |
|-----|------|----------|------------|
| P0 | Live re-audit navbar cover after deploy | Shell | ops |
| P1 | Brand navbar = current module name | Shell | ~15m–0.5d |
| P1 | Sticky `.o-detail-summary` / statusbar **md+ only** | Form | ~2h |
| P1 | Kanban gutter double-spacing DevTools fix if real | Kanban | small |
| P2 | Kanban responsive column width (~90vw &lt;lg) | Kanban | small |
| P2 | List sticky thead e2e proof + optional ops padding CSS | List | QA + tiny CSS |
| P2 | Notebook/tab edge bleed if product needs | Form | ~3h |
| P3 | Mobile scroll-owner flip | Shell/Form | arch |
| Skip | Full CP 3-col, OWL, inline edit, SearchModel | CP/List | — |

## Next command

```text
/ck:plan brand-module + statusbar sticky md+ + kanban gutter/responsive
  context: plans/reports/xia-compare-synthesis-260806-odoo-layout.md
```

Or cook single P1 slice after plan approval.
