---
title: "LMS teaching spine API UI family"
description: "Plan 2/3: class engine full, enrollment ops, family auth, attendance/journal, exercise delivery, teacher/admin/family UI. Blocked by foundation spike."
status: in_progress
priority: P1
effort: "4–6 tuần"
tags: [lms, teaching, family, ui]
created: 2026-08-11
blockedBy:
  - project:260811-1117-lms-foundation-adr-va-spike-unit-range
blocks:
  - project:260811-1118-lms-erp-money-bridge-import-cutover
---

# Plan 2/3 — Teaching spine (API + UI + family)

## Depends on

**Plan 1 DONE** + ship note contracts:
- `orderGlobal` unique(program, orderGlobal)
- `EnrollmentUnitRange.facilityId` + FORCE RLS
- Procedure freeze: `enroll` reserved-only; ranges via grantUnits
- Create+stamp TX; dual-gate on rosterForSession
- Ship note: `plans/reports/ship-lms-foundation-spike.md` (after cook)

## Outcome

Daily teaching loop on monorepo without money bridge yet (admin can grant units by hand):

- Cancel session restamps units; no makeup  
- grantPast / revokeFromNext / archive  
- Family phone+password multi-child  
- Attendance window + journal + photoConsent  
- Exercise library + 1 delivery/session end + grade/stars  
- Teacher + admin ops + family UI spines  

## Non-goals

- Receipt → auto unit grant (plan 3)  
- Import live / close cmc-lms (plan 3)  
- Gifts redesign  

## Phases

| # | Phase | Dep |
|---|-------|-----|
| 1 | Start / inventory after foundation | plan1 |
| 2 | Class engine full cancel restamp | 1 |
| 3 | Enrollment ops grant revoke archive | 2 |
| 4 | Family principal ownership sinks | 1 |
| 5 | Attendance journal photoConsent | 2,4 |
| 6 | Exercise library delivery grading | 2,3 |
| 7 | Teacher admin family UI spines | 3–6 |

## Success criteria

- [ ] Teacher can run full day on staging  
- [ ] Family can homework when entitled  
- [x] Open-tier path flag-off ready  
- [x] Server kill-switch for dual homework models  

## Progress (2026-08-11 cook)

| Phase | Status | Evidence |
|-------|--------|----------|
| 1 Start | done | Plan 1 ship + foundation commit `7d55b17` |
| 2 Class engine cancel restamp | done (API) | `cancelSessionAndRestamp` + int test |
| 3 Enrollment grant revoke archive | done (API) | grantPast / revokeFromNext / archive + int tests |
| 4 Family principal | partial | existing lms-auth ownership; isActive/tokenVersion not added |
| 5 Attendance journal photoConsent | todo | — |
| 6 Exercise library delivery | partial | open-tier kill-switch + entitlement gate only |
| 7 UI spines | todo | — |

Ship note: `plans/reports/ship-lms-teaching-spine-api-ops.md`

## Cook

Foundation spike done. This plan cooked in API slices; UI/family schema remain.

<!-- slug: lms-teaching-spine-api-ui-family -->
