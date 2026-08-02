---
title: "Course create UI"
status: pending
priority: P0
effort: 2h
dependencies: []
---

# Phase 2: Course create UI

## Overview

Add create dialog on `/admin/courses` calling existing `course.create`.

## Requirements

- Functional: GĐĐT opens “+ Tạo khoá”, picks program + name, creates, list refreshes
- Non-functional: match classes dialog Astryx patterns

## Related Code Files

- Modify: `apps/admin/src/pages/courses/index.tsx`
- Create: `apps/admin/src/pages/courses/index.test.tsx`
- No API change: `apps/api/src/course/router.ts`

## Implementation Steps

1. Dialog + form state (program Selector from PROGRAM_VALUES, name TextInput)
2. `course.create.useMutation` + invalidate `course.list`
3. Unit tests: open dialog, disabled until valid, mutate payload

## Success Criteria

- [x] Create button visible for page already gated by course.manage
- [x] Tests green
