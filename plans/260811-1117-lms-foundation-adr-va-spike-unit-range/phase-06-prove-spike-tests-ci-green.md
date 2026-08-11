---
title: "Phase 6: Prove spike tests CI green"
status: todo
priority: P1
effort: "1d"
dependencies: [5]
---

# Phase 6: Prove + ship note — REVISED

## Overview

Foundation cook-complete with concrete command list and contracts for plan 2/3.

## Test harness (mandatory)

- [x] cleanupFacility deletes EnrollmentUnitRange before Enrollment  
- [x] seedEnrollmentWithUnits helper  
- [x] seedCurriculumUnit sets orderGlobal  

## Commands (adjust to monorepo scripts)

- [x] domain-lms unit tests  
- [x] spike integration tests  
- [x] provisioning + finance approve regression  
- [x] typecheck db + api  

## Ship note (`plans/reports/ship-lms-foundation-spike.md`)

Must include:
- Procedure freeze (enroll vs grantUnits)  
- orderGlobal unique(program, orderGlobal)  
- facilityId on ranges  
- create+stamp TX contract  
- open-tier still live (side effect note)  
- plan 2 entry checklist  

## Success Criteria

- [x] All above green  
- [x] Plan 2 unblocked by contracts, not only “tests green”  
