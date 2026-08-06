# Cook delta — 260806-1045-odoo-grammar-gap-cook

**Date:** 2026-08-06  
**Cook path:** Phase 2 + 4 + 6 (Phase 1 ops parallel; 3 deferred; 5 cut)

## Shipped

| Change | Files |
|--------|-------|
| Brand = active module label | `shell.tsx` — `brand={activeId ? undefined : 'CMC EDU'}` (unmatched → product; matched → navbar default) |
| Asserts | `shell.test.tsx`, `admin-shell.ui.spec.ts`, `design3-frontend-audit.mjs` (`brandCmc` = non-empty), `webwright-prod-smoke.mjs` |
| Kanban ≤768px column width | `packages/ui/src/odoo.css` — col `width` **only** in `@media`; cards `width: 100%` in media (desktop shrink-wrap restored after review High #1) |
| Token test | `packages/ui/src/odoo/odoo-tokens.test.ts` |
| Evergreen map | `design-system/cmc-edu/ODOO-COMPONENT-MAP.md` |
| Audit/smoke brand asserts | `design3-frontend-audit.mjs`, `webwright-prod-smoke.mjs` — **were untracked**; include in cook PR (`git add`) so SoT ships |

## Debt (explicit)

- Phase 3: thin statusbar sticky after summary split — **deferred**
- Phase 5: Astryx/`.ck-table-shell` sticky under nested scroll — **cut**
- Phase 1: live `menuCoveredCount=0` — **ops** (last artifact still 7)

## Validation

- `pnpm --filter @cmc/ui exec vitest run src/odoo/odoo-tokens.test.ts src/odoo/odoo-kanban.test.ts` — pass
- `pnpm --filter @cmc/admin exec vitest run src/shell/shell.test.tsx` — pass
