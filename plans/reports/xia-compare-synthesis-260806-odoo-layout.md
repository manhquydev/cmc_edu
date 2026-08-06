# Xia compare synthesis — Odoo layout grammar (acceptance close)

**Date:** 2026-08-06 (closed)  
**Pin:** `7de220c9` @ 19.0 (`/home/manhquy/Downloads/odoo-src`)  
**Branch tip:** `feat/design3-admin-rollout` @ `0f3dfe9`  
**Playbook:** `plans/260806-odoo-ui-component-dissection/AGENT-COMMAND-MAP.md`

## Analytical coverage

| Surface | Report | Verdict / ship |
|---------|--------|----------------|
| Shell / navbar | [xia-compare-260806-odoo-shell-navbar.md](./xia-compare-260806-odoo-shell-navbar.md) | SHIPPED (z=1000, brand=module) |
| Form sheet | [xia-compare-260806-odoo-form-sheet.md](./xia-compare-260806-odoo-form-sheet.md) | Dual sheet + thin statusbar sticky md+ **SHIPPED** |
| Control panel | [xia-compare-260806-odoo-control-panel.md](./xia-compare-260806-odoo-control-panel.md) | Densify kept; **no** 3-col port |
| List density | [xia-compare-260806-odoo-list-density.md](./xia-compare-260806-odoo-list-density.md) | Tokens OK; sticky/ops-pad e2e **CUT** (debt) |
| Kanban | [xia-compare-260806-odoo-kanban.md](./xia-compare-260806-odoo-kanban.md) | Geometry + responsive **SHIPPED** |
| Settings | [xia-compare-260806-odoo-settings.md](./xia-compare-260806-odoo-settings.md) | SettingsShell OK; mobile tabs **P2 optional** |
| Float layers | [xia-compare-260806-odoo-float-layers.md](./xia-compare-260806-odoo-float-layers.md) | Toast 1100 + ConfirmDialog markers **SHIPPED** |

## Cook packages closed this wave

| Plan | Outcome |
|------|---------|
| `260806-1045-odoo-grammar-gap-cook` | Phases 1–4 + 6 done; Phase 5 **CUT** |
| `260806-design3-detail-grammar-validation` | Playwright + ops harness **done** |
| `260806-float-stacking-toast` | Toast above navbar **done** |
| `260806-confirmdialog-float-z` | `.ck-dialog` + top-layer docs **done** |

## Explicit non-goals (still)

- OWL / XML arch / SearchModel / Bootstrap / purple interactive accent  
- Full CP L/C/R band  
- Inline list edit  
- Settings search CP  

## Remaining optional (not blocking acceptance)

| Item | Pri | When |
|------|-----|------|
| Settings mobile horizontal tabs | P2 | UX asks |
| List sticky under Astryx scroll | debt | Separate plan |
| Ops smoke-statusbar green | ops | Needs seeded receipt+opp on cmcv2 |
| Notebook / button_box density Xia | P2 | Product polish |

## Float stacking (authoritative)

```text
page chrome < navbar 1000 < toast 1100 < dialog band 1150 < cmd 1200
native <dialog>.showModal() top-layer > fixed z while open
```

## Acceptance of analysis wave

- [x] 7 surfaces Xia-compared under allowlist  
- [x] P0–P1 cook gaps from first synthesis shipped or cut with debt note  
- [x] Live navbar cover `menuCoveredCount=0` after rebuild (earlier evidence)  
- [x] Evergreen map / VIEW-GRAMMAR / STYLING-BRIDGE stacking updated  
- [ ] Optional: CI green on PR (open PR next)

## Next command

```text
gh pr create (feat/design3-admin-rollout → develop)
# optional later: Settings P2 or list sticky debt plan
```
