---
phase: 4
title: "formatRole consistency + toast coverage"
status: pending
priority: P2
effort: "1h"
dependencies: []
---

# Phase 4: formatRole consistency + toast coverage

## Overview

Eliminate dual role label maps on users admin; ensure toast on Sprint B commit paths (may be done in phase 3).

## Related Code Files

- Modify: `apps/admin/src/pages/admin/users.tsx`  
- Modify: `apps/admin/src/pages/admin/users.test.tsx` if labels asserted  

## Implementation Steps

1. Remove local ROLE_LABELS duplicates; import `formatRole`, `ROLE_LABELS` or map ACTIVE_ROLES via formatRole.  
2. Table role badges use formatRole.  
3. Smoke test labels if tests check strings.  

## Success Criteria

- [x] No local Super Admin vs Quản trị hệ thống split for same key in users UI  
- [x] Typecheck + users tests pass  

## Risk Assessment

- Option labels change slightly for create-user form — intentional product language unification.
