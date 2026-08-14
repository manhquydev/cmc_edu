---
phase: 4
title: "CRM list + pipeline grammar (single PR)"
status: pending
priority: P1
effort: "1-2d"
dependencies: [3]
---

# Phase 4: CRM list + pipeline grammar (single PR)

## Overview

One CRM PR covering list DataTable path, aftersale list, detail badges, and pipeline kanban chrome/grammar. **Do not** parallelize list vs kanban — both own `pipeline.tsx`.

<!-- Updated: Red Team Round 1 — merge former phases 4+5; drop inventing sort/done/bulk-widen -->

## Requirements

- Functional:
  - Pipeline list + aftersale empties:
    - Use `TableEmptySpec` **only** when the kind is evidenced (`first-run` or `filtered`).
    - Emit `filtered` only with evidence: active filters **and** unfiltered baseline `total>0` (or equivalent). Kanban column copy already uses `facilityCount` / `filtersActive` (`pipeline.tsx:531-539`) — **preserve**; do not rewrite that matrix.
    - If kind is unknown → pass a **bare string** `empty` (neutral). Do **not** invent a fourth kind; do **not** force `TableEmptySpec.kind` when under-claiming. No `done` for CRM.
  - Kanban: gap-audit only; keep existing empty tests green; never set `ListPage.isEmpty`.
  - **Badge/category under-claim (RT2):** Do **not** invent CRM `source`→`a|b|c|d` or waiting→`brand` maps in cook. Adopt `StatusBadge`/`CategoryChip` on CRM **only** where this plan (or a linked map in BRIDGE) documents the mapping. Otherwise leave existing `Badge`/due chips; prove `CategoryChip` on courses `program` in Phase 6.
- Non-functional:
  - **No sortable columns** until CRM list APIs accept validated sort fields (`opportunityList` / after-sale list currently `orderBy: { createdAt: 'desc' }` only).
  - **No `onSelectAllMatching`** unless backend can materialize all matching IDs; page-only selection messaging only.
  - No lab DnD; no StageFunnel/statusbar geometry changes.
  - Clamp/reset page when `items=[]` but `total>0` before choosing empty kind.

## Related Code Files

- Modify: `apps/admin/src/pages/crm/pipeline.tsx`, `pipeline.test.tsx`
- Modify: `apps/admin/src/pages/crm/aftersale.tsx` (+ tests if present)
- Modify: `apps/admin/src/pages/crm/opportunity-detail.tsx`, `aftersale-detail.tsx` (badge hygiene)
- Read: `apps/admin/src/pages/finance/receipt-list.tsx` (pattern — but **do not** copy its bulk-widen callback until ID materialization exists)
- Read: `apps/api/src/crm/router.ts` (no sort input today)

## Implementation Steps

1. Gap-audit kanban empties vs `pipeline.test.tsx:226-305` — do not reimplement what already passes.
2. List path: replace string empties with first-run/filtered under evidence rules; add tests for filter on/off **and** `items=[] && total>0` page clamp.
3. Aftersale: same empty rules; fetch or derive baseline when filters active if cheap; else neutral copy.
4. Badge/category: skip CRM invent-maps; optional detail StatusBadge only for keys already in `STATUS_SOFT` (+ `brand` when product status string exists).
5. Tests: board-empty stay inside ListPage; FunnelBar + stages; never `isEmpty`; page-clamp; neutral string empty path when under-claiming.
6. Reject DnD / sort UI / invented category maps.

## Todo

- [x] Gap audit kanban (no duplicate)
- [x] List + aftersale empty evidence rules + tests (incl. neutral string fallback)
- [x] Page-clamp empty tests
- [x] isEmpty-invariant tests
- [x] No invented source→category map

## Success Criteria

- [x] Existing kanban empty tests still green; new list empty tests green
- [x] Diff does not add `sortable: true` or `onSelectAllMatching` without API support
- [x] Pipeline never uses `ListPage.isEmpty`

## Risk Assessment

Wrong empty kind = highest product risk. Prefer under-claiming (neutral empty) over lying “filtered” or “done”.
