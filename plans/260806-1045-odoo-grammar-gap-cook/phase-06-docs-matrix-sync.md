---
phase: 6
title: Docs delta in PR
status: completed
priority: P2
effort: 1-2h
dependencies:
  - 2
  - 4
---

# Phase 6: Docs delta in PR

## Overview

Lightweight evergreen sync **in the same cook PR** after brand + kanban. Record Phase 3 deferred + Phase 5 cut as matrix debt.

## Requirements

- Functional: brand + kanban responsive rows match code; Phase 3/5 marked deferred/cut with reason
- Non-functional: `reports/cook-delta.md`

## Related Code Files

- `design-system/cmc-edu/ODOO-COMPONENT-MAP.md`
- `plans/260806-1045-odoo-grammar-gap-cook/reports/cook-delta.md`

## Implementation Steps

1. Update brand + kanban statuses after phases 2+4.
2. Note: statusbar sticky PARTIAL (await thin split); list sticky/Astryx scroll PARTIAL (debt).
3. Never claim stacking SHIPPED without Phase 1 live zero.

## Success Criteria

- [ ] Map matches cook outcome
- [ ] Debt one-liners for deferred Phase 3 + cut Phase 5
- [ ] cook-delta lists files

<!-- Updated: Validation Session 1 - cook path 2+4 only -->
