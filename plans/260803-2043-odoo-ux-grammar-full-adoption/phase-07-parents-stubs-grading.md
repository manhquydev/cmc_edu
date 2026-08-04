---
phase: 7
title: "Parents stubs grading"
status: completed
priority: P1
effort: "4–8h"
dependencies: [2]
---

# Phase 7: Parents, stubs, grading chrome

## Overview

Finish remaining off-frame product surfaces: parents hub, engagement stubs, grading chrome (MasterDetail preserved).

## Requirements

- Functional:
  - parents/index → ListPage or Detail-style hub with frame (prefer ListPage if table; else FormPage/tabs under ListPage header).
  - leaderboard → ListPage + EmptyState.
  - grading → keep MasterDetail; wrap with consistent PageHeader inside ListPage **or** documented exemption in VIEW-GRAMMAR as “split ops view” if ListPage breaks layout — prefer ListPage with MasterDetail as body.
- Non-functional: grading tests pass.

## Related Code Files

- Modify: `parents/index.tsx`, `engagement/leaderboard.tsx`, `teaching/grading.tsx` (+ tests)
- Exempt unchanged: `teaching/pdf-annotator.tsx`

## Implementation Steps

1. parents → frame.
2. leaderboard stub → ListPage + EmptyState.
3. grading → ListPage shell if possible; else document exemption + PageHeader-only allowed in VIEW-GRAMMAR.
4. Run grading.test.tsx.

## Success Criteria

- [x] parents + leaderboard on frames
- [x] grading tests pass
- [x] VIEW-GRAMMAR lists any remaining intentional exemption
  - No new exemption needed: grading uses ListPage + MasterDetail body (not PageHeader-only)

## Risk Assessment

MasterDetail height calc — avoid fixed 100vh hacks; use flex min-height 0 patterns from premium.
