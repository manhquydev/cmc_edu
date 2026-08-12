---
phase: 2
title: "Routes + form shell"
status: completed
priority: P1
effort: "3h"
dependencies: [1a, 1b]
---

# Phase 2: Routes + KPI form page

## Overview
`/hr/kpi/:scoreId` DetailPage shell: load get, statusbar, CopyLinkButton, placeholders for actions.

## Requirements
- Route static order: `kpi` list, then `kpi/:scoreId`  
- Invalid uuid → EmptyState  
- Loading / error / success states  
- Statusbar: Nháp → Chờ xác nhận → Đã xác nhận → Đã duyệt (terminal branches OK)  
- CopyLinkButton mode=go entity=kpiScore  

## Related Code Files
- Modify: `apps/admin/src/routes/hr.routes.tsx`  
- Create: `apps/admin/src/pages/hr/kpi-detail.tsx`  
- Create: `apps/admin/src/pages/hr/kpi-detail.test.tsx`  

## Implementation Steps (TDD)
1. Form tests with mocked get + useParams mock (no nested MemoryRouter)  
2. Implement form page  
3. Wire route  

## Success Criteria
- [ ] detail tests pass  
- [ ] tsc clean on touched files  
