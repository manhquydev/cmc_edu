---
title: "Phase 2: Ops density ListPage"
status: completed
priority: P1
effort: "1h"
dependencies: [1]
---

# Phase 2: Ops density ListPage

## Overview

Apply existing `density="ops"` so high-traffic ops lists use tighter canvas padding (`.tpl-wrap--ops`).

## Related Code Files

- Modify: `apps/admin/src/pages/finance/receipt-list.tsx`
- Modify: `apps/admin/src/pages/finance/reconciliation.tsx`
- Modify: `apps/admin/src/pages/admin/users.tsx`
- Modify: `apps/admin/src/pages/admin/facilities.tsx`
- Modify: `apps/admin/src/pages/admin/audit-log.tsx`
- Modify: `apps/admin/src/pages/admin/network-ip.tsx`
- Modify: `apps/admin/src/pages/teaching/exercises.tsx`
- Modify: `apps/admin/src/pages/teaching/attendance.tsx`
- Modify: `apps/admin/src/pages/teaching/schedule.tsx`
- Modify: `apps/admin/src/pages/engagement/rewards.tsx`
- Modify: `apps/admin/src/pages/engagement/gifts.tsx`
- Modify: `apps/admin/src/pages/crm/aftersale.tsx`
- Modify: `apps/admin/src/pages/crm/post-sale-meeting.tsx`
- Modify: `packages/ui/src/components/list-page.test.tsx` (density class assertion)

## Implementation Steps

1. Add `density="ops"` to each ListPage above.
2. Unit test: `density="ops"` → class contains `tpl-wrap--ops`.

## Success Criteria

- [ ] ≥8 pages pass density prop
- [ ] list-page test covers ops class
