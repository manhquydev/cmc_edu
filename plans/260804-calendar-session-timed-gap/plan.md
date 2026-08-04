---
title: "Calendar ClassSession timed events gap"
description: "Feed FullCalendar timeGrid with real ClassSession start/end (listInRange + adapter), not only classBatch all-day periods."
status: completed
priority: P2
branch: "feat/business-verify-correctness-tier"
tags: [calendar, class-session, fullcalendar, soft-ops]
blockedBy: []
blocks: []
created: "2026-08-04T04:27:29.739Z"
createdBy: "ck:plan"
source: skill
---

# Calendar ClassSession timed events gap

## Overview

**Problem:** Schedule calendar (FullCalendar timeGrid/dayGrid) only shows **classBatch all-day** ranges. Teachers cannot see real lesson blocks. Schema already stores `ClassSession.startTime`/`endTime` (ICT timestamptz); API only exposes `classSession.list({ classBatchId })`.

**Outcome:** Week/month calendar views load **timed ClassSession** events via a facility-scoped `listInRange` query; event click deep-links to attendance with both `classBatch` and `session`.

**Direction (locked from brainstorm/advise):** Option B — one `classSession.listInRange` procedure + `classSessionToEvents` adapter. No N+1 fan-out, no drag/reschedule, no premium Scheduler, no Soft Ops re-skin of FC chrome.

**Non-goals**

- Drag-drop reschedule / editable events
- Resource timeline / rooms as resources
- N+1 `list` per batch from the client
- Replacing list/kanban Soft Ops views (they stay batch-oriented)

## Success criteria (plan-level)

- [x] `classSession.listInRange({ from, to, courseId?, includeCancelled? })` returns sessions + batch denorm, gated on `class.read`
- [x] `classSessionToEvents` produces timed (`allDay: false`) EventInput with `?classBatch=&session=` href
- [x] Schedule week/month views load range from FC `datesSet` (sensible default ± ~2 months)
- [x] Cancelled sessions excluded by default
- [x] Targeted API + adapter tests green; schedule honesty callout updated

## Phases

| Phase | Name | Status | Effort |
|-------|------|--------|--------|
| 1 | [API listInRange](./phase-01-api-listinrange.md) | Completed | S |
| 2 | [Session FC adapter](./phase-02-session-fc-adapter.md) | Completed | S |
| 3 | [Wire schedule UI](./phase-03-wire-schedule-ui.md) | Completed | M |
| 4 | [Tests and docs](./phase-04-tests-and-docs.md) | Completed | S |

## Dependencies

- FullCalendar Soft Ops shell already in place (`SoftOpsFullCalendar`, `schedule-fc-events.ts` batch adapter).
- Index `@@index([facilityId, sessionDate])` on `ClassSession` — no migration.
- Attendance already accepts `?classBatch=` + `?session=`.

## Evidence / prior work

- Scout + advise: [reports/brainstorm-research-advise-2026-08-04.md](./reports/brainstorm-research-advise-2026-08-04.md)
- Red-team: [reports/red-team-2026-08-04.md](./reports/red-team-2026-08-04.md)
- Validate: [reports/validate-2026-08-04.md](./reports/validate-2026-08-04.md)

## Risks

| Risk | Mitigation |
|------|------------|
| Empty calendar when no sessions generated | Callout honesty; list/kanban still show batches |
| `datesSet` refetch thrash | Compare from/to strings before setState |
| Huge range DoS | Cap range span (120 days) server-side |
| TZ display wrong | Emit ISO from timestamptz; FC `timeZone` local/browser |

## Rollback

Revert API procedure + UI wire; batch all-day path remains as fallback if needed.
