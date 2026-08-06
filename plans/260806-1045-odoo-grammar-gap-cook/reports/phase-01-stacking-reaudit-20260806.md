# Phase 1 evidence — stacking re-audit 2026-08-06

**Plan:** `plans/260806-1045-odoo-grammar-gap-cook/` Phase 1  
**Runner:** `apps/e2e/design3-frontend-audit.mjs`  
**Target:** Docker `cmcv2-prod` · `https://localhost/admin`  
**Artifact:** `outputs/design3-frontend-audit/results.json` (+ REPORT.md, screenshots)

## Result

| Metric | Value |
|--------|-------|
| Shell OK | 34/34 (100%) |
| `menuCoveredCount` | **7** (unchanged vs morning audit) |
| Covered paths | session-evidence, session-assessment, hr/my, salary-tiers, shift-config, network-ip, finance/new |

## Diagnosis

Live compute on covered route (session-assessment):

- `.o-navbar` **z-index = auto** (deployed CSS)
- `.o-page-header` wins `elementsFromPoint` over open app-switcher

**Source repo (branch commits `8e3860e` / `732ca32`) already has:**

- `.o-navbar { z-index: 1000 }` — `packages/ui/src/odoo.css`
- `.o_web_client .o-page-header { position: static; z-index: auto }`
- Unit: `packages/ui/src/odoo/odoo-shell-stacking.test.ts` green

⇒ Residual is **deploy lag**, not missing source fix. Admin container image does not embed current `@cmc/ui` CSS.

## Disposition

- [x] Live audit re-run completed (artifact refreshed)
- [ ] `menuCoveredCount=0` — **blocked on admin image rebuild** from current branch
- [ ] Evergreen map must **not** claim stacking SHIPPED until re-audit after rebuild

## Next ops steps

1. Push `feat/design3-admin-rollout` (ahead 2) if not pushed.
2. Rebuild/redeploy `cmcv2-prod-admin` with workspace `@cmc/ui` that includes navbar z-index 1000.
3. Re-run `node apps/e2e/design3-frontend-audit.mjs`.
4. Expect `menuCoveredCount=0`; then `ck plan check 1` and update ODOO-COMPONENT-MAP.
