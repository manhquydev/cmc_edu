---
phase: 3
title: "PR2 brand tone approval and CRM waiting"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3: PR2 — brand tone (waiting workflows) + CRM table stages

<!-- Updated: Red Team R1 — KPI submitted; exclude payroll; kanban unchanged; report-cards deferred -->

## Overview

Apply `StatusBadge` `tone="brand"` only where workflow meaning is **waiting on another human**. Do **not** change global `STATUS_SOFT['draft']`.

## Requirements

- Functional:
  - **Finance receipts** list + detail: when `status === 'draft'`, pass `tone="brand"`.
  - **HR KPI** list + detail: when `status === 'submitted'`, pass `tone="brand"` (manager waiting). Keep `draft` on default map (`neutral`) — employee still editing.
  - **Payroll: out of scope** — `draft` means editable/reopened assembly (`payroll/router.ts` reopen → draft), not an approval queue.
  - **Report cards: deferred** — keep existing waiting Banner; no StatusBadge invent. Owner list amended.
  - **Shifts / teaching exercises: unchanged.**
  - **CRM pipeline table only:** stage cell → `StatusBadge` with:
    - `O3_TEST_SCHEDULED`, `O4_TESTED` → `tone="brand"`
    - `O5_ENROLLED` → `tone="success"`
    - `O1_LEAD`, `O2_CONTACTED` → `tone="neutral"`
    - Lost → existing danger path
  - **Kanban: explicitly unchanged** this PR (no card badge work, no “don’t contradict” soft requirement).
- Non-functional: unit asserts brand class only for the exact status literals above; non-target statuses retain mapped tones.

## Architecture

```
STATUS_SOFT.draft = neutral (unchanged)
receipt: status===draft → tone="brand"
kpi: status===submitted → tone="brand"
pipeline table: mapStageTone(stage) → StatusBadge
kanban: no edits
```

## Related Code Files

- Modify: `apps/admin/src/pages/finance/receipt-list.tsx`, `receipt-detail.tsx` (+ tests)
- Modify: `apps/admin/src/pages/hr/kpi.tsx`, `kpi-detail.tsx` (+ tests)
- Modify: `apps/admin/src/pages/crm/pipeline.tsx`, `pipeline.test.tsx` (**table columns only**)
- Do **not** modify: `STATUS_SOFT['draft']`; payroll; report-cards; kanban card renderer beyond accidental shared helpers
- Read: `apps/api/src/kpi/router.ts:1–20`

## Implementation Steps

1. Receipts: `tone="brand"` iff `draft`.
2. KPI: `tone="brand"` iff `submitted`.
3. Pipeline table stage cell → StatusBadge + `mapStageTone`; leave kanban path untouched.
4. Tests for each call site; assert payroll file untouched.
5. PR2 after PR1; CI green.

## Success Criteria

- [ ] `STATUS_SOFT['draft']` still `'neutral'`
- [ ] Draft receipt → brand; submitted KPI → brand; payroll unchanged
- [ ] Pipeline **table**: O3/O4 brand, O5 success, O1/O2 neutral
- [ ] Pipeline **kanban** behavior/files for cards unchanged (diff review)
- [ ] Unit tests green; no a11y name collisions

## Risk Assessment

- Explicit `tone` overrides map — never apply to `pending` “as equivalent”.
- Column width: `size="sm"`.
- Later PR4 also edits pipeline — Phase 5 depends on this phase.
