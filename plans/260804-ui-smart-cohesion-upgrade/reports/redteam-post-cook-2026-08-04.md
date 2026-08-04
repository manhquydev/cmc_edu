# Red team after cook — UI smart cohesion (2026-08-04)

## Cycle
Cook cycle 1: list bulk+pager depth · cockpit generic empty CTA · dual-title permission path · check-ui-frames script · inventory honesty.

## P0 / P1 checklist

| ID | Issue | Status | Evidence |
|----|--------|--------|----------|
| R1 | Inventory ⌘K miss | **PASS** | inventory row ok (prior + this cycle) |
| R2 | Explore ≠ SoT | **PASS** | styles section banner + upgrade Option B |
| R3 | Mock ≠ product | **DEFER P2** | skins still mock; production Soft Ops unchanged (non-goal re-skin) |
| R4 | Lab bloat | **DEFER P2** | no new skins; no LOC cap automated |
| R5 | No enforcement | **PASS partial** | `scripts/check-ui-frames.mjs` + node:test |
| R6 | Over-green inventory | **PASS** | bulk ok; settings/dark still honest partial/miss |
| Dual title success paths | Entity details | **PASS** | `check-ui-frames` dualTitleReview = **0**; loading/deny paths breadcrumbs-only |
| Bulk depth ≥5 | Smart ops | **PASS** | **8** lists: receipts, students, classes, users, facilities, aftersale, exercises, gifts |

## Scores (post-cook)

| Dimension | Before | After |
|-----------|--------|-------|
| Lab honesty | 2 | 3.5 |
| Enforceability | 2 | 3 |
| Bulk/smart ops | 2 | 4 |
| Frame grammar | 4 | 4 |
| Overall product cohesion | 2.5 | **3.7** |

## Verdict
**P0/P1 clear for Option B cook.** Remaining SettingsShell multi-screen rollout and optional CI wire of check-ui-frames are **deferred** (P2) with rationale: not required for ≥5 bulk metric or dual-title identity on entity routes.

## Stop condition
Met: bulkListsOk ≥5 · dual-title entity success recipes · SoT banners · red-team P0 fixed or deferred with rationale.
