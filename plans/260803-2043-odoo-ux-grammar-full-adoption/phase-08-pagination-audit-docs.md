---
phase: 8
title: "Pagination audit docs"
status: pending
priority: P1
effort: "4–6h"
dependencies: [3, 4, 5, 6, 7]
---

# Phase 8: ListPagination production + audit + docs

## Overview

Wire ListPagination on receipt-list, audit remaining product pages for frame compliance, sync stale docs, close plan gates.

## Requirements

- Functional: receipt-list uses ListPagination component in ControlBar/footer region; behavior parity with existing local pager.
- Audit: inventory all product pages; zero unintentional off-frame pages.
- Docs: update codebase-summary / design claims if they still say “21/21”; VIEW-GRAMMAR final polish.

## Related Code Files

- Modify: `finance/receipt-list.tsx`, `finance/receipt-list.test.tsx`
- Modify: design-system docs as needed; `docs/codebase-summary.md` only if it asserts template coverage
- Create: optional `plans/.../reports/adoption-audit.md` inventory table post-migration

## Implementation Steps

1. **Read first:** `ListPagination` props + current receipt-list pager state; map 1:1 before coding.
2. Replace custom pager UI on receipt-list with ListPagination.
3. Grep product pages for adoption (plan EXEMPT list). Recipe:
   ```bash
   # pages without frame imports — then subtract EXEMPT
   rg -L "ListPage|DetailPage|FormPage|DashboardPage" apps/admin/src/pages --glob '*.tsx'
   ```
4. Fix stragglers or document exemption in VIEW-GRAMMAR.
5. Run admin tests for receipt-list + smoke list of touched files.
6. Write short adoption audit report; mark plan success criteria.

## Success Criteria

- [x] receipt-list uses ListPagination
- [x] receipt-list tests pass
- [x] Audit: only intentional exemptions off-frame
- [x] Docs not claiming false 100% without inventory

## Risk Assessment

Pager off-by-one when swapping components — lock with existing tests for page changes.
