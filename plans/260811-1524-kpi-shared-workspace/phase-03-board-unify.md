---
phase: 3
title: "Board unify + list self-scope"
status: completed
priority: P1
effort: "3-4h"
dependencies: [2]
---

# Phase 3: Board as shared workspace

## Overview
Refactor `/hr/kpi` list to resource board: period + status filters; row opens form; bulkApprove toolbar; title “Phiếu KPI” / “KPI”.

## Requirements
- PageHeader title **KPI** / subtitle phiếu  
- Row action **Mở phiếu** → `links.kpiScore(id)`  
- Extend `kpi.list` for callers with only submitSlip: **self rows only**  
- Directors: keep existing branch-scoped list  
- bulkApprove remains on board  

## Related Code Files
- Modify: `apps/api/src/kpi/router.ts` (`list`)  
- Modify: `apps/api/src/kpi/lifecycle.test.ts` or list tests  
- Modify: `apps/admin/src/pages/hr/kpi.tsx`  
- Modify: `apps/admin/src/pages/hr/kpi.test.tsx`  

## Implementation Steps (TDD)
1. API test: sale list returns only own  
2. UI: navigate on Mở phiếu; breadcrumbs KPI  
3. Keep confirm/override on board **or** move primary to form in phase 4 — prefer keep secondary on board for density  

## Success Criteria
- [ ] Staff can list own slips if nav open; GĐ still sees branch  
- [ ] Board tests green  
