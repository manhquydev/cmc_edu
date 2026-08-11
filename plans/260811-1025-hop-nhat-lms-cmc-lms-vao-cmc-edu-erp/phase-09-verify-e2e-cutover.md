---
title: "Phase 9: Verify e2e cutover"
status: todo
priority: P1
effort: "2–3d"
dependencies: [6, 7, 8]
---

# Phase 9: Verify + e2e cutover

## Overview

Chứng minh end-to-end ERP↔LMS spine và teaching/family loops; cắt cờ dual-run; cập nhật docs/acceptance; decommission `cmc-lms` as ops system of record.

## Requirements

- Functional journeys:
  - [ ] CRM → receipt approve → parent family login → child sees class
  - [ ] Admin create class + enroll units (ops path)
  - [ ] Teacher: mark attendance → publish journal → grade homework
  - [ ] Auto delivery after session end (or test clock)
  - [ ] Student/family submit → stars
  - [ ] Expiring units warning visible
- Gates:
  - [ ] `typecheck-and-test` green
  - [ ] `ui-e2e` green
  - [ ] `pnpm acceptance:report` re-measured; document snapshot date
- Docs:
  - [ ] system-architecture LMS section rewritten
  - [ ] ADR 0038 superseded; 0041 amended
  - [ ] Runbook cutover + rollback

## Implementation Steps

1. Add/adjust e2e journeys for new spine.
2. Turn off v1 exercise open-tier + legacy auth.
3. Remove dead code paths after monitoring window.
4. Tag release; archive cmc-lms as read-only reference (or submodule freeze).
5. Journal + ship report under `plans/reports/`.

## Success Criteria

- [ ] All Wave 1 acceptance checkboxes in plan.md checked
- [ ] No critical open incidents after 48h dual-off
- [ ] cmc-lms no longer required for daily ops

## Risk Assessment

E2E flakiness on time-based unit/exercise delivery — pin clocks in tests like cmc-lms `LMS_TEST_TODAY`.
