---
title: "Phase 1: Start / branch hygiene"
status: todo
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: Start — RED-TEAM REVISED

## Overview

Branch + workspace ready; hard hygiene gates before any schema work.

## Hard gates (fail cook if any fail)

- [x] Clean worktree **or** allowlist only plan/docs files  
- [x] Branch name contains `lms-foundation` or `unit-range` (not mixed breadcrumb UI commits)  
- [x] `ak plan use plans/260811-1117-lms-foundation-adr-va-spike-unit-range`  
- [x] Record `git rev-parse HEAD` in checklist  
- [x] Confirm no EnrollmentUnitRange yet; cmc-lms domain path exists  

## Implementation Steps

1. Create/switch `feat/lms-foundation-unit-range-spike` from clean base  
2. Pin plan  
3. Verify paths (domain-lms source, schema Enrollment/ClassBatch/CurriculumUnit)  
4. Do not edit finance/provision  

## Success Criteria

- [x] All hard gates checked  
