---
phase: 3
title: "Proof and regression validation"
status: in-progress
priority: P1
effort: "0.5-1d"
dependencies: [2]
---

# Phase 3: Proof and regression validation

## Overview

Prove the redesigned flow retains its sensitive server contracts and is
operable with keyboard and a 375px viewport before relying on required CI.

## Requirements

- Unit/UI: keep the exact submit shape, future-date gate, group/template
  selection, server-success/error banners, role-gated approval tab, confirm
  gating, reject reason, cancellation, and query invalidation assertions.
- Add focused assertions for selection-mode UI semantics, preflight summary,
  submitted-ticket warning/recovery, native labels/focus, and selection
  preservation after a mutation failure.
- E2E: extend
  `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`
  only as needed to keep its real lifecycle (submit → reject → resubmit →
  approve → cancel) working with the new controls; add a 375px assertion that
  the registration surface is reachable and does not horizontally overflow.
- Treat the server suites as the proof of ticket-lock, overlap, future ICT,
  group-type review, and anti-self-review. The client proof must not duplicate
  or weaken those boundaries.

## Implementation Steps

1. Run `pnpm --filter @cmc/admin test -- src/pages/attendance/shifts.test.tsx`.
2. Run `pnpm --filter @cmc/admin typecheck` and
   `pnpm --filter @cmc/admin build`.
3. Run `pnpm lint`, `pnpm check:ui-a11y-roles`, and `git diff --check`.
4. With the required synthetic environment available, run
   `pnpm --filter @cmc/e2e test -- tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`.
5. Push the branch and require green `typecheck-and-test` and `ui-e2e`; then
   run `pnpm acceptance:report` against the current CI artifact before making
   any acceptance-count claim.

## Related Code Files

- Test: `apps/admin/src/pages/attendance/shifts.test.tsx`.
- Test: `apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`.
- Validate server behavior without changing it:
  `apps/api/src/shift/register-approve.test.ts`,
  `apps/api/src/shift/reject-validate.test.ts`, and
  `apps/api/src/shift/list-procedures.test.ts`.

## Success Criteria

- [x] Focused UI tests prove the redesigned selections serialize to the current
  `shift.submit` contract and retain visible recovery states.
- [ ] The targeted lifecycle journey succeeds through reject, resubmit,
  approval, and cancellation using the redesigned UI. The test is collected
  with the updated labels but needs disposable PostgreSQL configuration.
- [ ] Keyboard and 375px checks pass at runtime without horizontal page
  overflow or an inaccessible mutation path. The responsive source and
  assertion are present; the browser run is blocked by the same environment.
- [ ] Required CI is green; any unavailable local synthetic environment is
  reported separately rather than treated as a product failure.

## Risk Assessment

- E2E labels are deliberately exact and the lifecycle depends on ticket-lock
  order. Update selectors deliberately; never replace its real UI setup with
  direct database mutation.
- Local PostgreSQL/synthetic prerequisites can block browser proof. Preserve
  focused unit/build evidence, report the limitation, and obtain authoritative
  CI proof before completion.
- Rollback: revert the UI commit; server state and migrations are untouched.
