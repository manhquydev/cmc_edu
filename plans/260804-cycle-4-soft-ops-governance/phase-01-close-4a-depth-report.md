---
phase: 1
title: Close 4a depth report
status: completed
priority: P1
effort: S
dependencies: []
---

# Phase 1: Close 4a depth report

## Overview

Verify prior cook for MS-1/2/4 (detail tiers + check-ui-frames depth report). **Do not re-implement** if verification green — only fill gaps.

## Requirements

- Functional: PAGE-FRAMES tiers full|standard|settings|thin; script reports detailTiers + FilterBar + ListPagination; dual-title/bulk strict still works.
- Non-functional: no new strict gates on thin/settings.

## Related Code Files

- Verify: `design-system/cmc-edu/PAGE-FRAMES.md`, `VIEW-GRAMMAR.md`
- Verify: `scripts/check-ui-frames.mjs`, `scripts/check-ui-frames.test.mjs`
- Verify: `packages/ui/llms.txt`
- Verify: lab inventory Detail partial + red-team H6

## Implementation Steps

1. Run `node --test scripts/check-ui-frames.test.mjs`.
2. Run `node scripts/check-ui-frames.mjs --strict` and confirm JSON tiers:
   - full ≥2 (receipt, opportunity)
   - standard ≥2 (student, class)
   - settings ≥3
   - thin includes payroll + my-hr
3. Grep PAGE-FRAMES for `full | standard | settings | thin` table.
4. If any gap: patch only missing piece (docs/script/test/lab).
5. Mark phase complete when criteria pass.

## Success Criteria

- [x] check-ui-frames tests pass (3/3, 2026-08-04)
- [x] --strict exit 0 · dualTitle=0 · bulkListsOk
- [x] detailTiers classifies 9 DetailPages into 4 buckets (2/2/3/2)
- [x] PAGE-FRAMES §C tiers present
- [x] No product EntityHeader forced onto settings pages

## Risk Assessment

- False re-cook wastes time → **verify-first**.
- Misclassification thin vs standard → trust SettingsShell/EntityHeader/Workflow heuristics already in script.

## Validation commands

```bash
node --test scripts/check-ui-frames.test.mjs
node scripts/check-ui-frames.mjs --strict
```
