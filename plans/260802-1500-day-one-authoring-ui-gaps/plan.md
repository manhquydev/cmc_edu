---
title: "day-one authoring ui gaps"
description: "Unblock GĐĐT day-one catalog/class authoring: course create UI, CurriculumUnit seed on local-sim, /classes redirect"
status: completed
priority: P0
effort: S
tags: [admin, curriculum, local-sim]
created: 2026-08-02
---

# day-one authoring ui gaps

## Overview

Timeline e2e proved backend enrollment/attendance works for SA-provisioned
staff, but **authoring surfaces** block pure-UI day-one ops. This plan closes
the smallest proven gaps only.

**Brainstorm:** `plans/reports/brainstorm-260802-day-one-authoring-gaps.md`  
**Research:** `plans/reports/research-260802-day-one-authoring-gaps.md`  
**Advise:** `plans/reports/advise-260802-day-one-authoring-gaps.md`  
**Scout:** explore agent report (session 260802)

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | GĐĐT creates course from `/admin/courses` UI | P0 |
| 2 | local-sim path ensures CurriculumUnit rows exist | P0 |
| 3 | `/classes` redirects to `/admin/classes` | P1 |
| 4 | Tests lock course create UI | P0 |

## Non-goals

- Sale `finance.receiptList` (SoD / ADR-B)
- CurriculumUnit admin CRUD
- CRM Ghi danh path change (already correct)
- Class form validator rewrite

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase framing](./phase-01-start.md) | Done |
| 2 | [Course create UI](./phase-02-course-create-ui.md) | Pending |
| 3 | [Curriculum seed ensure](./phase-03-curriculum-seed-ensure.md) | Pending |
| 4 | [Classes redirect](./phase-04-classes-redirect.md) | Pending |
| 5 | [Validate and tests](./phase-05-validate-and-tests.md) | Pending |

## Red-team notes (pre-cook)

| Attack | Mitigation |
|--------|------------|
| Course create opens to non-GĐĐT | Reuse PermissionGate + `course.manage`; no new API |
| Seed overwrites catalog | Idempotent count>0 skip (same as seed.mjs) |
| Redirect loops | Single Navigate replace to `/admin/classes` only |
| Scope creep sale receipts | Explicitly deferred |

## Success Criteria

- [ ] Course create dialog mutates `course.create` and invalidates list
- [ ] Unit tests for course create green
- [ ] `ensureCurriculumUnits` / local-sim path leaves ≥1 unit
- [ ] `/classes` → `/admin/classes`
- [ ] No auth roster changes

## Handoff

```bash
/ak:cook plans/260802-1500-day-one-authoring-ui-gaps/plan.md
```

<!-- slug: day-one-authoring-ui-gaps -->
