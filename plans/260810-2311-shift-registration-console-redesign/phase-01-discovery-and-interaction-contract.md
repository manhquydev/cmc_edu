---
phase: 1
title: "Discovery and interaction contract"
status: complete
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 1: Discovery and interaction contract

## Overview

Turn the legacy schedule reference into a CMC Console interaction specification
and establish the UI boundaries from the live client/server contracts before
changing markup.

## Requirements

- Functional: retain `/hr/shifts`, three existing tabs, query/mutation names,
  exact submit payload, ICT future-date rule, ticket-lock, overlap protection,
  role-gated review, anti-self-review, cancel, and reject reason behavior.
- Functional: map a selected group's returned `selectionMode` to the grid:
  one template per day for `SINGLE`; several distinct templates per day for
  `MULTIPLE`. Do not infer a mode from display role/type.
- UX: borrow only the reference's schedule-grid hierarchy—period first,
  day/shift selection second, preflight last—and express it with Console's
  warm dense page grammar, one blue primary action, and no copied branding.
- Boundary: document that current `shift.submit` has no `entryType`; do not
  design a work/leave control that cannot be persisted.

## Architecture

1. Read and reconcile `docs/20-quy-tac-nghiep-vu-van-hanh.md` §2 and
   `docs/27-workflow-spec-p3.md` WF-P3-03/04 with
   `apps/admin/src/pages/attendance/shifts.tsx` and its focused test.
2. Confirm the UI model against `apps/api/src/shift/router.ts`: `listGroups`
   supplies `selectionMode`; `submit` accepts only group/range/entries and is
   the final authority for membership, future ICT, ticket-lock, overlap, range,
   and duplicate guards.
3. Specify one local derived state model in `shifts.tsx`: selected group/range
   → visible ICT dates → selected template IDs by date → serialized entries →
   preflight. Keep helpers local unless the page proves an extraction necessary.
4. Reuse `DateField` and `ProgressSteps`; assess `console-kanban.tsx` but
   reject it as the entry surface because its fixed columns and horizontal
   overflow conflict with a 375px date × template operation.

## Related Code Files

- Read: `docs/design-system-console.md`,
  `design-system/cmc-edu/MASTER.md`,
  `docs/20-quy-tac-nghiep-vu-van-hanh.md`,
  `docs/27-workflow-spec-p3.md`.
- Read: `apps/admin/src/pages/attendance/shifts.tsx`,
  `apps/admin/src/pages/attendance/shifts.test.tsx`,
  `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`.
- Read: `packages/ui/src/components/progress-steps.tsx`,
  `packages/ui/src/console/console-kanban.tsx`.
- Later modify: `apps/admin/src/pages/attendance/shifts.tsx`,
  `apps/admin/src/pages/attendance/shifts.test.tsx`,
  `apps/admin/src/app.css`, and the named journey only.

## Success Criteria

- [x] A developer can implement the grid without guessing the authoritative
  mode, payload, validation owner, review gate, or product copy.
- [x] The interaction contract covers loading, empty, invalid, pending,
  success, error, rejected/resubmit, cancel, and approval states.
- [x] The legacy reference is explicitly constrained to layout inspiration.

## Risk Assessment

- UI-only checks must never claim to replace server validation. Keep client
  guidance preflight-only and retain the server error path.
- Existing focused and journey tests locate labels. Preserve semantic labels
  where possible; change selectors only with their tests in the same commit.
- Rollback: discard this planning phase; no runtime artifact is created.
