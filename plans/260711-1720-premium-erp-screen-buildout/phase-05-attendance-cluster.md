# Phase 05 — Attendance cluster

## Context links
- Parent: [plan.md](plan.md) · Prereq: [phase-00](phase-00-admin-test-harness.md)
- Exemplars: `pages/finance/receipt-create.tsx` (form flow), `pages/enrollment/class-placement.tsx`

## Overview
Two form screens (punch/manual-punch, shift submit/approve).

| Screen | Archetype | State | tRPC | Emoji |
|--------|-----------|-------|------|-------|
| `attendance/check-in-out.tsx` | form | REAL | `checkInOut.punch.useMutation`, `manualPunch.create.useMutation` | NO |
| `attendance/shifts.tsx` | form | REAL | `shift.submit/approve/cancel.useMutation` | NO |

## Key insights
- check-in-out: `Card`/`Banner`/`TextArea`/`TextInput` → `FormPage` with `ResultPanel` for punch feedback.
- shifts: uses `CmcTabs` + `ConfirmDialog` for submit/approve/cancel → `FormPage` (or DetailPage-with-tabs) keeping the three mutations + confirm gating.
- Both currently use `Banner` for result/error → migrate to `ResultPanel`/premium error nodes.

## Requirements
- Both adopt premium form archetype; all mutation payloads + confirm flows unchanged.
- Approve/cancel remain permission-gated as-is.

## Architecture / data flow
- check-in-out: punch → `checkInOut.punch.mutate` (or `manualPunch.create.mutate` for manual path) → result panel.
- shifts: submit→`shift.submit.mutate`; approve→`shift.approve.mutate` (behind ConfirmDialog); cancel→`shift.cancel.mutate`.

## Related code files
- Modify: `apps/admin/src/pages/attendance/{check-in-out,shifts}.tsx`.
- Create: co-located `*.test.tsx`.

## Implementation steps (TDD per screen)
1. check-in-out: lock both punch mutations + result/error → `FormPage` refactor → green.
2. shifts: lock submit/approve/cancel mutate args + confirm gating (tab structure) → refactor → green.
3. Phase gate.

## Todo list
- [x] check-in-out test → FormPage → green
- [x] shifts test → refactor → green
- [x] phase verify gate

## Success criteria
- Both screens premium form archetype; attendance/shift contracts unchanged.
- typecheck + build 14/14 + admin test + lint clean + `@cmc/ui` unchanged.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Two punch paths (auto vs manual) confused in refactor | Med×High | Separate tests per mutation asserting distinct payloads |
| shift approve/cancel confirm bypass | Low×High | Test that mutate fires only after ConfirmDialog confirm |

## Security considerations
Manual punch + shift approval are audit-sensitive; tests must confirm no change to who/what is submitted. Server enforces authz; no client gate removed.

## Next steps
Proceed to [phase-06](phase-06-hr-cluster.md).
