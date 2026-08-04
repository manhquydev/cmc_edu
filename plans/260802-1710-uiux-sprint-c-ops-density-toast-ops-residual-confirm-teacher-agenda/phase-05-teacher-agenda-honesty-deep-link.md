---
title: "Phase 5: Teacher agenda honesty + deep-link"
status: completed
priority: P2
effort: "1.5h"
dependencies: [1]
---

# Phase 5: Teacher agenda honesty + deep-link

## Overview

Honest labeling for batch-window schedule panel + deep-link into attendance with preselected class. No new session-today API.

## Related Code Files

- Modify: `apps/admin/src/pages/cockpit.tsx` — `TodaySchedulePanel`
- Modify: `apps/admin/src/pages/teaching/attendance.tsx` — hydrate `classBatch` / `session` from search params

## Implementation Steps

1. Rename empty/title copy: e.g. "Lớp đang trong kỳ" (not "hôm nay" if no session times).
2. TaskRow href: `/teaching/attendance?classBatch={id}`.
3. Attendance: `useSearchParams` → init `classBatchId` / `sessionId` when present; keep Selector controllable.
4. Optional: when sessions load and `session` query matches, select it.

## Success Criteria

- [ ] Cockpit class row navigates with classBatch query
- [ ] Attendance preselects class from query
- [ ] Leave-guard still works when dirty
