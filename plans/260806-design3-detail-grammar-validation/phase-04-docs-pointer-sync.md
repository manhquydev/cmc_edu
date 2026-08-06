---
phase: 4
title: Docs pointer sync
status: completed
priority: P2
dependencies:
  - 3
---

# Phase 4: Docs pointer sync

## Overview

Point dissection / VIEW-GRAMMAR / agent map at the two-layer validation commands so future Odoo grammar cooks reuse the harness instead of inventing new scrapers.

## Requirements

- Functional: document ops command + Playwright file + hard-fail seed policy.
- Non-functional: no product behavior change.

## Related Code Files

- Modify (pointers only): `plans/260806-odoo-ui-component-dissection/AGENT-COMMAND-MAP.md` (L8 Test lane)
- Modify (optional 1 para): `design-system/cmc-edu/VIEW-GRAMMAR.md` or `ODOO-COMPONENT-MAP.md` statusbar row
- Ref: brainstorm report already authoritative for design

## TDD

| Step | Action |
|------|--------|
| Tests Before | N/A (docs) |
| Refactor | Docs only |
| Tests After | N/A |
| Regression Gate | Links resolve in-repo |

## Implementation Steps

1. Add L8 bullet: Playwright `design3-statusbar.ui.spec.ts` + `pnpm exec tsx apps/e2e/smoke-statusbar.ts`.
2. Note: list rows use onRowClick — never validate detail via href scrape.
3. Cross-link brainstorm report path.

## Success Criteria

- [ ] Agent map L8 mentions both layers
- [ ] Statusbar grammar docs mention sticky proof command
- [ ] No conflicting “scrape href” guidance left in those files

## Risk Assessment

Low — docs drift only.
