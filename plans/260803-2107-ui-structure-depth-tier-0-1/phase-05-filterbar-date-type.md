---
phase: 5
title: "FilterBar date type"
status: pending
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 5: FilterBar date type

## Overview

Extend FilterDef with `type: 'date'` (and optional `daterange` if cheap) for ops lists.

## Requirements

- FilterBar renders date input (native or Astryx if available)
- URL sync for uncontrolled; controlled value/onChange still works
- Unit test for date filter render + change

## Related Code Files

- Modify: `filter-bar.tsx`, filter-bar tests if any, create test
- Optional pilot: schedule or attendance list

## Success Criteria

- [x] `type: 'date'` supported
- [x] Tests pass
- [x] llms.txt mention optional
