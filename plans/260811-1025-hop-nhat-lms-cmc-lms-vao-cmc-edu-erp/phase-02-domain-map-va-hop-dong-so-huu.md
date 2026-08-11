---
title: "Phase 2: Domain map va hop dong so huu"
status: todo
priority: P1
effort: "1–2d"
dependencies: [1]
---

# Phase 2: Domain map & ownership contract

## Overview

Viết hợp đồng kỹ thuật: bảng ownership, map procedure `cmc-lms` → mount monorepo, map role ERP → guard LMS, supersede ADRs, catalog breaking changes.

## Requirements

- Functional:
  - [ ] Ownership matrix finalized (entity × writer × reader)
  - [ ] Procedure catalog: keep / port / delete / bridge
  - [ ] ADR draft: “LMS unit-range + exercise sequence supersedes 0038”
  - [ ] ADR draft or amendment: provisioning grants unit ranges (extends 0041)
- Non-functional:
  - [ ] No silent dual-write paths
  - [ ] Explicit facility column policy for every new LMS table

## Architecture

```text
ERP write ──► Receipt approved
                 │
                 ├─► ParentAccount / Student / Guardian / StudentAccount (identity)
                 ├─► Enrollment.active (class membership shell)
                 └─► EnrollmentUnitRange[] (sold rights)  ◄── NEW SoT for roster/homework
                          │
LMS read/write ◄──────────┴── ClassSession unit stamps, attendance, delivery cursor
```

## Related Code Files

- Create: `docs/decisions/00XX-lms-unit-range-and-exercise-sequence.md`
- Create: `docs/decisions/00XX-provisioning-grants-unit-ranges.md`
- Create: `plans/.../reports/procedure-catalog.md`
- Modify: `docs/system-architecture.md` (LMS section outline only this phase)

## Implementation Steps

1. Inventory `cmc-lms` routers vs `cmc_edu` routers (diff names + semantics).
2. For each ERP invariant (0041, RLS, multi-facility), document how LMS procedures obey it.
3. Define RBAC mapping:
   - `teacher` role → teacher procedures
   - GĐĐT / CSKH / SUPER_ADMIN → admin LMS procedures (least privilege list)
4. Define identity cutover contract for phase 7 (family vs parent+student).
5. Publish procedure catalog: e.g. `enrollment.addWithUnits` port; `exercise.openForStudent` open-tier → deprecate; `provisionFromReceipt` bridge.

## Success Criteria

- [ ] Catalog reviewed (user or self-red-team)
- [ ] ADR drafts accepted enough to guide schema
- [ ] No ambiguous “who writes EnrollmentUnitRange”

## Risk Assessment

Ambiguous ownership → dual writers race. Mitigate: only provision + enrollment admin may create ranges; finance never writes LMS domain tables directly except via provision service.
