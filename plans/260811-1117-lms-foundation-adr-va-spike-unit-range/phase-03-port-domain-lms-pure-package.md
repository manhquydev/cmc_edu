---
title: "Phase 3: Port domain-lms pure package"
status: todo
priority: P1
effort: "0.5–1d"
dependencies: [2]
---

# Phase 3: Port `@cmc/domain-lms` — REVISED

## Overview

Clone monorepo `domain-grading` skeleton. Port **unit-progression** (+ tests) first.  
Do **not** port session-schedule unless replacing generate-sessions (explicit).

## Requirements

- [x] Package under `packages/domain-lms` (workspace `packages/*` already covers)  
- [x] Wire `apps/api` dependency `"@cmc/domain-lms": "workspace:*"`  
- [x] Port `unit-progression.ts` + tests; export isEntitled, deriveSessionUnits, validateNewRange, remainingUnits, SESSIONS_PER_UNIT  
- [x] Order→unitId map stays in **API layer**, not domain  
- [x] Package tests green  

## Non-goals

- facility/auth in domain  
- Overlap checks that need DB (API layer, port from live enrollment router)  

## Success Criteria

- [x] Filter test green; api can import package  
