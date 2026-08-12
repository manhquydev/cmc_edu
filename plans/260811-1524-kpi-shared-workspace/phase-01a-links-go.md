---
phase: 1a
title: "links.kpiScore + go"
status: completed
priority: P1
effort: "1h"
dependencies: [0]
---

# Phase 1a: links.kpiScore (TDD)

## Overview
Add shareable form path builders for KpiScore UUID.

## Requirements
- `links.kpiScore = (id) => /hr/kpi/${id}`  
- `resolveGo('kpiScore', uuid)` works  
- Optional: `kpiScoresPath({ period?, status? })` for board query  

## Related Code Files
- Modify: `packages/links/src/index.ts`  
- Modify: `packages/links/src/index.test.ts`  
- Build: `pnpm --filter @cmc/links build`

## Implementation Steps (TDD)
1. Write failing tests for path + go + invalid uuid  
2. Implement links.kpiScore (+ board path helper if needed)  
3. Rebuild package dist  

## Success Criteria
- [ ] links tests green including kpiScore  
