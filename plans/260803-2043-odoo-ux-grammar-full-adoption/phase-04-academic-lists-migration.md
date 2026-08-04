---
phase: 4
title: "Academic lists migration"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 4: Academic lists migration

## Overview

Migrate high-traffic academic list screens onto ListPage + ControlBar grammar with quality gates (tests green before done).

## Requirements

- Functional: students list, classes list, courses list, class-placement use ListPage (density ops where tables dominate).
- Preserve existing tRPC queries, permissions, dialogs, create flows.
- Non-functional: existing/page tests updated and green.

## Related Code Files

- Modify:
  - `apps/admin/src/pages/students/index.tsx` (+ tests if any)
  - `apps/admin/src/pages/classes/index.tsx` (+ `index.test.tsx`)
  - `apps/admin/src/pages/courses/index.tsx` (+ tests)
  - `apps/admin/src/pages/enrollment/class-placement.tsx`
- Do not modify: student-detail, class-detail (already DetailPage)

## Implementation Steps

1. students/index → ListPage + PageHeader + existing search as filters slot (FilterBar if fit).
2. classes/index → ListPage; keep create dialogs.
3. courses/index → ListPage.
4. class-placement → ListPage or FormPage if wizard-dominant (prefer ListPage if table-first).
5. Run page tests; fix selectors only when structure changed intentionally.

## Success Criteria

- [x] Four paths use ListPage (grep)
- [x] class list tests pass
- [x] No permission/behavior regressions

## Risk Assessment

Class create dialog coupling to layout — keep dialogs outside body; only wrap chrome.
