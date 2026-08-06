---
phase: 1
title: RED Playwright contract
status: completed
priority: P1
dependencies: []
---

# Phase 1: RED Playwright contract

## Overview

Write the failing Playwright UI contract for DetailPage thin statusbar grammar **before** the shared helper exists. Tests define the public API of `openSeededDetail` and sticky assertions.

## Requirements

- Functional: spec imports `openSeededDetail` + asserts sticky statusbar / non-sticky summary on receipt and opportunity detail.
- Non-functional: hard-fail language when no seeded row (assert error message shape once helper lands — stub throw OK in RED).
- Mode: TDD RED — suite must fail (missing module or failing asserts).

## Architecture

```text
design3-statusbar.ui.spec.ts
  → login (via helper or temporary inline until phase 2)
  → openSeededDetail(page, 'receipt' | 'opportunity')
  → measure computed style on .o-detail-statusbar / .o-detail-summary
```

Viewport ≥1280 so md+ sticky rules apply (match `odoo.css`).

## Related Code Files

- Create: `apps/e2e/tests/design3-statusbar.ui.spec.ts`
- Ref (do not edit): `packages/ui/src/odoo.css` (sticky md+), `detail-page.tsx`
- Import target (not created yet): `apps/e2e/src/design3/open-seeded-detail.ts`

## TDD

| Step | Action |
|------|--------|
| Tests Before | Write full spec expecting helper exports `loginAsSuperAdmin`, `openSeededDetail`, sticky contracts |
| Refactor | None in this phase |
| Tests After | N/A (RED) |
| Regression Gate | `pnpm --filter @cmc/e2e exec playwright test design3-statusbar` **fails** as expected |

## Implementation Steps

1. Add `design3-statusbar.ui.spec.ts` under `apps/e2e/tests/`.
2. Spec flow: login → open receipt detail → assert `.o-detail-statusbar` `position === 'sticky'` and summary not sticky → same for opportunity.
3. Import from `../src/design3/open-seeded-detail.js` (TS emit/playwright path).
4. Run once; capture RED failure reason (module not found = success for RED).

## Success Criteria

- [ ] Spec file committed with clear assert names
- [ ] Command fails because helper missing (or explicit `test.fail` removed once green)
- [ ] No production CSS/TS product code changes

## Risk Assessment

- CI baseURL differs from prod HTTPS — gate production-only sticky smoke in phase 3; Playwright may target local preview with seed from e2e global setup. Prefer **same URL policy as other admin UI specs** in `playwright.config.ts`. If sticky needs prod CSS rebuild, document `@ops` / skip if `!process.env.DESIGN3_OPS_BASE`.
- Mitigate: assert DOM presence of `.o-detail-statusbar` in CI always; sticky computed-style assert when `DESIGN3_OPS_BASE` or tag `@live-prod` for ops.
