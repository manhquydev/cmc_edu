---
title: Float stacking toast above navbar (xia)
description: >-
  Raise .ck-toast-viewport above navbar (1000) and below command palette (1200);
  document stacking table. From xia float compare 260806.
status: completed
priority: P1
branch: feat/design3-admin-rollout
tags:
  - design3
  - odoo
  - float
  - stacking
blockedBy: []
blocks: []
created: '2026-08-06T04:53:04.711Z'
createdBy: 'ck:plan'
source: skill
---

# Float stacking toast above navbar (xia)

## Overview

Odoo notifications sit at z≈1055 (modal band). CMC toast at 60 loses to `.o-navbar` 1000. Raise toast to **1100**, keep `.ck-cmd` at **1200**.

**Authority:** `plans/reports/xia-compare-260806-odoo-float-layers.md`

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Raise toast z-band + contract tests](./phase-01-raise-toast-z-band-contract-tests.md) | Completed |
| 2 | [Docs map stacking table](./phase-02-docs-map-stacking-table.md) | Completed |

## Acceptance

- [ ] `.ck-toast-viewport` z-index = 1100
- [ ] Tests assert navbar < toast < cmd
- [ ] ODOO-COMPONENT-MAP + STYLING-BRIDGE stacking table updated
