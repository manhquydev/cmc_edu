# Phase 1 evidence — stacking re-audit 2026-08-06

**Plan:** `plans/260806-1045-odoo-grammar-gap-cook/` Phase 1  
**Runner:** `apps/e2e/design3-frontend-audit.mjs`  
**Target:** Docker `cmcv2-prod` · `https://localhost/admin`  
**Artifact:** `outputs/design3-frontend-audit/results.json`

## Pass (post-rebuild)

| Metric | Before rebuild | After rebuild |
|--------|----------------|---------------|
| Shell OK | 34/34 | 34/34 |
| `menuCoveredCount` | **7** | **0** |
| Navbar computed z-index | `auto` | **`1000`** |
| PageHeader under shell | z≈10 competing | `static` / `auto` |

Spotlight `/teaching/session-assessment`: `menuCovered=false`, `menuAboveContent=true`.

## Disposition

- [x] Live audit re-run completed
- [x] `menuCoveredCount=0`
- [x] Evergreen map may claim stacking SHIPPED
- [x] Rebuild via `scripts/rebuild-cmcv2-admin.sh` (after branch push)

## Note

Audit REPORT prose still embeds a generic “navbar without z-index” blurb when generating markdown; ignore when summary `menuCoveredCount=0` and spotlight shows navbar z-index 1000.
