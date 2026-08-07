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

## CI follow-up (2026-08-07) — **green**

| Check | Status | HEAD |
|-------|--------|------|
| typecheck-and-test | **pass** | `fdc2c93` |
| ui-e2e | **pass** | `fdc2c93` |

Earlier fail on `c4f403e` (run 31137446299): 2 journeys stale vs FilterBar API. Fixed in `fdc2c93`.

### Root cause (ui-e2e, fixed)

1. **ADM-04** (`audit-log-view`): journey clicked `getByRole('button', { name: 'Lọc' })` — FilterBar text filters debounce 300ms and re-query; no submit button.
2. **P1-06** (`parent-link-approve-reject`): `selectLinkFilter` used combobox name `Lọc theo trạng thái` — page label is now `Trạng thái` (same as KPI inbox pattern).

## Remaining follow-ups (non-blocking)

- Optional UI debounce unit tests for FilterBar hosts
- Acceptance re-measure (`pnpm acceptance:report`) if needed for snapshot docs
- PR #75 ready for human merge review when desired

## Related

- PM: `plans/reports/pm-260807-0841-filterbar-search-ship.md`
- Design authority: `docs/design-system-odoo.md`
- Pre-ship baseline: `plans/reports/orchestrate-20260806-234049-ui-component-readiness/`

## Environment consolidation (2026-08-07 ship preflight)

| Surface | Result |
|---------|--------|
| Branch | `develop` @ `3ee2952` clean, = `origin/develop` |
| Worktrees | 1 (primary only) |
| vs `main` | **15** commits ahead, **0** behind |
| PR | [#75](https://github.com/manhquydev/cmc_edu/pull/75) `develop` → `main` (OPEN, MERGEABLE) |
| `feat/ui-copy-standard` | Stale; not merged (would regress FilterBar wave) |
| `jules/integration-smoke` | Cherry-picked `plans/jules/integration-smoke.md` |
| Stashes (2) | Left unapplied (WIP / superseded audit) |