---
phase: 2
title: "Leave-guard attendance"
status: pending
priority: P1
effort: "2h"
dependencies: [1]
---

# Phase 2: Leave-guard attendance

## Overview

Wire `useUnsavedBlocker` when attendance has local dirty state (`!saved` after toggles with session selected).

## Requirements

- Functional: dirty = session selected && at least one local toggle since last save (existing `saved===false` after toggle is enough once roster loaded)  
- Do not block when nothing marked / pristine after load  
- Copy VN: title "Rời trang điểm danh?", message about unsaved marks  

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/attendance.tsx`  
- Modify: `apps/admin/src/pages/teaching/attendance.test.tsx`  

## Implementation Steps

1. `dirty = Boolean(sessionId) && !saved && Object.keys(localStatus).length > 0` — refine: after load setSaved(false) but localStatus may be seeded from server → only dirty if user toggled.  
   **Better:** track `dirty` boolean set true on toggleStatus; false on successful save and on session change.  
2. Render ConfirmDialog from hook.  
3. Test: toggle → navigate attempt → dialog (if testable); at minimum unit test dirty flag + blocker integration.  

## Success Criteria

- [x] Toggle then attempt leave shows confirm  
- [x] Save clears dirty  
- [x] Existing markAll tests still pass  

## Risk Assessment

- Seeding localStatus from server must not mark dirty.
