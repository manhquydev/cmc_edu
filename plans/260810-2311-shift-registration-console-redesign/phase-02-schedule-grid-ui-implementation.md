---
phase: 2
title: "Schedule-grid UI implementation"
status: complete
priority: P1
effort: "1-1.5d"
dependencies: [1]
---

# Phase 2: Schedule-grid UI implementation

## Overview

Implement the task-first registration composition and retain the self-service
ledger and role-gated approval inbox as operational Console surfaces.

## Requirements

- Functional: replace repeated “add day” rows with a group/date-driven schedule
  grid. A valid group and inclusive date range produce the selectable day rows;
  invalid/incomplete periods do not produce a misleading grid.
- Functional: `SINGLE` is one labelled radio choice (or clear) per date;
  `MULTIPLE` is labelled checkbox selection per date and template. Derive the
  existing `entries` array exactly at submission; never send UI-only fields.
- Functional: read `myRegistrations` for a preflight warning about a submitted
  ticket, but retain mutation error handling because the server may change
  between read and submit. Preserve selection on errors; clear it only on
  success or an intentional reset.
- UX: show group/range/selected-day/selected-shift summary immediately before
  one sticky/reachable `Gửi đăng ký` action. Keep secondary reset/cancel
  visually subordinate. Add contextual names/range/count to approve/cancel
  confirmation and keep reject's minimum-three-character feedback visible.
- Non-functional: use only existing CMC Console/AstryX primitives and tokens;
  no new dependency, bespoke design system, raw copied screenshot styling, or
  server-contract change.

## Architecture

1. In `SubmitTab`, replace free-text dates with `DateField`; validate future
   ICT with the existing helper and give invalid `fromDate`, ordering,
   and empty-selection errors next to their controls.
2. Extend the local group type with `selectionMode`. Build visible dates and
   selected template state from group/range; serialize late into
   `{ date, shiftTemplateId }[]` so no stale row survives a group/range change.
3. Use `ProgressSteps` as a non-deceptive orientation strip (“Chọn kỳ”, “Chọn
   ca”, “Rà soát và gửi”), not a wizard that hides the grid. Use a semantic
   table on desktop and stacked day sections at the small breakpoint.
4. Keep `MyRegistrationsTab` and `ApproveTab` contract-first: status/reason,
   confirmations, mutation pending states, result `Banner`, and relevant query
   invalidation remain. Approval tab remains absent without `canDo('shift',
   'approve')`.
5. Add only page-scoped `.shift-registration-*` styles in `apps/admin/src/app.css`
   for the grid, summary, focus, 44px targets, 375px stacking, and
   `prefers-reduced-motion`; do not change shared Console or kanban CSS.

## Related Code Files

- Modify: `apps/admin/src/pages/attendance/shifts.tsx`.
- Modify: `apps/admin/src/app.css` (page-scoped layout rules only).
- Modify: `apps/admin/src/pages/attendance/shifts.test.tsx`.
- Modify: `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`.
- Reuse unchanged: `packages/ui/src/components/progress-steps.tsx`,
  `packages/ui/src/components/date-field.tsx`,
  `packages/ui/src/console/console-kanban.tsx`.

## Success Criteria

- [x] A staff member can select a future ICT range and schedule days without
  manually adding rows; the submitted payload remains byte-identical.
- [x] SINGLE and MULTIPLE visibly and semantically prevent their respective
  duplicate selections before submission, while server errors still recover.
- [x] Submitted registration, rejection/resubmission, approval, and cancellation
  stay visible and auditable in their existing tabs.
- [x] The responsive layout stacks controls and day cards below 768px so the
  page no longer requires a horizontal grid at 375px. Runtime browser proof is
  tracked in Phase 3.

## Risk Assessment

- Changing a selected group/range can invalidate entries. Give an explicit
  reset affordance/confirmation when non-empty selections would be discarded.
- A handcrafted ARIA grid would add fragile keyboard behavior. Use native
  radio/checkbox semantics inside a visual table/list instead.
- Rollback: revert the page, scoped CSS, and matching tests together.
