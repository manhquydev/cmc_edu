---
phase: 4
title: "ListPagination top lists"
status: pending
priority: P1
effort: "4h"
dependencies: [3]
---

# Phase 4: ListPagination top lists

## Overview

Wire ListPagination via `controlFooter` on high-traffic lists that already page server-side or can page client-side.

## Target pages (min 5)

1. `admin/users.tsx` (if paged)
2. `classes/index.tsx` (client or server)
3. `crm/aftersale.tsx`
4. `engagement/gifts.tsx` or rewards
5. `finance/reconciliation.tsx` if table list
6. Keep `receipt-list` (already done)

If a page has no total/page API, client-slice pageSize 20 is acceptable.

## Related Code Files

- Modify only listed page files + tests
- Do not change packages/ui

## Success Criteria

- [x] ≥5 production lists use ListPagination
- [x] Touched tests pass or updated
