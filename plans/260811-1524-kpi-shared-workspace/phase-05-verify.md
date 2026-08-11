---
phase: 5
title: "Verify"
status: completed
priority: P1
effort: "1h"
dependencies: [4]
---

# Phase 5: Verify

## Overview
Full focused verification for cook gate.

## Steps
1. `pnpm --filter @cmc/links test`  
2. API: `vitest run src/kpi/` with DATABASE_URL  
3. Admin: kpi + kpi-detail + my-hr tests  
4. tsc touch surfaces  
5. Update phase statuses; short report under `plans/reports/`  

## Success Criteria
- [ ] All above green  
- [ ] No new “Duyệt KPI” in admin nav  
