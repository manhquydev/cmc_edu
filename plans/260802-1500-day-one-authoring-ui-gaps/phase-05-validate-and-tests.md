---
title: "Validate and tests"
status: pending
priority: P0
effort: 1h
dependencies: [2, 3, 4]
---

# Phase 5: Validate and tests

## Overview

Run focused admin unit tests; optional ensure script smoke; red-team checklist on SoD.

## Implementation Steps

1. `pnpm --filter @cmc/admin test` focused on courses
2. Typecheck admin if needed
3. Run ensure script against local-sim DB if up
4. Confirm no packages/auth changes

## Success Criteria

- [x] Course tests pass
- [x] Curriculum ensure works on empty DB
- [x] Report completion
