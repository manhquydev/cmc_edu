---
phase: 2
title: "Session FC adapter"
status: completed
priority: P1
effort: "1h"
dependencies: [1]
---

# Phase 2: Session FC adapter

## Overview

Map `listInRange` session DTOs to FullCalendar timed EventInput objects (not all-day batch periods).

## Requirements

- Functional: `allDay: false`; `start`/`end` ISO from `startTime`/`endTime`.
- Title: `{batchCode} · {program}` (fallback session id slice if missing).
- href: `/teaching/attendance?classBatch={batchId}&session={sessionId}`.
- Skip cancelled (defensive; API already filters).
- Status → `classNames` same convention as batch adapter (`ck-fc-ev--*`).
- Keep `classBatchToEvents` for any residual/background use; calendar UI will prefer timed.

## Related Code Files

- Modify: `apps/admin/src/pages/teaching/schedule-fc-events.ts`
- Modify: `apps/admin/src/pages/teaching/schedule-fc-events.test.ts`

## Implementation Steps

1. Widen `ScheduleFcEvent` so `allDay` is `boolean` (or add `ScheduleTimedFcEvent`).
2. Add `ClassSessionLike` + `classSessionToEvents`.
3. Unit tests: empty, timed ISO, href with both params, skip cancelled, status class.

## Success Criteria

- [ ] Timed events have real clock start/end
- [ ] Deep-link includes both query params
- [ ] Existing batch adapter tests still pass

## Risk Assessment

Low. Pure function, no side effects.
