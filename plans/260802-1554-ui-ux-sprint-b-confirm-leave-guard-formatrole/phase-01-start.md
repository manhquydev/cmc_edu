---
phase: 1
title: "Foundation: useUnsavedBlocker"
status: pending
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Foundation — useUnsavedBlocker

## Overview

Shared SPA leave-guard primitive: when `dirty`, block route changes via react-router `useBlocker` and offer ConfirmDialog.

## Requirements

- Functional: `useUnsavedBlocker({ dirty, title?, message? })` returns dialog props + blocker control  
- Non-functional: no new deps; ConfirmDialog from `@cmc/ui`; works under MemoryRouter tests  

## Related Code Files

- Create: `apps/admin/src/lib/use-unsaved-blocker.ts`  
- Create: `apps/admin/src/lib/use-unsaved-blocker.test.tsx` (optional light)  

## Implementation Steps

1. Implement hook with `useBlocker` from `react-router-dom` (v7).  
2. When dirty && blocker.state === 'blocked', open ConfirmDialog.  
3. Confirm leave → `blocker.proceed()`; cancel → `blocker.reset()`.  
4. Optional: window `beforeunload` when dirty.  

## Success Criteria

- [x] Hook exported and typed  
- [x] Unit test or attendance test proves dialog on navigation attempt when dirty  

## Risk Assessment

- MemoryRouter may need `future` flags — verify in vitest. Fallback: document manual navigation spy if useBlocker limited in tests.
