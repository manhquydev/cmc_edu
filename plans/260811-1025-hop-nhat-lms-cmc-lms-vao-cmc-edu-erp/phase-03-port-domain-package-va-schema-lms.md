---
title: "Phase 3: Port domain package va schema LMS"
status: todo
priority: P1
effort: "3–5d"
dependencies: [2]
---

# Phase 3: Port domain package + schema

## Overview

Mang pure domain rules từ `cmc-lms/packages/domain` vào monorepo và mở rộng Prisma: unit ranges, class exercise sequence, session delivery, batch unit anchors — **có facilityId** nơi cần RLS.

## Requirements

- Functional:
  - [ ] Package `@cmc/domain-lms` (or extend existing) with unit-progression, exercise-sequence, session-schedule, grading-scale, annotation
  - [ ] Schema models: `EnrollmentUnitRange`, exercise library (`ExerciseFolder`/`ExerciseFile` or rename to avoid clash), `ClassExerciseItem`, `SessionExercise`, batch anchors
  - [ ] Curriculum CSV seed path compatible with monorepo
  - [ ] Unit tests from cmc-lms domain ported and green
- Non-functional:
  - [ ] Migrations additive first; no destructive drop of open-tier until phase 8/9
  - [ ] RLS policies for facility-scoped new tables
  - [ ] Old `Exercise.curriculumUnitId` columns remain until cutover flag off

## Architecture

Port pure functions first (no Prisma). Then additive migrations. Feature flag `LMS_UNIT_ENGINE=v2` optional for dual-run.

Key port sources (`cmc-lms`):

- `packages/domain/src/unit-progression.ts`
- `packages/domain/src/exercise-sequence.ts`
- `packages/domain/src/session-schedule.ts`
- `packages/domain/src/grading-scale.ts`
- schema models around EnrollmentUnitRange, ClassBatch anchors, ExerciseFolder/File, ClassExerciseItem, SessionExercise

Adaptations for monorepo:

- Add `facilityId` + RLS on ClassBatch-adjacent tables if not global
- Align UUID/time conventions (`Timestamptz`)
- Map `AppUser` staff roles (teacher/admin enum vs ERP Role enum) via adapter — do not force ERP to 2-role enum globally

## Related Code Files

- Create: `packages/domain-lms/` (name TBD)
- Modify: `packages/db/prisma/schema.prisma`
- Create: migrations under `packages/db/prisma/migrations/`
- Port tests: domain `*.test.ts`

## Implementation Steps

1. Create package, copy pure domain + tests; fix imports.
2. Diff Prisma models; design additive migration with collision-safe names.
3. Seed curriculum from `CMC_EDU_Khung_Chuong_Trinh.csv` (copy into monorepo docs/scripts).
4. Add RLS SQL for new facility tables (follow ADR 0042 patterns).
5. Run package tests + prisma migrate on empty/dev DB.

## Success Criteria

- [ ] Domain unit tests green
- [ ] Migrate applies clean on fresh DB
- [ ] No production drop of ADR 0038 columns yet
- [ ] Typecheck packages green

## Risk Assessment

Name collision `Exercise` vs library files — rename carefully (`LmsExerciseFile` vs catalog). Dual meaning of “unit” (curriculum month vs session unit stamp) — document in schema comments.
