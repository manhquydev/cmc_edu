---
phase: 0
title: "Nav + authority wire"
status: completed
priority: P1
effort: "1h"
dependencies: []
---

# Phase 0: Nav + authority

## Overview
Make IA match resource-centric law: label **KPI**, not Duyệt KPI; cite structure authority in plan only (doc already locked).

## Requirements
- Functional: nav-registry leaf id `kpi` label `KPI`
- Visibility: show leaf if `canDo('kpi','confirm') || canDo('kpi','submitSlip')` if registry supports custom visibility; else keep `kpi.confirm` for GĐ and staff reach KPI via my-hr link until phase 3
- Non-functional: update any e2e `menuNav(..., 'Duyệt KPI')`

## Related Code Files
- Modify: `apps/admin/src/shell/nav-registry.ts`
- Modify: `apps/admin/src/shell/**/*.test.*` if label asserted
- Modify: e2e journeys that hardcode Duyệt KPI

## Implementation Steps
1. Rename label Duyệt KPI → KPI  
2. Prefer dual visibility: confirm OR submitSlip (if `isNavChildVisible` allows OR/custom; else document GĐ-only nav + form deep link for staff)  
3. TDD: nav test expects “KPI”

## Success Criteria
- [ ] UI shows KPI under Nhân sự  
- [ ] No string “Duyệt KPI” in nav-registry  

## Risk Assessment
menuNav string drift — grep e2e for Duyệt KPI.
