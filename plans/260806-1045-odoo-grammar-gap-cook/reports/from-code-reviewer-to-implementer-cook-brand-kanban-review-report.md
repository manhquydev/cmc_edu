# Code Review: cook brand + kanban (260806-1045)

**To:** implementer  
**From:** code-reviewer  
**Date:** 2026-08-06  
**Focus:** regressions only (brand module name + kanban responsive)  
**Scope files:** shell brand removal, asserts, `odoo.css` kanban media, token test, map, cook-delta

## Code Review Summary

### Scope
- Files: `shell.tsx`, `shell.test.tsx`, `admin-shell.ui.spec.ts`, `design3-frontend-audit.mjs`, `webwright-prod-smoke.mjs`, `odoo.css`, `odoo-tokens.test.ts`, `ODOO-COMPONENT-MAP.md`, `cook-delta.md`
- LOC: ~+122 / −10 tracked (odoo.css carries additional non–Phase-2/4 grammar in same working tree)
- Focus: brand fallback, kanban narrow `width: 100%`, `brandCmc` empty locator
- Scout findings: desktop col `width: 320px` vs fixed card `320px` under `.o_web_client { box-sizing: border-box }`; null `activeAppId` → `apps[0].label` (not always `'CMC EDU'`); audit/smoke assert files untracked

### Overall Assessment
Brand override removal is correct and matches `OdooNavbar` defaults. Narrow-viewport kanban card `width: 100%` is present and sound. **Desktop kanban column width is a new layout regression.** Assert tooling for design3/smoke is updated in the worktree but not git-tracked, so a PR of tracked files alone will not ship those surfaces.

### Critical Issues
None.

### High Priority

1. **Desktop kanban: column width + border-box clips/overflows cards**  
   - Evidence: HEAD had `.o-kanban-col` **without** explicit `width` (column shrink-wrapped around 320px cards + padding). Cook adds `width: var(--odoo-kanban-card-width)` (320px) while `.o-kanban-card` / `.o-kanban-empty` stay `width: var(--odoo-kanban-card-width)`. Under `.o_web_client * { box-sizing: border-box }` (odoo.css ~87–90), column content box = `320 − 2×8` gutter ≈ 304px; cards remain 320px → horizontal overflow / cramped columns on CRM + teaching schedule boards.  
   - Narrow path is fine: `@media (max-width: 768px)` sets cards/empty to `width: 100%`.  
   - Fix (pick one):  
     - Prefer: set `.o-kanban-card, .o-kanban-empty { width: 100%; }` at **all** breakpoints and keep desktop col at `--odoo-kanban-card-width`; or  
     - Only apply col `width` inside the media query (restore desktop auto-size); or  
     - `width: calc(var(--odoo-kanban-card-width) + 2 * var(--odoo-kanban-gutter))` on col if cards stay fixed 320px.

2. **Phase-2 assert scripts are untracked — cook claim vs ship surface**  
   - `apps/e2e/design3-frontend-audit.mjs` and `apps/e2e/webwright-prod-smoke.mjs` are `??` (never in git history). Brand metric updates live only in the worktree.  
   - Impact: PR of tracked changes ships shell + Playwright unit/e2e; local/CI ops runners that copy old scripts (or expect repo SoT) still assert product-name brand behavior elsewhere. Cook-delta lists them as shipped.  
   - Fix: `git add` both files into the cook PR **or** amend cook-delta to mark them local-only and move SoT elsewhere.

### Medium Priority

3. **`activeAppId === null` brand is first visible module, not always `'CMC EDU'`**  
   - Verified: `odoo-navbar.tsx`  
     `brand ?? activeApp?.label ?? (apps[0] ? apps[0].label : 'CMC EDU')`.  
   - Empty `apps` (e.g. `me == null` → `modules = []` in shell) → **`'CMC EDU'`** (non-empty ✓).  
   - Non-empty `apps` + unmatched path (`activeModuleId` → `null`, see `active-module.test.ts` `/unknown`) → **`apps[0].label`** (typically `Tổng quan`), which mislabels the chrome. Previously hardcode always showed product name.  
   - Fix if product wants true product fallback on unmatched routes: shell `brand={activeApp ? undefined : 'CMC EDU'}` or navbar last resort before `apps[0]`. At minimum add a unit case for `activeAppId={null}` with non-empty apps.

4. **Token test is presence-only (phantom coverage for the real fix)**  
   - `odoo-tokens.test.ts` asserts media string + `min(90vw, var(--odoo-kanban-card-width-sm))` but **not** `.o-kanban-card` / `.o-kanban-empty { width: 100% }` and not desktop non-overflow. Would stay green while desktop regressed.  
   - Extend string asserts to include card `width: 100%` inside the media block, or add a layout/DOM assertion if the suite has CSSOM support.

### Low Priority

5. Breakpoint drift: kanban uses `max-width: 768px`; much of odoo chrome uses `767px`. One-pixel band inconsistency — ignore unless unifying breakpoints.  
6. Metric name `brandCmc` now means “non-empty module brand” — rename later to avoid false ops interpretation.  
7. Same `odoo.css` working tree also stacks z-index / form-sheet / control-bar changes beyond Phase 2+4; keep out of this slice’s PR if validate is brand+kanban-only.

### Edge Cases Found by Scout (requested checks)

| Check | Result |
|-------|--------|
| `activeAppId` null brand fallback | **Present.** Empty apps → `'CMC EDU'`. Non-empty apps → `apps[0].label` (see Medium #3). Removing `brand="CMC EDU"` does not leave `.o-brand` empty when navbar mounts. |
| Kanban media `width: 100%` on cards | **Present** on `.o-kanban-card` and `.o-kanban-empty` under `@media (max-width: 768px)`. |
| `brandCmc` + `evaluateAll` with zero `.o-brand` | **Safe.** Playwright runs the callback with `[]`; `.some(...)` → `false`; `.catch(() => false)` only for detach/eval errors. No throw; audit fails closed. `webwright-prod-smoke` uses `.first().textContent()` + length — also fails closed on missing brand. |

### Positive Observations
- Shell hardcode removal is the right lever; `OdooNavbar` already owned the module-label contract.  
- Playwright + shell unit now assert `.o-brand` / `Tổng quan` on cockpit — aligned with `NAV_MODULES`.  
- Narrow media explicitly shrinks cards (not only columns), which is the correct half of the responsive fix.

### Recommended Actions
1. Fix desktop `.o-kanban-col` vs card width interaction (**High #1**) before merge.  
2. Track or explicitly deskcope audit/smoke files (**High #2**).  
3. Decide unmatched-route brand vs `apps[0]` and add a null-`activeAppId` unit assert (**Medium #3**).  
4. Strengthen token/CSS assert for `width: 100%` (**Medium #4**).

### Metrics
- Type Coverage: n/a (review-only)  
- Test Coverage: unit/token green per cook-delta; **layout regression not covered**  
- Linting Issues: n/a (not re-run; no claims)

### Severity counts
| Severity | Count |
|----------|------:|
| Critical | 0 |
| High | 2 |
| Medium | 2 |
| Low | 3 |

### Unresolved Questions
- Should unmatched routes show product `'CMC EDU'` or first nav module label? Plan said fallback non-empty; did not specify which string for `activeAppId === null` with apps present.
