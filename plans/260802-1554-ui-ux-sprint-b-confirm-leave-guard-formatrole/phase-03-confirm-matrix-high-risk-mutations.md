---
phase: 3
title: "Confirm matrix high-risk mutations"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 3: Confirm matrix (high-risk teaching)

## Overview

Gate irreversible / parent-visible teaching mutations with ConfirmDialog + toast on success.

## In scope (must confirm)

| Action | File | Message gist |
|--------|------|----------------|
| exercise.publish | `teaching/exercises.tsx` | Học sinh có thể nộp bài |
| exercise.close | `teaching/exercises.tsx` | Không nhận bài mới |
| sessionEvidence.publish | `teaching/session-evidence.tsx` | Phụ huynh sẽ thấy |

## Out of scope (do not confirm)

| Action | Why |
|--------|-----|
| payslip.finalize / reopen | `payroll.test.tsx` forbids ConfirmDialog |
| attendance.markAll | high frequency; already has validation |
| submission.grade | high frequency; toast only |

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/exercises.tsx` + test  
- Modify: `apps/admin/src/pages/teaching/session-evidence.tsx` + test  

## Implementation Steps

1. State `pendingPublishId` / `pendingCloseId` / `publishConfirmOpen`.  
2. ConfirmDialog loading tied to mutation.isPending.  
3. onSuccess: toast + invalidate (existing patterns).  
4. Update tests: mutate only after confirm click (mirror shifts.test).  

## Success Criteria

- [x] Direct row button does not call mutate until ConfirmDialog confirm  
- [x] Toast success after each  
- [x] Tests green  

## Risk Assessment

- Label "Publish" EN → keep or "Công bố" (prefer Việt for confirm title).
