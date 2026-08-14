---
phase: 2
title: "Implement Classes empty recipe"
status: pending
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 2: Implement Classes empty recipe

<!-- Updated: Red Team R1 -->

## Overview

BRIDGE empty honesty on `classes/index.tsx`. first-run like **courses**; search-zero bare string like **students**.

## Requirements

- No debounced search + `total === 0` → `TableEmptySpec` `kind: 'first-run'` with description + action that **opens create dialog**. CTA label e.g. `Thêm lớp học đầu tiên` (must not contain `Tạo lớp`).
- Search active + zero rows → bare **string** empty. Never `kind: 'filtered'`.
- When `data.total` implies fewer pages than current `page`, clamp page (stale page after data shrink — search already resets to 1).
- No `sortable: true`. No `totalMatching` / `onSelectAllMatching`.
- Permission EmptyState unchanged.

## Tests (required)

1. `total: 0`, no search → `data-empty-kind=first-run`; CTA present; **click CTA opens create dialog**.
2. Search + `total: 0` → empty text present; **no** `data-empty-kind=filtered`.
3. Non-empty page: select-all checkbox → bulk bar visible; **no** button matching `/Chọn tất cả .* khớp/`.
4. Optional: stale page clamp if easy to fixture.

## Related Code Files

- Modify: `apps/admin/src/pages/classes/index.tsx`, `index.test.tsx`
- Read: `courses/index.tsx` first-run; `students/index.tsx` neutral search empty

## Success Criteria

- [ ] first-run kind + CTA opens dialog
- [ ] Search zero → neutral string only
- [ ] Widen absent with selection on non-empty list
- [ ] Unit tests green; CI green

## Risk Assessment

- Pre-existing header `+ Tạo lớp` vs dialog `Tạo lớp` substring collision is **out of scope** (no list e2e clicks those today).
