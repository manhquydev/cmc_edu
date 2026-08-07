# Ship report — G1 FilterBar + API search

**Date:** 2026-08-07  
**Branch:** `develop` → PR #75 → `main`  
**PR:** https://github.com/manhquydev/cmc_edu/pull/75

## Pipeline

| Step | Result |
|------|--------|
| ak:test | typecheck ui/admin/api **0**; unit **125** focused admin + filter-bar **5** green |
| ak:code-review | **APPROVE_WITH_NITS** (0 critical) |
| Review nits fixed | I1 listForGrading pre-scope, I2 manager roster, I3 attendance pin, I5 parents hasClear |
| ak:ship | pushed `bd7c216` to `origin/develop`; PR #75 opened |

## Commits shipped (6)

```
bd7c216 fix(admin): address review nits on search FilterBar ship
fdf9445 feat(admin): FilterBar search on payroll and teaching ops
2faf575 feat(admin): API search for courses and classes lists
433cd2e feat(admin): API search for users and facilities lists
cbb2e9f fix(admin): validate audit log date range before query
4c78c31 fix(admin): ControlBar filter host and select semantics
```

## CI follow-up (2026-08-07)

| Check | Status |
|-------|--------|
| typecheck-and-test | **pass** (incl. `c4f403e` pickList/classBatch/listForGrading search tests) |
| ui-e2e (run 31137446299) | **fail** — 2 journeys stale vs FilterBar API |
| e2e fix commit | align ADM-04 + P1-06 with reactive FilterBar (no `Lọc` button; combobox `Trạng thái`) |

### Root cause (ui-e2e)

1. **ADM-04** (`audit-log-view`): journey clicked `getByRole('button', { name: 'Lọc' })` — FilterBar text filters debounce 300ms and re-query; no submit button.
2. **P1-06** (`parent-link-approve-reject`): `selectLinkFilter` used combobox name `Lọc theo trạng thái` — page label is now `Trạng thái` (same as KPI inbox pattern).

## Remaining follow-ups (non-blocking)

- Optional UI debounce unit tests for FilterBar hosts
- Acceptance re-measure after ui-e2e green
