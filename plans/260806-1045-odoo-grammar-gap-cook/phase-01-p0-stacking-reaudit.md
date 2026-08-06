---
phase: 1
title: "P0 stacking ops checklist"
status: pending
priority: P0
effort: "ops / 2-4h when deploy ready"
dependencies: []
---

# Phase 1: P0 stacking ops checklist

## Overview

**Ops evidence track** — not on the cook critical path. Live-prove app-switcher hit-testing after admin image embeds navbar `z-index: 1000`. Does **not** block phases 2 or 4.

## Requirements

- Functional: document live `menuCoveredCount` from `design3-frontend-audit.mjs`
- Non-functional: unit stacking test remains regression-only (not substitute for live audit)

## Related Code Files

- Run: `apps/e2e/design3-frontend-audit.mjs`
- Prior: `outputs/design3-frontend-audit/results.json` (last: `menuCoveredCount: 7`)
- Regression: `packages/ui/src/odoo/odoo-shell-stacking.test.ts`
- CSS already: `packages/ui/src/odoo.css` `.o-navbar` z-index 1000

## Implementation Steps

1. When deploy embeds current `@cmc/ui`, re-run audit; stash JSON under this plan `reports/`.
2. If still non-zero: open minimal stacking fix cook (separate micro-phase) — do not mark stacking **SHIPPED** in evergreen map.
3. Unit test may be run anytime; never alone completes this phase for authority claims.

## Success Criteria

- [ ] Live audit artifact attached with `menuCoveredCount=0` **or** dated residual + owner
- [ ] Evergreen map does not claim stacking SHIPPED until zero
- [ ] Phases 2/4 not waiting on this phase

## Risk Assessment

Deploy lag delays evidence only. Mitigate: keep grammar cook (brand/kanban) moving.

<!-- Updated: Red Team Session 1 - demote off cook path; no blocker-as-done for SHIPPED -->
