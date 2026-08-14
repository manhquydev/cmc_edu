---
phase: 6
title: "Adoption recipe and fan-out proof (courses)"
status: pending
priority: P1
effort: "0.5-1d"
dependencies: [4]
---

# Phase 6: Adoption recipe and fan-out proof (courses)

## Overview

Publish ListPage adoption recipe; prove on **preselected** page `apps/admin/src/pages/courses/index.tsx` (FilterBar `q`+`program`, ordinary list, create dialog, string empty today).

<!-- Updated: Red Team Round 1 — fixed fan-out target; Wave 4A partial language -->

## Requirements

- Functional:
  - BRIDGE “ListPage adoption recipe”.
  - Courses: apply empty rules from Phase 4. Prefer `TableEmptySpec` when evidenced; otherwise **neutral string** is success (do **not** fail the phase for lacking filtered-empty if API only returns filtered totals — `course.list` today).
  - **Prove CategoryChip** on courses `program` with an explicit map in BRIDGE (e.g. UCREA→a, BRIGHT_IG→b, BLACK_HOLE→c; no fourth program → unused `d`).
- Non-functional: No mass sweep; no Wave 4B; Wave **4A partial** only.

## Related Code Files

- Modify: `design-lab/system/BRIDGE.md`
- Modify: `apps/admin/src/pages/courses/index.tsx` (+ tests if present / add focused test)
- Optional: `DESIGN.md` pointer to recipe

## Implementation Steps

1. Recipe checklist: evidence for empty kind → no sort without API → no bulk-widen without IDs → badge vs category → page clamp → tests.
2. Apply to courses list; CategoryChip on program column/chip with documented map.
3. Empty tests: at least first-run (no filters, total 0) **or** neutral string under filters without baseline; add filtered kind **only** if baseline fetch is added cheaply — not mandatory.
4. Update BRIDGE wave table (4A partial; CRM partial; fan-out ready).
5. Stop.

## Todo

- [x] BRIDGE recipe + program→category map
- [x] courses empty (evidence-honest) + CategoryChip + test
- [x] Wave status wording

## Success Criteria

- [x] Recipe alone sufficient for another ListPage PR
- [x] CategoryChip proven on courses program with documented map
- [x] Empty copy never lies about filtered vs first-run
- [x] No claim that full Wave 4 is done

## Risk Assessment

Courses without unfiltered total when filtered → same under-claim rule as Phase 4.
