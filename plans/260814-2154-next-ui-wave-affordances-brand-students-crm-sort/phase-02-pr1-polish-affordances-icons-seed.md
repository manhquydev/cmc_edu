---
phase: 2
title: "PR1 polish affordances icons seed"
status: completed
priority: P1
effort: "1-1.5d"
dependencies: [1]
---

# Phase 2: PR1 — polish affordances + EmptyState icons + idempotent seed

<!-- Updated: Red Team R1 — idempotent seed; fixture-only select-all; honest receipt bulk; EmptyState all kinds -->

## Overview

Make shared ListPage grammar **visibly better**: sort chevron contrast, applied filter facet chip, default EmptyState icons for **all** `EmptyStateKind` values, idempotent draft-receipt seed, and remove dishonest receipt “select all matching” until IDs can actually be selected.

## Requirements

- Functional:
  - Inactive sort chevron opacity ≥ ~0.55 (active remains 1; ascending rotate kept).
  - Applied filter facets closer to lab `.chip[data-applied]` without changing `aria-label="Xóa ${label}"`.
  - `EmptyState` default LineIcon for **every** kind: `first-run`, `filtered`, `done`, `error` when `icon` omitted; override still wins. Bare-string DataTable empties stay icon-less (no fake `kind`).
  - Seed: leave exactly one identifiable draft receipt via **idempotent** path (lookup by stable demo key / reuse opp+receipt; double-run must not accumulate drafts).
  - **Receipt-list honesty:** remove `onSelectAllMatching` (or never pass it) while the callback only selects loaded `rows`. Keep page selection + clear. Toast/copy must not claim global select.
  - Automated proof of BulkActionBar widen UX: **unit fixture only** (callback that truly selects `totalMatching` IDs). **Not** a prod-sim acceptance item this wave.
- Non-functional: no CTA label substring collisions; seed double-run safe.

## Architecture

```
EmptyState(kind) → DEFAULT_ICONS[kind] → Astryx
SortHeader → console-list-sort opacity
FilterBar facet → applied tint tokens
seed: upsert/reuse fixture → 1 draft receipt
receipt-list: no onSelectAllMatching until ID endpoint exists
```

## Related Code Files

- Modify: `packages/ui/src/console.css`
- Modify: `packages/ui/src/components/empty-state.tsx` (+ tests for all 4 kinds)
- Modify: `packages/ui/src/components/bulk-action-bar.test.tsx` (widen fixture)
- Modify: `apps/admin/src/pages/finance/receipt-list.tsx` — drop dishonest widen
- Modify: `scripts/seed-local-sim-demo.ts` — idempotent draft fixture
- Read: `apps/e2e/tests/admin-shell.ui.spec.ts` — ensure seed draft does not break empty-facility assumptions (isolate facility or adjust test)

## Implementation Steps

1. Raise inactive sort SVG opacity; pin in console token / visual test if present.
2. Restyle `.console-search-facet` toward applied chip.
3. Add default icons for all four EmptyState kinds; unit tests.
4. Seed: deterministic fixture key; create-or-reuse; leave one draft; assert double-run still one draft (script comment or small node assert).
5. Receipt-list: remove `onSelectAllMatching` + stop advertising global select; keep page checkbox selection.
6. BulkActionBar unit test proves widen button when props honest.
7. Check `admin-shell.ui.spec.ts` empty finance assumption vs seed; fix isolation if needed.
8. PR1 → develop; CI green.

## Success Criteria

- [ ] Inactive sort chevron opacity ≥ ~0.55
- [ ] Applied filter facet uses action-tint styling
- [ ] EmptyState defaults icons for all four kinds; override works
- [ ] Seed double-run → still exactly one known draft receipt
- [ ] Receipt-list does not offer “Chọn tất cả N dòng khớp bộ lọc” unless N IDs selected
- [ ] BulkActionBar widen covered by unit fixture
- [ ] `typecheck-and-test` + `ui-e2e` green

## Risk Assessment

- Seed vs empty e2e facility: isolate or update journey.
- EmptyState icons layout shift: small LineIcon only.
