---
title: "Phase 4: Residual confirm matrix"
status: completed
priority: P1
effort: "1h"
dependencies: [1]
---

# Phase 4: Residual confirm matrix

## Overview

Gate irreversible/hard-to-undo ops still missing ConfirmDialog: guardian reject + enrollment place.

## Related Code Files

- Modify: `apps/admin/src/pages/parents/index.tsx`
- Modify: `apps/admin/src/pages/enrollment/class-placement.tsx`
- Modify tests if present: `parents/index.test.tsx`

## Implementation Steps

1. **Reject:** open ConfirmDialog (destructive) → mutate only on confirm; toast on success (phase 3).
2. **Enroll:** ConfirmDialog before `enroll.mutate` with student name + class code; toast on success.
3. Do **not** add ConfirmDialog to payroll.

## Success Criteria

- [ ] Reject button opens dialog; cancel does not mutate
- [ ] Enroll button opens dialog; cancel does not mutate
