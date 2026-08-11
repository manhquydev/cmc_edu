---
title: "Shift Registration Console Redesign"
description: "Task-first CMC Console redesign of /hr/shifts without changing the shift server contract."
status: in-progress
priority: P1
effort: "2-3d"
tags: [attendance, hr, shift, cmc-console, ux]
created: 2026-08-10
---

# Shift Registration Console Redesign

## Overview

Redesign `/hr/shifts` from a row-by-row form into a task-first schedule grid:
choose a future ICT period and group, select daily shifts, review, and submit one primary action.

## Outcome, authority, and non-goals

Authority: `docs/20-quy-tac-nghiep-vu-van-hanh.md` §2;
`docs/27-workflow-spec-p3.md` WF-P3-03/04; `docs/design-system-console.md`;
`design-system/cmc-edu/MASTER.md`; and current UI/API tests. The legacy screenshot
supplies grid hierarchy only: this is CMC Console, not a pixel copy.

Keep route `/hr/shifts`, existing tRPC names and payloads, RLS/role gates, and
server validation authoritative. No schema/router/permission change, calendar
dependency, fake client-side approval, or unbacked `leave` field: current
`shift.submit` has no entry-type payload, so that needs separately authorized API work.

## Field and interaction map

| Surface | CMC Console interaction | Contract retained |
|---|---|---|
| Group + templates | `Selector` from `shift.listGroups`; show group, times, and plain-language single/multiple rule. | Send `shiftGroupId`; use returned `selectionMode`, never role inference. |
| Period | Two native `DateField`s; dynamic ICT-future validation, `fromDate ≤ toDate`, inclusive day list. | Send `YYYY-MM-DD`; server remains final future/range validator. |
| Schedule grid | Semantic date rows; `SINGLE` uses one radio choice/day, `MULTIPLE` uses template checkboxes and rejects duplicate pairs. | Serialize only `{ date, shiftTemplateId }[]`; preflight range limit is 366. |
| Preflight + submit | ProgressSteps orientation, compact count/range/group summary, submitted-ticket warning, one `Gửi đăng ký` primary action. | `shift.myRegistrations` informs; `shift.submit` enforces ticket-lock and overlap. |
| My registrations | Dense status table with entry count, reject reason, and confirmed cancel. | `shift.myRegistrations`, `shift.cancel`. |
| Approval inbox | Permission-gated tab; scoped pending rows, contextual approve confirm, reject dialog with visible 3-character rule. | `shift.pendingForApproval`, `approve`, `reject`; server enforces group-role and anti-self-review. |

## States, accessibility, and responsive rules

- Loading/error/empty data, invalid period, no chosen shifts, submitted ticket,
  pending/success/error, cancellation, approval, and rejection visibly recover;
  preserve entries after errors.
- Reuse Console tokens, `PageHeader`, `CmcTabs`, `FormPage`, `DateField`,
  `ProgressSteps`, `Banner`, dialogs, and status badges—not a horizontal
  `console-kanban`, which is a density reference rather than date × shift selection.
- Use labelled native date/radio/checkbox controls, focus, native keyboard
  behavior, `aria-live` results, modal focus, non-color status, 44px targets,
  and reduced-motion feedback; at 375px stack fields and day cards with no
  horizontal page overflow and a reachable primary action.

## Evidence and phases

Source: `apps/admin/src/pages/attendance/shifts.tsx`,
`packages/ui/src/components/progress-steps.tsx`, and `packages/ui/src/console/console-kanban.tsx`.
Tests: `apps/admin/src/pages/attendance/shifts.test.tsx` and
`apps/e2e/tests/journeys/shift-register-approve-reject.journey.ui.spec.ts`.

| # | Phase | Status |
|---|---|---|
| 1 | [Discovery and interaction contract](./phase-01-discovery-and-interaction-contract.md) | Complete |
| 2 | [Schedule-grid UI implementation](./phase-02-schedule-grid-ui-implementation.md) | Complete |
| 3 | [Proof and regression validation](./phase-03-proof-and-regression-validation.md) | In progress |

## Progress and documentation decision

The redesigned submit surface, focused component coverage, TypeScript checks,
production build, lint, role guard, diff check, and Playwright journey
collection are complete. The real browser lifecycle and required CI remain
open because this isolated checkout has no disposable PostgreSQL configuration.

No evergreen documentation changes are needed: the route, terms, workflow,
authorization, and API contract are unchanged. This plan and its research and
validation reports are the durable record of the UI implementation.

## Validation, risks, rollback

Run focused admin tests, admin typecheck/build, lint/a11y role guard, targeted
Playwright journey, `git diff --check`, then required CI
`typecheck-and-test` and `ui-e2e`; run `pnpm acceptance:report` only against
its current CI artifact before stating acceptance numbers.

Main risks are accidental payload/label regressions, client rule drift,
selection loss, and a wide grid at 375px. Mitigate with state-derived entries,
server-error recovery, byte-preserving contract tests, and viewport proof.
Rollback is one UI/CSS/test revert: no stored data or API migration exists.

<!-- slug: shift-registration-console-redesign -->
