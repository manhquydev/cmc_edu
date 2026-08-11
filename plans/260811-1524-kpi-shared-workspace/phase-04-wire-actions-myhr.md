---
phase: 4
title: "Form actions + my-hr links"
status: completed
priority: P1
effort: "2-3h"
dependencies: [3]
---

# Phase 4: Wire form actions + my-hr

## Overview
Form: confirm / override / submitSlip / refresh when allowed. my-hr: deep link to form id when score exists.

## Requirements
- Mirror server gates in UI (same as board)  
- After mutate: invalidate get + list  
- my-hr: “Mở phiếu” → kpiScore(id)  
- listBackPath with period in state optional  

## Related Code Files
- Modify: `kpi-detail.tsx`  
- Modify: `my-hr.tsx`  
- Modify tests  

## Success Criteria
- [ ] Form can confirm/override with dialogs  
- [ ] my-hr links to form  
