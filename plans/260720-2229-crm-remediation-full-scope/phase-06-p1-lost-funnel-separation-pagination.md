---
phase: 6
title: "P1 Lost funnel separation + pagination"
status: done
priority: P2
dependencies: [3]
effort: "3-4h"
---

# Phase 6: P1 Lost funnel separation + pagination

> Rescoped after red-team 2026-07-20: the backend contract changes (`lost` filter with default `exclude`, `stageCounts`/`lostCount` in the `opportunityList` response — NO separate pipelineStats procedure) moved into phase 3's single consolidated backend edit. This phase is **UI-only consumption** plus the enroll-picker explicit param.

## Overview
Findings F7 (HIGH) + F11 (pagination). Lost cards currently sit in their stage columns and inflate funnel/byStage counts (client-side count over all items, `apps/admin/src/pages/crm/pipeline.tsx:140-144`); pipeline hard-caps at 100 rows silently (:98). Make the funnel show live-pipeline truth from server aggregates and expose real pagination.

## Requirements
- Funnel + column counts consume `stageCounts`/`lostCount` from the `opportunityList` response (phase 3 contract) — accurate regardless of page; delete the client-side byStage computation.
- Filter control: Đang chăm sóc (default → `lost:'exclude'`) / Tất cả (`'include'`) / Đã mất (`'only'`).
- Pagination controls (page/pageSize, prev/next + total; reuse an existing `@cmc/ui` pagination composite if present, else minimal controls) replacing the hard `pageSize:100`.
- Lost cards visible only under Tất cả/Đã mất, visually distinct (existing badge), with reopen action (phase 3).
- `enroll-picker.tsx` passes explicit `lost:'exclude'` (it already client-filters closed — `apps/admin/src/lib/enroll-picker.tsx:19`; make it server-side and explicit).
- Optimistic-update caches keyed by the full query input (search/lost/page) — phase 3's cache pattern extended once here, not rewritten (red-team churn note: implement phases 3 → 6 back-to-back, same implementer).

## Related Code Files
- Modify: `apps/admin/src/pages/crm/pipeline.tsx`, `pipeline.test.tsx`
- Modify: `apps/admin/src/lib/enroll-picker.tsx`

## Implementation Steps
1. Component tests first: funnel numbers sourced from response aggregates (mock 101+ items scenario); filter toggle switches datasets; lost hidden by default; pagination renders/advances.
2. Implement UI; delete client byStage; wire filter + pagination params.
3. `pnpm -F @cmc/admin test` + typecheck + lint; `gitnexus_detect_changes`.

## Success Criteria
- [ ] Creating a 101st opportunity changes funnel counts without scrolling/paging (server aggregate).
- [ ] Default pipeline shows zero lost cards; lost reachable via filter with reopen.
- [ ] Lost-at-O3 opp: absent from O3 count, present in lostCount.
- [ ] No client-side stage counting remains (grep pipeline.tsx).

## Risk Assessment
- **Risk**: aggregate + page items in one response could get heavy — bounded: counts are groupBy over facility-scoped Opportunity (small table, 1 facility).
- **Risk**: filter/pagination state combinatorics in cache keys — covered by keying on full input object (tRPC default).
- **Rollback**: UI-only; revert safe.
