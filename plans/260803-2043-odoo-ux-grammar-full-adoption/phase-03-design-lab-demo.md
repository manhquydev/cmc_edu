---
phase: 3
title: "Design Lab demo"
status: pending
priority: P2
effort: "2–3h"
dependencies: [2]
---

# Phase 3: Design Lab demo

## Overview

Living inventory at `/design` shows ControlBar + ListPage recipe so reviewers and agents share a visual source of truth.

## Requirements

- Functional: Design Lab section demos sticky ControlBar with PageHeader, FilterBar, ListPagination, fake table shell.
- Non-functional: no product route breakage; inventory table notes ControlBar = ok.

## Related Code Files

- Modify: `apps/admin/src/pages/design-lab.tsx` (+ css if needed)
- Create: none required

## Implementation Steps

1. Import ControlBar + ListPagination.
2. Replace/extend listops section with full recipe demo.
3. Update inventory row for Detail/List frames to mention ControlBar.

## Success Criteria

- [x] `/design` shows ControlBar composite without console errors
- [x] Inventory status reflects ControlBar shipped

## Risk Assessment

Low — demo only.
