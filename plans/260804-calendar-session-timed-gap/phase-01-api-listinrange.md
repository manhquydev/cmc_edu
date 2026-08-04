---
phase: 1
title: "API listInRange"
status: completed
priority: P1
effort: "2h"
dependencies: []
---

# Phase 1: API listInRange

## Overview

Add `classSession.listInRange` so the calendar can fetch all facility sessions in a date window with batch denormalization in one query.

## Requirements

- Functional: `from`/`to` as `YYYY-MM-DD` (ICT calendar days, inclusive); optional `courseId`; optional `includeCancelled` (default false).
- Permission: `class.read` (same as `list`).
- Facility-scoped via `withFacility` + `facilityId` on where.
- Cap range span at 120 days (BAD_REQUEST if larger or from > to).
- Return sessions ordered by `startTime` asc with batch fields needed for titles/href.

## Architecture

```
UI datesSet → listInRange({from,to}) → Prisma findMany
  where: facilityId, sessionDate in [ict midnight from .. to],
         status not cancelled (unless includeCancelled),
         optional classBatch.courseId
  include: classBatch { code, program, teacherId, courseId, status }
```

Filter on `sessionDate` (ICT midnight) using `ictToUtc(date, '00:00')` bounds — matches index `[facilityId, sessionDate]`.

## Related Code Files

- Modify: `apps/api/src/class/class-session-router.ts`
- Create: `apps/api/src/class/list-in-range.test.ts` (or extend existing session tests)

## Implementation Steps

1. Add Zod input: `from`, `to` dateOnly; optional `courseId` uuid; `includeCancelled` bool default false; refine from ≤ to and span ≤ 120 days.
2. Add DTO type `ClassSessionInRangeDto` extending session fields + batch denorm.
3. Implement query with `requirePermission('class', 'read')`.
4. Map rows to DTO (startTime/endTime as Date → JSON ISO on wire).

## Success Criteria

- [ ] Procedure registered on `classSession` router
- [ ] Returns only same-facility sessions
- [ ] Excludes cancelled by default
- [ ] Rejects inverted / oversized range
- [ ] Test coverage for happy path + bounds + cancel filter

## Risk Assessment

Low. Read-only. Index already exists. No schema change.
