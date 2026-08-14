# Design system gallery (lab)

**Path:** `design-lab/system/`  
**Choice:** 1C Lab first · Full gallery · Hybrid · multipage module grammar

## Serve

Serve the **parent** `design-lab/` root so gallery ↔ cockpit links work:

```bash
python3 -m http.server 8766 --directory design-lab
```

- Foundations: http://127.0.0.1:8766/system/
- Cross-module patterns: http://127.0.0.1:8766/system/patterns.html
- Modules: http://127.0.0.1:8766/system/modules/
- Cockpit: http://127.0.0.1:8766/cockpit-roles/

## Contents

| File | Role |
|------|------|
| `tokens.css` | Three-layer tokens (primitive → semantic → component) + density + print |
| `system.css` | Shell, atoms, cross-module patterns, archetypes |
| `modules.css` | Module-only patterns (board, schedule, matrix, ledger, receipt…) |
| `shell.js` | Shared gallery behavior (density, selection, attendance, board…) |
| `index.html` | Foundations gallery |
| `patterns.html` | Cross-module pattern gallery |
| `modules/*.html` | CRM, Finance, Teaching, Students, HR, Engagement, Audit, Print |
| `BRIDGE.md` | Hybrid map lab → `@cmc/ui` (doc only) |

## Layers (general → specific)

1. **Foundations** — tokens, type, density, seven control states, a11y baseline.
2. **Patterns** — list / master-detail / dashboard / detail / form / approval gate / toast / palette.
3. **Module grammar** — only what a domain needs beyond the four page archetypes.

## Rules

- Vietnamese UI copy; Inter (Vietnamese diacritics); purple `#71639e`.
- Synthetic data labeled.
- No production edits from this folder until bridge wave.
- Density default = 40px (OpenEduCat contract); Audit may default to compact.
- Status vocabulary is shared: danger / warning / success / info / neutral / brand.
