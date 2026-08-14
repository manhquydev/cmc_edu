---
title: "Phase 2: Implement Parents empty honesty"
status: todo
---

# Phase 2: Implement Parents empty honesty

## Overview

Replace terse empty strings with richer under-claim consts (Students style).
Extend `parents/index.test.tsx`. Do **not** import EmptyState solely for this;
do **not** pass `TableEmptySpec`.

## Target

- Modify: `apps/admin/src/pages/parents/index.tsx`
- Modify: `apps/admin/src/pages/parents/index.test.tsx`

## Requirements

- Functional: implement Phase 1 matrix copy
- Functional: search+`missing` empty must name missing-email constraint
- Non-functional: no create/add verbs in empty copy
- Non-functional: no `data-empty-kind` on these empties
- Tests: mock `{ items:[], total:0 }`; assert copy; assert `document.querySelector('[data-empty-kind]')` null
- Tests for all-parents: `sessionRoles = ['sale']` and assert tab/table present before copy asserts
- Design note only: never invent create CTA (do not assert "button absent" as sole proof)

## Implementation Steps

1. Add named consts near top of `parents/index.tsx` (mirror Students comment about why kindless).
2. Requests tab: single const for empty.
3. AllParentsTab: branch on `emailFilter` × `debouncedSearch` (applied search only).
4. Extend tests:
   - requests empty → expected copy + kind null
   - all-parents missing / no search → expected copy + kind null
   - all-parents missing / search → copy mentions email constraint + kind null
   - all-parents all / search → search-zero copy + kind null
   - (optional) all / no search / total 0 → facility-empty copy
5. Run ` vitest` for parents page; admin typecheck if needed.

## Success Criteria

- [x] Matrix copy live
- [x] Tests green; kind null asserted
- [x] No TableEmptySpec / no invent CTA in diff

## Risk Assessment

- Copy too long for ops density — keep one short sentence + optional second clause.
- Debounce: assert using applied search path only (same as Classes).

<!-- Updated: Validation Session 1 - kindless; role precondition; no phantom create test -->
