---
title: "Teacher Session Hub RCWS"
description: "Record-centric ClassSession hub: schedule → session detail → session-scoped ops (attendance/assessment/evidence). Long-term RCWS pattern."
status: completed
priority: P1
effort: "1–2 sessions"
tags: [teaching, session-hub, rcws, ux, odoo-grammar]
created: 2026-08-04
blockedBy: []
blocks: []
---

# Teacher Session Hub RCWS

## Overview

Make `ClassSession` the teacher day-ops work object: calendar browse → DetailPage hub → tabs for attendance / assessment / evidence, without re-picking class/session. Aligns TL06 URL grammar + VIEW-GRAMMAR DetailPage. Backend session-done semantics unchanged.

## Brainstorm contract

| Field | Value |
|-------|--------|
| Outcome | GV opens session from schedule; completes 3 session-scoped ops on one hub; progress 3/3 visible |
| Constraints | React/@cmc/ui/DetailPage; existing permissions; no session-done rule change; no OWL port |
| Non-goals | Grading/exercises in hub v1; batch admin merge; OpenEduCat port |
| Acceptance | `/teaching/sessions/:id`; calendar href; panels without re-pick; get+doneProgress; tests green |

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | `classSession.get` + `doneProgress` | P1 |
| 2 | Session DetailPage + tab panels | P1 |
| 3 | Calendar + class-detail + legacy redirects | P1 |
| 4 | Focused tests green | P1 |

## Phases

| # | Phase | Status | Depends |
|---|-------|--------|---------|
| 1 | [Scaffold / deep-link prep](./phase-01-start.md) | Pending | — |
| 2 | [API get + doneProgress](./phase-02-api-classsessionget-doneprogress.md) | Pending | 1 |
| 3 | [Session detail shell + panels](./phase-03-session-detail-shell-panels.md) | Pending | 2 |
| 4 | [Wire calendar / class-detail / redirects](./phase-04-wire-calendar-class-detail-redirects.md) | Pending | 3 |
| 5 | [Tests + review](./phase-05-tests-review-docs.md) | Pending | 4 |

## Architecture

```text
/teaching/schedule  →  /teaching/sessions/:sessionId?tab=attendance|assessment|evidence|overview
DetailPage shell + CmcTabs
  panels: AttendancePanel | AssessmentPanel | EvidencePanel (sessionId fixed)
classSession.get · classSession.doneProgress
```

## Success Criteria

- [ ] Calendar event opens session hub
- [ ] 3 ops without re-pick session
- [ ] doneProgress shown on hub
- [ ] Legacy attendance deep-link redirects/navigates to hub
- [ ] API + admin unit tests for touched surfaces pass

## References

- `plans/reports/advise-260804-session-hub-long-term-architecture.md`
- `docs/06-kien-truc-url-routing.md`
- `apps/admin/src/pages/crm/opportunity-detail.tsx`

<!-- slug: teacher-session-hub-rcws -->
