---
title: "Phase 5: API teaching va family portal"
status: todo
priority: P1
effort: "5–8d"
dependencies: [4]
---

# Phase 5: API teaching + family portal

## Overview

Port tRPC routers/services từ `cmc-lms` (classBatch, enrollment unit ops, exercise library/delivery, attendance, sessionEvidence, submission, family reads) vào `apps/api`, gắn guards ERP staff RBAC + family principal.

## Requirements

- Functional:
  - [ ] Class create/list/detail/sessions/setCurrentUnit/realignHistory/close/discard/slots
  - [ ] Enrollment addWithUnits/grantPast/revoke/archive/expiring/rosterForSession
  - [ ] Exercise library + sequence + delivery job
  - [ ] Attendance mark + monthly report
  - [ ] Session evidence draft/publish + family list
  - [ ] Submission save/submit/grade/publish + stars
  - [ ] Family-facing: myClasses, attendanceForChild, journals, exercises
- Non-functional:
  - [ ] Staff calls use existing `staffProcedure` + `can()` mapping
  - [ ] Family calls use new/adapted LMS principal
  - [ ] Integration tests ported from cmc-lms `test:int`
  - [ ] Cron: session materialization + exercise delivery (single-instance lock if multi-worker)

## Architecture

Prefer **port modules under** `apps/api/src/lms-ops/` (or fold into existing folders carefully) rather than big-bang rename of all ERP routers.

Guards:

| Principal | Access |
|---|---|
| Staff teacher | own sessions / classes teaching |
| Staff admin LMS (mapped roles) | all LMS ops |
| Family | children via Guardian ownership |
| Super admin | full |

Deprecation path:

- Keep old `exercise.openForStudent` behind flag until UI cutover
- New family procedures shadow old parent/student splits

## Related Code Files

Port from `cmc-lms/apps/api/src/routers/*` + `services/*`:

- class-batch, enrollment, exercise, attendance, session-evidence, submission, student, parent, curriculum, rewards(star)

Modify monorepo:

- `apps/api/src/router.ts` mount map
- `apps/api/src/trpc.ts` family principal
- worker/cron entrypoints

## Implementation Steps

1. Scaffold family principal + ownership helpers (adapt `principalOwnsStudent`).
2. Port domain-dependent services (session generator, batch unit, exercise delivery).
3. Port routers one domain at a time with integration tests.
4. Wire cron in worker process used by monorepo deploy.
5. Leave ERP CRM/finance/HR routers untouched.

## Success Criteria

- [ ] Integration suite for unit/enroll/exercise/attendance green
- [ ] Old ERP finance/CRM tests still green
- [ ] Feature flag can switch student homework source (old open-tier vs new delivery)

## Risk Assessment

Router name collisions (`enrollment.*` exists). Use versioned sub-routers or carefully extend semantics with tests for both reserved/active ERP and unit-range LMS.
