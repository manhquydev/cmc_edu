---
phase: 5
title: "PR4 CRM opportunity list orderBy"
status: completed
priority: P1
effort: "1-1.5d"
dependencies: [3]
---

# Phase 5: PR4 — CRM opportunityList orderBy + table sort

<!-- Updated: Red Team R1 — frozen whitelist; id tie-breaker; no contactName; depends on Phase 3; rotting journey locator -->

## Overview

Add a **frozen whitelist** sort to `crm.opportunityList` and wire only those columns in the pipeline **table** view. Default remains `createdAt desc`. Always append stable `{ id: 'asc' }`.

## Requirements

- Functional:
  - Input (exact contract — do not “adjust during cook” without plan amend):

```ts
sort: z.object({
  field: z.enum(['createdAt', 'nextActionAt', 'stage']),
  direction: z.enum(['asc', 'desc']),
}).optional()
```

  - Prisma: `[fieldOrder, { id: 'asc' }]` always.
  - `nextActionAt` nulls: document and test explicit placement (Prisma/Postgres default OK if asserted in test).
  - **Out of whitelist:** contact/student name relation sort (no index; was falsely named `studentName`).
  - Admin **table** sortable columns (exact — do not invent a `createdAt` column):
    - `stage` → label **「Giai đoạn」** → API `field: 'stage'`
    - `nextActionAt` → label **「Việc tiếp」** → API `field: 'nextActionAt'`
  - API still accepts `createdAt` for default / explicit clients, but the table UI does **not** expose a createdAt header this PR.
  - Sort query input applies **only in table view**. Kanban continues to use default `createdAt desc` (or omit `sort`) so stage columns stay stable.
  - Lost rows: sorting by `stage` orders live stages only as today’s list already filters/includes Lost — assert current `lost` filter behavior unchanged; do not invent Lost enum ordering.
  - Before merge: fix or scope `crm-rotting.journey.ui.spec.ts` if it clicks first global “Chuyển lên” — bind to unique lead name.
- Non-functional: API tests for default, each field asc/desc, invalid field reject, tied-value pagination stability; admin sort wiring test.

## Architecture

```
opportunityListInput.sort? → whitelist map → orderBy: [primary, { id: 'asc' }]
UI DataTable sort ↔ trpc input
```

## Related Code Files

- Modify: `apps/api/src/crm/router.ts` (`opportunityListInput`, handler)
- Modify: `apps/api/src/crm/list.test.ts` (extend)
- Modify: `apps/admin/src/pages/crm/pipeline.tsx` (after PR2 stage badges — rebase)
- Modify: `apps/admin/src/pages/crm/pipeline.test.tsx`
- Possibly modify: `apps/e2e/tests/journeys/crm-rotting.journey.ui.spec.ts`
- Read: `packages/db/prisma/schema.prisma` Opportunity model

## Implementation Steps

1. Confirm Opportunity fields `createdAt`, `nextActionAt`, `stage`, `id`.
2. Add Zod + Prisma mapper with id tie-breaker; default unchanged.
3. API tests including ties + null nextActionAt.
4. Wire table sort state → query; only whitelist columns.
5. Harden rotting journey locator to named card/row.
6. PR4 stacked on PR2; CI green.

## Success Criteria

- [x] Whitelist only `createdAt|nextActionAt|stage`; unknown rejected
- [x] Every orderBy includes `{ id: 'asc' }`
- [x] No contact-name sort
- [x] Table sorts **Giai đoạn** + **Việc tiếp** end-to-end; other columns not sortable; no new createdAt column
- [x] Rotting journey not order-fragile
- [ ] API + admin + ui-e2e green

## Risk Assessment

- Offset pagination without id tie-breaker = Critical (mitigated in contract).
- Merge conflict with PR2 stage badges — depend on Phase 3; rebase carefully.
- Performance: enum/date sorts on indexed/default columns only — acceptable for P1 facility size.
