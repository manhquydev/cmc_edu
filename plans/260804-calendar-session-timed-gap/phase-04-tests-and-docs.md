---
phase: 4
title: "Tests and docs"
status: completed
priority: P2
effort: "1h"
dependencies: [1, 2, 3]
---

# Phase 4: Tests and docs

## Overview

Prove API bounds/filters and adapter contracts; keep UI honesty text accurate. No evergreen product doc churn unless architecture claim changes.

## Requirements

- API integration test: create batch with slots → sessions → listInRange returns them in range; out-of-range excluded; cancelled excluded; oversized range rejected.
- Adapter unit tests (phase 2).
- Optional: permission smoke — giao_vien can listInRange (class.read).
- Callout / comment honesty only; no TL doc rewrite.

## Related Code Files

- Create/Modify: `apps/api/src/class/list-in-range.test.ts`
- Modify: `apps/admin/src/pages/teaching/schedule-fc-events.test.ts`
- Optional: extend `class-read-permission.test.ts` with listInRange call

## Implementation Steps

1. Write API tests using existing createTestFacility + classBatch.create pattern.
2. Run focused vitest for api + admin adapter.
3. Confirm schedule.tsx callout text.

## Success Criteria

- [ ] API tests green
- [ ] Adapter tests green
- [ ] No typecheck errors on touched packages

## Risk Assessment

Low. Test DB already supports session generation via classBatch.create.
