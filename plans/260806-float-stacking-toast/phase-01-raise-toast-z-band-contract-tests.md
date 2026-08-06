---
phase: 1
title: Raise toast z-band + contract tests
status: completed
priority: P1
dependencies: []
---

# Phase 1: Raise toast z-band + contract tests

## Overview

Move toast viewport above navbar and below command palette; lock with unit CSS contracts.

## Related Code Files

- Modify: `packages/ui/src/odoo.css` (`.ck-toast-viewport`)
- Modify: `packages/ui/src/odoo/odoo-float-layer.test.ts`

## Implementation Steps

1. Set `.ck-toast-viewport { z-index: 1100 }`
2. Assert toast z ≥ 1100, cmd z ≥ 1200, toast < cmd; navbar z from shell test remains ≥100

## Success Criteria

- [ ] `pnpm --filter @cmc/ui test` float + shell stacking green
