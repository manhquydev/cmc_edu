---
title: "Phase 4: Schema additive EnrollmentUnitRange va RLS"
status: todo
priority: P1
effort: "3–5d"
dependencies: [2, 3]
---

# Phase 4: Schema + RLS (additive) — RED-TEAM REVISED

## Overview

Add teaching entitlement model + batch neo anchors + program-scoped `orderGlobal`.  
**Not optional fluff** — spike cannot run without these.

## Hard contracts (from red-team)

1. **`EnrollmentUnitRange` MUST have denormalized `facilityId`** (copy from Enrollment in same TX). ENABLE + FORCE RLS + `facility_isolation` policy matching Enrollment. **No join-only RLS.**
2. **`CurriculumUnit.orderGlobal`** non-null after seed path; uniqueness **`@@unique([program, orderGlobal])`** (or documented equivalent). No range writes until this exists.
3. **`ClassBatch` neo fields required for spike:** `startUnitId`, `currentUnitId`, `currentUnitAnchor` (Date). Create-time defaults: current = start, anchor = startDate (date).
4. **ERP `Course` (facility-scoped) ≠ global unit catalog.** Teaching math uses `Program` + `CurriculumUnit.orderGlobal`. ClassBatch still has facility Course for ERP placement; stamp map = units of `batch.program`.
5. **One migration** = tables + FKs + indexes + RLS ENABLE/FORCE + grants to app role. Post-migrate: boot-check FORCE RLS.
6. **`Enrollment.archivedAt`** optional DateTime for day-gate (nullable).

## Models (minimum)

- [x] `EnrollmentUnitRange` (id, facilityId, enrollmentId, fromOrderGlobal, toOrderGlobal, createdAt; optional createdById)
- [x] CHECK from ≤ to (SQL)
- [x] ClassBatch startUnitId / currentUnitId / currentUnitAnchor FKs to CurriculumUnit
- [x] CurriculumUnit.orderGlobal Int + unique(program, orderGlobal)
- [x] Enrollment.archivedAt DateTime?

## Explicit non-goals this phase

- ExerciseFolder / SessionExercise  
- Drop isMakeup column  
- Change provision-from-receipt  
- Full multi-program CSV import (seed **one** program contiguous orders for tests)

## Related Code

- Modify: `packages/db/prisma/schema.prisma`
- Create: hand-written migration under `packages/db/prisma/migrations/`
- Pattern: existing FORCE RLS migrations + `apps/api/src/boot-checks.ts`
- Live ref: `cmc-lms/packages/db/prisma/schema.prisma` EnrollmentUnitRange (add facilityId for monorepo)

## Implementation Steps

1. ADR note in phase-02 already: orderGlobal immutability + Course vs Program map.  
2. Prisma models + migration all-or-nothing.  
3. Seed helper: one Program, N units with orderGlobal 1..N.  
4. RLS negative test template planned for phase 6.  
5. Extend test cleanup notes for EnrollmentUnitRange before Enrollment delete.

## Success Criteria

- [x] Fresh migrate + boot-check FORCE RLS  
- [x] Cannot insert range without facilityId  
- [x] Unique (program, orderGlobal) enforced  
- [x] Typecheck @cmc/db green  

## Risk Assessment

**High** topology change. Prefer additive columns. Expand-contract only.
