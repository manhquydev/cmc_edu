# F1 — CRM empty-state truthful under filters

- Date: 2026-08-13
- Branch: `fix/crm-empty-truthful` @ `412a2af`
- Base: `develop` `bc986bd` (PR #127)
- Worktree: `/home/manhquy/.herdr/worktrees/cmc_edu/fix-crm-empty-truthful`
- Scope: `apps/admin/src/pages/crm/pipeline.tsx` + `pipeline.test.tsx` only

## What changed

PR #127 fixed the **column badge** (`count={stageItems.length}`) but left the **empty-state** gated only on `facilityCount = stageCounts[stage]`. Those totals are facility-wide, always exclude lost, and ignore search / `?stage=` / page.

The empty-state now asks whether the visible set is the same domain those totals describe:

```ts
const filtersActive =
  Boolean(debouncedSearch) || lostFilter !== 'exclude' || Boolean(stageFilter);
```

- `filtersActive` → `"Không khớp bộ lọc"` (no number)
- `!filtersActive && facilityCount > 0` → `"Không có trên trang này · {N} ở giai đoạn"` (old truthful page-scope)
- `!filtersActive && facilityCount === 0` → `"Chưa có"`

Unchanged on purpose: `listInput` / router, `stageCounts` / funnel, badge (`stageItems.length`).

GitNexus: `impact(CrmPipelinePage, upstream)` = **LOW** (0 callers). `detect_changes` = **HIGH** because the whole page function is one symbol and sits on 6 flows (`IsLostOpp`, `FormatContactPhone`, `GetOwnerInitials`, `UseOpportunityActions`, two `Close` traces). That is page-level over-attribution — the hunk is a local JSX branch. Reviewer: **APPROVE**.

## Filter × empty-copy matrix (after)

| search | lost | stageFilter | facilityCount | this-page items | copy |
|---|---|---|---|---|---|
| empty | exclude (default) | off | 0 | 0 | `Chưa có` |
| empty | exclude | off | N>0 | 0 | `Không có trên trang này · N ở giai đoạn` |
| empty | exclude | off | any | >0 | cards (no empty) |
| non-empty | * | * | any | 0 | `Không khớp bộ lọc` |
| * | include | * | any | 0 | `Không khớp bộ lọc` |
| * | only | * | any | 0 | `Không khớp bộ lọc` |
| * | * | on (`?stage=`) | any | 0 | `Không khớp bộ lọc` |

`lost=include` shares the `!== 'exclude'` branch with `only`. Table `empty="Chưa có cơ hội nào"` is the same family of unfiltered language; left out of F1.

## Test evidence

Command: `pnpm --filter @cmc/admin exec vitest run src/pages/crm/pipeline.test.tsx`

### Green after fix

36/36, then 37/37 after adding the `?stage=` arm.

Required cases in `filter-aware empty-state (facilityCount is not a filtered total)`:

1. `lost=only + total>0 + empty O2 (facilityCount O2=0)` → `Không khớp bộ lọc`, not `Chưa có`, no digit
2. `search active + unmatched column` → `Không khớp bộ lọc`, not facility `2`
3. `no filter, facilityCount>0, this page 0` → `Không có trên trang này · 2 ở giai đoạn`
4. `no filter, facilityCount=0` → `Chưa có`

Extra: `?stage= URL filter + unmatched column` → same numberless copy (cockpit deep-link path).

### Red proof (must-catch)

Temporarily restored the old `facilityCount > 0 ? page-scoped N : "Chưa có"` gate. Result: **2 failed | 34 passed**.

| case | expected | received on old gate |
|---|---|---|
| (1) lost=only, O2 facilityCount=0, total>0 | `Không khớp bộ lọc` | `Chưa có` |
| (2) search "Nguyễn", O3 facilityCount=2 | `Không khớp bộ lọc` | `Không có trên trang này · 2 ở giai đoạn` |
| (3)(4) unfiltered | same as before | still green |

Then the filter-aware gate was restored. Final: **37 passed**.

### Typecheck

`pnpm typecheck` → **34/34** successful (`@cmc/db` cache hit; no `db:generate` needed).

## git diff --stat

```
 apps/admin/src/pages/crm/pipeline.test.tsx | 65 ++++++++++++++++++++++++++++++
 apps/admin/src/pages/crm/pipeline.tsx      | 10 ++++-
 2 files changed, 74 insertions(+), 1 deletion(-)
```

Commit `412a2af` `fix(crm): keep kanban empty-state truthful under filters` — local only, not pushed.

F1 DONE
