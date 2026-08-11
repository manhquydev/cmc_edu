---
title: "Phase 8: Migration du lieu va dual-run"
status: todo
priority: P1
effort: "3–5d"
dependencies: [3, 4, 5]
---

# Phase 8: Data migration + dual-run

## Overview

Backfill `EnrollmentUnitRange` and class exercise sequences from existing monorepo data (and/or import from live `cmc-lms` if still authoritative ops DB). Run dual paths under feature flags until verification.

## Requirements

- Functional:
  - [ ] Script: for each active Enrollment → synthetic unit range covering current operational intent
  - [ ] Script: stamp ClassSession curriculumUnitId / anchors if missing
  - [ ] Optional: import ops data from cmc-lms backup (students/classes/submissions) if that DB is production teaching
  - [ ] Feature flags: `LMS_ENGINE=v1|v2`, `LMS_AUTH=legacy|family`
- Non-functional:
  - [ ] Dry-run + report diffs
  - [ ] Idempotent backfill
  - [ ] Rollback plan: flags off, no destructive drops until phase 9

## Architecture

Two data sources possible:

| Scenario | Action |
|---|---|
| A: Teaching already on monorepo | Backfill ranges from class program remaining units |
| B: Teaching live on cmc-lms DB | One-time import into monorepo then cutover DNS/deploy |
| C: Both dirty | Freeze one as SoT; import; stop writes on loser |

User must pick A/B/C in phase 1.

## Related Code Files

- Create: `scripts/lms-v2/backfill-unit-ranges.ts`
- Create: `scripts/lms-v2/import-from-cmc-lms.ts` (if B)
- Modify: env docs / docker-compose flags

## Implementation Steps

1. Inventory row counts both DBs.
2. Choose scenario; write dry-run importer.
3. Backfill on staging; compare roster samples.
4. Enable v2 engine on staging; keep v1 fallback.
5. Production dual-run window with monitoring.

## Success Criteria

- [ ] Dry-run report accepted
- [ ] Staging teaching day simulated OK
- [ ] Rollback tested (flag off)

## Risk Assessment

Import of stars/submissions must preserve append-only ledgers. Photo blobs need storage path remap.
