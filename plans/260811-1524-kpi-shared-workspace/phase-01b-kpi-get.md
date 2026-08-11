---
phase: 1b
title: "kpi.get cold-start"
status: completed
priority: P1
effort: "2-3h"
dependencies: [0]
---

# Phase 1b: kpi.get (TDD)

## Overview
Cold-start load for form `/hr/kpi/:scoreId`.

## Requirements
- Input: `{ scoreId: uuid }`  
- Facility-scoped `withFacility`  
- Include: appUser `{ id, fullName, userId, managerId, roles }`  
- Access:  
  - owner (score.appUserId === caller AppUser.id)  
  - super_admin  
  - confirm path: managerId match (same as confirm)  
  - OR director with `kpi.approve` / `kpi.confirm` AND branch role match (`allowedKpiTargetRoles`)  
- Errors: NOT_FOUND, FORBIDDEN  

## Related Code Files
- Modify: `apps/api/src/kpi/router.ts`  
- Create: `apps/api/src/kpi/get.test.ts`  

## Implementation Steps (TDD)
1. Write get.test.ts cases: owner, manager, wrong manager, wrong track GĐ, peer, not found, super_admin  
2. Implement `get` procedure  
3. Run vitest with DATABASE_URL  

## Success Criteria
- [ ] get tests ≥ 5 green  
- [ ] Existing kpi lifecycle tests still green  

## Risk Assessment
Do not weaken managerId rule for confirm; get only reads.
