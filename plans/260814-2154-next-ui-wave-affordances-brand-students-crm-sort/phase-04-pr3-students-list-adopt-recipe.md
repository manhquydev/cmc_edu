---
phase: 4
title: "PR3 students list adopt recipe"
status: in-progress
priority: P1
effort: "0.5d"
dependencies: [2]
---

# Phase 4: PR3 — Students list empty recipe (no bulk widen)

<!-- Updated: Red Team R1 — forbid widen; forbid unverified filtered kind -->

## Overview

Adopt BRIDGE empty-state honesty on Students. **Do not** offer “select all matching” — `student.lookup` caps at `LOOKUP_LIMIT=20` with no total.

## Requirements

- Functional:
  - Empty handling:
    - Search-gated (`<2` chars): keep supporting copy / neutral — **not** `first-run` without facility-empty proof.
    - Lookup returns zero: **neutral string** (or under-claim copy). Do **not** use `kind: 'filtered'` without independent proof that students exist facility-wide.
    - If a future API returns facility existence + filter exclusion, then `filtered` is allowed — out of scope now.
  - Keep lifecycle `StatusBadge`.
  - **No** `sortable: true`.
  - **No** `totalMatching` / `onSelectAllMatching` widen. Page checkbox selection may remain if already present; do not claim completeness beyond loaded rows.
- Non-functional: page tests; unique CTA labels if any.

## Architecture

`student.lookup` → capped array (`LOOKUP_LIMIT=20`) → client slice for pager. Completeness unknown → no widen, no filtered-kind claim.

## Related Code Files

- Modify: `apps/admin/src/pages/students/index.tsx`
- Modify/create: `apps/admin/src/pages/students/index.test.tsx`
- Read: `apps/api/src/student/router.ts:44–45`, `:285–289`
- Read: `design-lab/system/BRIDGE.md:102`

## Implementation Steps

1. [x] Replace bare empty string with honest neutral / supporting copy only.
2. [x] Ensure BulkActionBar does not advertise all-matching widen.
3. [x] Tests: zero-lookup → neutral empty; no sortable; no widen button.
4. [ ] PR3; CI green.

Implemented beyond the minimum, same honesty rule: kanban view no longer shows a
blank grid on zero matches (same neutral string) and never reuses that string for
a failed lookup; a full 20-row result now says the cap was hit, so the pager's
`/ 20` is not read as a match count.

## Success Criteria

- [x] No `filtered`/`first-run` without evidence — bare string, no `data-empty-kind`
- [x] No bulk widen / “Chọn tất cả N khớp” — asserted absent with page fully selected
- [x] No sortable columns — no `aria-sort` / `.console-list-sort` in DOM
- [x] Unit tests pass — `apps/admin` 68 files / 693 tests green; typecheck + eslint clean
- [ ] CI green on PR3 (not committed by this phase run)

## Risk Assessment

- Under-claiming empty is correct; resist “pretty” filtered copy.
