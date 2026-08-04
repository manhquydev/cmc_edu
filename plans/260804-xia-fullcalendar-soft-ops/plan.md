---
title: Xia FullCalendar B-lite Soft Ops calendar
description: >-
  Install FullCalendar React plugins; Soft Ops CSS bridge; SessionCard
  eventContent; wire teaching/schedule week+month; editable false; batch-all-day
  v1 or session feed when ready.
status: completed
priority: P1
branch: develop
tags:
  - xia
  - fullcalendar
  - soft-ops
  - calendar
  - teaching
blockedBy: []
blocks: []
created: '2026-08-04T03:12:37.402Z'
createdBy: 'ck:plan'
source: skill
---

# Xia FullCalendar B-lite Soft Ops calendar

## Overview

**Approved mode:** B-lite (user 2026-08-04) — **npm FullCalendar** for UI fidelity (“y hệt” views/toolbar), **Soft Ops skin**, **no monorepo vendor**, **editable: false**.

**Source:** fullcalendar/fullcalendar (MIT) via published packages, not git tree in repo.  
**Local seam:** `apps/admin/src/pages/teaching/schedule.tsx` + `@cmc/ui` SessionCard.  
**Recon:** `reports/xia-fullcalendar-recon-challenge-2026-08-04.md`

### Goals

1. Month **dayGrid** + week **timeGrid** (and optional list) match FullCalendar interaction chrome.  
2. Visual: warm canvas, brand blue, radius 12/16 via Soft Ops CSS bridge.  
3. Events render Soft Ops density (SessionCard compact or themed FC event).  
4. Keep ListPage + FilterBar + Soft Ops list/kanban views.  
5. No drag/reschedule v1.

### Non-goals

- Vendor FullCalendar monorepo into packages/  
- Resource timeline / premium plugins  
- LMS calendar  
- editable drag until reschedule API  
- Re-skin whole Soft Ops to FC default theme  
- Replace SessionCard design language with FC default chips only  

### Risk

| Risk | Mitigation |
|------|------------|
| Batch grain ≠ hour sessions | Phase 1: honest all-day batch events **or** session-range when API exists |
| Second visual system | Soft Ops CSS overrides under `.ck-fc` wrapper only |
| Bundle size | Load FC only on schedule route (lazy already) |
| Doctrine “no heavy calendar” | Document B-lite exception + pin versions |

## Phases

| Phase | Name | Status | Pri |
|-------|------|--------|-----|
| 1 | [Data event adapter](./phase-01-data-event-adapter.md) | Pending | Completed |
| 2 | [Deps and SoftOps FC bridge](./phase-02-deps-and-softops-fc-bridge.md) | Pending | Completed |
| 3 | [Wire teaching schedule](./phase-03-wire-teaching-schedule.md) | Pending | Completed |
| 4 | [Tests and design-lab](./phase-04-tests-and-design-lab.md) | Pending | Completed |

## Decision lock (from challenge)

| Item | Choice |
|------|--------|
| Delivery | `@fullcalendar/react` + core + daygrid + timegrid + list + interaction |
| Theme | Soft Ops bridge CSS, not classic FC purple defaults as SoT |
| Event UI | SessionCard compact via `eventContent` where feasible |
| Drag | **off** |
| WeekSchedule | Keep as optional Soft Ops “board” subview **or** replace week with timeGrid — prefer **replace calendar+week with FC**, retain `list` + `kanban` |
| Data v1 | classBatch → all-day events with clear title; document limit |

## Cook handoff

```text
/ak:cook plans/260804-xia-fullcalendar-soft-ops/plan.md --auto
```

## Rollback

- Remove FC deps + SoftOpsFullCalendar  
- Restore schedule.tsx WeekSchedule/ScheduleMonth branches  
- Keep SessionCard unchanged  

## Success metrics

- [x] Schedule views week/month use FullCalendar chrome  
- [x] Soft Ops brand/canvas on FC chrome (CSS bridge `.ck-fc`)  
- [x] eventClick navigates attendance deep-link  
- [x] editable false  
- [x] Unit tests for event adapter (6)  
- [x] Scoped schedule tests green (7)  
- [x] No dual-title/bulk regression (`pnpm check:ui-frames`)  

Cook report: `reports/cook-complete-2026-08-04.md`
