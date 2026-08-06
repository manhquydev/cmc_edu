---
phase: 2
title: Brand module name
status: completed
priority: P1
effort: 0.5d
dependencies: []
---

# Phase 2: Brand module name

## Overview

Remove shell hardcode so navbar shows **active module label** (`OdooNavbar` default). Update every assert that still requires literal `CMC EDU`.

## Requirements

- Functional: `.o-brand` = active module label when navigating modules
- Non-functional: same commit updates unit, Playwright, design3 audit brand metric, webwright smoke

## Related Code Files

- Modify: `apps/admin/src/shell/shell.tsx` (remove `brand="CMC EDU"`)
- Read: `packages/ui/src/odoo/odoo-navbar.tsx` (`brand ?? activeApp?.label …`)
- Tests: `apps/admin/src/shell/shell.test.tsx`, `apps/e2e/tests/admin-shell.ui.spec.ts`
- **Must update:** `apps/e2e/design3-frontend-audit.mjs` (`brandCmc` → non-empty / module label)
- **Must update:** `apps/e2e/webwright-prod-smoke.mjs`

## Implementation Steps

1. Close open Q: ship `NAV_MODULES` labels as-is (VN) unless validate chooses otherwise.
2. Remove `brand="CMC EDU"` override.
3. Update all four assert surfaces in one commit.
4. Smoke two modules; confirm `.o-brand` changes.

## Success Criteria

- [ ] No shell hardcode brand
- [ ] Unit + Playwright + audit + smoke asserts aligned
- [ ] Fallback still non-empty

## Risk Assessment

Audit false failure if brand metric forgotten — mitigated by explicit file list.

<!-- Updated: Red Team Session 1 - expand dependents; drop dep on phase 1 -->
