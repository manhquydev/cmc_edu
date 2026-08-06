# Xia compare synthesis — Odoo layout grammar (5 surfaces)

**Date:** 2026-08-06  
**Pin:** `7de220c9` @ 19.0 (`/home/manhquy/Downloads/odoo-src`)  
**Mode:** `--compare` only (no cook)  
**Playbook:** `plans/260806-odoo-ui-component-dissection/AGENT-COMMAND-MAP.md`

## Reports

| Surface | File | Verdict |
|---------|------|---------|
| Shell / navbar | [xia-compare-260806-odoo-shell-navbar.md](./xia-compare-260806-odoo-shell-navbar.md) | Production-ready SPA simplify; MED risk |
| Form sheet | [xia-compare-260806-odoo-form-sheet.md](./xia-compare-260806-odoo-form-sheet.md) | Dual sheet shipped; sticky statusbar gap → **SHIPPED** |
| Control panel | [xia-compare-260806-odoo-control-panel.md](./xia-compare-260806-odoo-control-panel.md) | Keep densify column; **no** 3-col port |
| List density | [xia-compare-260806-odoo-list-density.md](./xia-compare-260806-odoo-list-density.md) | Tokens OK; e2e sticky + ops pad **CUT/debt** |
| Kanban | [xia-compare-260806-odoo-kanban.md](./xia-compare-260806-odoo-kanban.md) | Geometry aligned; responsive shipped |
| Settings | [xia-compare-260806-odoo-settings.md](./xia-compare-260806-odoo-settings.md) | SettingsShell OK; mobile tabs P2 only |
| Float layers | [xia-compare-260806-odoo-float-layers.md](./xia-compare-260806-odoo-float-layers.md) | Toast was under navbar → cook toast **1100** |

## Follow-on (2026-08-06 session)

- Validation harness for statusbar: `plans/260806-design3-detail-grammar-validation/` **done**
- Session handoff: `handoff-20260806-1148-odoo-design3-session.md`
- Float cook plan: `plans/260806-float-stacking-toast/`

## Next command

```text
# after toast ship: optional Settings P2 mobile tabs only if UX asks
# else: push feat/design3-admin-rollout + PR check CI
```

