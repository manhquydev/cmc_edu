---
phase: 1
title: "Coordination brief + VIEW-GRAMMAR amend"
status: pending
priority: P1
effort: "1h"
dependencies: []
---

# Phase 1: Coordination brief + VIEW-GRAMMAR amend

## Overview

Lock structure-depth rules into VIEW-GRAMMAR and mark plan active in ak store.

## Requirements

- Document single-h1 rule, ControlBar surface, HighlightStrip, RelatedList future
- Link research report
- ak plan update in-progress

## Related Code Files

- Modify: `design-system/cmc-edu/VIEW-GRAMMAR.md`, optionally PAGE-FRAMES.md
- Create: `plans/.../reports/coordination-brief.md` (optional)

## Implementation Steps

1. Amend VIEW-GRAMMAR § Detail: breadcrumbs-only PageHeader when EntityHeader present.
2. Add § HighlightStrip + ControlBar surface notes.
3. `ak plan update cmc_edu/260803-1407 --status in-progress`
4. `ak plan validate` this plan dir

## Success Criteria

- [x] VIEW-GRAMMAR updated with single-h1 + highlight + control surface
- [x] Plan store status in-progress
- [x] `ak plan validate` exits 0
